// src/services/tmdb.js
const axios = require("axios");
const config = require("../config/config");

const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

function isAvailable() {
  return !!config.tmdbApiKey;
}

/**
 * Search for a movie or TV show by title.
 * @param {string} query
 * @param {"movie"|"tv"} type
 * @returns {Promise<object|null>} the best-matching result, or null
 */
async function search(query, type = "movie") {
  if (!isAvailable()) return null;
  try {
    const response = await axios.get(`${BASE_URL}/search/${type}`, {
      params: { api_key: config.tmdbApiKey, query, include_adult: false }
    });
    return response.data?.results?.[0] || null;
  } catch (err) {
    console.error("❌ TMDB search error:", err.response?.data?.status_message || err.message);
    return null;
  }
}

/**
 * Get full details for a title, including real watch-provider data
 * (streaming / rent / buy, JustWatch-sourced via TMDB) for config.tmdbRegion.
 * @param {number|string} id
 * @param {"movie"|"tv"} type
 * @returns {Promise<object|null>}
 */
async function getDetails(id, type = "movie") {
  if (!isAvailable()) return null;
  try {
    const response = await axios.get(`${BASE_URL}/${type}/${id}`, {
      params: { api_key: config.tmdbApiKey, append_to_response: "watch/providers,credits" }
    });
    return response.data || null;
  } catch (err) {
    console.error("❌ TMDB details error:", err.response?.data?.status_message || err.message);
    return null;
  }
}

/**
 * Search + fetch details in one call — what commands should normally use.
 * @param {string} query
 * @param {"movie"|"tv"} type
 */
async function lookup(query, type = "movie") {
  const found = await search(query, type);
  if (!found) return null;
  return getDetails(found.id, type);
}

/**
 * Pull a clean "where to watch" summary out of a details object for one region.
 * @param {object} details - result of getDetails()
 * @param {string} [region] - defaults to config.tmdbRegion
 */
function watchProvidersFor(details, region = config.tmdbRegion) {
  const byRegion = details?.["watch/providers"]?.results?.[region];
  if (!byRegion) return null;
  const names = (arr) => (arr || []).map(p => p.provider_name);
  return {
    region,
    link: byRegion.link || null,
    stream: names(byRegion.flatrate),
    rent: names(byRegion.rent),
    buy: names(byRegion.buy)
  };
}

function posterUrl(details) {
  return details?.poster_path ? `${IMAGE_BASE}${details.poster_path}` : null;
}

module.exports = { isAvailable, search, getDetails, lookup, watchProvidersFor, posterUrl };
