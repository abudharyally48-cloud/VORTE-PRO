// src/commands/add.js
const helpers = require("../utils/helpers");
const { guardGroupAdmin } = require("../utils/guards");

module.exports = {
  name: "add",
  description: "Add someone to the group (admin only). Usage: .add 255700000000 [more numbers]",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    if (!(await guardGroupAdmin(sock, m, { botAdmin: true }))) return;

    const numbers = [...new Set(args.map(a => a.replace(/[^0-9]/g, "")).filter(n => n.length >= 7 && n.length <= 15))].slice(0, 10);
    if (!numbers.length) return sock.sendMessage(chat, { text: "Usage: .add <number with country code> [more numbers]" });

    try {
      const results = await sock.groupParticipantsUpdate(chat, numbers.map(n => `${n}@s.whatsapp.net`), "add");
      const lines = (results || []).map(r => {
        const num = "+" + helpers.normalizeJid(r.jid || "");
        switch (String(r.status)) {
          case "200": return `✅ ${num} added`;
          case "409": return `ℹ️ ${num} is already in the group`;
          case "403": return `🔒 ${num} has privacy settings that block direct adds — send them the invite link instead (.link)`;
          case "408": return `⚠️ ${num} recently left; can't be re-added right now`;
          case "401": return `❌ ${num} has blocked the bot`;
          default: return `❌ ${num} could not be added (status ${r.status})`;
        }
      });
      await sock.sendMessage(chat, { text: lines.join("\n") || "❌ No result returned." });
    } catch (err) {
      console.error("❌ add error:", err.message);
      await sock.sendMessage(chat, { text: "❌ Couldn't add them." });
    }
  }
};
