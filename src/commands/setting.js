// src/commands/setting.js
const helpers = require("../utils/helpers");

// These two are bot-wide/owner concepts (WhatsApp Status isn't per-group), so
// they live in settings.global and are owner-only, unlike the per-chat keys below.
// 'autoviewstatus' is accepted as an alias of 'autostatusview' (both names are
// used interchangeably in different parts of the spec/menu) — both map to the
// same underlying settings.global.autostatusview key.
const GLOBAL_KEYS = ['autostatusview', 'autoreacttostatus'];
// Alternate spellings from the spec/menus, all resolved to the canonical key before use.
const KEY_ALIASES = { autoviewstatus: 'autostatusview', statusview: 'autostatusview', recording: 'autorecording' };
// These apply per-chat, and per spec section 8 must work in BOTH groups and
// private chats — not restricted to groups only.
const PER_CHAT_KEYS = ['autotyping', 'autorecording', 'autoreact', 'antilink', 'welcome', 'goodbye', 'autoread', 'antiedit', 'antidelete', 'antibug', 'antispam', 'antimention'];
const ALL_KEYS = [...GLOBAL_KEYS, ...PER_CHAT_KEYS];

module.exports = {
  name: 'setting',
  aliases: PER_CHAT_KEYS.concat(GLOBAL_KEYS, Object.keys(KEY_ALIASES), ['settings']),
  description: 'Toggle bot settings (some per-chat, some global — see .menu)',
  async execute(sock, m, args, getSettings, saveSettings) {
    const chat = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;
    const isOwner = helpers.isOwner(sender) || m.key?.fromMe;

    const body = helpers.getBody(m);
    const prefix = body.charAt(0);
    const commandUsed = body.slice(1).split(/\s+/)[0].toLowerCase();

    let key, value;
    if (commandUsed === 'setting' || commandUsed === 'settings') {
      key = args[0]?.toLowerCase();
      value = args[1]?.toLowerCase();
    } else {
      key = commandUsed;
      value = args[0]?.toLowerCase();
    }

    // Resolve alternate spellings (e.g. autoviewstatus -> autostatusview) to the canonical key
    key = KEY_ALIASES[key] || key;

    if (!ALL_KEYS.includes(key)) {
      return sock.sendMessage(chat, { text: `❌ Invalid setting. Valid options: ${ALL_KEYS.join(", ")}` });
    }

    if (!value || (value !== 'on' && value !== 'off')) {
      return sock.sendMessage(chat, { text: `❌ Usage: ${prefix}${commandUsed} ${commandUsed === 'setting' ? key + ' ' : ''}on/off` });
    }

    const settings = getSettings();

    if (GLOBAL_KEYS.includes(key)) {
      // Status settings are bot-wide, so only the owner may change them, from any chat.
      if (!isOwner) {
        return sock.sendMessage(chat, { text: "❌ Only my owner can change status settings." });
      }
      settings.global = settings.global || {};
      settings.global[key] = value === 'on';
      saveSettings(settings);
      return sock.sendMessage(chat, { text: `✅ ${key} has been turned ${value} (applies to all statuses).` });
    }

    // Per-chat keys: usable in a group (admin/owner) or a private chat (owner only —
    // there's no "admin" concept in a 1:1 chat).
    if (helpers.isGroup(chat)) {
      const isAdmin = await helpers.isAdmin(sock, chat, sender);
      if (!isOwner && !isAdmin) {
        return sock.sendMessage(chat, { text: "❌ Only group admins or my owner can change these settings." });
      }
    } else if (!isOwner) {
      return sock.sendMessage(chat, { text: "❌ Only my owner can change this in a private chat." });
    }

    if (!settings[chat]) settings[chat] = {};
    settings[chat][key] = value === 'on';
    saveSettings(settings);

    await sock.sendMessage(chat, { text: `✅ ${key} has been turned ${value}.` });
  }
};
