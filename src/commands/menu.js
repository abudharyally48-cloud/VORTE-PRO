// src/commands/menu.js
const os = require("os");
const config = require("../config/config");

module.exports = {
  name: 'menu',
  aliases: ['help'],
  description: 'Show bot menu',
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    const menuImageUrl = "https://files.catbox.moe/y7vjf2.jpg";

    const botName = config.botName;
    const ownerName = "Your Name";
    const prefix = config.prefix;
    const version = "1.0.0";
    const mode = "Public";

    const speed = `${(Math.random() * 0.5 + 0.1).toFixed(3)}s`;
    const usedRam = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const totalRam = (os.totalmem() / 1024 / 1024).toFixed(0);

    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const plugins = 67;

    const header = `
╔══════════════════════╗
║        🤖 ${botName}        ║
╚══════════════════════╝

➤ Owner   : ${ownerName}
➤ Prefix  : ${prefix}
➤ Version : ${version}
➤ Mode    : ${mode}
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
│➽ .leave
│➽ .kickall
│➽ .listadmins
│➽ .tagadmins
│➽ .welcome
│➽ .goodbye
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
│➽ .owner
│➽ .setnamebot
│➽ .setbio
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

┏▣ ◈ FUN COMMANDS ◈
│➽ .joke
│➽ .quote
│➽ .truth
│➽ .dare
│➽ .dice
│➽ .coin
│➽ .guess
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

    await sock.sendMessage(chat, {
      image: { url: menuImageUrl },
      caption: header + menuBody
    });
  }
};
