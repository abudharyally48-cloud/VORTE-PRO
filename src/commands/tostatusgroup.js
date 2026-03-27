// src/commands/tostatusgroup.js
const helpers = require("../utils/helpers");

module.exports = {
  name: "tostatusgroup",
  description: "Send a message to your own WhatsApp status",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    const body = args.join(" ");

    if (!body) return sock.sendMessage(chat, { text: "Usage: .tostatusgroup <text>" });

    try {
      // Sending to jid 'status@broadcast' with mentors of your own contacts works for some, 
      // but simpler is just sending to sock.user.id for 'My Status'
      await sock.sendMessage("status@broadcast", { text: body }, { backgroundColor: "#313335", font: 1 });
      await sock.sendMessage(chat, { text: "✅ Message posted to your status." });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(chat, { text: "❌ Failed to post status." });
    }
  },
};
