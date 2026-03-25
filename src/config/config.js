// src/config/config.js
require('dotenv').config();

module.exports = {
  // Bot Settings
  botName: process.env.BOT_NAME || "VORTE PRO",
  prefix: process.env.PREFIX || ".",
  
  // Server Settings
  port: process.env.PORT || 3000,
  
  // Owner Details
  owners: [
    [process.env.OWNER_1 || "+255778271055", "Primary Owner", true],
    [process.env.OWNER_2 || "+6285863023532", "Secondary Owner", true],
  ],
  sudo: ["255778271055", "6285863023532"],

  // Session & Storage
  sessionFolder: process.env.SESSION_FOLDER || "./storage/session",
  settingsPath: "./storage/groupSettings.json",

  // Helper to check if a service is enabled (has API key)
  isServiceEnabled: (key) => !!key && key.trim().length > 0,
  
  // Standard error message for missing keys
  missingKeyMessage: "⚠️ This feature is currently unavailable. Please try again later."
};
