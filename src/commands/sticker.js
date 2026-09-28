// src/commands/sticker.js
const helpers = require("../utils/helpers");

module.exports = {
  name: "sticker",
  aliases: ["s"],
  description: "Convert an image or video to a sticker",
  async execute(sock, m) {
    const chat = m.key.remoteJid;
    
    try {
      let mediaMsg = m;
      if (m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        mediaMsg = { 
          key: { ...m.key, id: m.message.extendedTextMessage.contextInfo.stanzaId }, 
          message: m.message.extendedTextMessage.contextInfo.quotedMessage 
        };
      }

      const media = mediaMsg.message?.imageMessage || mediaMsg.message?.videoMessage;
      if (!media) return sock.sendMessage(chat, { text: "📸 Reply to an image/video or send one with caption .sticker" });

      // Note: downloadMediaMessage is a helper that needs to be implemented or use the one from baileys
      const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
      const type = mediaMsg.message?.imageMessage ? "image" : "video";
      const stream = await downloadContentFromMessage(media, type);
      
      let buffer = Buffer.from([]);
      for await(const chunk of stream) {
          buffer = Buffer.concat([buffer, chunk]);
      }

      await sock.sendMessage(chat, { sticker: buffer });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(chat, { text: "❌ Failed to create sticker." });
    }
  },
};
