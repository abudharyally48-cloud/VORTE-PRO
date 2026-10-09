// Automation: scope settings AND the runtime that must obey them. Run: node tests/automation.e2e.js
const M = require("./_mock");
const { check, section, done, makeSock, groupMsg, privateMsg, makeStore, texts, lastText, sleep, G } = M;
const handler = require("../src/bot/handlers/commandHandler");
const { processMessage } = require("../src/bot/events/messageHandler");
const automation = require("../src/utils/automation");
const migrate = require("../src/utils/settingsMigrate");

const cmd = async (sock, m, store) => handler.handle(sock, m, m.message.conversation, store.getSettings, store.saveSettings);
const feed = async (sock, m, store) => { await processMessage(sock, m, store.getSettings, store.saveSettings); await sleep(40); };
const presence = (s) => s.calls.filter((c) => c[0] === "presence").map((c) => c[1] + "@" + (c[2] === G ? "group" : "private"));
const withAuto = (key, scope) => makeStore({ global: { automation: { [key]: { enabled: scope !== "off", scope: scope === "off" ? "both" : scope } } } });
const strangerPrivate = (text, extra) => privateMsg(text, { from: "stranger", ...extra });

(async () => {
  section("command replies show the real state (spec formats)");
  let s = makeSock(), st = makeStore();
  await cmd(s, privateMsg(".autotyping private"), st);
  check("private", lastText(s) === "🤖 AUTO TYPING\n\nStatus: ✅ ON\nScope: 👤 Private", lastText(s));
  await cmd(s, privateMsg(".autotyping groups"), st);
  check("groups", lastText(s) === "🤖 AUTO TYPING\n\nStatus: ✅ ON\nScope: 👥 Groups", lastText(s));
  await cmd(s, privateMsg(".autotyping both"), st);
  check("both", lastText(s) === "🤖 AUTO TYPING\n\nStatus: ✅ ON\nScope: 🌐 All Chats", lastText(s));
  await cmd(s, privateMsg(".autotyping off"), st);
  check("off", lastText(s) === "🤖 AUTO TYPING\n\nStatus: ❌ OFF\nScope: 🌐 All Chats", lastText(s));
  await cmd(s, privateMsg(".autotyping on"), st);
  check("'on' after 'off' restores ON (scope kept)", /Status: ✅ ON/.test(lastText(s)));
  await cmd(s, privateMsg(".autorecording both"), st);
  check("autorecording panel", lastText(s) === "🎙️ AUTO RECORDING\n\nStatus: ✅ ON\nScope: 🌐 All Chats", lastText(s));
  await cmd(s, privateMsg(".autotyping banana"), st);
  check("invalid value -> usage, setting unchanged", /Usage: \.autotyping on\|off\|private\|groups\|both/.test(lastText(s)) && st.raw().global.automation.autotyping.enabled === true);
  await cmd(s, privateMsg(".setting autoread groups"), st);
  check("legacy '.setting <key> <value>' form still works", st.raw().global.automation.autoread.scope === "groups");

  section("autotyping RUNTIME respects scope");
  for (const [scope, expPrivate, expGroup] of [["private", true, false], ["groups", false, true], ["both", true, true], ["off", false, false]]) {
    s = makeSock(); st = withAuto("autotyping", scope);
    await feed(s, strangerPrivate("hello there"), st);
    const privOk = presence(s).includes("composing@private");
    s = makeSock(); await feed(s, groupMsg(3, "hello group"), st);
    const grpOk = presence(s).includes("composing@group");
    check(`scope=${scope}: private=${expPrivate} group=${expGroup}`, privOk === expPrivate && grpOk === expGroup, { privOk, grpOk });
  }
  s = makeSock(); st = withAuto("autotyping", "both");
  await feed(s, strangerPrivate("hi"), st);
  check("subscribes to presence before showing typing", s.calls.some((c) => c[0] === "subscribe") && s.calls.findIndex((c) => c[0] === "subscribe") < s.calls.findIndex((c) => c[0] === "presence"));
  s = makeSock(); await feed(s, { key: { remoteJid: "status@broadcast", participant: "9777@lid", id: "S1" }, message: { conversation: "status" } }, st);
  check("no typing presence for status updates", presence(s).length === 0, presence(s));

  section("autorecording RUNTIME respects scope");
  for (const [scope, expPrivate, expGroup] of [["private", true, false], ["groups", false, true], ["both", true, true]]) {
    s = makeSock(); st = withAuto("autorecording", scope);
    await feed(s, strangerPrivate("hello"), st);
    const privOk = presence(s).includes("recording@private");
    s = makeSock(); await feed(s, groupMsg(3, "hello"), st);
    check(`recording scope=${scope}: private=${expPrivate} group=${expGroup}`, privOk === expPrivate && presence(s).includes("recording@group") === expGroup);
  }
  s = makeSock(); st = makeStore({ global: { automation: { autotyping: { enabled: true, scope: "both" }, autorecording: { enabled: true, scope: "both" } } } });
  await feed(s, strangerPrivate("text"), st);
  const textP = presence(s);
  s = makeSock(); await feed(s, strangerPrivate("", { message: { audioMessage: { ptt: true } } }), st);
  check("both on: text -> typing, voice note -> recording", textP.includes("composing@private") && !textP.includes("recording@private") && presence(s).includes("recording@private"), { textP, voice: presence(s) });

  section("typing clears itself (paused)");
  s = makeSock(); st = withAuto("autotyping", "both");
  await feed(s, strangerPrivate("hello"), st);
  await sleep(3800);
  check("'paused' follows 'composing'", presence(s).slice(-1)[0] === "paused@private" && presence(s)[0] === "composing@private", presence(s));

  section("autoread / autoreact (scoped) + status automation + online");
  s = makeSock(); st = withAuto("autoread", "groups");
  await feed(s, strangerPrivate("hi"), st);
  const readPriv = s.calls.some((c) => c[0] === "read");
  s = makeSock(); await feed(s, groupMsg(3, "hi"), st);
  check("autoread groups-only: reads group msgs, not private", !readPriv && s.calls.some((c) => c[0] === "read"));
  s = makeSock(); st = withAuto("autoreact", "private");
  await feed(s, strangerPrivate("hi"), st);
  const reactPriv = s.sent.some((x) => x.content.react);
  s = makeSock(); await feed(s, groupMsg(3, "hi"), st);
  check("autoreact private-only: reacts in private, not in groups", reactPriv && !s.sent.some((x) => x.content.react));
  s = makeSock(); st = makeStore({ global: { autostatusview: true, autoreacttostatus: true } });
  await feed(s, { key: { remoteJid: "status@broadcast", participant: "9777@lid", id: "S2" }, message: { imageMessage: {} } }, st);
  check("autostatusview reads the status", s.calls.some((c) => c[0] === "read" && c[1][0].remoteJid === "status@broadcast"));
  check("autoreacttostatus reacts to the status with a statusJidList", s.sent.some((x) => x.jid === "status@broadcast" && x.content.react && x.opts?.statusJidList?.length), s.sent);
  s = makeSock(); st = makeStore({ global: { online: true } });
  await feed(s, strangerPrivate("hi"), st);
  check("online: presence 'available' is sent", s.calls.some((c) => c[0] === "presence" && c[1] === "available"));

  section("messages after the first in one upsert are not dropped");
  s = makeSock(); st = withAuto("autoread", "both");
  const { handleMessage } = require("../src/bot/events/messageHandler");
  await handleMessage(s, { type: "notify", messages: [strangerPrivate("one"), strangerPrivate("two"), strangerPrivate("three")] }, st.getSettings, st.saveSettings);
  await sleep(40);
  check("3 messages in one batch -> 3 reads", s.calls.filter((c) => c[0] === "read").length === 3, s.calls.filter((c) => c[0] === "read").length);

  section("old per-chat flags are migrated");
  const old = { [G]: { autotyping: true, welcome: true }, "9777@lid": { autotyping: true, autoread: true }, "120363111@g.us": { antidelete: true } };
  const changed = migrate.migrate(old);
  check("migration reports a change", changed === true);
  check("autotyping private+group -> both", old.global.automation.autotyping.scope === "both");
  check("autoread only in a private chat -> private", old.global.automation.autoread.scope === "private");
  check("legacy flags removed, other settings kept", !("autotyping" in old[G]) && old[G].welcome === true);
  check("legacy antidelete -> global on", old.global.antidelete.enabled === true && !("antidelete" in old["120363111@g.us"]));
  check("migration is idempotent", migrate.migrate(old) === false);

  done();
})().catch((e) => { console.error(e); process.exit(1); });
