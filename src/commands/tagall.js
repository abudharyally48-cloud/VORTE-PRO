// src/commands/tagall.js
const helpers = require("../utils/helpers");

module.exports = {
  name: 'tagall',
  aliases: ['everyone'],
  description: 'Tag everyone in the group',
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    if (!helpers.isGroup(chat)) return sock.sendMessage(chat, { text: "❌ This command can only be used in groups." });

    try {
      const metadata = await sock.groupMetadata(chat);
      const members = metadata.participants.map(u => u.id);
      
      let textTag = "📣 *Tagging Everyone*\n\n";
      members.forEach(u => {
        textTag += `@${u.split("@")[0]}\n`;
      });

      await sock.sendMessage(chat, { 
        text: textTag, 
        mentions: members 
      });
    } catch (e) {
      await sock.sendMessage(chat, { text: "❌ Failed to tag everyone." });
    }
  }
};
