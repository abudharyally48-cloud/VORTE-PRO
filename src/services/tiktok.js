// src/services/tiktok.js
//
// CAPABILITY NOTE (read before wiring this into a command):
// TikTok's official API (client_key/client_secret, OAuth) does NOT provide a
// generic "download any public video" endpoint. Their Display API / Content
// Posting API operate on content belonging to an authorized/connected TikTok
// account, not arbitrary public videos. If the goal is "user sends any TikTok
// link, bot downloads it," that is not achievable through TikTok's official
// API at all, at any auth level. It's only possible via unofficial third-party
// scraper APIs (e.g. RapidAPI listings), which is a different, non-official
// integration — see commands/tiktok.js for how that distinction is surfaced
// to the user rather than silently pretending official support exists.
const axios = require("axios");
const config = require("../config/config");

let cachedToken = null;
let tokenExpiresAt = 0;

function isAvailable() {
  return !!(config.tiktokClientKey && config.tiktokClientSecret);
}

/**
 * Real client-credentials OAuth exchange against TikTok's actual token
 * endpoint. This part is genuine official-API functionality.
 * @returns {Promise<string|null>} access token, or null if unavailable/failed
 */
async function getAccessToken() {
  if (!isAvailable()) return null;
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  try {
    const response = await axios.post(
      "https://open.tiktokapis.com/v2/oauth/token/",
      new URLSearchParams({
        client_key: config.tiktokClientKey,
        client_secret: config.tiktokClientSecret,
        grant_type: "client_credentials"
      }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    cachedToken = response.data.access_token;
    tokenExpiresAt = Date.now() + (response.data.expires_in || 7200) * 1000 - 30000;
    return cachedToken;
  } catch (err) {
    console.error("❌ TikTok OAuth error:", err.response?.data || err.message);
    return null;
  }
}

module.exports = { isAvailable, getAccessToken };
