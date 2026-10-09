// src/bot/events/editHandler.js
const messageCache = require("../../utils/messageCache");
const botActivity = require("../../utils/botActivity");
const antiDelete = require("../../utils/antiDelete");

/**
 * Baileys emits `messages.update` for both edits and deletes (revokes).
 * A delete/revoke shows up as `update.message === null` (or stub type REVOKE) with the
 * same key.id as the original message. An edit shows up with the same key.id and new content.
 *  - DELETE -> AntiDelete (global): recovered content goes to the owner's inbox.
 *  - EDIT   -> AntiEdit (per chat): before/after shown in that chat.
 */
async function handleMessageUpdate(sock, updates, getSettings) {
  for (const update of updates) {
    try {
      const { key, update: upd } = update;
      if (!key?.id || !key?.remoteJid) continue;

      const settings = getSettings();
      const isDelete = upd?.message === null || upd?.messageStubType === 1 /* REVOKE */;

      if (isDelete) {
        await antiDelete.handleDelete(sock, update, settings);
        continue;
      }

      const chatSetting = settings[key.remoteJid] || {};
      if (!chatSetting.antiedit) continue;
      if (botActivity.wasSentByBot(key.id)) continue; // the bot editing its own status messages isn't a user edit
      const cached = messageCache.get(key.id);
      if (!cached) continue; // we never saw the original, nothing to report

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
        messageCache.update(key.id, { text: newText }); // next edit diffs against this version
      }
    } catch (err) {
      console.error("❌ editHandler error:", err.message);
    }
  }
}

module.exports = { handleMessageUpdate };
