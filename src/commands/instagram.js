// src/commands/instagram.js
// Real downloads go through yt-dlp (API-less, works for public IG reels/posts).
// The official Meta Graph API scaffold (services/instagram.js) is kept for
// whatever legitimate official-API use you add later — see .igstatus.
const fs = require("fs");
const downloaders = require("../services/downloaders");

const SEND_MAX_BYTES = (Number(process.env.YTDLP_SEND_MAX_MB) || 100) * 1024 * 1024;

module.exports = {
  name: "instagram",
  aliases: ["ig"],
  description: "Download an Instagram reel/post video. Usage: .ig <link>",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    const query = args.join(" ").trim();
    if (!query) return sock.sendMessage(chat, { text: "Usage: .ig <Instagram link>" });

    const detected = downloaders.detectPlatform(query);
    if (!detected || detected.platform !== "instagram") {
      return sock.sendMessage(chat, { text: "❌ That doesn't look like an Instagram link." });
    }

    let result;
    try {
      await sock.sendMessage(chat, { react: { text: "⏳", key: m.key } });
      result = await downloaders.downloadVideoFromUrl(detected.url);

      if (result.sizeBytes > SEND_MAX_BYTES) {
        downloaders.cleanup(result.filePath);
        return sock.sendMessage(chat, { text: `❌ That's too large to send (${(result.sizeBytes / 1024 / 1024).toFixed(1)}MB).` });
      }

      await sock.sendMessage(chat, { video: fs.readFileSync(result.filePath), caption: `📸 ${result.title}` });
    } catch (err) {
      const text = err.isBusy ? err.message : `❌ ${err.message || "Couldn't download that Instagram post (it may be private)."}`;
      await sock.sendMessage(chat, { text });
    } finally {
      if (result?.filePath) downloaders.cleanup(result.filePath);
    }
  }
};
