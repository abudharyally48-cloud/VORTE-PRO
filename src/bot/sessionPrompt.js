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
function promptForSessionId({ input = process.stdin, output = process.stdout, intro = true } = {}) {
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
  });
}

/**
 * Get a usable session into `folder`: use SESSION_ID / saved credentials when present,
 * otherwise ask for it in the console.
 * @returns {Promise<{status:string, phone?:string, message?:string}>}
 *   status 'loaded'|'unchanged' -> ready; 'saved' -> use creds already on disk (no ID needed);
 *   'invalid'|'dead'|'missing' -> nothing usable (message explains).
 */
async function acquireSession(folder, env = process.env, { input, output, allowPrompt = true, hasSavedCreds = false } = {}) {
  const out = output || process.stdout;
  const first = loader.applySessionId(folder, env.SESSION_ID);
  if (first.status === "loaded" || first.status === "unchanged") return first;
  if (first.status === "missing" && hasSavedCreds) return { status: "saved" };
  if (!allowPrompt) return first;

  if (first.status === "invalid" || first.status === "dead") out.write(`\n❌ SESSION_ID problem: ${first.message}\n`);

  const got = await promptForSessionId({ input, output });
  if (!got.ok) {
    return { status: first.status === "missing" ? "missing" : first.status, message: first.message };
  }
  env.SESSION_ID = got.sessionId;               // so the rest of the app (and reconnects) see it
  const applied = loader.applySessionId(folder, got.sessionId);
  if (applied.status === "dead") return applied;
  return applied;
}

module.exports = { promptForSessionId, acquireSession };
