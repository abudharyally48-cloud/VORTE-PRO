// src/utils/botActivity.js
// Remembers what the BOT itself sent / deleted, so features that watch chat events
// (antidelete, antiedit) can ignore the bot's own activity instead of reacting to it.
// This is the single source for "was this event caused by the bot?".
const TTL_MS = 10 * 60 * 1000;
const MAX = 5000;

const sent = new Map();     // message id -> ts   (messages the bot sent)
const deleted = new Map();  // message id -> ts   (messages the bot deleted)

function put(map, id) {
  if (!id) return;
  map.set(id, Date.now());
  if (map.size > MAX) map.delete(map.keys().next().value);
}
function has(map, id) {
  const ts = map.get(id);
  if (!ts) return false;
  if (Date.now() - ts > TTL_MS) { map.delete(id); return false; }
  return true;
}

const markSent = (id) => put(sent, id);
const markDeleted = (id) => put(deleted, id);
const wasSentByBot = (id) => has(sent, id);
const wasDeletedByBot = (id) => has(deleted, id);

/**
 * Wrap sock.sendMessage once so EVERY send/delete in the codebase is tracked
 * without touching each command. Idempotent.
 */
function install(sock) {
  if (!sock || sock.__vorteTracked) return sock;
  const original = sock.sendMessage.bind(sock);
  sock.sendMessage = async (jid, content, options) => {
    if (content && content.delete && content.delete.id) markDeleted(content.delete.id);
    const result = await original(jid, content, options);
    if (result?.key?.id && !(content && content.delete)) markSent(result.key.id);
    return result;
  };
  sock.__vorteTracked = true;
  return sock;
}

module.exports = { install, markSent, markDeleted, wasSentByBot, wasDeletedByBot };
