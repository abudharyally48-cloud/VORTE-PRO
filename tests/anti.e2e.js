// Anti systems: warn/delete/remove modes, warnings per group+user+feature, persistence,
// bot-admin safety. Run: node tests/anti.e2e.js
const M = require("./_mock");
const { check, section, done, makeSock, groupMsg, makeStore, texts, lastText, G, jidOf } = M;
const handler = require("../src/bot/handlers/commandHandler");
const { processMessage } = require("../src/bot/events/messageHandler");

const feed = async (sock, m, store) => processMessage(sock, m, store.getSettings, store.saveSettings);
const inChat = (m, chat) => { m.key.remoteJid = chat; return m; };
const deletes = (s) => s.sent.filter((x) => x.content.delete);
const link = (n, id) => groupMsg(n, "check this https://spam.example.com/x", { id });
const cfg = (action, feature = "antilink", chat = G, extra = {}) => makeStore({ [chat]: { [feature]: true, ...(action ? { antiActions: { [feature]: action } } : {}), ...extra } });
const removed = (s, n) => !s.state.participants.some((p) => p.id === jidOf(n));

(async () => {
  section("config replies (spec format)");
  let s = makeSock(), st = makeStore();
  await handler.handle(s, groupMsg(2, ".antilink warn"), ".antilink warn", st.getSettings, st.saveSettings);
  check("warn", lastText(s) === "🛡️ ANTILINK\n\nStatus: ✅ ON\nAction: ⚠️ WARN\nWarning limit: 3", lastText(s));
  await handler.handle(s, groupMsg(2, ".antilink delete"), ".antilink delete", st.getSettings, st.saveSettings);
  check("delete", lastText(s) === "🛡️ ANTILINK\n\nStatus: ✅ ON\nAction: 🗑️ DELETE", lastText(s));
  await handler.handle(s, groupMsg(2, ".antilink remove"), ".antilink remove", st.getSettings, st.saveSettings);
  check("remove", lastText(s) === "🛡️ ANTILINK\n\nStatus: ✅ ON\nAction: 🚫 REMOVE", lastText(s));
  await handler.handle(s, groupMsg(2, ".antilink off"), ".antilink off", st.getSettings, st.saveSettings);
  check("off", /Status: ❌ OFF/.test(lastText(s)));
  await handler.handle(s, groupMsg(2, ".antilink on"), ".antilink on", st.getSettings, st.saveSettings);
  check("'on' keeps the previously chosen action", /Action: 🚫 REMOVE/.test(lastText(s)), lastText(s));
  for (const f of ["antispam", "antimention", "antibug"]) {
    s = makeSock(); st = makeStore();
    await handler.handle(s, groupMsg(2, `.${f} delete`), `.${f} delete`, st.getSettings, st.saveSettings);
    check(`.${f} delete is supported`, lastText(s).startsWith(`🛡️ ${f.toUpperCase()}`) && /DELETE/.test(lastText(s)), lastText(s));
  }
  s = makeSock({ botAdmin: false }); st = makeStore();
  await handler.handle(s, groupMsg(2, ".antilink warn"), ".antilink warn", st.getSettings, st.saveSettings);
  check("enabling while the bot is not admin warns the admin", /I need to be a group admin/.test(lastText(s)));

  section("WARN mode: delete + warn + track + remove on the 3rd");
  s = makeSock(); st = cfg("warn");
  await feed(s, link(3, "w1"), st);
  check("1st: message deleted + 'WARNING 1/3' text", deletes(s).length === 1 && /^⚠️ WARNING 1\/3\n\n@9003 Your message violated the AntiLink rule\.\nThe message has been deleted\.$/.test(lastText(s)), texts(s));
  check("1st: user NOT removed, warning stored", !removed(s, 3) && st.raw()[G].antiWarnings.antilink && Object.values(st.raw()[G].antiWarnings.antilink)[0] === 1, st.raw());
  await feed(s, link(3, "w2"), st);
  check("2nd: 'WARNING 2/3 ... 1 warning remaining before removal'", /^⚠️ WARNING 2\/3\n\n@9003 You have received another warning\.\n1 warning remaining before removal\./.test(lastText(s)), lastText(s));
  await feed(s, link(3, "w3"), st);
  check("3rd: user removed for real + 'WARNING 3/3' text", removed(s, 3) && /^🚫 WARNING 3\/3\n\n@9003 has reached the warning limit\.\nThe violating message was deleted and the user has been removed\.$/.test(lastText(s)), lastText(s));
  check("3 messages deleted in total", deletes(s).length === 3);
  check("warning state cleared after removal", !Object.keys(st.raw()[G].antiWarnings.antilink || {}).length, st.raw()[G]);

  section("persistence: counters survive a restart");
  s = makeSock(); st = cfg("warn");
  await feed(s, link(3, "p1"), st); await feed(s, link(3, "p2"), st);
  const restarted = makeStore(st.raw());               // brand-new process reading the saved file
  const s2 = makeSock();
  await feed(s2, link(3, "p3"), restarted);
  check("after restart the 3rd strike still removes", removed(s2, 3), texts(s2));

  section("warnings are per group, per user, per feature");
  const H = "120363999999999999@g.us";
  s = makeSock(); st = makeStore({ [G]: { antilink: true, antispam: true }, [H]: { antilink: true } });
  await feed(s, link(3, "a1"), st); await feed(s, link(3, "a2"), st);
  await feed(s, inChat(link(3, "b1"), H), st);
  const w = st.raw();
  check("other GROUP starts at 1 (not 3)", Object.values(w[H].antiWarnings.antilink)[0] === 1 && Object.values(w[G].antiWarnings.antilink)[0] === 2, w);
  await feed(s, link(4, "u1"), st);
  check("other USER starts at 1", Object.values(w[G].antiWarnings.antilink).length === 1 && Object.values(st.raw()[G].antiWarnings.antilink).sort().join() === "1,2", st.raw()[G].antiWarnings);
  for (let i = 0; i < 7; i++) await feed(s, groupMsg(3, "flood " + i, { id: "f" + i }), st);
  check("other FEATURE (antispam) has its own counter: 1, not 3", st.raw()[G].antiWarnings.antispam && Object.values(st.raw()[G].antiWarnings.antispam)[0] === 1 && !removed(s, 3), st.raw()[G].antiWarnings);

  section("DELETE mode: only deletes");
  s = makeSock(); st = cfg("delete");
  await feed(s, link(3, "d1"), st); await feed(s, link(3, "d2"), st); await feed(s, link(3, "d3"), st); await feed(s, link(3, "d4"), st);
  check("4 violations: 4 deletions, no warnings, nobody removed", deletes(s).length === 4 && !removed(s, 3) && !st.raw()[G].antiWarnings && texts(s).every((t) => t === "🗑️ Message deleted."), texts(s));

  section("REMOVE mode: delete + remove immediately");
  s = makeSock(); st = cfg("remove");
  await feed(s, link(3, "r1"), st);
  check("deleted AND removed on the first violation", deletes(s).length === 1 && removed(s, 3) && lastText(s) === "🚫 Message deleted.\n👤 User removed from the group.", texts(s));

  section("admins and the owner are never punished");
  s = makeSock(); st = cfg("remove");
  await feed(s, link(2, "x1"), st); await feed(s, link(1, "x2"), st);
  check("group admin + bot owner posting links -> untouched", deletes(s).length === 0 && !removed(s, 2) && !removed(s, 1));

  section("bot-admin safety (no pretending)");
  s = makeSock({ botAdmin: false }); st = cfg("remove", "antilink", "120363777777777777@g.us");
  await feed(s, inChat(link(3, "n1"), "120363777777777777@g.us"), st); await feed(s, inChat(link(3, "n2"), "120363777777777777@g.us"), st);
  check("no delete / kick attempted", deletes(s).length === 0 && !s.calls.some((c) => c[0] === "participants"));
  check("tells the group 'I need to be a group admin…' (once, not per message)", texts(s).filter((t) => /I need to be a group admin to perform this action/.test(t)).length === 1, texts(s));
  s = makeSock({ refuse: { "9004": 403 } }); st = cfg("warn", "antilink", G, { antiWarnings: { antilink: { "pn:255700000004": 2 } } });
  await feed(s, link(4, "k1"), st);
  check("WhatsApp refuses the removal -> honest message, user still there", !removed(s, 4) && /couldn.t remove/.test(lastText(s)) && /WhatsApp refused/.test(lastText(s)), lastText(s));
  check("counter stays at the limit so the next offence retries", Object.values(st.raw()[G].antiWarnings.antilink)[0] === 3, st.raw()[G]);

  section("detection");
  for (const [label, text, expect] of [["chat.whatsapp.com invite (no scheme)", "join chat.whatsapp.com/AbCdEf", true], ["www. link", "see www.example.com now", true], ["wa.me link", "wa.me/255700000000", true], ["plain text", "hello friends", false]]) {
    s = makeSock(); st = cfg("delete");
    await feed(s, groupMsg(3, text, { id: "dt" + label.length }), st);
    check(`antilink: ${label} -> ${expect ? "caught" : "ignored"}`, (deletes(s).length === 1) === expect);
  }
  s = makeSock(); st = cfg("delete", "antimention");
  await feed(s, groupMsg(3, "hey", { mentions: Array.from({ length: 16 }, (_, i) => `99${i}@lid`), id: "am1" }), st);
  check("antimention: 16 mentions -> blocked", deletes(s).length === 1);
  s = makeSock(); st = cfg("delete", "antibug");
  await feed(s, groupMsg(3, "x".repeat(4100), { id: "ab1" }), st);
  check("antibug: oversized text -> blocked", deletes(s).length === 1);
  s = makeSock(); st = cfg("warn", "antibug");
  await feed(s, groupMsg(3, "x".repeat(4100), { id: "ab2" }), st);
  check("antibug supports warn mode (counter per feature)", st.raw()[G].antiWarnings.antibug && /WARNING 1\/3/.test(lastText(s)));

  section("antibot: flagged number (LID sender resolved to its phone) gets the chosen action");
  s = makeSock(); st = makeStore({ [G]: { antibot: true, knownBots: ["255700000004"] } });
  await feed(s, groupMsg(4, "I am a bot", { id: "bt1" }), st);
  check("default (legacy) = remove: deleted + removed", deletes(s).length === 1 && removed(s, 4), texts(s));
  s = makeSock(); st = makeStore({ [G]: { antibot: true, antiActions: { antibot: "delete" }, knownBots: ["255700000004"] } });
  await feed(s, groupMsg(4, "I am a bot", { id: "bt2" }), st);
  check("delete mode: deleted, not removed", deletes(s).length === 1 && !removed(s, 4));
  s = makeSock(); st = makeStore({ [G]: { antibot: true, antiActions: { antibot: "warn" }, knownBots: ["255700000004"] } });
  await feed(s, groupMsg(4, "I am a bot", { id: "bt3" }), st);
  check("warn mode: deleted + WARNING 1/3 (AntiBot rule)", deletes(s).length === 1 && /WARNING 1\/3[\s\S]*AntiBot rule/.test(lastText(s)), lastText(s));
  s = makeSock(); st = makeStore({ [G]: { antibot: true, knownBots: ["255700000004"] } });
  await feed(s, groupMsg(3, "I am human", { id: "bt4" }), st);
  check("non-flagged member untouched", deletes(s).length === 0 && !removed(s, 3));

  done();
})().catch((e) => { console.error(e); process.exit(1); });
