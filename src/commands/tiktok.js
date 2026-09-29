// src/commands/tiktok.js
const tiktok = require("../services/tiktok");
const providers = require("../services/providers");

module.exports = {
  name: "tiktok",
  description: "TikTok integration (see note: official API limitations apply)",
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;

    if (!providers.isTikTokAvailable()) {
      return sock.sendMessage(chat, { text: providers.UNAVAILABLE_MESSAGE + "\n(Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET.)" });
    }

    const token = await tiktok.getAccessToken();
    if (!token) {
      return sock.sendMessage(chat, { text: "❌ Couldn't authenticate with TikTok's API right now." });
    }

    // Honest limitation: TikTok's official API has no "download any public
    // video by URL" capability at any authentication level — it only
    // operates on content belonging to an authorized/connected account.
    await sock.sendMessage(chat, {
      text: "✅ TikTok API credentials are configured and working.\n\n" +
        "⚠️ Note: TikTok's *official* API doesn't offer a way to download arbitrary public videos — that's simply not a capability it exposes, regardless of auth level. " +
        "Official TikTok API access only covers content from an account you've connected via OAuth (for things like a business posting/analytics integration).\n\n" +
        "If you specifically want 'send a link, get the video back,' that only exists via unofficial third-party APIs (e.g. RapidAPI) — happy to wire that in separately if you want it, but it's a different, non-official integration."
    });
  }
};
