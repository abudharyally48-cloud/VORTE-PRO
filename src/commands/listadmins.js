// src/commands/listadmins.js
const helpers = require("../utils/helpers");

module.exports = {
  name: "listadmins",
  aliases: ["admins"],
  description: "List all admins in the group",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    if (!helpers.isGroup(chat)) {
      return sock.sendMessage(chat, { text: "❌ This command only works in groups." });
    }

    try {
      const metadata = await sock.groupMetadata(chat);
      const admins = metadata.participants.filter(p => p.admin);
      if (admins.length === 0) {
        return sock.sendMessage(chat, { text: "ℹ️ No admins found in this group." });
      }

      const list = admins
        .map((a, i) => `${i + 1}. @${a.id.split("@")[0]}${a.admin === "superadmin" ? " (owner)" : ""}`)
        .join("\n");

      await sock.sendMessage(chat, {
        text: `👮 *Group Admins*\n\n${list}`,
        mentions: admins.map(a => a.id)
      });
    } catch (e) {
      await sock.sendMessage(chat, { text: "❌ Could not fetch group admins." });
    }
  }
};
