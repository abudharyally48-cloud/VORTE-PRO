// src/commands/joinrequests.js
// One implementation for the whole join-request workflow (groups with
// "approve new members" turned on): .requests .accept .reject .acceptall .rejectall
const helpers = require("../utils/helpers");
const { guardGroupAdmin } = require("../utils/guards");

module.exports = {
  name: "requests",
  aliases: ["accept", "reject", "acceptall", "rejectall"],
  description: "Manage pending join requests (admin only): .requests | .accept <n> | .reject <n> | .acceptall | .rejectall",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    if (!(await guardGroupAdmin(sock, m, { botAdmin: true }))) return;

    const cmd = helpers.getBody(m).slice(1).split(/\s+/)[0].toLowerCase();

    let pending;
    try {
      const list = await sock.groupRequestParticipantsList(chat);
      pending = (list || []).map(p => p.jid || p.id).filter(Boolean);
    } catch (err) {
      console.error("❌ requests list error:", err.message);
      return sock.sendMessage(chat, { text: "❌ Couldn't fetch join requests (is 'approve new members' enabled for this group?)." });
    }

    if (cmd === "requests") {
      if (!pending.length) return sock.sendMessage(chat, { text: "ℹ️ No pending join requests." });
      return sock.sendMessage(chat, {
        text: `📥 *Pending requests (${pending.length}):*\n${pending.map((j, i) => `${i + 1}. +${helpers.normalizeJid(j)}`).join("\n")}\n\nUse .accept <number> / .reject <number> / .acceptall / .rejectall`
      });
    }

    const action = cmd.startsWith("accept") ? "approve" : "reject";
    let targets;
    if (cmd === "acceptall" || cmd === "rejectall") {
      targets = pending;
    } else {
      const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      const wanted = helpers.normalizeJid(mentioned || args[0] || "");
      if (!wanted) return sock.sendMessage(chat, { text: `Usage: .${cmd} <number>` });
      targets = pending.filter(j => helpers.normalizeJid(j) === wanted);
      if (!targets.length) return sock.sendMessage(chat, { text: `ℹ️ +${wanted} has no pending request.` });
    }
    if (!targets.length) return sock.sendMessage(chat, { text: "ℹ️ No pending join requests." });

    try {
      await sock.groupRequestParticipantsUpdate(chat, targets, action);
      await sock.sendMessage(chat, { text: `✅ ${action === "approve" ? "Approved" : "Rejected"} ${targets.length} request(s).` });
    } catch (err) {
      console.error("❌ join request update error:", err.message);
      await sock.sendMessage(chat, { text: "❌ Couldn't process those requests." });
    }
  }
};
