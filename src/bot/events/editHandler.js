// src/bot/events/editHandler.js
const messageCache = require("../../utils/messageCache");

/**
 * Baileys emits `messages.update` for both edits and deletes (revokes).
 * A delete/revoke shows up as `update.message === null` (or a protocolMessage
 * of type REVOKE) with the same key.id as the original message.
 * An edit shows up with the same key.id and new message content.
 * @param {object} sock
 * @param {Array} updates
 * @param {Function} getSettings
 */
async function handleMessageUpdate(sock, updates, getSettings) {
  for (const update of updates) {
    try {
      const { key, update: upd } = update;
      if (!key?.id || !key?.remoteJid) continue;

      const settings = getSettings();
      const chatSetting = settings[key.remoteJid] || {};
      const cached = messageCache.get(key.id);
      if (!cached) continue; // we never saw the original, nothing to report

      const isDelete = upd?.message === null || upd?.messageStubType === 1 /* REVOKE */;

      if (isDelete && chatSetting.antidelete) {
        await sock.sendMessage(key.remoteJid, {
          text: `🗑️ *Anti-Delete*\n@${cached.sender.split("@")[0]} deleted:\n"${cached.text || "(non-text message)"}"`,
          mentions: [cached.sender]
        });
        continue;
      }

      if (!isDelete && chatSetting.antiedit) {
        const newText =
          upd?.message?.conversation ||
          upd?.message?.extendedTextMessage?.text ||
          upd?.message?.editedMessage?.message?.conversation ||
          upd?.message?.editedMessage?.message?.extendedTextMessage?.text;

        if (newText && newText !== cached.text) {
          await sock.sendMessage(key.remoteJid, {
            text: `✏️ *Anti-Edit*\n@${cached.sender.split("@")[0]} edited a message:\nBefore: "${cached.text}"\nAfter: "${newText}"`,
            mentions: [cached.sender]
          });
        }
      }
    } catch (err) {
      console.error("❌ editHandler error:", err.message);
    }
  }
}

module.exports = { handleMessageUpdate };
