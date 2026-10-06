// src/services/downloaders/ffmpegCheck.js
const { execFile } = require("child_process");

let cached = null;

/**
 * Checks whether ffmpeg is actually callable on this host. Cached after the
 * first check (process lifetime) since it can't change while the bot runs.
 * @returns {Promise<boolean>}
 */
function isFfmpegAvailable() {
  if (cached !== null) return Promise.resolve(cached);
  return new Promise((resolve) => {
    execFile("ffmpeg", ["-version"], { timeout: 5000 }, (err) => {
      cached = !err;
      resolve(cached);
    });
  });
}

module.exports = { isFfmpegAvailable };
