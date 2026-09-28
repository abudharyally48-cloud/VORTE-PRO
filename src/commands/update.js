// src/commands/update.js
const helpers = require("../utils/helpers");
const { exec } = require("child_process");

module.exports = {
  name: "update",
  description: "Pull the latest updates from Git (Owner only)",
  async execute(sock, m) {
    const chat = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;

    if (!helpers.isOwner(sender)) return sock.sendMessage(chat, { text: "❌ Owner only command." });

    await sock.sendMessage(chat, { text: "⬇️ Pulling latest updates..." });

    exec("git pull", (err, stdout, stderr) => {
      if (err) return sock.sendMessage(chat, { text: `❌ Update failed:\n${err.message}` });
      if (stderr && stderr.includes('error:')) return sock.sendMessage(chat, { text: `⚠️ Some issues:\n${stderr}` });

      sock.sendMessage(chat, { text: `✅ Update complete:\n${stdout}\n\nRestarting bot...` }).then(() => {
        // Restart after update
        process.exit(1);
      });
    });
  },
};
