const path = require('path');

module.exports = {
  port: process.env.PORT || 20202,

  settingsPath: path.join(__dirname, '../../storage/settings.json'),

  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  IMDB_API_KEY: process.env.IMDB_API_KEY || '',
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY || '',
};
