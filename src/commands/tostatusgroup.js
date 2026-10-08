// src/commands/tostatusgroup.js — post a text status from the bot's WhatsApp account (OWNER only).
// WhatsApp only delivers a status to the contacts listed in `statusJidList`; without it the
// post goes nowhere. We list every chat the bot knows (+ this group's members, + the bot itself).
const identity = require("../utils/identity");
const chatStore = require("../utils/chatStore");
const helpers = require("../utils/helpers");
const { panel } = require("../utils/ui");

const TITLE = "📣 STATUS POST";

module.exports = {
  name: "tostatusgroup",
  scope: "OWNER",
  description: "Post a text message to the bot account's WhatsApp status (owner only). Usage: .tostatusgroup <text>",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    const body = args.join(" ").trim();
    if (!body) return sock.sendMessage(chat, { text: panel(TITLE, ["Usage: .tostatusgroup <text>"]) });

    const audience = new Set(chatStore.getKnownChats().filter((j) => j.endsWith("@s.whatsapp.net")));
    if (helpers.isGroup(chat)) {
      try { (await identity.getMetadata(sock, chat)).participants.forEach((p) => audience.add(p.phoneNumber || (p.id.endsWith("@s.whatsapp.net") ? p.id : null))); } catch { /* optional */ }
    }
    if (sock.user?.id) audience.add(sock.user.id.split(":")[0] + "@s.whatsapp.net");
    audience.delete(null); audience.delete(undefined);

    try {
      await sock.sendMessage("status@broadcast", { text: body, backgroundColor: "#313335", font: 1 }, { statusJidList: [...audience] });
      await sock.sendMessage(chat, { text: panel(TITLE, [`✅ Posted to your status (visible to ${audience.size} contact(s)).`]) });
    } catch (err) {
      console.error("❌ tostatusgroup:", err.message);
      await sock.sendMessage(chat, { text: panel(TITLE, ["❌ I couldn't post the status."]) });
    }
  }
};
