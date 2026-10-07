// Console SESSION_ID prompt tests. Run: node tests/session-prompt.e2e.js
const fs = require("fs"), os = require("os"), path = require("path");
const { PassThrough } = require("stream");
const { promptForSessionId, acquireSession } = require("../src/bot/sessionPrompt");
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(`  ${ok ? "✅" : "❌"} ${n}${ok ? "" : " -> " + (d ?? "")}`); };

const creds = (n = 1) => ({ noiseKey: { private: "a" }, signedIdentityKey: { private: "c" }, registrationId: n, me: { id: "255700000001:12@s.whatsapp.net" } });
const mk = (c = creds()) => "VORTE_PRO~" + Buffer.from(JSON.stringify(c)).toString("base64");
const dir = () => fs.mkdtempSync(path.join(os.tmpdir(), "prm-"));
const io = () => { const input = new PassThrough(), output = new PassThrough(); let text = ""; output.on("data", (d) => (text += d)); return { input, output, text: () => text }; };
const tick = () => new Promise((r) => setTimeout(r, 20));
const id = mk();

(async () => {
  console.log("[promptForSessionId]");
  let t = io(); let p = promptForSessionId(t); t.input.write(id + "\n");
  let r = await p;
  check("single-line paste accepted", r.ok && r.sessionId === id);
  check("prompt text shown to operator", /Paste your SESSION_ID/.test(t.text()));

  t = io(); p = promptForSessionId(t);
  const third = Math.floor(id.length / 3);
  t.input.write(id.slice(0, third) + "\n"); await tick();
  t.input.write(id.slice(third, 2 * third) + "\n"); await tick();
  const midMsg = t.text();
  t.input.write(id.slice(2 * third) + "\n");
  r = await p;
  check("paste cut into 3 lines is stitched together", r.ok && r.sessionId === id);
  check("tells operator it is waiting for the rest", /not complete yet/.test(midMsg));

  t = io(); p = promptForSessionId(t);
  t.input.write("hello world\n"); await tick();
  t.input.write(id + "\n");
  r = await p;
  check("wrong value rejected with reason, then correct one accepted", r.ok && /must start with/.test(t.text()));

  t = io(); p = promptForSessionId(t);
  t.input.write("VORTE_PRO~" + Buffer.from('{"a":1}').toString("base64") + "\n"); await tick();
  t.input.write(id + "\n");
  r = await p;
  check("not-credentials value rejected immediately (no waiting for more)", r.ok && /not WhatsApp credentials/.test(t.text()));

  t = io(); p = promptForSessionId(t);
  t.input.write(id.slice(0, 50) + "\n"); await tick();
  t.input.write("reset\n"); await tick();
  t.input.write(id + "\n");
  r = await p;
  check("'reset' discards a half-pasted value", r.ok && r.sessionId === id);

  t = io(); p = promptForSessionId(t);
  t.input.write("\n\n   \n"); await tick(); t.input.write(`  "${id}"  \n`);
  r = await p;
  check("blank lines ignored, quotes/spaces tolerated", r.ok && r.sessionId === id);

  t = io(); p = promptForSessionId(t); t.input.end();
  r = await p;
  check("no console attached (stdin ends) -> gives up, does not hang", r.ok === false && r.reason === "eof");

  console.log("[acquireSession]");
  let d = dir(); t = io();
  let s = await acquireSession(d, { SESSION_ID: id }, { ...t, allowPrompt: true, root: dir() });
  check("valid env SESSION_ID: no prompt, loaded", s.status === "loaded" && t.text() === "");
  d = dir(); fs.writeFileSync(path.join(d, "creds.json"), "{}"); t = io();
  s = await acquireSession(d, {}, { ...t, hasSavedCreds: true });
  check("no env but saved creds on disk: no prompt", s.status === "saved" && t.text() === "");

  d = dir(); t = io(); const env = {};
  let pa = acquireSession(d, env, { ...t, allowPrompt: true, root: dir() }); await tick();
  t.input.write(id + "\n"); s = await pa;
  check("no SESSION_ID: asks, loads pasted value, writes creds.json", s.status === "loaded" && JSON.parse(fs.readFileSync(path.join(d, "creds.json"), "utf8")).registrationId === 1);
  check("pasted ID is kept in env for reconnects", env.SESSION_ID === id);
  check("ID is never echoed back by the bot", !t.text().includes(id.slice(12, 60)));

  d = dir(); t = io();
  pa = acquireSession(d, { SESSION_ID: "VORTE_PRO~garbage$" }, { ...t, allowPrompt: true, root: dir() }); await tick();
  const shown = t.text(); t.input.write(id + "\n"); s = await pa;
  check("invalid env ID: explains, then prompts, then loads pasted one", /SESSION_ID problem/.test(shown) && s.status === "loaded");

  d = dir(); t = io(); t.input.end();
  s = await acquireSession(d, {}, { ...t, allowPrompt: true, waitForFile: false, root: dir() });
  check("no env + no console -> status missing (bot idles, no crash)", s.status === "missing");
  d = dir(); t = io();
  s = await acquireSession(d, {}, { ...t, allowPrompt: false });
  check("SESSION_PROMPT=false path: no prompt at all", s.status === "missing" && t.text() === "");

  console.log("[session.txt file method]");
  const fileRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), "froot-"));
  // console ended (Katabump case) and file appears while waiting
  let root = fileRoot(); d = dir(); t = io(); t.input.end();
  pa = acquireSession(d, {}, { ...t, root, pollMs: 40 });
  await new Promise((r) => setTimeout(r, 150));
  check("stdin ended: tells operator to create session.txt, keeps waiting", /session\.txt/.test(t.text()));
  fs.writeFileSync(path.join(root, "session.txt"), id + "\n");
  s = await pa;
  check("session.txt appearing later is picked up and loaded", s.status === "loaded" && s.via === "file" && JSON.parse(fs.readFileSync(path.join(d, "creds.json"), "utf8")).registrationId === 1);
  check("session.txt is deleted after it is read", !fs.existsSync(path.join(root, "session.txt")));

  root = fileRoot(); fs.writeFileSync(path.join(root, "session.txt"), id); d = dir(); t = io();
  s = await acquireSession(d, {}, { ...t, root, pollMs: 40 });
  check("session.txt already present at start: used immediately, no prompt", s.status === "loaded" && s.via === "file" && !/Paste your SESSION_ID/.test(t.text()));

  root = fileRoot(); d = dir(); t = io(); t.input.end();
  pa = acquireSession(d, {}, { ...t, root, pollMs: 40 });
  fs.writeFileSync(path.join(root, "session.txt"), "VORTE_PRO~notvalid$$"); await new Promise((r) => setTimeout(r, 150));
  const badShown = t.text();
  fs.writeFileSync(path.join(root, "session.txt"), mk(creds(5)));
  s = await pa;
  check("bad session.txt: reason shown, keeps waiting, fixed file then works", /session\.txt: /.test(badShown) && s.status === "loaded" && JSON.parse(fs.readFileSync(path.join(d, "creds.json"), "utf8")).registrationId === 5);

  root = fileRoot(); d = dir(); t = io(); // console OPEN but silent; file wins and releases the prompt
  pa = acquireSession(d, {}, { ...t, root, pollMs: 40 });
  await new Promise((r) => setTimeout(r, 100)); fs.writeFileSync(path.join(root, "session.txt"), id);
  s = await pa;
  check("console open + file supplied: file wins, prompt released", s.status === "loaded" && s.via === "file");

  root = fileRoot(); d = dir(); t = io(); t.input.end();
  s = await acquireSession(d, {}, { ...t, root, waitForFile: false });
  check("waitForFile=false: returns missing instead of waiting forever", s.status === "missing");

  root = fileRoot(); d = dir(); t = io(); t.input.end(); fs.writeFileSync(path.join(root, "session.txt"), id.slice(0, 80));
  s = await acquireSession(d, {}, { ...t, root, waitForFile: false });
  check("incomplete session.txt is not accepted", s.status === "missing" && !fs.existsSync(path.join(d, "creds.json")));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
