// src/commands/setgroupname.js
const helpers = require("../utils/helpers");

module.exports = {
  name: "setgroupname",
  description: "Change the group name",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    if (!helpers.isGroup(chat)) return sock.sendMessage(chat, { text: "❌ This command can only be used in groups." });

    const sender = m.key.participant || m.key.remoteJid;
    const newName = args.join(" ");

    if (!newName) return sock.sendMessage(chat, { text: "Usage: .setgroupname <new name>" });

    try {
      if (!(await helpers.isAdmin(sock, chat, sender)) && !helpers.isOwner(sender)) {
        return sock.sendMessage(chat, { text: "❌ Only admins can use this command." });
      }
      if (!(await helpers.isBotAdmin(sock, chat))) {
        return sock.sendMessage(chat, { text: "❌ Bot needs to be admin to change settings." });
      }

      await sock.groupUpdateSubject(chat, newName);
      await sock.sendMessage(chat, { text: `✅ Group name updated to: ${newName}` });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(chat, { text: "❌ Failed to update group name." });
    }
  },
};
