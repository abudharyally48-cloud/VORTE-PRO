// config.js
// API keys are loaded from environment variables (.env file)
// NEVER hardcode real keys here — this file is public on GitHub
//
// To set your keys:
//   1. Copy .env.example to .env
//   2. Fill in your real values in .env
//   3. .env is in .gitignore so it will never be pushed to GitHub
//
// On Heroku/Railway/Render: paste keys directly into the platform's
// "Environment Variables" settings panel instead of using .env

module.exports = {
  OPENAI_API_KEY:   process.env.OPENAI_API_KEY   || '',
  IMDB_API_KEY:     process.env.IMDB_API_KEY     || '',
  YOUTUBE_API_KEY:  process.env.YOUTUBE_API_KEY  || '',
};
