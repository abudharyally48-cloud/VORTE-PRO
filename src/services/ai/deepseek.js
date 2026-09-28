// src/services/ai/deepseek.js
// DeepSeek's API is OpenAI-compatible, so we talk to it with a plain HTTPS
// call (same request/response shape as OpenAI chat completions) rather than
// pulling in a separate SDK dependency.
const axios = require("axios");
const config = require("../../config/config");

function isAvailable() {
  return !!config.deepseekApiKey;
}

async function chatCompletion(query, model) {
  if (!isAvailable()) return null;
  try {
    const response = await axios.post(
      "https://api.deepseek.com/chat/completions",
      {
        model: model || config.deepseekModel || "deepseek-chat",
        messages: [{ role: "user", content: query }]
      },
      {
        headers: {
          "Authorization": `Bearer ${config.deepseekApiKey}`,
          "Content-Type": "application/json"
        }
      }
    );
    return response.data?.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error("❌ DeepSeek chatCompletion error:", err.response?.data?.error?.message || err.message);
    return null;
  }
}

module.exports = { isAvailable, chatCompletion };
