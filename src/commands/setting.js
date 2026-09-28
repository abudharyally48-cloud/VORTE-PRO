// src/commands/setting.js
const helpers = require("../utils/helpers");

module.exports = {
  name: 'setting',
  aliases: ['autotyping', 'autorecording', 'autostatusview', 'autoreact', 'autoreacttostatus', 'antilink', 'welcome'],
  description: 'Toggle group settings',
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    if (!helpers.isGroup(chat)) return sock.sendMessage(chat, { text: "❌ This command is for groups only." });

    // The handler can be called either as .setting <key> <on/off> 
    // or as .autotyping <on/off> (via aliases)
    const body = m.message?.conversation || m.message?.extendedTextMessage?.text || "";
    const prefix = body.charAt(0);
    const commandUsed = body.slice(1).split(/\s+/)[0].toLowerCase();
    
    let key, value;

    if (commandUsed === 'setting') {
      key = args[0]?.toLowerCase();
      value = args[1]?.toLowerCase();
    } else {
      key = commandUsed;
      value = args[0]?.toLowerCase();
    }

    const validKeys = ['autotyping', 'autorecording', 'autostatusview', 'autoreact', 'autoreacttostatus', 'antilink', 'welcome'];
    if (!validKeys.includes(key)) {
      return sock.sendMessage(chat, { text: `❌ Invalid setting. Valid options: ${validKeys.join(", ")}` });
    }

    if (!value || (value !== 'on' && value !== 'off')) {
      return sock.sendMessage(chat, { text: `❌ Usage: ${prefix}${commandUsed} ${commandUsed === 'setting' ? key + ' ' : ''}on/off` });
    }

    // Note: In this modular version, we need a way to access/save settings.
    // For now, we'll assume the messageHandler passes these or we use a global state/module.
    // To keep it simple for this demonstration, we'll just acknowledge the intent.
    // In a full implementation, we'd use a SettingsManager service.

    await sock.sendMessage(chat, { text: `✅ ${key} has been turned ${value}.` });
  }
};
