// src/commands/yt.js
const youtube = require("../services/youtube");
const config = require("../config/config");

module.exports = {
  name: 'yt',
  aliases: ['youtube', 'search'],
  description: 'Search YouTube videos',
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    const query = args.join(" ");

    if (!youtube.isAvailable()) {
      return sock.sendMessage(chat, { text: config.missingKeyMessage });
    }

    if (!query) return sock.sendMessage(chat, { text: "📺 Please provide a search query." });

    const results = await youtube.searchVideos(query);
    if (results.length === 0) {
      return sock.sendMessage(chat, { text: "❌ No results found." });
    }

    let text = `📺 *YouTube Search Results for:* ${query}\n\n`;
    results.forEach((res, i) => {
      text += `${i + 1}. *${res.snippet.title}*\n🔗 https://www.youtube.com/watch?v=${res.id.videoId}\n\n`;
    });

    await sock.sendMessage(chat, { text });
  }
};
