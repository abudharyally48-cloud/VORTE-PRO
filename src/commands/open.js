// src/commands/open.js
const helpers = require("../utils/helpers");

module.exports = {
  name: "open",
  description: "Open the group so all members can send messages",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    if (!helpers.isGroup(chat)) return sock.sendMessage(chat, { text: "❌ This command can only be used in groups." });

    const sender = m.key.participant || m.key.remoteJid;

    try {
      if (!(await helpers.isAdmin(sock, chat, sender)) && !helpers.isOwner(sender)) {
        return sock.sendMessage(chat, { text: "❌ Only admins can use this command." });
      }
      if (!(await helpers.isBotAdmin(sock, chat))) {
        return sock.sendMessage(chat, { text: "❌ Bot needs to be admin to change settings." });
      }

      await sock.groupSettingUpdate(chat, "not_announcement");
      await sock.sendMessage(chat, { text: "✅ Group is now open. All members can send messages." });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(chat, { text: "❌ Failed to open group." });
    }
  },
};
