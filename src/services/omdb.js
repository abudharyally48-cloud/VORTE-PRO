// src/services/omdb.js
const axios = require('axios');
const config = require('../config/config');

/**
 * Check if OMDb service is available
 * @returns {boolean}
 */
function isAvailable() {
  return !!config.imdbApiKey;
}

/**
 * Get movie details from OMDb
 * @param {string} title 
 * @returns {Promise<Object|null>}
 */
async function getMovieDetails(title) {
  if (!isAvailable()) return null;
  try {
    const response = await axios.get(`http://www.omdbapi.com/`, {
      params: {
        t: title,
        apikey: config.imdbApiKey
      }
    });
    return response.data;
  } catch (err) {
    console.error('❌ OMDb error:', err.message);
    return null;
  }
}

module.exports = {
  isAvailable,
  getMovieDetails
};
