// src/commands/imageai.js
const openai = require("../services/openai");

const imageStyles = {
  "1917style": "1917 cinematic, realistic",
  "advancedglow": "advanced glow, futuristic",
  "cartoonstyle": "cartoon style, colorful",
  "luxurygold": "luxury gold, elegant, shiny",
  "matrix": "matrix cyberpunk, green digital",
  "sand": "sand texture, desert, grainy",
  "papercutstyle": "papercut art style, layered"
};

module.exports = {
  name: "imageai",
  aliases: Object.keys(imageStyles),
  description: "Generate images with various styles",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    const body = m.body || "";
    const prefix = body.charAt(0);
    const commandUsed = body.slice(1).split(/\s+/)[0].toLowerCase();
    
    const style = imageStyles[commandUsed];
    if (!style) return sock.sendMessage(chat, { text: "❌ Invalid style." });

    const prompt = args.join(" ");
    if (!prompt) return sock.sendMessage(chat, { text: `Usage: ${prefix}${commandUsed} <prompt>` });

    if (!openai.isAvailable()) return sock.sendMessage(chat, { text: "⚠️ OpenAI service is not available." });

    await sock.sendMessage(chat, { text: `🎨 Generating ${commandUsed} image...` });

    try {
      const imageUrl = await openai.generateImage(prompt, style);
      if (!imageUrl) return sock.sendMessage(chat, { text: "❌ Failed to generate image." });

      await sock.sendMessage(chat, { image: { url: imageUrl }, caption: `✨ *${commandUsed} image* for: "${prompt}"` });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(chat, { text: "❌ An error occurred." });
    }
  },
};
