// src/commands/leave.js
const helpers = require("../utils/helpers");

module.exports = {
  name: "leave",
  description: "Make the bot leave the current group (Admin/Owner only)",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;

    if (!helpers.isGroup(chat)) {
      return sock.sendMessage(chat, { text: "❌ This command only works in groups." });
    }

    const isOwner = helpers.isOwner(sender) || m.key?.fromMe;
    const isAdmin = await helpers.isAdmin(sock, chat, sender);
    if (!isOwner && !isAdmin) {
      return sock.sendMessage(chat, { text: "❌ Only group admins or my owner can use this." });
    }

    await sock.sendMessage(chat, { text: "👋 Goodbye! Leaving this group now." });
    await sock.groupLeave(chat);
  }
};
