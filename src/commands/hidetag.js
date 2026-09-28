// src/commands/hidetag.js
const helpers = require("../utils/helpers");

module.exports = {
  name: "hidetag",
  description: "Send a message that tags all members without showing the tags",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    if (!helpers.isGroup(chat)) return sock.sendMessage(chat, { text: "❌ This command can only be used in groups." });

    const sender = m.key.participant || m.key.remoteJid;
    const body = args.join(" ");

    if (!body) return sock.sendMessage(chat, { text: "Usage: .hidetag <message>" });

    try {
      if (!(await helpers.isAdmin(sock, chat, sender)) && !helpers.isOwner(sender)) {
        return sock.sendMessage(chat, { text: "❌ Only admins can use this command." });
      }

      const metadata = await sock.groupMetadata(chat);
      const allMembers = metadata.participants.map((p) => p.id);
      await sock.sendMessage(chat, { text: body, mentions: allMembers });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(chat, { text: "❌ Failed to send hidetag." });
    }
  },
};
