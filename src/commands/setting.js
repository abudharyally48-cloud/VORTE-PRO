// src/commands/setting.js
const helpers = require("../utils/helpers");

module.exports = {
  name: 'setting',
  aliases: ['autotyping', 'autorecording', 'autostatusview', 'autoreact', 'autoreacttostatus', 'antilink', 'welcome', 'antibug', 'antispam', 'antimention'],
  description: 'Toggle group settings (admin/owner only)',
  async execute(sock, m, args, getSettings, saveSettings) {
    const chat = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;
    if (!helpers.isGroup(chat)) return sock.sendMessage(chat, { text: "❌ This command is for groups only." });

    const isOwner = helpers.isOwner(sender) || m.key?.fromMe;
    const isAdmin = await helpers.isAdmin(sock, chat, sender);
    if (!isOwner && !isAdmin) {
      return sock.sendMessage(chat, { text: "❌ Only group admins or my owner can change these settings." });
    }

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

    const validKeys = ['autotyping', 'autorecording', 'autostatusview', 'autoreact', 'autoreacttostatus', 'antilink', 'welcome', 'antibug', 'antispam', 'antimention'];
    if (!validKeys.includes(key)) {
      return sock.sendMessage(chat, { text: `❌ Invalid setting. Valid options: ${validKeys.join(", ")}` });
    }

    if (!value || (value !== 'on' && value !== 'off')) {
      return sock.sendMessage(chat, { text: `❌ Usage: ${prefix}${commandUsed} ${commandUsed === 'setting' ? key + ' ' : ''}on/off` });
    }

    const settings = getSettings();
    if (!settings[chat]) settings[chat] = {};
    settings[chat][key] = value === 'on';
    saveSettings(settings);

    await sock.sendMessage(chat, { text: `✅ ${key} has been turned ${value}.` });
  }
};
