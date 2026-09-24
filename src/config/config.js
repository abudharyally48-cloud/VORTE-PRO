// config.js
const path = require('path');

// API keys are loaded from environment variables
module.exports = {
  // Storage
  settingsPath: path.join(__dirname, '../../storage/settings.json'),

  // API keys
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  IMDB_API_KEY: process.env.IMDB_API_KEY || '',
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY || '',
};
