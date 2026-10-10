// src/commands/menu.js
const os = require("os");
const fs = require("fs");
const config = require("../config/config");
const { buildMenuBody } = require("../utils/menuBuilder");
const prefixLib = require("../utils/prefix");

// Defaults so .setmenu2/.setmenu3 work out of the box, even before .setmenudisplay
// or a custom .setmenu2/.setmenu3 <url> is run live on the bot.
const DEFAULT_MENU_IMAGE = "https://eliteprotech-url.zone.id/1790194710775wkxz5l.jpg";
const DEFAULT_MENU_VIDEO = "https://eliteprotech-url.zone.id/1790195141470z221vj.mp4";

module.exports = {
  name: 'menu',
  scope: "BOTH",
  aliases: ['help'],
  description: 'Show bot menu',
  async execute(sock, m, args, getSettings, saveSettings, context) {
    const chat = m.key.remoteJid;

    let menuSettings = {};
    let mode = "public";
    try {
      const settings = getSettings?.() || {};
      menuSettings = settings.global?.menu || {};
      mode = settings.global?.mode || "public";
    } catch (e) {}

    const style = menuSettings.style || 1;
    const botName = menuSettings.customName || config.botName;
    let globalOwnerName;
    try { globalOwnerName = (getSettings?.() || {}).global?.ownerName; } catch (e) {}
    const ownerName = globalOwnerName || config.owners?.[0]?.[0] || "Not set";
    let liveSettings = {};
    try { liveSettings = getSettings?.() || {}; } catch (e) {}
    const prefix = context?.prefix || prefixLib.display(liveSettings);
    const prefixLine = prefixLib.headline(liveSettings);
    const version = "1.0.0";

    const speed = `${(Math.random() * 0.5 + 0.1).toFixed(3)}s`;
    const usedRam = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const totalRam = (os.totalmem() / 1024 / 1024).toFixed(0);

    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const plugins = context?.primaryCount ?? context?.commandCount ?? "?";

    const header = `
╔══════════════════════╗
║        🤖 ${botName}        ║
╚══════════════════════╝

➤ Owner   : ${ownerName}
➤ Prefix  : ${prefixLine}
➤ Version : ${version}
➤ Mode    : ${mode.toUpperCase()}
➤ Plugins : ${plugins}
➤ Speed   : ${speed}
➤ Usage   : ${hours}h ${minutes}m ${seconds}s
➤ Ram     : ${usedRam}MB / ${totalRam}MB
`;

    const menuBody = buildMenuBody(prefix, context?.registry || new Map()) + `\n📢 ${config.channel.name}: ${config.channel.url}\n`;

    const fullText = header + menuBody;

    // Style 2: picture header (local file from .setmenudisplay takes priority, else the saved URL, else the default)
    if (style === 2) {
      if (menuSettings.imagePath && fs.existsSync(menuSettings.imagePath)) {
        return sock.sendMessage(chat, { image: fs.readFileSync(menuSettings.imagePath), caption: fullText });
      }
      const imageUrl = menuSettings.imageUrl || DEFAULT_MENU_IMAGE;
      if (imageUrl) {
        return sock.sendMessage(chat, { image: { url: imageUrl }, caption: fullText });
      }
    }

    // Style 3: video/GIF header
    if (style === 3) {
      if (menuSettings.videoPath && fs.existsSync(menuSettings.videoPath)) {
        return sock.sendMessage(chat, { video: fs.readFileSync(menuSettings.videoPath), caption: fullText, gifPlayback: true });
      }
      const videoUrl = menuSettings.videoUrl || DEFAULT_MENU_VIDEO;
      if (videoUrl) {
        return sock.sendMessage(chat, {
          video: { url: videoUrl },
          caption: fullText,
          gifPlayback: true
        });
      }
    }

    // Style 4: fully custom media (name is already applied above)
    if (style === 4) {
      if (menuSettings.customMediaPath && fs.existsSync(menuSettings.customMediaPath)) {
        if (menuSettings.customMediaType === "video") {
          return sock.sendMessage(chat, { video: fs.readFileSync(menuSettings.customMediaPath), caption: fullText, gifPlayback: true });
        }
        return sock.sendMessage(chat, { image: fs.readFileSync(menuSettings.customMediaPath), caption: fullText });
      }
      if (menuSettings.customMediaUrl) {
        if (menuSettings.customMediaType === "video") {
          return sock.sendMessage(chat, {
            video: { url: menuSettings.customMediaUrl },
            caption: fullText,
            gifPlayback: true
          });
        }
        return sock.sendMessage(chat, { image: { url: menuSettings.customMediaUrl }, caption: fullText });
      }
    }

    // Style 1, or a media style selected but no media set yet — plain text
    return sock.sendMessage(chat, { text: fullText });
  }
};
