// src/commands/delppgroup.js
const helpers = require("../utils/helpers");

module.exports = {
  name: "delppgroup",
  description: "Delete the group profile picture",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    if (!helpers.isGroup(chat)) return sock.sendMessage(chat, { text: "❌ This command can only be used in groups." });

    const sender = m.key.participant || m.key.remoteJid;

    try {
      if (!(await helpers.isAdmin(sock, chat, sender)) && !helpers.isOwner(sender)) {
        return sock.sendMessage(chat, { text: "❌ Only admins can use this command." });
      }
      if (!(await helpers.isBotAdmin(sock, chat))) {
        return sock.sendMessage(chat, { text: "❌ Bot needs to be admin to delete the picture." });
      }

      await sock.updateProfilePicture(chat, { url: "https://i.ibb.co/0r5MZ9X/blank.png" });
      await sock.sendMessage(chat, { text: "✅ Group profile picture deleted." });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(chat, { text: "❌ Failed to delete group profile picture." });
    }
  },
};
