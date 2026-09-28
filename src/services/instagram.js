// src/services/instagram.js
//
// CAPABILITY NOTE: Meta's official Instagram Graph API operates on content
// belonging to a Business/Creator account you've connected via OAuth (posting,
// insights, comments on YOUR OWN account's media). It does not provide a way
// to download arbitrary other users' public posts/reels by URL. As with
// TikTok, "paste any Instagram link, get the media back" is not something the
// official API supports at any auth level.
const axios = require("axios");
const config = require("../config/config");

function isAvailable() {
  return !!config.instagramAccessToken;
}

/**
 * Fetch the connected account's own recent media via the official Graph API.
 * Genuine official-API functionality — only works for the account that
 * issued INSTAGRAM_ACCESS_TOKEN, not arbitrary other users' posts.
 */
async function getOwnMedia() {
  if (!isAvailable()) return null;
  try {
    const response = await axios.get("https://graph.instagram.com/me/media", {
      params: {
        fields: "id,caption,media_type,media_url,permalink,timestamp",
        access_token: config.instagramAccessToken
      }
    });
    return response.data?.data || [];
  } catch (err) {
    console.error("❌ Instagram Graph API error:", err.response?.data || err.message);
    return null;
  }
}

module.exports = { isAvailable, getOwnMedia };
