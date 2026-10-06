// src/services/downloaders/urlDetector.js
// Centralized platform/URL detection so no command has to duplicate regexes.

const PATTERNS = [
  { platform: "youtube", re: /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)[\w-]+/i },
  { platform: "tiktok", re: /(?:tiktok\.com\/[^\s]+|vm\.tiktok\.com\/[\w]+|vt\.tiktok\.com\/[\w]+)/i },
  { platform: "instagram", re: /instagram\.com\/(?:reel|reels|p|tv)\/[\w-]+/i }
];

/**
 * @param {string} text
 * @returns {{ platform: "youtube"|"tiktok"|"instagram", url: string } | null}
 */
function detect(text) {
  if (!text) return null;
  for (const { platform, re } of PATTERNS) {
    const match = text.match(re);
    if (match) {
      // Re-extract a clean URL starting at the match, trimmed at whitespace.
      const start = text.indexOf(match[0]);
      const rest = text.slice(start).split(/\s/)[0];
      const url = rest.startsWith("http") ? rest : `https://${rest}`;
      return { platform, url };
    }
  }
  return null;
}

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

module.exports = { detect, isValidUrl };
