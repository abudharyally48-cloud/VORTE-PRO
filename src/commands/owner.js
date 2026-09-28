// src/commands/owner.js
const config = require("../config/config");

module.exports = {
  name: 'owner',
  description: 'Show bot owner info',
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    const owners = config.owners.map((o, i) => `${i+1}. ${o[0]} - ${o[1]}`).join("\n");
    await sock.sendMessage(chat, { text: `👑 *Bot Owners*\n\n${owners}` });
  }
};
