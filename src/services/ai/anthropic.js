// src/services/ai/anthropic.js
const axios = require("axios");
const config = require("../../config/config");

function isAvailable() {
  return !!config.anthropicApiKey;
}

async function chatCompletion(query, model) {
  if (!isAvailable()) return null;
  try {
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: model || config.anthropicModel || "claude-sonnet-4-5",
        max_tokens: 1024,
        messages: [{ role: "user", content: query }]
      },
      {
        headers: {
          "x-api-key": config.anthropicApiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json"
        }
      }
    );
    return response.data?.content?.[0]?.text || null;
  } catch (err) {
    console.error("❌ Anthropic chatCompletion error:", err.response?.data?.error?.message || err.message);
    return null;
  }
}

module.exports = { isAvailable, chatCompletion };
