// .welcome shows the REAL group description (default rules only when there is none). Run: node tests/welcome.e2e.js
const M = require("./_mock");
const { check, section, done, makeSock, makeStore, G, jidOf, texts } = M;
const { handleGroupUpdate } = require("../src/bot/events/groupHandler");
const { buildWelcome, DEFAULT_RULES, DEFAULT_RULES_LINES } = require("../src/utils/welcomeMessage");

const join = async (sock, store, who = jidOf(3)) => { sock.sent.length = 0; await handleGroupUpdate(sock, { id: G, action: "add", participants: [who] }, store.getSettings); return sock.sent; };
const image = (sent) => sent.find((x) => x.content.image);
const store = (extra = {}) => makeStore({ [G]: { welcome: true, ...extra } });
const RULES_RE = /GROUP RULES[\s\S]*Respect everyone[\s\S]*No spam[\s\S]*No links[\s\S]*No adult content[\s\S]*Follow admins/;

(async () => {
  section("group HAS a description -> it is shown, rules are not");
  let s = makeSock(); s.state.desc = "Welcome to the Swahili devs! We share code on Fridays.";
  let sent = await join(s, store());
  let img = image(sent);
  check("image welcome sent with mention", !!img && img.content.mentions[0] === jidOf(3));
  check("caption contains the real description", /GROUP DESCRIPTION\*\nWelcome to the Swahili devs! We share code on Fridays\./.test(img.content.caption), img.content.caption);
  check("default rules are NOT shown", !/GROUP RULES|Respect everyone/.test(img.content.caption));
  check("header still shows user and group name", /Welcome @9003/.test(img.content.caption) && /Group: Test Group/.test(img.content.caption));

  section("group has NO description -> default rules from the bot code");
  s = makeSock(); s.state.desc = "";
  img = image(await join(s, store()));
  check("rules shown", RULES_RE.test(img.content.caption), img.content.caption);
  check("no 'GROUP DESCRIPTION' heading", !/GROUP DESCRIPTION/.test(img.content.caption));
  s = makeSock(); s.state.desc = "   \n  ";
  img = image(await join(s, store()));
  check("whitespace-only description counts as no description", RULES_RE.test(img.content.caption));

  section("description is read fresh at every join");
  s = makeSock(); s.state.desc = "First description";
  const st = store();
  await join(s, st);
  s.state.desc = "Second description (edited)";
  img = image(await join(s, st, jidOf(4)));
  check("2nd join uses the edited description", /Second description \(edited\)/.test(img.content.caption) && !/First description/.test(img.content.caption), img.content.caption);
  s.state.desc = "";
  img = image(await join(s, st, jidOf(4)));
  check("description removed -> falls back to the rules", RULES_RE.test(img.content.caption));

  section("long description");
  s = makeSock(); s.state.desc = "Line one of a very long description. ".repeat(40);
  sent = await join(s, store());
  img = image(sent);
  check("picture keeps a short caption (header)", img.content.caption.length < 400 && /WELCOME/.test(img.content.caption));
  const follow = sent.find((x) => x.content.text && /GROUP DESCRIPTION/.test(x.content.text));
  check("full description follows as text, nothing cut", follow && follow.content.text.includes("Line one of a very long description.") && follow.content.text.length > 1000, follow && follow.content.text.length);

  section("custom .setwelcome message");
  s = makeSock(); s.state.desc = "We love open source";
  img = image(await join(s, store({ welcomeMessage: "Hi {user}, welcome to {group}!\n{desc}" })));
  check("{user} {group} {desc} replaced (real description)", img.content.caption === "Hi @9003, welcome to Test Group!\nWe love open source", img.content.caption);
  s = makeSock(); s.state.desc = "";
  img = image(await join(s, store({ welcomeMessage: "Hi {user}\n{description}" })));
  check("{desc} with no group description -> default rules lines", img.content.caption === `Hi @9003\n${DEFAULT_RULES_LINES.join("\n")}`, img.content.caption);
  s = makeSock(); s.state.desc = "ignored";
  img = image(await join(s, store({ welcomeMessage: "Hi {user}, welcome to {group}!" })));
  check("custom message without {desc} stays exactly as written", img.content.caption === "Hi @9003, welcome to Test Group!");

  section("robustness");
  s = makeSock(); s.state.desc = "Still shows the description";
  s.profilePictureUrl = async () => { throw new Error("no picture"); };
  sent = await join(s, store());
  check("no profile picture -> default picture is used, welcome still sent", !!image(sent) && /Still shows the description/.test(image(sent).content.caption));
  s = makeSock(); s.state.desc = "Desc for object participants";
  sent = await (async () => { s.sent.length = 0; await handleGroupUpdate(s, { id: G, action: "add", participants: [{ id: jidOf(3), phoneNumber: "255700000003@s.whatsapp.net" }] }, store().getSettings); return s.sent; })();
  check("participants given as objects (Baileys v7) work", !!image(sent) && /Desc for object participants/.test(image(sent).content.caption));
  s = makeSock(); s.state.desc = "x";
  sent = await join(s, makeStore({ [G]: { welcome: false } }));
  check("welcome off -> nothing sent", sent.length === 0);
  s = makeSock(); s.state.desc = "Description survives an image failure";
  const orig = s.sendMessage;
  s.sendMessage = async (jid, c, o) => { if (c.image) throw new Error("upload failed"); return orig(jid, c, o); };
  await handleGroupUpdate(s, { id: G, action: "add", participants: [jidOf(3)] }, store().getSettings);
  check("image send fails -> plain text welcome with the description still goes out", s.sent.some((x) => x.content.text && /Description survives an image failure/.test(x.content.text)), s.sent.map((x) => Object.keys(x.content)));

  section("builder unit checks");
  const b = buildWelcome({ user: "255700000009:3@s.whatsapp.net", groupName: "G", description: "  hello  " });
  check("device suffix stripped in the mention, description trimmed", /@255700000009\b/.test(b.caption) && /\nhello$/.test(b.caption), b.caption);
  check("rules constant is the 5-rule block", DEFAULT_RULES.split("\n").length === 6);

  done();
})().catch((e) => { console.error(e); process.exit(1); });
