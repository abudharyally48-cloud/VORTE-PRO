// src/commands/prefix.js
const helpers = require("../utils/helpers");
const config = require("../config/config");

module.exports = {
  name: "prefix",
  description: "Set an additional custom prefix on top of the defaults (owner only)",
  async execute(sock, m, args, getSettings, saveSettings) {
    const chat = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;
    if (!helpers.isOwner(sender) && !m.key?.fromMe) return sock.sendMessage(chat, { text: "❌ Owner only command." });

    const newPrefix = args[0];
    if (!newPrefix) {
      const settings = getSettings();
      const custom = settings.global?.customPrefix;
      return sock.sendMessage(chat, {
        text: `Default prefixes: ${config.prefixes.join(" ")}${custom ? `\nCustom prefix: ${custom}` : ""}\n\nUsage: .prefix <symbol>`
      });
    }
    if (newPrefix.length !== 1) {
      return sock.sendMessage(chat, { text: "❌ Prefix must be a single character." });
    }

    const settings = getSettings();
    settings.global = settings.global || {};
    settings.global.customPrefix = newPrefix;
    saveSettings(settings);

    await sock.sendMessage(chat, { text: `✅ Custom prefix set to "${newPrefix}" (default prefixes ${config.prefixes.join(" ")} still work too).` });
  }
};
