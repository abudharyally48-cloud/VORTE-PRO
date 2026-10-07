// src/bot/sessionPrompt.js
// Lets the operator paste the SESSION_ID straight into the console (panel console,
// SSH, local terminal) when the bot starts without a usable session.
const readline = require("readline");
const loader = require("./sessionLoader");

/**
 * Read a SESSION_ID from `input`, line by line.
 * - A paste cut into several lines (panels/TTYs often cap line length) is stitched
 *   together: lines are appended until the value decodes into valid credentials.
 * - A definitely-wrong value (wrong prefix, not credentials, ...) is rejected at once and
 *   the prompt starts over. Typing `reset` also starts over.
 * - If the input stream ends (no console attached, e.g. most cloud hosts) it gives up.
 * @returns {Promise<{ok:true, sessionId:string} | {ok:false, reason:'eof'}>}
 */
function promptForSessionId({ input = process.stdin, output = process.stdout, intro = true, signal } = {}) {
  return new Promise((resolve) => {
    const say = (t) => output.write(t + "\n");
    const rl = readline.createInterface({ input, terminal: false });
    let buffer = "";
    let done = false;

    const finish = (result) => { if (done) return; done = true; rl.close(); resolve(result); };

    if (intro) {
      say("\n🔑 Paste your SESSION_ID here and press Enter (it starts with VORTE_PRO~).");
      say("   Get one from the VORTE PRO Session ID Generator. If the console cuts a long paste,");
      say("   just paste the rest on the next line. Type 'reset' to start over.\n");
    }

    rl.on("line", (raw) => {
      if (done) return;
      const line = String(raw).trim();
      if (!line) return;
      if (line.toLowerCase() === "reset") { buffer = ""; say("↩️  Cleared. Paste your SESSION_ID."); return; }

      buffer += line.replace(/\s+/g, "");
      const parsed = loader.parseSessionId(buffer);
      if (parsed.ok) return finish({ ok: true, sessionId: parsed.full });

      if (parsed.code === "INCOMPLETE") {
        say(`⏳ Received ${buffer.length} characters, but the SESSION_ID is not complete yet. Paste the rest on the next line (or type 'reset').`);
        return;
      }
      say(`❌ ${parsed.error}`);
      say("   Paste your SESSION_ID again.");
      buffer = "";
    });

    rl.on("close", () => finish({ ok: false, reason: "eof" }));
    if (signal) {
      if (signal.aborted) finish({ ok: false, reason: "aborted" });
      else signal.addEventListener("abort", () => finish({ ok: false, reason: "aborted" }), { once: true });
    }
  });
}

const fs = require("fs");
const path = require("path");
const ROOT_DIR = path.join(__dirname, "../..");

/** Files an operator can drop the SESSION_ID into (host file managers can't type into stdin). */
function sessionFileCandidates(env = process.env, root = ROOT_DIR) {
  return [env.SESSION_FILE, path.join(root, "session.txt"), path.join(root, "session_id.txt"), path.join(root, "storage", "session.txt")].filter(Boolean);
}

/** Look once. @returns {{found:false} | {found:true, file:string, ok:boolean, sessionId?:string, parsed?:object}} */
function readSessionFile(candidates) {
  for (const file of candidates) {
    let raw;
    try { raw = fs.readFileSync(file, "utf8"); } catch { continue; }
    if (!raw.trim()) continue; // empty file: still being created
    const parsed = loader.parseSessionId(raw);
    return parsed.ok ? { found: true, file, ok: true, sessionId: parsed.full } : { found: true, file, ok: false, parsed, raw };
  }
  return { found: false };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Get a usable session into `folder`: SESSION_ID env / saved credentials first; otherwise
 * wait for the operator to supply it by EITHER pasting into the console OR creating a
 * session.txt file next to index.js. Whichever happens first wins.
 * @returns {Promise<{status:string, phone?:string, message?:string, via?:string}>}
 *   'loaded'|'unchanged' ready; 'saved' creds already on disk; 'invalid'|'dead'|'missing' nothing usable.
 */
async function acquireSession(folder, env = process.env, opts = {}) {
  const { input, output, allowPrompt = true, hasSavedCreds = false, waitForFile = true, pollMs = 3000, maxWaitMs = Infinity, root = ROOT_DIR } = opts;
  const out = output || process.stdout;
  const say = (t) => out.write(t + "\n");

  const first = loader.applySessionId(folder, env.SESSION_ID);
  if (first.status === "loaded" || first.status === "unchanged") return first;
  if (first.status === "missing" && hasSavedCreds) return { status: "saved" };
  if (!allowPrompt) return first;

  if (first.status === "invalid" || first.status === "dead") say(`\n❌ SESSION_ID problem: ${first.message}`);

  const candidates = sessionFileCandidates(env, root);
  const consume = (found, via) => {
    env.SESSION_ID = found.sessionId;
    const applied = loader.applySessionId(folder, found.sessionId);
    if (via === "file" && (applied.status === "loaded" || applied.status === "unchanged")) {
      try { fs.rmSync(found.file, { force: true }); say(`🧹 Read the SESSION_ID from ${path.basename(found.file)} and deleted that file.`); } catch { /* keep going */ }
    }
    return { ...applied, via };
  };

  // 1) a session file that is already there
  const already = readSessionFile(candidates);
  if (already.found && already.ok) return consume(already, "file");
  if (already.found && !already.ok && already.parsed.code !== "INCOMPLETE") say(`❌ ${path.basename(already.file)}: ${already.parsed.error}`);

  // 2) console paste and the file watcher race each other
  const ac = new AbortController();
  let stdinEnded = false;
  let finished = false;

  const promptP = (input === null ? Promise.resolve({ ok: false, reason: "eof" }) : promptForSessionId({ input, output, signal: ac.signal })).then((r) => {
    if (!r.ok && r.reason === "eof") {
      stdinEnded = true;
      if (waitForFile && !finished) {
        say("\nℹ️  This host does not pass console input to the bot.");
        say("   Create a file named session.txt in the bot folder (next to index.js), paste your SESSION_ID into it and save.");
        say("   The bot checks for it every few seconds and starts as soon as it is valid.\n");
      }
    }
    return r;
  });

  const watchP = (async () => {
    const started = Date.now();
    let lastBad = "";
    while (!finished && Date.now() - started < maxWaitMs) {
      const r = readSessionFile(candidates);
      if (r.found && r.ok) return { via: "file", found: r };
      if (r.found && !r.ok && r.parsed.code !== "INCOMPLETE") {
        const sig = r.file + ":" + r.parsed.code + ":" + r.raw.length;
        if (sig !== lastBad) { lastBad = sig; say(`❌ ${path.basename(r.file)}: ${r.parsed.error}`); }
      }
      if (!waitForFile && stdinEnded) return null;
      await sleep(pollMs);
    }
    return null;
  })();

  const result = await Promise.race([
    promptP.then((r) => (r.ok ? { via: "console", sessionId: r.sessionId } : watchP)),
    watchP
  ]);
  finished = true;
  ac.abort();

  if (!result) return { status: first.status, message: first.message };
  if (result.via === "console") {
    env.SESSION_ID = result.sessionId;
    return { ...loader.applySessionId(folder, result.sessionId), via: "console" };
  }
  return consume(result.found, "file");
}

module.exports = { promptForSessionId, acquireSession, sessionFileCandidates, readSessionFile };
