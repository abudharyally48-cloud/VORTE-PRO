// src/services/providers.js
// Central "is this external service configured?" checks used by commands, plus
// the one shared user-facing message for unconfigured features.
//
// Note on TikTok/Instagram: the official developer credentials (TIKTOK_CLIENT_*,
// META_*/INSTAGRAM_ACCESS_TOKEN) only grant access to the connected account's
// own data — they cannot fetch arbitrary public videos. Downloading (.tiktok,
// .ig) goes through yt-dlp instead (services/downloaders); the status commands
// (.tiktokstatus, .igstatus) just verify the official credentials.
const instagram = require("./instagram");
const tiktok = require("./tiktok");
const tmdb = require("./tmdb");
const ai = require("./ai");

module.exports = {
  UNAVAILABLE_MESSAGE: "❌ This feature is currently unavailable because its API provider is not configured.",
  isInstagramAvailable: () => instagram.isAvailable(),
  isTikTokAvailable: () => tiktok.isAvailable(),
  isTmdbAvailable: () => tmdb.isAvailable(),
  isAiAvailable: () => ai.availableProviders().length > 0,
};
