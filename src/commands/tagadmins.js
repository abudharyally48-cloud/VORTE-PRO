// src/commands/tagadmins.js
const helpers = require("../utils/helpers");

module.exports = {
  name: "tagadmins",
  description: "Mention all admins in the group with an optional message (Admin/Owner only)",
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

    try {
      const metadata = await sock.groupMetadata(chat);
      const admins = metadata.participants.filter(p => p.admin);
      if (admins.length === 0) {
        return sock.sendMessage(chat, { text: "ℹ️ No admins found in this group." });
      }

      const message = args.join(" ") || "📢 Attention admins!";
      const mentionText = admins.map(a => `@${a.id.split("@")[0]}`).join(" ");

      await sock.sendMessage(chat, {
        text: `${message}\n\n${mentionText}`,
        mentions: admins.map(a => a.id)
      });
    } catch (e) {
      await sock.sendMessage(chat, { text: "❌ Could not tag admins." });
    }
  }
};
