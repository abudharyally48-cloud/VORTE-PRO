// src/commands/gpt.js
const ai = require("../services/ai");
const providers = require("../services/providers");
const helpers = require("../utils/helpers");

// .claude / .deepseek force a provider; .gpt/.ai/.ask use the first provider the host configured
// (OpenAI first, so existing OpenAI-only setups behave exactly as before).
const PROVIDER_BY_COMMAND = { claude: "anthropic", deepseek: "deepseek" };

module.exports = {
  name: 'gpt',
  aliases: ['ai', 'ask', 'claude', 'deepseek'],
  description: 'Ask AI (uses whichever provider(s) the host has configured)',
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    const query = args.join(" ").trim();
    const commandUsed = helpers.getBody(m).slice(1).split(/\s+/)[0].toLowerCase();
    const forced = PROVIDER_BY_COMMAND[commandUsed];

    if (forced ? !ai.isProviderAvailable(forced) : ai.availableProviders().length === 0) {
      return sock.sendMessage(chat, { text: providers.UNAVAILABLE_MESSAGE });
    }
    if (!query) return sock.sendMessage(chat, { text: "💬 Please provide a question for the AI." });
    if (query.length > 4000) return sock.sendMessage(chat, { text: "❌ That question is too long (max 4000 characters)." });

    await sock.sendMessage(chat, { react: { text: "🤖", key: m.key } });

    const result = await ai.chatCompletion(query, forced);
    if (result?.text) {
      await sock.sendMessage(chat, { text: result.text.slice(0, 4000) });
    } else {
      await sock.sendMessage(chat, { text: "❌ Sorry, I couldn't reach the AI at the moment." });
    }
  }
};
