// src/commands/sudo.js
const helpers = require("../utils/helpers");

module.exports = {
  name: "sudo",
  aliases: ["eval"],
  description: "Execute arbitrary JavaScript code (Owner only)",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;

    if (!helpers.isOwner(sender)) return sock.sendMessage(chat, { text: "❌ Owner only command." });

    const code = args.join(" ");
    if (!code) return sock.sendMessage(chat, { text: "Usage: .sudo <javascript code>" });

    try {
      // Provide some context variables for convenience
      const result = await eval(`(async () => { ${code} })()`);
      const resultStr = String(result).slice(0, 2000);
      await sock.sendMessage(chat, { text: `✅ Result:\n\`\`\`${resultStr}\`\`\`` });
    } catch (err) {
      await sock.sendMessage(chat, { text: `❌ Error:\n\`\`\`${String(err)}\`\`\`` });
    }
  },
};
