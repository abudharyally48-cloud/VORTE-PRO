// src/commands/song.js
const downloaders = require("../services/downloaders");
const { runDownload, readFile } = require("../utils/downloadUx");
const { panel } = require("../utils/ui");

module.exports = {
  name: "song",
  scope: "BOTH",
  aliases: ["play", "music"],
  description: "Search and download a song by name. Usage: .song <song name>",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    const query = args.join(" ").trim();
    if (!query) return sock.sendMessage(chat, { text: panel("🎵 AUDIO DOWNLOAD", ["Usage: .song <song name>"]) });

    await runDownload(sock, m, {
      title: "🎵 AUDIO DOWNLOAD",
      intro: ["🔎 Searching for:", `"${query}"`, "", "📥 Downloading..."],
      fetch: () => downloaders.searchAndDownloadAudio(query),
      message: (r) => ({ audio: readFile(r.filePath), mimetype: r.format === "mp3" ? "audio/mpeg" : "audio/mp4", fileName: `${r.title}.${r.format}` }),
      failText: "Couldn't find or download that song."
    });
  }
};
