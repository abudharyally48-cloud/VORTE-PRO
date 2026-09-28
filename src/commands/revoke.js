// src/commands/revoke.js
const { guardGroupAdmin } = require("../utils/guards");

module.exports = {
  name: "revoke",
  aliases: ["resetlink"],
  description: "Reset (revoke) the group invite link (admin only)",
  async execute(sock, m) {
    const chat = m.key.remoteJid;
    if (!(await guardGroupAdmin(sock, m, { botAdmin: true }))) return;
    try {
      const code = await sock.groupRevokeInvite(chat);
      await sock.sendMessage(chat, { text: `✅ Invite link reset. New link:\nhttps://chat.whatsapp.com/${code}` });
    } catch (err) {
      console.error("❌ revoke error:", err.message);
      await sock.sendMessage(chat, { text: "❌ Couldn't reset the invite link." });
    }
  }
};
