// src/commands/kickall.js
const helpers = require("../utils/helpers");

module.exports = {
  name: "kickall",
  description: "Remove all non-admin members from the group",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    if (!helpers.isGroup(chat)) return sock.sendMessage(chat, { text: "❌ This command can only be used in groups." });

    const sender = m.key.participant || m.key.remoteJid;

    try {
      if (!(await helpers.isAdmin(sock, chat, sender)) && !helpers.isOwner(sender)) {
        return sock.sendMessage(chat, { text: "❌ Only admins can use this command." });
      }
      if (!(await helpers.isBotAdmin(sock, chat))) {
        return sock.sendMessage(chat, { text: "❌ Bot needs to be admin to kick others." });
      }

      const metadata = await sock.groupMetadata(chat);
      const toKick = metadata.participants.filter((p) => !p.admin).map((p) => p.id);

      if (toKick.length === 0) return sock.sendMessage(chat, { text: "ℹ️ No non-admin members to kick." });

      await sock.sendMessage(chat, { text: `👢 Removing ${toKick.length} non-admin member(s)...` });

      // Kick in batches to avoid rate limits
      for (const jid of toKick) {
        await sock.groupParticipantsUpdate(chat, [jid], "remove");
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      await sock.sendMessage(chat, { text: "✅ All non-admin members removed." });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(chat, { text: "❌ Failed to kick all members." });
    }
  },
};
