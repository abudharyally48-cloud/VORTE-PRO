// src/commands/mute.js
const helpers = require("../utils/helpers");

module.exports = {
  name: "mute",
  description: "Mute a user in this group for N minutes (their messages get auto-deleted). Usage: .mute @user 10",
  async execute(sock, m, args, getSettings, saveSettings) {
    const chat = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;
    if (!helpers.isGroup(chat)) return sock.sendMessage(chat, { text: "❌ This command is for groups only." });

    const isOwner = helpers.isOwner(sender) || m.key?.fromMe;
    const isAdmin = await helpers.isAdmin(sock, chat, sender);
    if (!isOwner && !isAdmin) return sock.sendMessage(chat, { text: "❌ Only group admins or my owner can use this." });

    const target = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!target) return sock.sendMessage(chat, { text: "❌ Usage: .mute @user <minutes (default 10)>" });

    const minutes = parseInt(args.find(a => /^\d+$/.test(a))) || 10;
    const botCanModerate = await helpers.isBotAdmin(sock, chat);
    if (!botCanModerate) {
      return sock.sendMessage(chat, { text: "❌ I need to be admin to enforce a mute (auto-delete their messages)." });
    }

    const settings = getSettings();
    if (!settings[chat]) settings[chat] = {};
    if (!settings[chat].mutedUsers) settings[chat].mutedUsers = {};
    settings[chat].mutedUsers[helpers.normalizeJid(target)] = Date.now() + minutes * 60 * 1000;
    saveSettings(settings);

    await sock.sendMessage(chat, { text: `🔇 @${target.split("@")[0]} is muted for ${minutes} minutes.`, mentions: [target] });
  }
};
