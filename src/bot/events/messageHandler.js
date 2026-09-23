// src/bot/events/messageHandler.js
const config = require("../../config/config");
const helpers = require("../../utils/helpers");
const commandHandler = require("../handlers/commandHandler");
const openai = require("../../services/openai");
const chatStore = require("../../utils/chatStore");

// In-memory clones of what was in index.js
const lastCommand = {};
const groupWarnings = {};
const recentMessages = {}; // for antispam flood detection

const ANTIBUG_MAX_TEXT_LENGTH = 4000;
const ANTIBUG_MAX_VCARD_LENGTH = 3000;
const ANTIMENTION_MAX_MENTIONS = 15;
const ANTISPAM_WINDOW_MS = 8000;
const ANTISPAM_MAX_MESSAGES = 6;

/**
 * Delete the offending message, add a warning for the sender, and kick after 3
 * warnings if the bot has admin rights. Shared by antilink/antibug/antispam/antimention.
 */
async function warnDeleteAndMaybeKick(sock, chat, sender, m, settings, saveSettings, reasonText) {
  try {
    await sock.sendMessage(chat, { delete: m.key });
  } catch (e) {}

  if (!settings[chat]) settings[chat] = {};
  if (!settings[chat].warnings) settings[chat].warnings = {};
  const warns = (settings[chat].warnings[sender] || 0) + 1;
  settings[chat].warnings[sender] = warns;
  saveSettings(settings);

  await sock.sendMessage(chat, {
    text: `${reasonText}\n⚠️ @${sender.split("@")[0]} warning: ${warns}/3`,
    mentions: [sender]
  });

  if (warns >= 3) {
    const isBotAdmin = await helpers.isBotAdmin(sock, chat);
    if (isBotAdmin) {
      await sock.groupParticipantsUpdate(chat, [sender], "remove");
      await sock.sendMessage(chat, {
        text: `❌ @${sender.split("@")[0]} removed after 3 warnings.`,
        mentions: [sender]
      });
      delete settings[chat].warnings[sender];
      saveSettings(settings);
    }
  }
}

async function handleMessage(sock, upsert, getSettings, saveSettings) {
  const { messages, type } = upsert;
  if (type !== "notify") return;

  const m = messages[0];
  if (!m) return;

  const chat = m.key.remoteJid;
  const sender = m.key.participant || m.key.remoteJid;
  const isGroupChat = helpers.isGroup(chat);
  chatStore.trackChat(chat);
  const settings = getSettings();
  const groupSetting = settings[chat] || {};
  const globalSetting = settings.global || { mode: "public" }; // Default to public

  // Enforcement: If in "self" (private) mode, only owner can use the bot
  const isOwner = helpers.isOwner(sender) || m.key?.fromMe;
  if (globalSetting.mode === "self" && !isOwner) return;

  // Enforcement: ignore anyone on the blacklist entirely
  if (!isOwner && (globalSetting.blacklist || []).includes(sender.split("@")[0])) return;

  // Get message text
  const msgText =
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    m.message?.imageMessage?.caption ||
    m.message?.videoMessage?.caption ||
    "";

  const body = (msgText || "").trim();

  // Log incoming message to console for tracking
  if (body) {
    const senderNum = sender.split('@')[0];
    const chatNum = chat.split('@')[0];
    const context = isGroupChat ? `[Group: ${chatNum}]` : '[Private]';
    console.log(`💬  ${context} ${senderNum}: ${body}`);
  }

  // Allow self-commands: ignore fromMe ONLY if it's not a command
  if (m.key?.fromMe && !body.startsWith(config.prefix)) return;

  // Presence updates
  if (isGroupChat && groupSetting.autotyping) {
    setTimeout(() => sock.sendPresenceUpdate("composing", chat), 100);
    setTimeout(() => sock.sendPresenceUpdate("paused", chat), 2000);
  }

  // AI Auto-reply
  if (body.toLowerCase().includes("@bot") && openai.isAvailable()) {
    const query = body.replace(/@bot/gi, "").trim();
    if (query) {
      const reply = await openai.chatCompletion(query);
      if (reply) await sock.sendMessage(chat, { text: reply });
    }
    return;
  }

  // Anti-Link Moderation
  if (groupSetting.antilink && !isOwner) {
    const linkRegex = /(https?:\/\/[^\s]+)/i;
    if (linkRegex.test(body)) {
      const isAdmin = await helpers.isAdmin(sock, chat, sender);
      if (!isAdmin) {
        await sock.sendMessage(chat, { delete: m.key });
        const warns = (groupSetting.warnings?.[sender] || 0) + 1;
        
        // Update warnings in settings
        if (!settings[chat]) settings[chat] = {};
        if (!settings[chat].warnings) settings[chat].warnings = {};
        settings[chat].warnings[sender] = warns;
        saveSettings(settings);

        await sock.sendMessage(chat, {
          text: `🚫 @${sender.split("@")[0]} links are not allowed!\n⚠️ Warning: ${warns}/3`,
          mentions: [sender]
        });

        if (warns >= 3) {
          const isBotAdmin = await helpers.isBotAdmin(sock, chat);
          if (isBotAdmin) {
            await sock.groupParticipantsUpdate(chat, [sender], "remove");
            await sock.sendMessage(chat, {
              text: `❌ @${sender.split("@")[0]} removed after 3 warnings.`,
              mentions: [sender]
            });
            delete settings[chat].warnings[sender];
            saveSettings(settings);
          }
        }
        return;
      }
    }
  }

  // Anti-Bug: block known crash/malformed-payload patterns (oversized text, oversized vCards, etc.)
  if (isGroupChat && groupSetting.antibug && !isOwner) {
    const isAdminUser = await helpers.isAdmin(sock, chat, sender);
    if (!isAdminUser) {
      const vcard = m.message?.contactMessage?.vcard || "";
      const vcardArray = m.message?.contactsArrayMessage?.contacts || [];
      const totalVcardLength = vcard.length + vcardArray.reduce((sum, c) => sum + (c.vcard?.length || 0), 0);

      const isSuspicious =
        body.length > ANTIBUG_MAX_TEXT_LENGTH ||
        totalVcardLength > ANTIBUG_MAX_VCARD_LENGTH ||
        vcardArray.length > 50;

      if (isSuspicious) {
        await warnDeleteAndMaybeKick(sock, chat, sender, m, settings, saveSettings, "🛡️ Suspicious/oversized message blocked (anti-bug).");
        return;
      }
    }
  }

  // Anti-Mention: block mass-mention ("tag bombing") messages
  if (isGroupChat && groupSetting.antimention && !isOwner) {
    const isAdminUser = await helpers.isAdmin(sock, chat, sender);
    if (!isAdminUser) {
      const mentionedJid = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (mentionedJid.length > ANTIMENTION_MAX_MENTIONS) {
        await warnDeleteAndMaybeKick(sock, chat, sender, m, settings, saveSettings, "🛡️ Mass-mention message blocked (anti-mention).");
        return;
      }
    }
  }

  // Anti-Spam: flood/rate-limit protection on raw messages (separate from the command cooldown below)
  if (isGroupChat && groupSetting.antispam && !isOwner && body) {
    const isAdminUser = await helpers.isAdmin(sock, chat, sender);
    if (!isAdminUser) {
      const key = `${chat}_${sender}`;
      const now = Date.now();
      const timestamps = (recentMessages[key] || []).filter(t => now - t < ANTISPAM_WINDOW_MS);
      timestamps.push(now);
      recentMessages[key] = timestamps;

      if (timestamps.length > ANTISPAM_MAX_MESSAGES) {
        recentMessages[key] = []; // reset window after flagging, so one flood = one warning
        await warnDeleteAndMaybeKick(sock, chat, sender, m, settings, saveSettings, "🛡️ Flooding detected, message blocked (anti-spam).");
        return;
      }
    }
  }

  // Automation: Auto Status View
  if (groupSetting.autostatusview && chat.endsWith("@s.whatsapp.net")) {
    try {
      await sock.readMessages([m.key]);
    } catch (e) {}
  }

  // Automation: Auto React
  if (groupSetting.autoreact) {
    const emojis = ["❤️","😂","🤔","😅","🙂","🥺","🤒","🥹","😞","💔","🤖","😊","😁","😭","😘","🥰","🥲","🤩","😬","😝","😜","😔","😌","😋","🤬","🙄","😒","😶‍囚","😕","🤮","🥵","⭐","💥","👥","🫂","👁️","🦿","🦾"];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    try {
      await sock.sendMessage(chat, { react: { text: randomEmoji, key: m.key } });
    } catch (e) {}
  }

  // Automation: Auto Recording (for group or private)
  if (groupSetting.autorecording) {
    setTimeout(() => sock.sendPresenceUpdate("recording", chat), 100);
    setTimeout(() => sock.sendPresenceUpdate("paused", chat), 2000);
  }

  // Handle Commands
  if (body.startsWith(config.prefix)) {
    // Cooldown
    const now = Date.now();
    const cooldownKey = `${chat}_${sender}`;
    if (lastCommand[cooldownKey] && (now - lastCommand[cooldownKey]) < 1000) return;
    lastCommand[cooldownKey] = now;

    // Safemode: small human-like delay before responding
    if (globalSetting.safemode) {
      await sock.sendPresenceUpdate("composing", chat).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));
    }

    await commandHandler.handle(sock, m, body, getSettings, saveSettings);
  }
}

module.exports = { handleMessage };
