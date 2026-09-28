// src/commands/instagram.js
const instagram = require("../services/instagram");
const providers = require("../services/providers");

module.exports = {
  name: "instagram",
  aliases: ["ig"],
  description: "Instagram integration (see note: official API limitations apply)",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;

    if (!providers.isInstagramAvailable()) {
      return sock.sendMessage(chat, { text: providers.UNAVAILABLE_MESSAGE + "\n(Set META_APP_ID, META_APP_SECRET, and INSTAGRAM_ACCESS_TOKEN.)" });
    }

    const media = await instagram.getOwnMedia();
    if (media === null) {
      return sock.sendMessage(chat, { text: "❌ Couldn't reach Instagram's API right now." });
    }

    await sock.sendMessage(chat, {
      text: `✅ Instagram API is configured and working (found ${media.length} recent post(s) on the connected account).\n\n` +
        "⚠️ Note: Meta's *official* Instagram API only lets a bot access content from the specific Business/Creator account you've connected via OAuth — it has no capability to download other users' arbitrary public posts by URL. " +
        "That specific 'paste any Instagram link, get the media' feature only exists via unofficial third-party APIs — let me know if you want that wired in separately as a distinct, non-official integration."
    });
  }
};
