// src/commands/setwelcome.js
const helpers = require("../utils/helpers");

module.exports = {
  name: "setwelcome",
  description: "Set a custom welcome message. Use {user} and {group} as placeholders.",
  async execute(sock, m, args, getSettings, saveSettings) {
    const chat = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;
    if (!helpers.isGroup(chat)) return sock.sendMessage(chat, { text: "❌ This command is for groups only." });

    const isOwner = helpers.isOwner(sender) || m.key?.fromMe;
    const isAdmin = await helpers.isAdmin(sock, chat, sender);
    if (!isOwner && !isAdmin) return sock.sendMessage(chat, { text: "❌ Only group admins or my owner can use this." });

    const message = args.join(" ");
    if (!message) return sock.sendMessage(chat, { text: "Usage: .setwelcome Welcome {user} to {group}!" });

    const settings = getSettings();
    if (!settings[chat]) settings[chat] = {};
    settings[chat].welcomeMessage = message;
    saveSettings(settings);

    await sock.sendMessage(chat, { text: `✅ Welcome message set. Preview:\n\n${message.replace(/\{user\}/g, "@you").replace(/\{group\}/g, "this group")}` });
  }
};
