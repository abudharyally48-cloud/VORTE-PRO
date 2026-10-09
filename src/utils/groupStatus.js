// src/utils/groupStatus.js
// Post a REAL "group status": a Message wrapped in `groupStatusMessageV2` (WAProto field 103),
// relayed to the group JID. Baileys can unwrap this type when receiving but has no send helper,
// so we build the inner message with its own generateWAMessageContent (upload + thumbnails + text
// styling) and wrap/relay it ourselves.
//
// GROUP_STATUS_FIELD=v1 switches to the older `groupStatusMessage` (field 96) field in case a
// WhatsApp version only renders that one.
const baileys = require("baileys");

const FIELD = () => (String(process.env.GROUP_STATUS_FIELD || "").toLowerCase() === "v1" ? "groupStatusMessage" : "groupStatusMessageV2");

/**
 * @param {object} sock
 * @param {string} groupJid  must be a group (…@g.us)
 * @param {object} content   { text } | { image, caption } | { video, caption, gifPlayback } | { audio, mimetype, ptt }
 * @param {object} [options] { backgroundColor: "#rrggbb", font: 0-5 }  (Baileys reads these from OPTIONS, not content)
 * @returns {Promise<{messageId:string, field:string}>}
 */
async function sendGroupStatus(sock, groupJid, content, options = {}) {
  if (!groupJid || !groupJid.endsWith("@g.us")) throw new Error("A group status can only be posted in a group.");
  const inner = await baileys.generateWAMessageContent(content, {
    upload: sock.waUploadToServer,
    logger: sock.logger,
    mediaCache: undefined,
    ...options
  });
  const field = FIELD();
  const messageId = baileys.generateMessageIDV2(sock.user?.id);
  await sock.relayMessage(groupJid, { [field]: { message: inner } }, { messageId });
  return { messageId, field };
}

module.exports = { sendGroupStatus, FIELD };
