// src/commands/gpt.js
const openai = require("../services/openai");

module.exports = {
  name: 'gpt',
  aliases: ['ai', 'ask'],
  description: 'Ask AI (GPT-4o-mini)',
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    const query = args.join(" ");

    if (!openai.isAvailable()) {
      return sock.sendMessage(chat, { text: config.missingKeyMessage });
    }

    if (!query) return sock.sendMessage(chat, { text: "💬 Please provide a question for the AI." });

    await sock.sendMessage(chat, { react: { text: "🤖", key: m.key } });

    const response = await openai.chatCompletion(query);
    if (response) {
      await sock.sendMessage(chat, { text: response });
    } else {
      await sock.sendMessage(chat, { text: "❌ Sorry, I couldn't reach the AI at the moment." });
    }
  }
};
