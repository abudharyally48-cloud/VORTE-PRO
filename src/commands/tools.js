// src/commands/tools.js
const helpers = require("../utils/helpers");

const toolCommands = ["math", "echo", "say", "reverse", "countchars", "vv", "toviewonce", "timer", "upper", "lower", "password", "pick"];

module.exports = {
  name: "tools",
  aliases: toolCommands,
  description: "Various utility tools",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    const body = m.body || "";
    const prefix = body.charAt(0);
    const commandUsed = body.slice(1).split(/\s+/)[0].toLowerCase();
    const text = args.join(" ");

    switch (commandUsed) {
      case "math":
        if (!text) return sock.sendMessage(chat, { text: `Usage: ${prefix}math 5+5*2` });
        try {
          const safeArg = text.replace(/[^0-9+\-*/().\s]/g, '');
          const answer = eval(safeArg);
          await sock.sendMessage(chat, { text: `🧮 ${text} = *${answer}*` });
        } catch (err) {
          await sock.sendMessage(chat, { text: "❌ Invalid equation." });
        }
        break;

      case "echo":
      case "say":
        await sock.sendMessage(chat, { text: text || `Usage: ${prefix}${commandUsed} <text>` });
        break;

      case "reverse":
        if (!text) return sock.sendMessage(chat, { text: `Usage: ${prefix}reverse <text>` });
        await sock.sendMessage(chat, { text: text.split("").reverse().join("") });
        break;

      case "countchars":
        if (!text) return sock.sendMessage(chat, { text: `Usage: ${prefix}countchars <text>` });
        await sock.sendMessage(chat, { text: `📊 Text Analysis:\n• Characters: ${text.length}\n• Words: ${text.trim().split(/\s+/).length}` });
        break;

      case "vv":
        // Logic for view-once messages
        if (!m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            return sock.sendMessage(chat, { text: "❌ Reply to a view-once message." });
        }
        const quoted = m.message.extendedTextMessage.contextInfo.quotedMessage;
        if (quoted.viewOnceMessageV2 || quoted.viewOnceMessage) {
            const viewOnce = quoted.viewOnceMessageV2?.message || quoted.viewOnceMessage?.message;
            if (viewOnce.imageMessage) {
            return sock.sendMessage(chat, { image: viewOnce.imageMessage, caption: viewOnce.imageMessage.caption || "" });
            }
            if (viewOnce.videoMessage) {
            return sock.sendMessage(chat, { video: viewOnce.videoMessage, caption: viewOnce.videoMessage.caption || "" });
            }
        }
        await sock.sendMessage(chat, { text: "❌ That is not a view-once message." });
        break;

      case "toviewonce":
        if (!m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            return sock.sendMessage(chat, { text: "❌ Reply to an image or video." });
        }
        const q = m.message.extendedTextMessage.contextInfo.quotedMessage;
        if (q.imageMessage) {
            return sock.sendMessage(chat, { viewOnceMessage: { message: { imageMessage: q.imageMessage } } });
        }
        if (q.videoMessage) {
            return sock.sendMessage(chat, { viewOnceMessage: { message: { videoMessage: q.videoMessage } } });
        }
        await sock.sendMessage(chat, { text: "❌ Only image or video supported." });
        break;

      case "timer":
        const time = parseInt(text);
        if (!time) return sock.sendMessage(chat, { text: "Enter seconds" });
        await sock.sendMessage(chat, { text: `⏳ Timer started for ${time}s` });
        setTimeout(() => {
          sock.sendMessage(chat, { text: "⏰ Time's up!" });
        }, time * 1000);
        break;

      case "upper":
        if (!text) return sock.sendMessage(chat, { text: "Send text!" });
        await sock.sendMessage(chat, { text: text.toUpperCase() });
        break;

      case "lower":
        if (!text) return sock.sendMessage(chat, { text: "Send text!" });
        await sock.sendMessage(chat, { text: text.toLowerCase() });
        break;

      case "password":
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#";
        let pass = "";
        for (let j = 0; j < 10; j++) {
          pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        await sock.sendMessage(chat, { text: `🔐 Password: ${pass}` });
        break;

      case "pick":
        const items = text.split(",");
        if (items.length < 2) return sock.sendMessage(chat, { text: "Example: .pick apple,banana" });
        const choice = items[Math.floor(Math.random() * items.length)];
        await sock.sendMessage(chat, { text: `🎯 I pick: ${choice.trim()}` });
        break;
    }
  },
};
