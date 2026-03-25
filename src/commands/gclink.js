// src/commands/gclink.js
const helpers = require("../utils/helpers");

module.exports = {
  name: 'gclink',
  description: 'Get group invite link',
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    if (!helpers.isGroup(chat)) return sock.sendMessage(chat, { text: "❌ Group only command." });

    try {
      const res = await sock.groupInviteCode(chat);
      const link = `https://chat.whatsapp.com/${res}`;
      await sock.sendMessage(chat, { text: `🔗 Group Link: ${link}` });
    } catch (err) {
      await sock.sendMessage(chat, { text: "❌ Failed to fetch group link. Make sure the bot is an admin." });
    }
  }
};
