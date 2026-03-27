// src/bot/events/messageHandler.js
const config = require("../../config/config");
const helpers = require("../../utils/helpers");
const commandHandler = require("../handlers/commandHandler");
const openai = require("../../services/openai");

// In-memory clones of what was in index.js
const lastCommand = {};
const groupWarnings = {};

async function handleMessage(sock, upsert, getSettings, saveSettings) {
  const { messages, type } = upsert;
  if (type !== "notify") return;

  const m = messages[0];
  if (!m) return;

  const chat = m.key.remoteJid;
  const sender = m.key.participant || m.key.remoteJid;
  const isGroupChat = helpers.isGroup(chat);
  const settings = getSettings();
  const groupSetting = settings[chat] || {};
  const globalSetting = settings.global || { mode: "public" }; // Default to public

  // Enforcement: If in "self" (private) mode, only owner can use the bot
  const isOwner = helpers.isOwner(sender) || m.key?.fromMe;
  if (globalSetting.mode === "self" && !isOwner) return;

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

    await commandHandler.handle(sock, m, body, getSettings, saveSettings);
  }
}

module.exports = { handleMessage };
