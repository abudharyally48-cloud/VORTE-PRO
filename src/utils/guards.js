// src/utils/guards.js
// Shared permission guard for group-management commands, so the
// group-only / sender-is-admin / bot-is-admin checks live in one place
// and use the centralized (JID-normalizing) helpers.
const helpers = require("./helpers");

/**
 * @param {object} sock
 * @param {object} m
 * @param {{ botAdmin?: boolean }} [opts]
 * @returns {Promise<boolean>} true if the command may proceed (an error reply has
 *   already been sent when this returns false)
 */
async function guardGroupAdmin(sock, m, opts = {}) {
  const chat = m.key.remoteJid;
  const sender = m.key.participant || m.key.remoteJid;

  if (!helpers.isGroup(chat)) {
    await sock.sendMessage(chat, { text: "❌ This command is for groups only." });
    return false;
  }
  const isOwner = helpers.isOwner(sender) || m.key?.fromMe;
  if (!isOwner && !(await helpers.isAdmin(sock, chat, sender))) {
    await sock.sendMessage(chat, { text: "❌ Only group admins or my owner can use this." });
    return false;
  }
  if (opts.botAdmin && !(await helpers.isBotAdmin(sock, chat))) {
    await sock.sendMessage(chat, { text: "❌ I need to be a group admin to do that. Please make me an admin first." });
    return false;
  }
  return true;
}

module.exports = { guardGroupAdmin };
