// src/commands/broadcast.js
const helpers = require("../utils/helpers");

module.exports = {
  name: "broadcast",
  aliases: ["bc"],
  description: "Send a message to all chats (Owner only)",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;

    if (!helpers.isOwner(sender)) return sock.sendMessage(chat, { text: "❌ Owner only command." });

    const message = args.join(" ");
    if (!message) return sock.sendMessage(chat, { text: "Usage: .broadcast <message>" });

    try {
      await sock.sendMessage(chat, { text: "📢 Starting broadcast to all chats..." });

      let success = 0;
      let failed = 0;
      
      // In a real bot, you'd get chats from a database or store
      // Here we'll try to get them from the socket if available
      const chats = Object.keys(sock.store?.chats || {}).slice(0, 100); 

      if (chats.length === 0) {
        return sock.sendMessage(chat, { text: "ℹ️ No chats found in memory to broadcast to." });
      }

      for (const c of chats) {
        if (c.endsWith("@g.us") || c.endsWith("@s.whatsapp.net")) {
          try {
            await sock.sendMessage(c, { text: `📢 *Broadcast from VORTE PRO*\n\n${message}` });
            success++;
            await new Promise(resolve => setTimeout(resolve, 500)); // Delay to avoid spam filters
          } catch (e) {
            failed++;
          }
        }
      }

      await sock.sendMessage(chat, { text: `✅ Broadcast completed!\n• Sent: ${success}\n• Failed: ${failed}` });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(chat, { text: "❌ Failed to complete broadcast." });
    }
  },
};
