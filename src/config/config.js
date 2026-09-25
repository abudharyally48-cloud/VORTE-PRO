// src/config/config.js
require('dotenv').config();
const path = require('path');

// Owner numbers come ONLY from environment variables — no hardcoded fallback.
const ownerRaw = [process.env.OWNER_1, process.env.OWNER_2].filter(Boolean);
const ownerDigits = ownerRaw.map((n) => n.replace(/[^0-9]/g, ''));

module.exports = {
  // Bot Settings
  botName: process.env.BOT_NAME || "VORTE PRO",
  prefix: process.env.PREFIX || ".",

  // Server Settings
  port: process.env.PORT || 20202,

  // Owner Details — set OWNER_1 / OWNER_2 in your .env, e.g. OWNER_1=+255700000000
  owners: ownerRaw.map((num, i) => [num, i === 0 ? "Primary Owner" : "Secondary Owner", true]),
  owner1: ownerDigits[0] || null,
  owner2: ownerDigits[1] || null,
  sudo: ownerDigits,

  // Session & Storage (resolved relative to this file, not the process CWD)
  settingsPath: path.join(__dirname, '../../storage/groupSettings.json'),
  sessionFolder: path.join(__dirname, '../../storage/session'),

  // API Keys
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  youtubeApiKey: process.env.YOUTUBE_API_KEY || "",
  imdbApiKey: process.env.OMDB_API_KEY || process.env.IMDB_API_KEY || "",
  rapidApiKey: process.env.RAPIDAPI_KEY || "",

  // Helper to check if a service is enabled (has API key)
  isServiceEnabled: (key) => !!key && key.trim().length > 0,

  // Standard error message for missing keys
  missingKeyMessage: "⚠️ This feature is currently unavailable. Please try again later."
};
