// src/commands/ownernumber.js
// VIEW-ONLY on purpose. A chat command that could CHANGE who the owner is would
// be a serious security hole — whoever could run it (or trick the owner into
// running it) could permanently take over the bot. Owner numbers are a
// deploy-time decision, set via the OWNER_1 / OWNER_2 environment variables.
const config = require("../config/config");

module.exports = {
  name: "ownernumber",
  description: "Show the bot owner's number(s)",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    const owners = [config.owner1, config.owner2].filter(Boolean);
    if (!owners.length) {
      return sock.sendMessage(chat, { text: "ℹ️ No owner number is configured (set OWNER_1 in the environment)." });
    }
    await sock.sendMessage(chat, { text: `👑 Owner: ${owners.map(o => "+" + o).join(", ")}` });
  }
};
