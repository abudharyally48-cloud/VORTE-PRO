// src/commands/yt.js
const fs = require("fs");
const downloaders = require("../services/downloaders");

const SEND_MAX_BYTES = (Number(process.env.YTDLP_SEND_MAX_MB) || 100) * 1024 * 1024;

module.exports = {
  name: "yt",
  aliases: ["youtube", "video"],
  description: "Download a YouTube video, or search by name. Usage: .yt <url or search terms>",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    const query = args.join(" ").trim();
    if (!query) return sock.sendMessage(chat, { text: "Usage: .yt <YouTube URL or search terms>" });

    const detected = downloaders.detectPlatform(query);
    let result;
    try {
      await sock.sendMessage(chat, { react: { text: "⏳", key: m.key } });

      if (detected && detected.platform === "youtube") {
        result = await downloaders.downloadVideoFromUrl(detected.url);
      } else if (detected) {
        return sock.sendMessage(chat, { text: `❌ That's a ${detected.platform} link — use .${detected.platform} for that instead.` });
      } else {
        result = await downloaders.searchAndDownloadVideo(query);
      }

      if (result.sizeBytes > SEND_MAX_BYTES) {
        downloaders.cleanup(result.filePath);
        return sock.sendMessage(chat, { text: `❌ "${result.title}" is too large to send over WhatsApp (${(result.sizeBytes / 1024 / 1024).toFixed(1)}MB). Try a shorter video.` });
      }

      await sock.sendMessage(chat, { video: fs.readFileSync(result.filePath), caption: `🎬 ${result.title}` });
    } catch (err) {
      const text = err.isBusy ? err.message : `❌ ${err.message || "Couldn't download that."}`;
      await sock.sendMessage(chat, { text });
    } finally {
      if (result?.filePath) downloaders.cleanup(result.filePath);
    }
  }
};
