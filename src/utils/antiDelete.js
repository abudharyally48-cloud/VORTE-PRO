// src/utils/antiDelete.js
// AntiDelete: recover deleted messages (text AND media) and deliver them to the bot
// owner(s)' private inbox. Global (private chats + groups) when enabled via `.antidelete on`.
//
// WHAT IS EXCLUDED (all decided here, in one place):
//   - status updates, broadcasts, newsletters      -> not a chat message
//   - messages the BOT sent (welcome/goodbye, anti* warnings, command replies, status
//     lines, the recovery notices themselves)       -> botActivity.wasSentByBot
//   - messages the BOT deleted (antilink/antispam/antibot/mute/.delete enforcement)
//                                                   -> botActivity.wasDeletedByBot
//   - messages sent by the bot's own account       -> your own outgoing deletes aren't "events"
//   - view-once media                              -> never cached or forwarded
// The recovered copy sits in the owner's chat like any normal message: the bot never
// deletes it, so it stays until the owner deletes it.
const fs = require("fs");
const path = require("path");
const config = require("../config/config");
const messageCache = require("./messageCache");
const botActivity = require("./botActivity");
const identity = require("./identity");
const automation = require("./automation");

const CACHE_DIR = path.join(__dirname, "../../storage/tmp/antidelete");
const TTL_MS = (Number(process.env.ANTIDELETE_CACHE_MINUTES) || 60) * 60 * 1000;
const MAX_FILE_BYTES = (Number(process.env.ANTIDELETE_MAX_MEDIA_MB) || 10) * 1024 * 1024;
const MAX_TOTAL_BYTES = (Number(process.env.ANTIDELETE_MAX_TOTAL_MB) || 200) * 1024 * 1024;

const MEDIA_KEYS = { imageMessage: "image", videoMessage: "video", audioMessage: "audio", documentMessage: "document", stickerMessage: "sticker" };
const WRAPPERS = ["ephemeralMessage", "viewOnceMessage", "viewOnceMessageV2", "viewOnceMessageV2Extension", "documentWithCaptionMessage", "editedMessage"];

const media = new Map(); // message id -> { file, kind, mimetype, fileName, caption, ptt, gif, bytes, cachedAt }
let totalBytes = 0;

/** Peel ephemeral / view-once / caption wrappers. @returns {{message:object, viewOnce:boolean}} */
function unwrap(message) {
  let cur = message || {};
  let viewOnce = false;
  for (let i = 0; i < 6; i++) {
    const w = WRAPPERS.find((k) => cur?.[k]?.message);
    if (!w) break;
    if (w.startsWith("viewOnce")) viewOnce = true;
    cur = cur[w].message;
  }
  if (cur?.imageMessage?.viewOnce || cur?.videoMessage?.viewOnce || cur?.audioMessage?.viewOnce) viewOnce = true;
  return { message: cur, viewOnce };
}

/** What kind of content is this? -> { kind, text, caption } */
function describeContent(message) {
  const { message: msg, viewOnce } = unwrap(message);
  const text = msg.conversation || msg.extendedTextMessage?.text || "";
  for (const [k, kind] of Object.entries(MEDIA_KEYS)) if (msg[k]) return { kind, text: "", caption: msg[k].caption || "", viewOnce, node: msg[k] };
  if (msg.contactMessage) return { kind: "contact", text: `Contact: ${msg.contactMessage.displayName || ""}`, caption: "", viewOnce };
  if (msg.contactsArrayMessage) return { kind: "contact", text: `${msg.contactsArrayMessage.contacts?.length || 0} contact(s)`, caption: "", viewOnce };
  if (msg.locationMessage) return { kind: "location", text: `Location: ${msg.locationMessage.degreesLatitude}, ${msg.locationMessage.degreesLongitude}`, caption: "", viewOnce };
  if (msg.pollCreationMessage || msg.pollCreationMessageV3) return { kind: "poll", text: `Poll: ${(msg.pollCreationMessage || msg.pollCreationMessageV3).name}`, caption: "", viewOnce };
  return { kind: "text", text, caption: "", viewOnce };
}

const enabled = (settings) => !!settings?.global?.antidelete?.enabled;

function sweep() {
  const now = Date.now();
  for (const [id, e] of media) {
    if (now - e.cachedAt > TTL_MS) drop(id);
  }
  while (totalBytes > MAX_TOTAL_BYTES && media.size) drop(media.keys().next().value);
}
function drop(id) {
  const e = media.get(id);
  if (!e) return;
  media.delete(id);
  totalBytes = Math.max(0, totalBytes - (e.bytes || 0));
  fs.rm(e.file, { force: true }, () => {});
}

const sweeper = setInterval(sweep, 5 * 60 * 1000);
if (sweeper.unref) sweeper.unref();

/**
 * Called for every incoming message. Always keeps the text for AntiEdit/AntiDelete;
 * when AntiDelete is enabled it also saves downloadable media so it can be recovered.
 */
async function remember(sock, m, settings, { download = defaultDownload } = {}) {
  const id = m?.key?.id;
  if (!id) return;
  const c = describeContent(m.message);
  messageCache.store(id, {
    chat: m.key.remoteJid,
    sender: m.key.participant || m.key.remoteJid,
    fromMe: !!m.key.fromMe,
    text: c.text || c.caption || "",
    kind: c.kind,
    ts: (Number(m.messageTimestamp) || Math.floor(Date.now() / 1000)) * 1000
  });

  if (!enabled(settings) || !MEDIA_KEYS_SET.has(c.kind) || c.viewOnce) return;
  if (!automation.chatKind(m.key.remoteJid)) return;
  const declared = Number(c.node?.fileLength) || 0;
  if (declared && declared > MAX_FILE_BYTES) return;

  try {
    const buf = await download(sock, m);
    if (!buf || !buf.length || buf.length > MAX_FILE_BYTES) return;
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const file = path.join(CACHE_DIR, id.replace(/[^A-Za-z0-9_-]/g, "_"));
    fs.writeFileSync(file, buf);
    media.set(id, { file, kind: c.kind, mimetype: c.node?.mimetype, fileName: c.node?.fileName, caption: c.caption, ptt: !!c.node?.ptt, gif: !!c.node?.gifPlayback, bytes: buf.length, cachedAt: Date.now() });
    totalBytes += buf.length;
    sweep();
  } catch (e) {
    console.error("⚠️ antidelete: couldn't save media:", e.message);
  }
}
const MEDIA_KEYS_SET = new Set(Object.values(MEDIA_KEYS));

async function defaultDownload(sock, m) {
  const { downloadMediaMessage } = require("baileys");
  return downloadMediaMessage(m, "buffer", {}, { reuploadRequest: sock.updateMediaMessage });
}

/** Single place that decides whether a revoke event is reported. @returns {string|null} reason to ignore */
function ignoreReason(key, cached) {
  if (!automation.chatKind(key.remoteJid)) return "not a normal chat (status/broadcast/newsletter)";
  if (!cached) return "original never seen";
  if (botActivity.wasDeletedByBot(key.id)) return "deleted by the bot (moderation/command)";
  if (botActivity.wasSentByBot(key.id)) return "sent by the bot (system/feature message)";
  if (cached.fromMe) return "sent by the bot's own account";
  return null;
}

const ownerJids = () => [config.owner1, config.owner2].filter(Boolean).map((n) => `${n}@s.whatsapp.net`);

function formatTime(ts, tz = process.env.TZ) {
  try { return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", ...(tz ? { timeZone: tz } : {}) }); }
  catch { return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); }
}

function formatSender(jid) {
  const pn = identity.toPn(jid);
  return pn ? `+${pn}` : `@${String(jid || "").split("@")[0].split(":")[0]} (number hidden by WhatsApp)`;
}

/**
 * A message was deleted for everyone.
 * @returns {Promise<{sent:boolean, reason?:string}>}
 */
async function handleDelete(sock, update, settings) {
  const key = update.key;
  if (!enabled(settings)) return { sent: false, reason: "disabled" };
  const cached = messageCache.get(key.id);
  const why = ignoreReason(key, cached);
  if (why) return { sent: false, reason: why };

  const owners = ownerJids();
  if (!owners.length) { console.error("⚠️ antidelete: no OWNER_1 configured, nowhere to send recovered messages"); return { sent: false, reason: "no owner" }; }

  const isGroup = key.remoteJid.endsWith("@g.us");
  let chatName = "Private Chat";
  if (isGroup) {
    try { chatName = (await identity.getMetadata(sock, key.remoteJid)).subject || "Group"; } catch { chatName = "Group"; }
  }
  const deleter = update.update?.key?.participant || key.participant;
  const header = [
    "🗑️ ANTI-DELETE", "",
    `👤 Sender: ${formatSender(cached.sender)}`,
    `💬 Chat: ${isGroup ? `${chatName} (group)` : "Private Chat"}`,
    `🕐 Time: ${formatTime(cached.ts || cached.cachedAt)}`,
    deleter && identity.keysOf(deleter)[0] !== identity.keysOf(cached.sender)[0] ? `🧹 Deleted by: ${formatSender(deleter)}` : null
  ].filter((l) => l !== null && l !== undefined && l !== false).join("\n"); // keep the blank line under the title

  const saved = media.get(key.id);
  let delivered = false;
  for (const owner of owners) {
    try {
      if (saved && fs.existsSync(saved.file)) {
        const buffer = fs.readFileSync(saved.file);
        const caption = `${header}\n\n📩 Deleted message:${saved.caption ? `\n${saved.caption}` : ""}`.slice(0, 1000);
        if (saved.kind === "image") await sock.sendMessage(owner, { image: buffer, caption });
        else if (saved.kind === "video") await sock.sendMessage(owner, { video: buffer, caption, gifPlayback: saved.gif });
        else if (saved.kind === "document") await sock.sendMessage(owner, { document: buffer, mimetype: saved.mimetype || "application/octet-stream", fileName: saved.fileName || "deleted-file", caption });
        else if (saved.kind === "audio") { await sock.sendMessage(owner, { text: `${header}\n\n📩 Deleted voice/audio message ⬇️` }); await sock.sendMessage(owner, { audio: buffer, mimetype: saved.mimetype || "audio/ogg; codecs=opus", ptt: saved.ptt }); }
        else if (saved.kind === "sticker") { await sock.sendMessage(owner, { text: `${header}\n\n📩 Deleted sticker ⬇️` }); await sock.sendMessage(owner, { sticker: buffer }); }
      } else {
        const body = cached.text
          ? `📩 Deleted message:\n${cached.text}`
          : MEDIA_KEYS_SET.has(cached.kind)
            ? `📩 Deleted ${cached.kind} — it was too large, expired from my short cache, or arrived before AntiDelete was on, so I can't recover the file.`
            : "📩 Deleted message: (no recoverable content)";
        await sock.sendMessage(owner, { text: `${header}\n\n${body}` });
      }
      delivered = true;
    } catch (e) {
      console.error("❌ antidelete: couldn't deliver to owner:", e.message);
    }
  }
  drop(key.id);
  return { sent: delivered, reason: delivered ? undefined : "delivery failed" };
}

module.exports = { remember, handleDelete, ignoreReason, describeContent, unwrap, enabled, formatTime, _media: media, CACHE_DIR };
