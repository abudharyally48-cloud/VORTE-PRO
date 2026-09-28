// src/commands/warn.js
const helpers = require("../utils/helpers");

module.exports = {
  name: "warn",
  description: "Give a warning to a user in the group",
  async execute(sock, m, args, getSettings, saveSettings) {
    const chat = m.key.remoteJid;
    if (!helpers.isGroup(chat)) return sock.sendMessage(chat, { text: "❌ This command can only be used in groups." });

    const sender = m.key.participant || m.key.remoteJid;
    const warnUser = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (!warnUser) return sock.sendMessage(chat, { text: "Tag a user to warn. Usage: .warn @user" });

    try {
      if (!(await helpers.isAdmin(sock, chat, sender)) && !helpers.isOwner(sender)) {
        return sock.sendMessage(chat, { text: "❌ Only admins can use this command." });
      }

      const settings = getSettings();
      if (!settings[chat]) settings[chat] = {};
      if (!settings[chat].warnings) settings[chat].warnings = {};
      
      const warns = (settings[chat].warnings[warnUser] || 0) + 1;
      settings[chat].warnings[warnUser] = warns;
      saveSettings(settings);

      await sock.sendMessage(chat, {
        text: `⚠️ @${warnUser.split("@")[0]} has been warned.\nTotal warnings: ${warns}/3`,
        mentions: [warnUser]
      });

      if (warns >= 3) {
        if (await helpers.isBotAdmin(sock, chat)) {
          await sock.groupParticipantsUpdate(chat, [warnUser], "remove");
          await sock.sendMessage(chat, {
            text: `❌ @${warnUser.split("@")[0]} removed after 3 warnings.`,
            mentions: [warnUser]
          });
          delete settings[chat].warnings[warnUser];
          saveSettings(settings);
        } else {
          await sock.sendMessage(chat, { text: "⚠️ Bot needs to be admin to remove the user." });
        }
      }
    } catch (err) {
      console.error(err);
      await sock.sendMessage(chat, { text: "❌ Failed to warn user." });
    }
  },
};
