// src/commands/ginfo.js
const helpers = require("../utils/helpers");

module.exports = {
  name: "ginfo",
  aliases: ["groupinfo"],
  description: "Show information about this group",
  async execute(sock, m) {
    const chat = m.key.remoteJid;
    if (!helpers.isGroup(chat)) return sock.sendMessage(chat, { text: "❌ This command is for groups only." });
    try {
      const md = await sock.groupMetadata(chat);
      const admins = md.participants.filter(p => p.admin);
      const created = md.creation ? new Date(md.creation * 1000).toDateString() : "unknown";
      const text =
        `👥 *${md.subject}*\n\n` +
        `📝 Description: ${md.desc || "(none)"}\n` +
        `👤 Members: ${md.participants.length}\n` +
        `👮 Admins: ${admins.length}\n` +
        `📅 Created: ${created}\n` +
        `🔒 Messages: ${md.announce ? "admins only" : "everyone"}\n` +
        `⚙️ Edit info: ${md.restrict ? "admins only" : "everyone"}`;
      await sock.sendMessage(chat, { text });
    } catch (err) {
      console.error("❌ ginfo error:", err.message);
      await sock.sendMessage(chat, { text: "❌ Couldn't fetch group info." });
    }
  }
};
