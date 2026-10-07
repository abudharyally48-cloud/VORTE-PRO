// SESSION_ID loader tests. Run: node tests/session.e2e.js
const fs = require("fs"), os = require("os"), path = require("path");
const L = require("../src/bot/sessionLoader");
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(`  ${ok ? "✅" : "❌"} ${n}${ok ? "" : " -> " + (d ?? "")}`); };

const creds = (n = 1) => ({ noiseKey: { private: "a", public: "b" }, signedIdentityKey: { private: "c" }, registrationId: n, me: { id: "255700000001:12@s.whatsapp.net" } });
const mk = (c = creds()) => "VORTE_PRO~" + Buffer.from(JSON.stringify(c)).toString("base64");
const dir = () => fs.mkdtempSync(path.join(os.tmpdir(), "sess-"));
const read = (d) => JSON.parse(fs.readFileSync(path.join(d, "creds.json"), "utf8"));

const id = mk();
console.log("[parse]");
check("valid ID parses, phone extracted", L.parseSessionId(id).ok && L.parseSessionId(id).phone === "255700000001");
check("wrapped in quotes", L.parseSessionId(`"${id}"`).ok);
check("line-wrapped / spaces (pasted across lines)", L.parseSessionId(id.replace(/(.{40})/g, "$1\n ")).ok);
check("empty rejected", !L.parseSessionId("").ok && !L.parseSessionId(undefined).ok);
check("missing prefix rejected", !L.parseSessionId(id.slice(10)).ok);
check("truncated ID rejected (not decodable)", !L.parseSessionId(id.slice(0, id.length - 25)).ok);
check("garbage base64 chars rejected", !L.parseSessionId("VORTE_PRO~abc$%^").ok);
check("valid JSON but not creds rejected", !L.parseSessionId("VORTE_PRO~" + Buffer.from('{"a":1}').toString("base64")).ok);
const unpaired = creds(); delete unpaired.me;
check("unfinished pairing (no me) rejected", !L.parseSessionId(mk(unpaired)).ok);

console.log("[apply]");
let d = dir();
check("no SESSION_ID -> missing", L.applySessionId(d, undefined).status === "missing");
check("invalid -> invalid (+message), nothing written", (() => { const r = L.applySessionId(d, "VORTE_PRO~xx"); return r.status === "invalid" && r.message && !fs.existsSync(path.join(d, "creds.json")); })());
let r = L.applySessionId(d, id);
check("first run -> loaded, creds.json written", r.status === "loaded" && read(d).registrationId === 1);
check("hash file does NOT contain the raw SESSION_ID", !fs.readFileSync(path.join(d, ".session_hash"), "utf8").includes("VORTE_PRO"));
const c = read(d); c.registrationId = 777; c.rotated = true; fs.writeFileSync(path.join(d, "creds.json"), JSON.stringify(c));
r = L.applySessionId(d, id);
check("same ID again -> unchanged, fresher on-disk creds kept", r.status === "unchanged" && read(d).rotated === true);
fs.writeFileSync(path.join(d, "app-state-sync-key-1.json"), "{}");
r = L.applySessionId(d, mk(creds(2)));
check("NEW ID -> loaded, old session files wiped", r.status === "loaded" && read(d).registrationId === 2 && !fs.existsSync(path.join(d, "app-state-sync-key-1.json")));
d = dir(); fs.writeFileSync(path.join(d, ".session_hash"), id); fs.writeFileSync(path.join(d, "creds.json"), JSON.stringify(creds()));
check("legacy .session_hash (raw ID) treated as unchanged + migrated", L.applySessionId(d, id).status === "unchanged" && !fs.readFileSync(path.join(d, ".session_hash"), "utf8").includes("VORTE_PRO"));
d = dir(); L.applySessionId(d, id); fs.rmSync(path.join(d, "creds.json"));
check("hash matches but creds.json missing -> reloaded", L.applySessionId(d, id).status === "loaded" && fs.existsSync(path.join(d, "creds.json")));

console.log("[logged out]");
d = dir(); L.applySessionId(d, id); L.markDead(d, id);
check("markDead wipes session files", !fs.existsSync(path.join(d, "creds.json")));
check("same dead ID on restart -> 'dead' (no reconnect loop)", L.applySessionId(d, id).status === "dead");
check("a NEW ID after a dead one works", L.applySessionId(d, mk(creds(9))).status === "loaded");
d = dir(); L.applySessionId(d, id); L.forgetLoaded(d);
check("forgetLoaded makes next start re-apply SESSION_ID", L.applySessionId(d, id).status === "loaded");

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
