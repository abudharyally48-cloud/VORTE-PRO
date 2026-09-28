// src/utils/helpers.js
const fs = require('fs');
const config = require('../config/config');
const path = require('path');
const sudoStore = require('./sudoStore');

/**
 * Check if a JID is a group
 * @param {string} jid 
 * @returns {boolean}
 */
function isGroup(jid) {
  return jid && jid.endsWith("@g.us");
}

/**
 * Convert JID to simple number
 * @param {string} jid 
 * @returns {string}
 */
function jidToNumber(jid) {
  return jid ? jid.split("@")[0] : jid;
}

/**
 * Format current time
 * @returns {string}
 */
function formatTime() {
  return new Date().toLocaleTimeString();
}

/**
 * Format Tic-Tac-Toe board
 * @param {Array} board 
 * @returns {string}
 */
function tttBoardToText(board) {
  let b = board.map((c, i) => c || (i + 1)).map(c => ` ${c} `);
  return `${b[0]}|${b[1]}|${b[2]}\n───┼───┼───\n${b[3]}|${b[4]}|${b[5]}\n───┼───┼───\n${b[6]}|${b[7]}|${b[8]}`;
}

/**
 * Ensure directory exists
 * @param {string} dir 
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Normalize any WhatsApp JID format down to its bare digit string, so JIDs
 * from different sources (message sender vs group metadata) can be reliably
 * compared even when WhatsApp reports them in different formats
 * (@s.whatsapp.net vs @lid, with/without a :device suffix).
 * @param {string} jid
 * @returns {string}
 */
function normalizeJid(jid) {
  if (!jid) return '';
  return jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

/**
 * Check if a JID is an owner
 * @param {string} jid 
 * @returns {boolean}
 */
function isTrueOwner(jid) {
  if (!jid) return false;
  const num = normalizeJid(jid);
  const owners = [config.owner1, config.owner2, ...(config.sudo || [])].filter(Boolean);
  return owners.some(o => num === normalizeJid(o));
}

/**
 * Owner-level check: env-configured owners OR anyone on the persisted sudo list.
 * Use isTrueOwner() instead for actions sudo users must NOT be able to perform
 * (managing the sudo list itself, eval).
 * @param {string} jid
 * @returns {boolean}
 */
function isOwner(jid) {
  if (!jid) return false;
  if (isTrueOwner(jid)) return true;
  const num = normalizeJid(jid);
  return sudoStore.list().some(n => n === num);
}

/**
 * Check if a JID is an admin (or superadmin) in a group.
 * Compares normalized phone numbers rather than raw JID strings, since
 * WhatsApp/Baileys can report the same participant under different JID
 * formats (@lid vs @s.whatsapp.net) between group metadata and message events.
 * @param {object} sock
 * @param {string} chat
 * @param {string} user
 * @returns {Promise<boolean>}
 */
async function isAdmin(sock, chat, user) {
  if (!isGroup(chat)) return false;
  if (!user) return false;
  try {
    const metadata = await sock.groupMetadata(chat);
    const targetNum = normalizeJid(user);
    return metadata.participants.some((p) => {
      if (!p.admin) return false; // covers both 'admin' and 'superadmin'
      // A participant can carry both a phone-JID and a lid-JID depending on
      // the WhatsApp version; check every identifier field Baileys exposes.
      const candidates = [p.id, p.jid, p.lid].filter(Boolean).map(normalizeJid);
      return candidates.includes(targetNum);
    });
  } catch (e) {
    console.error('❌ isAdmin check failed:', e.message);
    return false;
  }
}

/**
 * Check if the bot is an admin in a group
 * @param {object} sock
 * @param {string} chat
 * @returns {Promise<boolean>}
 */
async function isBotAdmin(sock, chat) {
  if (!isGroup(chat)) return false;
  try {
    const botNum = normalizeJid(sock.user?.id);
    const metadata = await sock.groupMetadata(chat);
    return metadata.participants.some((p) => {
      if (!p.admin) return false;
      const candidates = [p.id, p.jid, p.lid].filter(Boolean).map(normalizeJid);
      return candidates.includes(botNum);
    });
  } catch (e) {
    console.error('❌ isBotAdmin check failed:', e.message);
    return false;
  }
}

/**
 * Check if a message body starts with any supported prefix, and return
 * which one matched. Centralizes multi-prefix support so it's defined
 * in exactly one place rather than duplicated per file.
 * @param {string} body
 * @returns {string|null} the matched prefix, or null if none matched
 */
function matchPrefix(body, extraPrefixes = []) {
  if (!body) return null;
  const prefixes = [...(config.prefixes || [config.prefix]), ...extraPrefixes];
  return prefixes.find(p => body.startsWith(p)) || null;
}

/**
 * Reliably extract the text body of a message. Baileys messages do not have
 * a top-level `m.body` — that was a bug present in several command files
 * (fun.js, hangman.js, quiz.js, tools.js, imageai.js), silently breaking
 * every command in each of those files. Always use this instead.
 * @param {object} m
 * @returns {string}
 */
function getBody(m) {
  return (
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    m.message?.imageMessage?.caption ||
    m.message?.videoMessage?.caption ||
    ""
  );
}

module.exports = {
  isTrueOwner,
  isGroup,
  jidToNumber,
  normalizeJid,
  formatTime,
  tttBoardToText,
  ensureDir,
  isOwner,
  isAdmin,
  isBotAdmin,
  matchPrefix,
  getBody
};
