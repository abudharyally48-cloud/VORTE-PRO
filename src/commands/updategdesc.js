// src/commands/updategdesc.js
const { guardGroupAdmin } = require("../utils/guards");

module.exports = {
  name: "updategdesc",
  aliases: ["setgdesc"],
  description: "Change the group description (admin only). Usage: .updategdesc <text>",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    if (!(await guardGroupAdmin(sock, m, { botAdmin: true }))) return;
    const desc = args.join(" ").trim();
    if (!desc) return sock.sendMessage(chat, { text: "Usage: .updategdesc <new description>" });
    if (desc.length > 2048) return sock.sendMessage(chat, { text: "❌ Description too long (max 2048 characters)." });
    try {
      await sock.groupUpdateDescription(chat, desc);
      await sock.sendMessage(chat, { text: "✅ Group description updated." });
    } catch (err) {
      console.error("❌ updategdesc error:", err.message);
      await sock.sendMessage(chat, { text: "❌ Couldn't update the description." });
    }
  }
};
