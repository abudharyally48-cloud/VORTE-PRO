// src/commands/menu.js
const os = require("os");
const fs = require("fs");
const config = require("../config/config");

// Defaults so .setmenu2/.setmenu3 work out of the box, even before .setmenudisplay
// or a custom .setmenu2/.setmenu3 <url> is run live on the bot.
const DEFAULT_MENU_IMAGE = "https://eliteprotech-url.zone.id/1790194710775wkxz5l.jpg";
const DEFAULT_MENU_VIDEO = "https://eliteprotech-url.zone.id/1790195141470z221vj.mp4";

module.exports = {
  name: 'menu',
  aliases: ['help'],
  description: 'Show bot menu',
  async execute(sock, m, args, getSettings, saveSettings, commandCount) { 
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
    const ownerName = config.owners?.[0]?.[0] || "Not set";
    const prefix = config.prefix;
    const version = "1.0.0";

    const speed = `${(Math.random() * 0.5 + 0.1).toFixed(3)}s`;
    const usedRam = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const totalRam = (os.totalmem() / 1024 / 1024).toFixed(0);

    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const plugins = commandCount || 0;

    const header = `
╔══════════════════════╗
║        🤖 ${botName}        ║
╚══════════════════════╝

➤ Owner   : ${ownerName}
➤ Prefix  : ${prefix}
➤ Version : ${version}
➤ Mode    : ${mode.toUpperCase()}
➤ Plugins : ${plugins}
➤ Speed   : ${speed}
➤ Usage   : ${hours}h ${minutes}m ${seconds}s
➤ Ram     : ${usedRam}MB / ${totalRam}MB
`;

    const menuBody = `
┏▣ ◈ GROUP COMMANDS ◈
│➽ .tagall
│➽ .promote @user
│➽ .demote @user
│➽ .kick @user
│➽ .kickall
│➽ .leave
│➽ .listadmins
│➽ .tagadmins
│➽ .welcome (on = join + leave messages)
│➽ .close
│➽ .open
│➽ .gclink
│➽ .antilink
│➽ .setgroupname
│➽ .warn
│➽ .userid
│➽ .poll
│➽ .tostatusgroup
│➽ .hidetag
│➽ .delppgroup
┗▣

┏▣ ◈ BOT CONTROLS ◈
│➽ .ping
│➽ .menu
│➽ .setmenu1 / .setmenu2 / .setmenu3 / .setmenu4
│➽ .setmenudisplay (reply to a pic/video)
│➽ .setbotnameto <name>
│➽ .owner
│➽ .setnamebot
│➽ .setbio
┗▣

┏▣ ◈ DEFENSE ◈
│➽ .antibug (group admin)
│➽ .antispam (group admin)
│➽ .antimention (group admin)
│➽ .blacklist add/remove/list (owner)
│➽ .safemode on/off (owner)
┗▣

┏▣ ◈ AUTOMATION ◈
│➽ .autotyping
│➽ .autorecording
│➽ .autostatusview
│➽ .autoreacttostatus
│➽ .autoreact
┗▣

┏▣ ◈ GAMES ◈
│➽ .tictactoe @user
│➽ .tttmove
│➽ .hangmanstart
│➽ .hangmanguess
│➽ .quizstart
│➽ .quizanswer
┗▣

┏▣ ◈ MEDIA & UTILS ◈
│➽ .sticker
│➽ .qr
│➽ .song
│➽ .yt
│➽ .imdb
│➽ .randommovie / .randomtv
┗▣

┏▣ ◈ AI ◈
│➽ .gpt
┗▣

┏▣ ◈ IMAGE AI ◈
│➽ .1917style
│➽ .advancedglow
│➽ .cartoonstyle
│➽ .luxurygold
│➽ .matrix
│➽ .sand
│➽ .papercutstyle
┗▣

┏▣ ◈ INFO & UTILS ◈
│➽ .search / .ddg
│➽ .wiki
│➽ .define
│➽ .weather
│➽ .fact
│➽ .meme
│➽ .shorten
│➽ .translate <lang> <text>
┗▣

┏▣ ◈ FUN COMMANDS ◈
│➽ .joke
│➽ .quote
│➽ .truth
│➽ .dare
│➽ .dice
│➽ .coin
│➽ .guess
│➽ .8ball
│➽ .rps
│➽ .ship @a @b
│➽ .wyr
┗▣

┏▣ ◈ TOOLS ◈
│➽ .math
│➽ .echo
│➽ .say
│➽ .reverse
│➽ .countchars
│➽ .vv
│➽ .toviewonce
┗▣

┏▣ ◈ OWNER ONLY ◈
│➽ .sudo
│➽ .broadcast
┗▣

Type ${prefix} before each command!
`;

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
