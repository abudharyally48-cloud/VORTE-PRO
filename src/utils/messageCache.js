// src/utils/messageCache.js
// Baileys does not give you the "before" content on an edit or delete event —
// only that it happened. To show what was edited/deleted, we cache recent
// message content ourselves, keyed by message id, bounded so it can't grow
// forever.
const MAX_ENTRIES = 2000;
const cache = new Map();

/**
 * @param {string} id - message id (m.key.id)
 * @param {{chat: string, sender: string, text: string}} data
 */
function store(id, data) {
  if (!id) return;
  cache.set(id, { ...data, cachedAt: Date.now() });
  if (cache.size > MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
}

/**
 * @param {string} id
 * @returns {{chat: string, sender: string, text: string, cachedAt: number}|undefined}
 */
function get(id) {
  return cache.get(id);
}

module.exports = { store, get };
