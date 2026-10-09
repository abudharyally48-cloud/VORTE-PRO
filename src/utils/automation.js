// src/utils/automation.js
// Scoped automation settings (autotyping / autorecording / autoread / autoreact).
// Stored at settings.global.automation[key] = { enabled: bool, scope: "private"|"groups"|"both" }
const KEYS = ["autotyping", "autorecording", "autoread", "autoreact"];

const SCOPE_LABEL = { private: "👤 Private", groups: "👥 Groups", both: "🌐 All Chats" };
const TITLES = {
  autotyping: "🤖 AUTO TYPING",
  autorecording: "🎙️ AUTO RECORDING",
  autoread: "👁️ AUTO READ",
  autoreact: "😀 AUTO REACT"
};

/** Kind of chat a jid is: "group" | "private" | null (status, broadcast, newsletter, ...) */
function chatKind(jid) {
  if (!jid || typeof jid !== "string") return null;
  if (jid.endsWith("@g.us")) return "group";
  if (jid.endsWith("@s.whatsapp.net") || jid.endsWith("@lid")) return "private";
  return null;
}

function getConfig(settings, key) {
  const c = settings?.global?.automation?.[key];
  return { enabled: !!c?.enabled, scope: ["private", "groups", "both"].includes(c?.scope) ? c.scope : "both" };
}

/** Is `key` active for this chat? */
function appliesTo(settings, key, chat) {
  const cfg = getConfig(settings, key);
  if (!cfg.enabled) return false;
  const kind = chatKind(chat);
  if (!kind) return false;
  if (cfg.scope === "both") return true;
  return cfg.scope === "private" ? kind === "private" : kind === "group";
}

/** Apply an argument ("on" | "off" | "private" | "groups" | "both") to the settings object. */
function applyArg(settings, key, arg) {
  const a = String(arg || "").toLowerCase();
  const aliases = { all: "both", chats: "both", group: "groups", dm: "private", pm: "private", users: "private" };
  const v = aliases[a] || a;
  const cur = getConfig(settings, key);
  let next;
  if (v === "on") next = { enabled: true, scope: cur.scope };
  else if (v === "off") next = { enabled: false, scope: cur.scope };
  else if (["private", "groups", "both"].includes(v)) next = { enabled: true, scope: v };
  else return null;
  settings.global = settings.global || {};
  settings.global.automation = settings.global.automation || {};
  settings.global.automation[key] = next;
  return next;
}

function describe(key, cfg) {
  return `${TITLES[key]}\n\nStatus: ${cfg.enabled ? "✅ ON" : "❌ OFF"}\nScope: ${SCOPE_LABEL[cfg.scope]}`;
}

/**
 * One-time upgrade: older versions stored these as per-chat booleans
 * (settings[chat].autotyping = true). Fold them into the global scoped setting.
 * @returns {boolean} true if settings were changed
 */
function migrate(settings) {
  let changed = false;
  for (const key of KEYS) {
    if (settings?.global?.automation?.[key]) continue;
    let groups = 0, privates = 0;
    for (const [jid, s] of Object.entries(settings || {})) {
      if (jid === "global" || !s || typeof s !== "object" || s[key] !== true) continue;
      const k = chatKind(jid);
      if (k === "group") groups++; else if (k === "private") privates++;
    }
    if (groups || privates) {
      settings.global = settings.global || {};
      settings.global.automation = settings.global.automation || {};
      settings.global.automation[key] = { enabled: true, scope: groups && privates ? "both" : groups ? "groups" : "private" };
      changed = true;
    }
  }
  // drop the legacy per-chat flags once folded in (they would otherwise be dead data)
  if (changed || settings?.global?.automation) {
    for (const [jid, s] of Object.entries(settings || {})) {
      if (jid === "global" || !s || typeof s !== "object") continue;
      for (const key of KEYS) if (key in s) { delete s[key]; changed = true; }
    }
  }
  return changed;
}

// ---- runtime: presence ------------------------------------------------------
const timers = new Map(); // chat -> timeout (so overlapping messages don't fight)

/** Show "typing…" / "recording…" briefly in `chat`, then clear it. */
async function showPresence(sock, chat, kind /* "composing" | "recording" */) {
  try { await sock.presenceSubscribe?.(chat); } catch { /* optional */ }
  try { await sock.sendPresenceUpdate(kind, chat); } catch (e) { console.error(`❌ presence(${kind}) failed:`, e.message); return; }
  clearTimeout(timers.get(chat));
  const t = setTimeout(() => {
    timers.delete(chat);
    Promise.resolve(sock.sendPresenceUpdate("paused", chat)).catch(() => {});
  }, 2000 + Math.floor(Math.random() * 1500));
  if (t.unref) t.unref();
  timers.set(chat, t);
}

/**
 * Decide and fire presence for one incoming message.
 * - only typing enabled for this chat  -> "composing" for every message
 * - only recording enabled             -> "recording" for every message
 * - both enabled                       -> "recording" for voice/audio messages, else "composing"
 */
async function runPresence(sock, settings, chat, m) {
  const typing = appliesTo(settings, "autotyping", chat);
  const recording = appliesTo(settings, "autorecording", chat);
  if (!typing && !recording) return null;
  const isAudio = !!m?.message?.audioMessage;
  const kind = typing && recording ? (isAudio ? "recording" : "composing") : typing ? "composing" : "recording";
  await showPresence(sock, chat, kind);
  return kind;
}

module.exports = { KEYS, TITLES, SCOPE_LABEL, chatKind, getConfig, appliesTo, applyArg, describe, migrate, showPresence, runPresence };
