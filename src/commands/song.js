// src/commands/song.js
const youtube = require("../services/youtube");

module.exports = {
  name: "song",
  aliases: ["yt", "music"],
  description: "Search for a song on YouTube",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    const query = args.join(" ");

    if (!query) return sock.sendMessage(chat, { text: "Usage: .song <song name>" });

    try {
      const results = await youtube.searchVideos(query);
      if (!results || results.length === 0) {
        return sock.sendMessage(chat, { text: "❌ No results found." });
      }

      let resultText = "🎵 *Search Results:*\n\n";
      results.forEach((video, i) => {
        resultText += `${i + 1}. *${video.snippet.title}*\n`;
        resultText += `   🔗 https://www.youtube.com/watch?v=${video.id.videoId}\n\n`;
      });

      await sock.sendMessage(chat, { text: resultText });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(chat, { text: "❌ Error searching for song." });
    }
  },
};
