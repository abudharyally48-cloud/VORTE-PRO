// src/commands/kick.js
const helpers = require("../utils/helpers");

module.exports = {
  name: "kick",
  description: "Remove a user from the group",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    if (!helpers.isGroup(chat)) return sock.sendMessage(chat, { text: "❌ This command can only be used in groups." });

    const sender = m.key.participant || m.key.remoteJid;
    const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    if (mentions.length === 0) return sock.sendMessage(chat, { text: "Usage: .kick @user" });

    try {
      if (!(await helpers.isAdmin(sock, chat, sender)) && !helpers.isOwner(sender)) {
        return sock.sendMessage(chat, { text: "❌ Only admins can use this command." });
      }
      if (!(await helpers.isBotAdmin(sock, chat))) {
        return sock.sendMessage(chat, { text: "❌ Bot needs to be admin to kick others." });
      }

      await sock.groupParticipantsUpdate(chat, mentions, "remove");
      await sock.sendMessage(chat, { text: `👢 Removed ${mentions.length} user(s)`, mentions });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(chat, { text: "❌ Failed to remove user(s)." });
    }
  },
};
