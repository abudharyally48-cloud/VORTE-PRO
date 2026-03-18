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
