// src/commands/poll.js
const helpers = require("../utils/helpers");

module.exports = {
  name: "poll",
  description: "Create a poll in the group",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    if (!helpers.isGroup(chat)) return sock.sendMessage(chat, { text: "❌ This command can only be used in groups." });

    const sender = m.key.participant || m.key.remoteJid;
    const body = args.join(" ");

    if (!body) return sock.sendMessage(chat, { text: "Usage: .poll question|option1|option2|..." });

    const [question, ...options] = body.split("|");
    if (!question || options.length < 2) return sock.sendMessage(chat, { text: "❌ Provide a question and at least 2 options." });

    try {
      if (!(await helpers.isAdmin(sock, chat, sender)) && !helpers.isOwner(sender)) {
        return sock.sendMessage(chat, { text: "❌ Only admins can use this command." });
      }

      await sock.sendMessage(chat, {
        poll: {
          name: question.trim(),
          values: options.map(o => o.trim()),
          selectableCount: 1
        }
      });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(chat, { text: "❌ Failed to create poll." });
    }
  },
};
