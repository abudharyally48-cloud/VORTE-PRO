// src/services/imdb236.js
const axios = require('axios');
const config = require('../config/config');

const HOST = "imdb236.p.rapidapi.com";
const BASE_URL = `https://${HOST}`;

function isAvailable() {
  return !!config.rapidApiKey;
}

function headers() {
  return {
    "x-rapidapi-key": config.rapidApiKey,
    "x-rapidapi-host": HOST
  };
}

/**
 * Get a random title from IMDb236.
 * @param {string} type - "movie" or "tvSeries"
 * @param {string[]} genres - e.g. ["Action", "Comedy"]
 * @returns {Promise<Object|null>}
 */
async function getRandomTitle(type = "movie", genres = []) {
  if (!isAvailable()) return null;
  try {
    const response = await axios.get(`${BASE_URL}/api/imdb/random`, {
      headers: headers(),
      params: {
        type,
        ...(genres.length ? { genre: genres.join(",") } : {})
      }
    });
    return response.data;
  } catch (err) {
    console.error('❌ IMDb236 error:', err.message);
    return null;
  }
}

module.exports = {
  isAvailable,
  getRandomTitle
};
