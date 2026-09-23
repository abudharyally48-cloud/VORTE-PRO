// src/utils/chatStore.js
// Baileys (v6+) no longer ships a built-in chat store, so broadcast.js had
// nothing to read from. This tracks every chat JID the bot sees a message
// from/in, persisted to disk so it survives restarts.
const fs = require('fs');
const path = require('path');

const CHATS_FILE = path.join(__dirname, '../../storage/knownChats.json');

function ensureFile() {
  const dir = path.dirname(CHATS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(CHATS_FILE)) fs.writeFileSync(CHATS_FILE, JSON.stringify([]));
}

function getKnownChats() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(CHATS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function trackChat(jid) {
  if (!jid) return;
  ensureFile();
  const chats = getKnownChats();
  if (!chats.includes(jid)) {
    chats.push(jid);
    fs.writeFileSync(CHATS_FILE, JSON.stringify(chats, null, 2));
  }
}

module.exports = { getKnownChats, trackChat };
