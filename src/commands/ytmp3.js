// src/commands/ytmp3.js
const fs = require("fs");
const downloaders = require("../services/downloaders");

const SEND_MAX_BYTES = (Number(process.env.YTDLP_SEND_MAX_MB) || 100) * 1024 * 1024;

module.exports = {
  name: "ytmp3",
  description: "Download audio from a YouTube URL. Usage: .ytmp3 <url>",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    const query = args.join(" ").trim();
    if (!query) return sock.sendMessage(chat, { text: "Usage: .ytmp3 <YouTube URL>" });

    const detected = downloaders.detectPlatform(query);
    if (!detected || detected.platform !== "youtube") {
      return sock.sendMessage(chat, { text: "❌ Please provide a valid YouTube URL (use .song <name> to search instead)." });
    }

    let result;
    try {
      await sock.sendMessage(chat, { react: { text: "⏳", key: m.key } });
      result = await downloaders.downloadAudioFromUrl(detected.url);

      if (result.sizeBytes > SEND_MAX_BYTES) {
        downloaders.cleanup(result.filePath);
        return sock.sendMessage(chat, { text: `❌ "${result.title}" is too large to send (${(result.sizeBytes / 1024 / 1024).toFixed(1)}MB).` });
      }

      await sock.sendMessage(chat, { audio: fs.readFileSync(result.filePath), mimetype: result.format === "mp3" ? "audio/mpeg" : "audio/mp4", fileName: `${result.title}.${result.format}` });
    } catch (err) {
      const text = err.isBusy ? err.message : `❌ ${err.message || "Couldn't download that."}`;
      await sock.sendMessage(chat, { text });
    } finally {
      if (result?.filePath) downloaders.cleanup(result.filePath);
    }
  }
};
