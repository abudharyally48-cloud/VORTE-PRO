// src/commands/ytmp3.js
const downloaders = require("../services/downloaders");
const { runDownload, readFile } = require("../utils/downloadUx");
const { panel } = require("../utils/ui");

module.exports = {
  name: "ytmp3",
  scope: "BOTH",
  description: "Download audio from a YouTube URL. Usage: .ytmp3 <url>",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    const query = args.join(" ").trim();
    if (!query) return sock.sendMessage(chat, { text: panel("🎵 AUDIO DOWNLOAD", ["Usage: .ytmp3 <YouTube URL>"]) });

    const detected = downloaders.detectPlatform(query);
    if (!detected || detected.platform !== "youtube") {
      return sock.sendMessage(chat, { text: panel("🎵 AUDIO DOWNLOAD", ["❌ Please provide a valid YouTube URL (use .song <name> to search instead)."]) });
    }
    await runDownload(sock, m, {
      title: "🎵 AUDIO DOWNLOAD",
      intro: ["📥 Fetching media...", "🎵 Preparing audio..."],
      fetch: () => downloaders.downloadAudioFromUrl(detected.url),
      message: (r) => ({ audio: readFile(r.filePath), mimetype: r.format === "mp3" ? "audio/mpeg" : "audio/mp4", fileName: `${r.title}.${r.format}` }),
      failText: "Couldn't download that."
    });
  }
};
