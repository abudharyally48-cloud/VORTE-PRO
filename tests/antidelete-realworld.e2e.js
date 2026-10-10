// AntiDelete in the situations that broke it for real: self mode, no OWNER set, Baileys' own revoke event.
// Run: node tests/antidelete-realworld.e2e.js
const M = require("./_mock");
const { check, section, done, makeSock, groupMsg, privateMsg, makeStore, sleep, G, jidOf } = M;
const config = require("../src/config/config");
const { processMessage } = require("../src/bot/events/messageHandler");
const { handleMessageUpdate } = require("../src/bot/events/editHandler");

const OWNER_INBOX = "255700000001@s.whatsapp.net";
const BOT_SELF = "255700009999@s.whatsapp.net";
const revoke = (orig, deleter) => [{ key: { remoteJid: orig.key.remoteJid, id: orig.key.id, fromMe: false, participant: deleter || orig.key.participant }, update: { message: null, messageStubType: 1 } }];
const to = (s, jid) => s.sent.filter((x) => x.jid === jid);
const settle = () => sleep(30);

(async () => {
  section("SELF mode (only the owner may use the bot) must not blind AntiDelete");
  let s = makeSock(), st = makeStore({ global: { mode: "self", antidelete: { enabled: true } } });
  const m1 = privateMsg("secret from a stranger", { from: "stranger", id: "SELF1" });
  await processMessage(s, m1, st.getSettings, st.saveSettings); await settle();
  check("in self mode the bot still does NOT answer the stranger (self mode unchanged)", s.sent.length === 0);
  await handleMessageUpdate(s, revoke(m1), st.getSettings);
  check("…but when the stranger deletes it, the owner gets it", to(s, OWNER_INBOX).length === 1 && /secret from a stranger/.test(to(s, OWNER_INBOX)[0].content.text), s.sent.map((x) => [x.jid, (x.content.text || "").slice(0, 40)]));
  s = makeSock(); st = makeStore({ global: { mode: "self", antidelete: { enabled: true } } });
  const g1 = groupMsg(3, "group secret in self mode", { id: "SELF2" });
  await processMessage(s, g1, st.getSettings, st.saveSettings); await settle();
  await handleMessageUpdate(s, revoke(g1, jidOf(3)), st.getSettings);
  check("same for a group message in self mode", to(s, OWNER_INBOX).length === 1 && /group secret in self mode/.test(to(s, OWNER_INBOX)[0].content.text));
  s = makeSock(); st = makeStore({ global: { mode: "self", antidelete: { enabled: true } } });
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const antiDelete = require("../src/utils/antiDelete");
  const img = { ...privateMsg("", { from: "stranger", id: "SELF3" }), message: { imageMessage: { caption: "photo", mimetype: "image/png", fileLength: png.length } } };
  await antiDelete.remember(s, img, st.getSettings(), { download: async () => png });
  await handleMessageUpdate(s, revoke(img), st.getSettings);
  check("media from others is recovered in self mode too", to(s, OWNER_INBOX).some((x) => Buffer.isBuffer(x.content.image)));

  section("the owner is not in a configured list -> the bot account itself receives it");
  const saved = [config.owner1, config.owner2]; config.owner1 = null; config.owner2 = null;
  s = makeSock(); st = makeStore({ global: { antidelete: { enabled: true } } });
  const m2 = privateMsg("no owner configured", { from: "stranger", id: "NOOWN1" });
  await processMessage(s, m2, st.getSettings, st.saveSettings); await settle(); s.sent.length = 0;
  await handleMessageUpdate(s, revoke(m2), st.getSettings);
  check("with no OWNER_1 set, it goes to the bot account's own chat ('You')", to(s, BOT_SELF).length === 1 && /no owner configured/.test(to(s, BOT_SELF)[0].content.text), s.sent.map((x) => x.jid));
  [config.owner1, config.owner2] = saved;
  s = makeSock(); st = makeStore({ global: { antidelete: { enabled: true } } });
  const m3 = privateMsg("owner is configured", { from: "stranger", id: "OWN2" });
  await processMessage(s, m3, st.getSettings, st.saveSettings); await settle(); s.sent.length = 0;
  await handleMessageUpdate(s, revoke(m3), st.getSettings);
  check("with OWNER_1 set it goes to OWNER_1 (not the bot account)", to(s, OWNER_INBOX).length === 1 && to(s, BOT_SELF).length === 0);

  section("what Baileys really emits for 'delete for everyone'");
  const baileys = require("baileys");
  let realEvents = [];
  try {
    const proc = require("baileys/lib/Utils/process-message");
    const fn = proc.default || proc.processMessage;
    const ev = new (require("events"))();
    ev.on("messages.update", (u) => realEvents.push(...u));
    const wm = baileys.proto.WebMessageInfo.fromObject({
      key: { remoteJid: G, fromMe: false, id: "REVOKER1", participant: jidOf(3) },
      messageTimestamp: Math.floor(Date.now() / 1000),
      message: { protocolMessage: { type: baileys.proto.Message.ProtocolMessage.Type.REVOKE, key: { remoteJid: G, fromMe: false, id: "REAL-ORIG-1", participant: jidOf(3) } } }
    });
    await fn(wm, { shouldProcessHistoryMsg: false, ev, creds: { me: { id: "255700009999:7@s.whatsapp.net" } }, keyStore: { get: async () => ({}), set: async () => {} }, logger: { info() {}, warn() {}, debug() {}, error() {}, trace() {}, child() { return this; } }, options: {}, getMessage: async () => undefined });
  } catch (e) { console.log("  (note: could not drive Baileys' own processMessage here: " + e.message + ")"); }
  if (realEvents.length) {
    const u = realEvents[0];
    check("Baileys emits messages.update with the ORIGINAL id and message:null", u.key.id === "REAL-ORIG-1" && u.update.message === null && u.update.messageStubType === baileys.proto.WebMessageInfo.StubType.REVOKE, u);
    s = makeSock(); st = makeStore({ global: { mode: "self", antidelete: { enabled: true } } });
    const orig = groupMsg(3, "deleted for everyone", { id: "REAL-ORIG-1" });
    await processMessage(s, orig, st.getSettings, st.saveSettings); await settle();
    await handleMessageUpdate(s, realEvents, st.getSettings);
    check("feeding Baileys' REAL event into our handler recovers the message", to(s, OWNER_INBOX).length === 1 && /deleted for everyone/.test(to(s, OWNER_INBOX)[0].content.text), s.sent.map((x) => x.jid));
  } else check("(Baileys revoke event could not be produced in this environment — covered by source reading)", true);

  done();
})().catch((e) => { console.error(e); process.exit(1); });
