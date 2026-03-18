// src/services/youtube.js
const { google } = require('googleapis');
const config = require('../config/config');

const youtube = config.youtubeApiKey ? google.youtube({
  version: 'v3',
  auth: config.youtubeApiKey
}) : null;

/**
 * Check if YouTube service is available
 * @returns {boolean}
 */
function isAvailable() {
  return !!youtube;
}

/**
 * Search videos on YouTube
 * @param {string} query 
 * @param {number} maxResults 
 * @returns {Promise<Array>}
 */
async function searchVideos(query, maxResults = 5) {
  if (!youtube) return [];
  try {
    const response = await youtube.search.list({
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults
    });
    return response.data.items;
  } catch (err) {
    console.error('❌ YouTube search error:', err.message);
    return [];
  }
}

module.exports = {
  isAvailable,
  searchVideos
};
