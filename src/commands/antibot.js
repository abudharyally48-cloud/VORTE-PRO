// src/commands/antibot.js
// Per-group list of numbers YOU have identified as bots, with enforcement.
// (WhatsApp offers no way to automatically detect bots, so detection is manual —
// see .antibothelp.) Serves: .antibot .botlist .kickbot .antibothelp
const helpers = require("../utils/helpers");
const { guardGroupAdmin } = require("../utils/guards");

module.exports = {
  name: "antibot",
  aliases: ["botlist", "kickbot", "antibothelp"],
  description: "Flag & remove known bot accounts in a group: .antibot on/off | add/remove/list <n> | .botlist | .kickbot | .antibothelp",
  async execute(sock, m, args, getSettings, saveSettings) {
    const chat = m.key.remoteJid;
    const cmd = helpers.getBody(m).slice(1).split(/\s+/)[0].toLowerCase();

    if (cmd === "antibothelp") {
      return sock.sendMessage(chat, {
        text:
          "🤖 *Anti-Bot help*\n\n" +
          "WhatsApp doesn't tell us which accounts are bots, so *you* flag them and I enforce it:\n\n" +
          "• .antibot add <number|@user> — flag a number as a bot in this group\n" +
          "• .antibot remove <number|@user> — unflag\n" +
          "• .antibot list  (or .botlist) — show flagged bots\n" +
          "• .antibot on/off — auto-remove flagged bots when they join or speak\n" +
          "• .kickbot — remove every flagged bot currently in the group\n\n" +
          "I must be a group admin to remove anyone."
      });
    }

    if (!(await guardGroupAdmin(sock, m, { botAdmin: cmd === "kickbot" }))) return;

    const settings = getSettings();
    if (!settings[chat]) settings[chat] = {};
    const cs = settings[chat];
    cs.knownBots = cs.knownBots || [];

    if (cmd === "botlist" || (cmd === "antibot" && args[0]?.toLowerCase() === "list")) {
      return sock.sendMessage(chat, {
        text: cs.knownBots.length
          ? `🤖 *Flagged bots (${cs.knownBots.length}):*\n${cs.knownBots.map(n => "+" + n).join("\n")}\n\nAuto-remove: ${cs.antibot ? "ON" : "OFF"}`
          : "ℹ️ No bots flagged in this group. Use .antibot add <number>."
      });
    }

    if (cmd === "kickbot") {
      const md = await sock.groupMetadata(chat);
      const botNum = helpers.normalizeJid(sock.user?.id);
      const targets = md.participants
        .filter(p => !p.admin)
        .map(p => p.id || p.jid)
        .filter(j => j && cs.knownBots.includes(helpers.normalizeJid(j)) && helpers.normalizeJid(j) !== botNum);
      if (!targets.length) return sock.sendMessage(chat, { text: "ℹ️ No flagged bots (that I can remove) are in this group right now." });
      try {
        await sock.groupParticipantsUpdate(chat, targets, "remove");
        return sock.sendMessage(chat, { text: `✅ Removed ${targets.length} flagged bot(s).` });
      } catch (err) {
        console.error("❌ kickbot error:", err.message);
        return sock.sendMessage(chat, { text: "❌ Couldn't remove them." });
      }
    }

    // .antibot <on|off|add|remove> ...
    const sub = args[0]?.toLowerCase();
    if (sub === "on" || sub === "off") {
      cs.antibot = sub === "on";
      saveSettings(settings);
      return sock.sendMessage(chat, { text: `✅ Anti-bot auto-removal turned ${sub}.` });
    }
    if (sub === "add" || sub === "remove") {
      const ctx = m.message?.extendedTextMessage?.contextInfo;
      const number = helpers.normalizeJid(ctx?.mentionedJid?.[0] || ctx?.participant || args[1] || "");
      if (number.length < 7 || number.length > 15) return sock.sendMessage(chat, { text: `Usage: .antibot ${sub} <number>  (or @mention / reply)` });
      if (helpers.isTrueOwner(number + "@s.whatsapp.net")) return sock.sendMessage(chat, { text: "❌ Can't flag the bot's owner." });
      if (sub === "add") { if (!cs.knownBots.includes(number)) cs.knownBots.push(number); }
      else cs.knownBots = cs.knownBots.filter(n => n !== number);
      saveSettings(settings);
      return sock.sendMessage(chat, { text: `✅ +${number} ${sub === "add" ? "flagged as a bot" : "unflagged"}.` });
    }

    return sock.sendMessage(chat, { text: "Usage: .antibot on/off | add/remove/list <number> — see .antibothelp" });
  }
};
