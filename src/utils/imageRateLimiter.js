// src/utils/imageRateLimiter.js
const fs = require("fs");
const path = require("path");

const USAGE_DIR = path.join(__dirname, "../../storage/usage");
const USAGE_FILE = path.join(USAGE_DIR, "image-generation.json");

const WINDOW_MS = 5 * 60 * 60 * 1000; // 5 hours
const LIMIT = 30;

function ensureFile() {
  if (!fs.existsSync(USAGE_DIR)) fs.mkdirSync(USAGE_DIR, { recursive: true });
  if (!fs.existsSync(USAGE_FILE)) fs.writeFileSync(USAGE_FILE, JSON.stringify({}));
}

function readUsage() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(USAGE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeUsage(data) {
  ensureFile();
  fs.writeFileSync(USAGE_FILE, JSON.stringify(data, null, 2));
}

function pruneOld(timestamps, now) {
  return timestamps.filter(t => now - t < WINDOW_MS);
}

/**
 * Check whether a sender is allowed to generate another image right now.
 * Does NOT record anything — call recordGeneration() only after a successful
 * generation, so failed API calls never consume the allowance.
 * @param {string} senderId - normalized sender identifier (e.g. phone digits)
 * @returns {{ allowed: boolean, remaining: number, retryAfterMs: number|null }}
 */
function canGenerate(senderId) {
  const usage = readUsage();
  const now = Date.now();
  const timestamps = pruneOld(usage[senderId] || [], now);

  if (timestamps.length >= LIMIT) {
    const oldest = Math.min(...timestamps);
    const retryAfterMs = WINDOW_MS - (now - oldest);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  return { allowed: true, remaining: LIMIT - timestamps.length, retryAfterMs: null };
}

/**
 * Record a SUCCESSFUL image generation for a sender. Only call this after
 * the generation actually succeeded.
 * @param {string} senderId
 */
function recordGeneration(senderId) {
  const usage = readUsage();
  const now = Date.now();
  const timestamps = pruneOld(usage[senderId] || [], now);
  timestamps.push(now);
  usage[senderId] = timestamps;
  writeUsage(usage);
}

/**
 * Format a millisecond duration as a human-readable "Xh Ym" string.
 * @param {number} ms
 */
function formatDuration(ms) {
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

module.exports = { canGenerate, recordGeneration, formatDuration, LIMIT, WINDOW_MS };
