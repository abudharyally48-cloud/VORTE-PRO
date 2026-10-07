// src/bot/sessionLoader.js
// SESSION_ID handling for session-only deployments (Render, Katabump, Heroku, ...).
//
// SESSION_ID format (produced by the VORTE PRO Session ID Generator):
//     VORTE_PRO~<base64 of creds.json>
//
// applySessionId() validates the ID, writes creds.json into the session folder, and
// reports exactly what happened so client.js can decide whether to connect.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PREFIX = "VORTE_PRO~";
const HASH_FILE = ".session_hash";   // sha256 of the SESSION_ID currently written to disk
const DEAD_FILE = ".session_dead";   // sha256 of a SESSION_ID WhatsApp has logged out

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

/**
 * Tolerant parse of the raw env value: trims, strips wrapping quotes and ANY
 * whitespace/newlines (hosts and copy/paste often wrap long values).
 * @returns {{ok:true, full:string, creds:object} | {ok:false, error:string}}
 */
function parseSessionId(raw) {
  if (!raw || !String(raw).trim()) return { ok: false, error: "SESSION_ID is empty." };
  let v = String(raw).trim().replace(/^["']+|["']+$/g, "").replace(/\s+/g, "");
  const idx = v.indexOf(PREFIX);
  if (idx === -1) return { ok: false, error: `SESSION_ID must start with "${PREFIX}" (copy the whole value from the generator).` };
  v = v.slice(idx);
  const b64 = v.slice(PREFIX.length);
  if (!b64 || !/^[A-Za-z0-9+/=_-]+$/.test(b64)) return { ok: false, error: "SESSION_ID contains characters that are not valid base64 — it was probably cut or altered when pasted." };
  let creds;
  try {
    creds = JSON.parse(Buffer.from(b64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  } catch {
    return { ok: false, error: "SESSION_ID could not be decoded — it is incomplete or corrupted. Generate a new one." };
  }
  if (!creds || typeof creds !== "object" || !creds.noiseKey || !creds.signedIdentityKey || creds.registrationId === undefined) {
    return { ok: false, error: "SESSION_ID decoded, but it is not WhatsApp credentials. Generate a new one." };
  }
  if (!creds.me?.id) {
    return { ok: false, error: "SESSION_ID is from an unfinished pairing (no account linked). Finish pairing on the generator, then copy the ID." };
  }
  return { ok: true, full: v, creds, phone: String(creds.me.id).split(":")[0].split("@")[0] };
}

function readIf(file) { try { return fs.readFileSync(file, "utf8").trim(); } catch { return ""; } }

function clearFolder(folder) {
  if (!fs.existsSync(folder)) return;
  for (const f of fs.readdirSync(folder)) {
    if (f === DEAD_FILE) continue; // keep the dead marker
    try { fs.rmSync(path.join(folder, f), { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

/**
 * @param {string} folder  session folder (config.sessionFolder)
 * @param {string|undefined} raw  process.env.SESSION_ID
 * @returns {{status:'loaded'|'unchanged'|'invalid'|'missing'|'dead', message?:string, phone?:string}}
 *   loaded    – ID written to disk (first run or a NEW ID was supplied)
 *   unchanged – same ID as last time; existing (fresher) creds on disk are kept
 *   invalid   – ID present but unusable (message says why)
 *   missing   – no SESSION_ID set
 *   dead      – this exact ID was already logged out by WhatsApp
 */
function applySessionId(folder, raw) {
  fs.mkdirSync(folder, { recursive: true });
  if (!raw || !String(raw).trim()) return { status: "missing" };

  const parsed = parseSessionId(raw);
  if (!parsed.ok) return { status: "invalid", message: parsed.error };

  const hash = sha(parsed.full);
  if (readIf(path.join(folder, DEAD_FILE)) === hash) {
    return { status: "dead", phone: parsed.phone, message: "This SESSION_ID was logged out by WhatsApp. Generate a NEW one and replace it." };
  }

  const credsPath = path.join(folder, "creds.json");
  const stored = readIf(path.join(folder, HASH_FILE));
  // legacy versions stored the raw ID in .session_hash — treat as unchanged and migrate to a hash
  const same = stored === hash || stored === parsed.full;
  if (same && fs.existsSync(credsPath)) {
    if (stored !== hash) fs.writeFileSync(path.join(folder, HASH_FILE), hash);
    return { status: "unchanged", phone: parsed.phone };
  }

  clearFolder(folder);
  fs.writeFileSync(credsPath, JSON.stringify(parsed.creds));
  fs.writeFileSync(path.join(folder, HASH_FILE), hash);
  return { status: "loaded", phone: parsed.phone };
}

/** Remember that WhatsApp logged this session out (so restarts don't keep retrying it). */
function markDead(folder, raw) {
  const parsed = parseSessionId(raw);
  try {
    fs.mkdirSync(folder, { recursive: true });
    if (parsed.ok) fs.writeFileSync(path.join(folder, DEAD_FILE), sha(parsed.full));
    for (const f of fs.readdirSync(folder)) if (f !== DEAD_FILE) fs.rmSync(path.join(folder, f), { recursive: true, force: true });
  } catch { /* best effort */ }
}

/** Force the next start to re-apply SESSION_ID from the environment (used on badSession). */
function forgetLoaded(folder) {
  try { fs.rmSync(path.join(folder, HASH_FILE), { force: true }); } catch { /* ignore */ }
}

module.exports = { parseSessionId, applySessionId, markDead, forgetLoaded, PREFIX };
