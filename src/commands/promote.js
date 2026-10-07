// src/commands/promote.js
const helpers = require("../utils/helpers");

module.exports = {
  name: "promote",
  description: "Promote a user to admin",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    if (!helpers.isGroup(chat)) return sock.sendMessage(chat, { text: "❌ This command can only be used in groups." });

    const sender = m.key.participant || m.key.remoteJid;
    const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    if (mentions.length === 0) return sock.sendMessage(chat, { text: "Usage: .promote @user" });

    try {
      const perms = await helpers.getPermissions(sock, m);

      if (!perms.isAdmin && !perms.isOwner) return sock.sendMessage(chat, { text: "❌ Only admins can use this command." });
      if (!perms.isBotAdmin) return sock.sendMessage(chat, { text: "❌ Bot needs to be admin to promote others." });

      await sock.groupParticipantsUpdate(chat, mentions, "promote");
      await sock.sendMessage(chat, { text: `✅ Promoted ${mentions.length} user(s)`, mentions });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(chat, { text: "❌ Failed to promote user(s)." });
    }
  },
};
