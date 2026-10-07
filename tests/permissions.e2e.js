// Permission matrix + Baileys v7 LID handling. Run: node tests/permissions.e2e.js
process.env.OWNER_1 = "255700000001";
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(`  ${ok ? "✅" : "❌"} ${n}${ok ? "" : " -> " + (d ?? "")}`); };

const helpers = require("../src/utils/helpers");
const identity = require("../src/utils/identity");
const leave = require("../src/commands/leave");
const promote = require("../src/commands/promote");
const { guardGroupAdmin } = require("../src/utils/guards");

const G = "120363000000000001@g.us";
// LID-addressed group (Baileys v7): participant id is a LID, phone in phoneNumber
const lidGroup = [
  { id: "9001@lid", phoneNumber: "255700000001@s.whatsapp.net", admin: null },            // owner (regular member here)
  { id: "9002@lid", phoneNumber: "255700000002@s.whatsapp.net", admin: "admin" },         // other admin
  { id: "9003@lid", phoneNumber: "255700000003@s.whatsapp.net", admin: null },            // member
  { id: "9099@lid", phoneNumber: "255700009999@s.whatsapp.net", admin: "admin" },         // the bot
];
// phone-addressed group: id is phone, lid separate
const pnGroup = [
  { id: "255700000001@s.whatsapp.net", lid: "9001@lid", admin: null },
  { id: "255700000002@s.whatsapp.net", lid: "9002@lid", admin: "superadmin" },
  { id: "255700000003@s.whatsapp.net", lid: "9003@lid", admin: null },
  { id: "255700009999@s.whatsapp.net", lid: "9099@lid", admin: null },                   // bot NOT admin
];

function mkSock(participants) {
  const sent = []; let left = false, promoted = false;
  return {
    sent, get left() { return left; }, get promoted() { return promoted; },
    user: { id: "255700009999:7@s.whatsapp.net", lid: "9099:7@lid" },
    groupMetadata: async () => ({ id: G, subject: "T", participants }),
    sendMessage: async (_c, c) => { sent.push(c.text); },
    groupLeave: async () => { left = true; },
    groupParticipantsUpdate: async () => { promoted = true; },
  };
}
const msg = (participant, extra = {}) => ({ key: { remoteJid: G, participant, fromMe: false, ...extra }, message: { extendedTextMessage: { text: "x", contextInfo: { mentionedJid: ["9003@lid"] } } } });

(async () => {
  for (const [label, parts] of [["LID-addressed group", lidGroup], ["phone-addressed group", pnGroup]]) {
    console.log(`\n[${label}]`);
    const lidMode = parts === lidGroup;
    const asOwner = lidMode ? msg("9001@lid", { participantAlt: "255700000001@s.whatsapp.net" }) : msg("255700000001@s.whatsapp.net");
    const asAdmin = lidMode ? msg("9002@lid") : msg("255700000002@s.whatsapp.net");
    const asMember = lidMode ? msg("9003@lid") : msg("255700000003@s.whatsapp.net");

    // owner-only: .leave
    let s = mkSock(parts); await identity.resolveSender(s, asOwner); await leave.execute(s, asOwner, []);
    check(".leave: OWNER allowed", s.left === true, s.sent);
    s = mkSock(parts); await identity.resolveSender(s, asAdmin); await leave.execute(s, asAdmin, []);
    check(".leave: group ADMIN denied", s.left === false && /Owner only/.test(s.sent[0] || ""), s.sent);
    s = mkSock(parts); await identity.resolveSender(s, asMember); await leave.execute(s, asMember, []);
    check(".leave: MEMBER denied", s.left === false, s.sent);

    // admin-only: guardGroupAdmin (used by kick/mute/close/...), botAdmin required
    const botIsAdmin = lidMode;
    s = mkSock(parts); await identity.resolveSender(s, asOwner);
    check("admin cmd: OWNER allowed", (await guardGroupAdmin(s, asOwner, { botAdmin: botIsAdmin })) === true, s.sent);
    s = mkSock(parts); await identity.resolveSender(s, asAdmin);
    check("admin cmd: group ADMIN allowed", (await guardGroupAdmin(s, asAdmin, { botAdmin: botIsAdmin })) === true, s.sent);
    s = mkSock(parts); await identity.resolveSender(s, asMember);
    check("admin cmd: MEMBER denied", (await guardGroupAdmin(s, asMember, { botAdmin: botIsAdmin })) === false);

    // bot-admin detection (phone JID vs LID mismatch was the v7 bug)
    s = mkSock(parts);
    check(`bot admin detected correctly (expected ${botIsAdmin})`, (await helpers.isBotAdmin(s, G)) === botIsAdmin);
    s = mkSock(parts); await identity.resolveSender(s, asAdmin);
    const r = await guardGroupAdmin(s, asAdmin, { botAdmin: true });
    check("bot-admin-required cmd gives correct result / message", lidMode ? r === true : (r === false && /need to be a group admin/.test(s.sent[0])), s.sent);

    // .promote inline check (had the sock.user.id vs p.id bug)
    s = mkSock(parts); await identity.resolveSender(s, asAdmin); await promote.execute(s, asAdmin, ["x"]);
    check(".promote: admin works iff bot is admin", s.promoted === botIsAdmin, s.sent);
    s = mkSock(parts); await identity.resolveSender(s, asMember); await promote.execute(s, asMember, ["x"]);
    check(".promote: member denied", s.promoted === false);

    // owner detection through LID
    s = mkSock(parts); await identity.resolveSender(s, asOwner);
    check("isOwner(owner sender)", helpers.isOwner(asOwner.key.participant) === true);
    s = mkSock(parts); await identity.resolveSender(s, asAdmin);
    check("isOwner(admin sender) is false", helpers.isOwner(asAdmin.key.participant) === false);
  }

  console.log("\n[misc]");
  const s2 = mkSock(lidGroup);
  const fm = msg("9099@lid", { fromMe: true }); await identity.resolveSender(s2, fm);
  await leave.execute(s2, fm, []);
  check(".leave: fromMe (bot account itself) allowed", s2.left === true, s2.sent);
  check("unknown LID is NOT treated as owner", helpers.isOwner("5555@lid") === false);
  check("plain phone JID owner still works (legacy)", helpers.isOwner("255700000001@s.whatsapp.net") === true);
  check("device suffix ignored", helpers.isOwner("255700000001:12@s.whatsapp.net") === true);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
