// src/commands/tiktok.js
// Real downloads go through yt-dlp (API-less, works for public TikTok videos).
// The official TikTok OAuth scaffold (services/tiktok.js) is kept for whatever
// legitimate official-API use you add later — see .tiktokstatus.
const fs = require("fs");
const downloaders = require("../services/downloaders");

const SEND_MAX_BYTES = (Number(process.env.YTDLP_SEND_MAX_MB) || 100) * 1024 * 1024;

module.exports = {
  name: "tiktok",
  aliases: ["tt"],
  description: "Download a TikTok video. Usage: .tiktok <link>",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    const query = args.join(" ").trim();
    if (!query) return sock.sendMessage(chat, { text: "Usage: .tiktok <TikTok link>" });

    const detected = downloaders.detectPlatform(query);
    if (!detected || detected.platform !== "tiktok") {
      return sock.sendMessage(chat, { text: "❌ That doesn't look like a TikTok link." });
    }

    let result;
    try {
      await sock.sendMessage(chat, { react: { text: "⏳", key: m.key } });
      result = await downloaders.downloadVideoFromUrl(detected.url);

      if (result.sizeBytes > SEND_MAX_BYTES) {
        downloaders.cleanup(result.filePath);
        return sock.sendMessage(chat, { text: `❌ That video is too large to send (${(result.sizeBytes / 1024 / 1024).toFixed(1)}MB).` });
      }

      await sock.sendMessage(chat, { video: fs.readFileSync(result.filePath), caption: `🎵 ${result.title}` });
    } catch (err) {
      const text = err.isBusy ? err.message : `❌ ${err.message || "Couldn't download that TikTok."}`;
      await sock.sendMessage(chat, { text });
    } finally {
      if (result?.filePath) downloaders.cleanup(result.filePath);
    }
  }
};
