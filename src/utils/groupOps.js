// src/utils/groupOps.js
// The action layer for group commands. Fixes the "fake success" class of bugs:
//  * groupParticipantsUpdate returns a PER-USER status ("200", "403", ...). Resolving
//    does NOT mean it worked, so every result is interpreted.
//  * group-state changes (name/description/open/close) are re-fetched from WhatsApp
//    and compared before we ever say "done".
//  * the metadata cache is dropped after every change so later commands see fresh state.
const identity = require("./identity");
const config = require("../config/config");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STATUS_REASON = {
  "401": "the account has blocked the bot",
  "403": "WhatsApp refused (privacy settings, or the account is protected)",
  "404": "that account is not in the group",
  "406": "WhatsApp rejected that number",
  "408": "that account left recently and can't be re-added yet",
  "409": "already in the group",
  "500": "WhatsApp had an internal error"
};

/** Human reason for a thrown Baileys/WhatsApp error. */
function errorReason(err) {
  const msg = String(err?.message || err || "").toLowerCase();
  if (msg.includes("not-authorized") || msg.includes("forbidden") || msg.includes("403") || msg.includes("401")) return "WhatsApp says I don't have permission (am I still a group admin?)";
  if (msg.includes("rate-overlimit") || msg.includes("429")) return "WhatsApp rate limit — try again in a moment";
  if (msg.includes("item-not-found") || msg.includes("404")) return "that group or user was not found";
  if (msg.includes("timed out") || msg.includes("timeout")) return "WhatsApp did not answer in time";
  return err?.message ? `WhatsApp error: ${err.message}` : "WhatsApp rejected the request";
}

const digits = (jid) => String(jid || "").split("@")[0].split(":")[0].replace(/[^0-9]/g, "");

/** @user text for mentions (uses the same user-part WhatsApp matches against mentionedJid). */
const mentionText = (jid) => "@" + String(jid || "").split("@")[0].split(":")[0];

/** Phone number for display ("+255…") or the raw id if the phone is unknown. */
function displayNumber(jid) {
  const pn = identity.toPn(jid);
  return pn ? "+" + pn : "@" + String(jid || "").split("@")[0].split(":")[0];
}

function findParticipant(meta, jid) {
  const want = new Set(identity.keysOf(jid));
  if (!want.size) return null;
  return (meta?.participants || []).find((p) => identity.participantKeys(p).some((k) => want.has(k))) || null;
}

/** The id format the group itself uses for this person (LID or phone). */
function toGroupJid(meta, jid) {
  return findParticipant(meta, jid)?.id || jid;
}

/**
 * Targets of a moderation command: @mentions, else the replied-to user, plus bare numbers.
 * @returns {string[]} unique jids
 */
function resolveTargets(m, args = []) {
  const ctx = m.message?.extendedTextMessage?.contextInfo || m.message?.imageMessage?.contextInfo || m.message?.videoMessage?.contextInfo || {};
  const found = [];
  for (const j of ctx.mentionedJid || []) found.push(j);
  if (!found.length && ctx.stanzaId && ctx.participant) found.push(ctx.participant);
  for (const a of args) {
    const d = String(a).replace(/[^0-9]/g, "");
    if (!String(a).startsWith("@") && d.length >= 7 && d.length <= 15) found.push(`${d}@s.whatsapp.net`);
  }
  const seen = new Set(), out = [];
  for (const j of found) {
    const k = identity.keysOf(j)[0] || j;
    if (!seen.has(k)) { seen.add(k); out.push(j); }
  }
  return out;
}

const ownerKeys = () => [config.owner1, config.owner2].filter(Boolean).map((n) => `pn:${n}`);

/**
 * Split targets into those we may act on and those we must not touch.
 */
function protect(sock, meta, jids, action) {
  const allowed = [], blocked = [];
  const botKeys = new Set(identity.botKeys(sock));
  const owners = new Set(ownerKeys());
  for (const jid of jids) {
    const keys = identity.keysOf(jid);
    const p = findParticipant(meta, jid);
    if (action !== "add") {
      if (keys.some((k) => botKeys.has(k))) { blocked.push({ jid, reason: "I can't do that to myself (use .leave to make me leave)" }); continue; }
      if (!p) { blocked.push({ jid, reason: "that user is not in this group" }); continue; }
    }
    if (action === "remove" || action === "demote") {
      if (p?.admin === "superadmin") { blocked.push({ jid, reason: "that is the group creator — WhatsApp doesn't allow it" }); continue; }
      if (keys.some((k) => owners.has(k)) || (p && identity.participantKeys(p).some((k) => owners.has(k)))) { blocked.push({ jid, reason: "that is my owner" }); continue; }
    }
    if (action === "promote" && p && (p.admin === "admin" || p.admin === "superadmin")) { blocked.push({ jid, reason: "already an admin" }); continue; }
    if (action === "demote" && p && !p.admin) { blocked.push({ jid, reason: "not an admin" }); continue; }
    allowed.push(jid);
  }
  return { allowed, blocked };
}

/**
 * Run add/remove/promote/demote and report what REALLY happened.
 * @returns {Promise<{ok: string[], failed: {jid:string, reason:string}[]}>}
 */
async function participantAction(sock, chat, jids, action, { verify = true } = {}) {
  let meta = null;
  try { meta = await identity.getMetadata(sock, chat); } catch { /* proceed without */ }
  const ids = jids.map((j) => (action === "add" ? j : toGroupJid(meta, j)));

  let results;
  try {
    results = await sock.groupParticipantsUpdate(chat, ids, action);
  } catch (err) {
    identity.invalidate(chat);
    const reason = errorReason(err);
    return { ok: [], failed: jids.map((jid) => ({ jid, reason })) };
  }
  identity.invalidate(chat);

  const ok = [], failed = [];
  const arr = Array.isArray(results) ? results : [];
  jids.forEach((jid, i) => {
    const want = new Set(identity.keysOf(ids[i]).concat(identity.keysOf(jid)));
    const r = arr.find((x) => identity.keysOf(x?.jid || x?.id || "").some((k) => want.has(k))) || (arr.length === jids.length ? arr[i] : null);
    const status = r ? String(r.status) : null;
    if (status && status !== "200") {
      if (status === "409" && action === "add") ok.push(jid); // already there: the goal state holds
      else failed.push({ jid, reason: STATUS_REASON[status] || `WhatsApp returned status ${status}` });
    } else {
      ok.push(jid); // 200, or no per-user status returned -> confirm by re-fetch below
    }
  });

  if (!verify || !ok.length) return { ok, failed };

  let fresh;
  try { await sleep(250); fresh = await identity.getMetadata(sock, chat, { force: true }); } catch { return { ok, failed }; }
  const confirmed = [];
  for (const jid of ok) {
    const p = findParticipant(fresh, jid);
    const good =
      action === "remove" ? !p :
      action === "add" ? !!p :
      action === "promote" ? !!p && !!p.admin :
      action === "demote" ? !!p && !p.admin : true;
    if (good) confirmed.push(jid);
    else failed.push({ jid, reason: "WhatsApp accepted the request but the group did not change" });
  }
  return { ok: confirmed, failed };
}

/**
 * Perform a group-state change and only report success once a FRESH metadata fetch
 * shows it. `check(meta) -> boolean` decides whether the change is visible.
 * @returns {Promise<{ok:boolean, reason?:string, meta?:object}>}
 */
async function applyAndVerify(sock, chat, perform, check, { attempts = [0, 600, 1500] } = {}) {
  try {
    await perform();
  } catch (err) {
    identity.invalidate(chat);
    return { ok: false, reason: errorReason(err) };
  }
  identity.invalidate(chat);
  let meta = null;
  for (const wait of attempts) {
    if (wait) await sleep(wait);
    try { meta = await identity.getMetadata(sock, chat, { force: true }); } catch { continue; }
    if (check(meta)) return { ok: true, meta };
  }
  return { ok: false, meta, reason: "WhatsApp accepted the request but the group still shows the old value" };
}

const setSubject = (sock, chat, name) =>
  applyAndVerify(sock, chat, () => sock.groupUpdateSubject(chat, name), (meta) => String(meta?.subject || "").trim() === name.trim());

const setAnnounce = (sock, chat, on) =>
  applyAndVerify(sock, chat, () => sock.groupSettingUpdate(chat, on ? "announcement" : "not_announcement"), (meta) => !!meta?.announce === !!on);

const setLocked = (sock, chat, on) =>
  applyAndVerify(sock, chat, () => sock.groupSettingUpdate(chat, on ? "locked" : "unlocked"), (meta) => !!meta?.restrict === !!on);

const setDescription = (sock, chat, text) =>
  applyAndVerify(sock, chat, () => sock.groupUpdateDescription(chat, text), (meta) => String(meta?.desc || "").trim() === text.trim());

module.exports = {
  errorReason, digits, mentionText, displayNumber, findParticipant, toGroupJid,
  resolveTargets, protect, participantAction, applyAndVerify,
  setSubject, setAnnounce, setLocked, setDescription
};
