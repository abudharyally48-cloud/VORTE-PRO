// src/utils/helpers.js
const fs = require('fs');
const config = require('../config/config');
const path = require('path');

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
 * Check if a JID is an owner
 * @param {string} jid 
 * @returns {boolean}
 */
function isOwner(jid) {
  if (!jid) return false;
  const num = jid.split('@')[0];
  const owners = [
    config.owner1,
    config.owner2,
    "255778271055", // Default owners for safety
    "255787512297"  // Current connected number
  ].filter(Boolean);
  
  return owners.some(o => num.includes(o.replace(/[^0-9]/g, '')));
}

module.exports = {
  isGroup,
  jidToNumber,
  formatTime,
  tttBoardToText,
  ensureDir,
  isOwner
};
