// src/services/ai/index.js
const openai = require("../openai"); // existing, unchanged — preserves current .gpt/.imageai behavior
const anthropic = require("./anthropic");
const deepseek = require("./deepseek");

const providers = { openai, anthropic, deepseek };

function isProviderAvailable(name) {
  return !!providers[name]?.isAvailable();
}

function availableProviders() {
  return Object.keys(providers).filter(isProviderAvailable);
}

/**
 * Route a chat completion request through a specific provider, or the first
 * available one if none is specified. Never throws — returns null with a
 * server-side log on failure, so commands can show a clean error instead of
 * crashing.
 * @param {string} query
 * @param {string} [providerName] - "openai" | "anthropic" | "deepseek"
 * @param {string} [model]
 * @returns {Promise<{ text: string, provider: string } | null>}
 */
async function chatCompletion(query, providerName, model) {
  const order = providerName ? [providerName] : availableProviders();
  if (order.length === 0) return null;

  for (const name of order) {
    const provider = providers[name];
    if (!provider || !provider.isAvailable()) continue;
    try {
      const text = await provider.chatCompletion(query, model);
      if (text) return { text, provider: name };
    } catch (err) {
      console.error(`❌ AI provider "${name}" failed:`, err.message);
    }
  }
  return null;
}

module.exports = { isProviderAvailable, availableProviders, chatCompletion, providers };
