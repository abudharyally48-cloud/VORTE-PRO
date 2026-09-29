// src/commands/demote.js
const helpers = require("../utils/helpers");

module.exports = {
  name: "demote",
  description: "Demote an admin to user",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    if (!helpers.isGroup(chat)) return sock.sendMessage(chat, { text: "❌ This command can only be used in groups." });

    const sender = m.key.participant || m.key.remoteJid;
    const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    if (mentions.length === 0) return sock.sendMessage(chat, { text: "Usage: .demote @user" });

    try {
      if (!(await helpers.isAdmin(sock, chat, sender)) && !helpers.isOwner(sender)) {
        return sock.sendMessage(chat, { text: "❌ Only admins can use this command." });
      }
      if (!(await helpers.isBotAdmin(sock, chat))) {
        return sock.sendMessage(chat, { text: "❌ Bot needs to be admin to demote others." });
      }

      await sock.groupParticipantsUpdate(chat, mentions, "demote");
      await sock.sendMessage(chat, { text: `⚠️ Demoted ${mentions.length} user(s)`, mentions });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(chat, { text: "❌ Failed to demote user(s)." });
    }
  },
};
