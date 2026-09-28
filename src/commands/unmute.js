// src/commands/unmute.js
const helpers = require("../utils/helpers");

module.exports = {
  name: "unmute",
  description: "Lift a mute early. Usage: .unmute @user",
  async execute(sock, m, args, getSettings, saveSettings) {
    const chat = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;
    if (!helpers.isGroup(chat)) return sock.sendMessage(chat, { text: "❌ This command is for groups only." });

    const isOwner = helpers.isOwner(sender) || m.key?.fromMe;
    const isAdmin = await helpers.isAdmin(sock, chat, sender);
    if (!isOwner && !isAdmin) return sock.sendMessage(chat, { text: "❌ Only group admins or my owner can use this." });

    const target = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!target) return sock.sendMessage(chat, { text: "❌ Usage: .unmute @user" });

    const settings = getSettings();
    if (settings[chat]?.mutedUsers) {
      delete settings[chat].mutedUsers[helpers.normalizeJid(target)];
      saveSettings(settings);
    }

    await sock.sendMessage(chat, { text: `🔊 @${target.split("@")[0]} has been unmuted.`, mentions: [target] });
  }
};
