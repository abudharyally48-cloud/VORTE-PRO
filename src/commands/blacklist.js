// src/commands/blacklist.js
const helpers = require("../utils/helpers");

module.exports = {
  name: "blacklist",
  description: "Block/unblock a number from using the bot entirely (owner only). Usage: .blacklist add/remove/list <number>",
  async execute(sock, m, args, getSettings, saveSettings) {
    const chat = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;

    if (!helpers.isOwner(sender) && !m.key?.fromMe) {
      return sock.sendMessage(chat, { text: "❌ Owner only command." });
    }

    const sub = args[0]?.toLowerCase();
    const settings = getSettings();
    settings.global = settings.global || {};
    settings.global.blacklist = settings.global.blacklist || [];

    if (sub === "list") {
      if (settings.global.blacklist.length === 0) {
        return sock.sendMessage(chat, { text: "ℹ️ Blacklist is empty." });
      }
      return sock.sendMessage(chat, { text: `🚫 *Blacklisted numbers:*\n${settings.global.blacklist.join("\n")}` });
    }

    const rawNumber = args[1];
    const number = rawNumber ? rawNumber.replace(/[^0-9]/g, "") : null;

    if ((sub === "add" || sub === "remove") && !number) {
      return sock.sendMessage(chat, { text: `❌ Usage: .blacklist ${sub} <number>` });
    }

    if (sub === "add") {
      if (!settings.global.blacklist.includes(number)) {
        settings.global.blacklist.push(number);
        saveSettings(settings);
      }
      return sock.sendMessage(chat, { text: `✅ ${number} added to blacklist. The bot will now ignore all messages from this number.` });
    }

    if (sub === "remove") {
      settings.global.blacklist = settings.global.blacklist.filter(n => n !== number);
      saveSettings(settings);
      return sock.sendMessage(chat, { text: `✅ ${number} removed from blacklist.` });
    }

    return sock.sendMessage(chat, { text: "❌ Usage: .blacklist add/remove/list <number>" });
  }
};
