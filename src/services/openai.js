// src/services/openai.js
const OpenAI = require("openai");
const config = require("../config/config");

const openai = config.openaiApiKey ? new OpenAI({
  apiKey: config.openaiApiKey
}) : null;

/**
 * Check if OpenAI service is available
 * @returns {boolean}
 */
function isAvailable() {
  return !!openai;
}

/**
 * Generate an image using DALL-E
 * @param {string} prompt 
 * @param {string} style 
 * @returns {Promise<string|null>}
 */
async function generateImage(prompt, style = "") {
  if (!openai) return null;
  try {
    const finalPrompt = style ? `${prompt}, in ${style} style` : prompt;
    const response = await openai.images.generate({
      prompt: finalPrompt,
      n: 1,
      size: "1024x1024"
    });
    return response.data[0].url;
  } catch (err) {
    console.error("❌ Image generation error:", err);
    return null;
  }
}

/**
 * Chat completion with OpenAI
 * @param {string} query 
 * @param {string} model 
 * @returns {Promise<string|null>}
 */
async function chatCompletion(query, model = "gpt-4o-mini") {
  if (!openai) return null;
  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: query }]
    });
    return response.choices?.[0]?.message?.content;
  } catch (err) {
    console.error("❌ chatCompletion error:", err);
    return null;
  }
}

module.exports = {
  isAvailable,
  chatCompletion,
  generateImage
};
