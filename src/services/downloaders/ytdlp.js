// src/services/downloaders/ytdlp.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");
const ytdlpExec = require("yt-dlp-exec");
const { isFfmpegAvailable } = require("./ffmpegCheck");

const TMP_DIR = path.join(__dirname, "../../../storage/tmp/downloads");
const BIN_PATH = require("yt-dlp-exec/src/constants").YOUTUBE_DL_PATH;
const BINARY_FALLBACK_URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";

const DEFAULT_TIMEOUT_MS = Number(process.env.YTDLP_TIMEOUT_MS) || 120000; // 2 min
const DEFAULT_MAX_FILESIZE_MB = Number(process.env.YTDLP_MAX_FILESIZE_MB) || 100;

function ensureTmpDir() {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
}

/**
 * Download the fallback binary directly from GitHub's release CDN,
 * bypassing the (rate-limited) GitHub API that yt-dlp-exec's own
 * postinstall script queries. Self-healing: called automatically if the
 * binary isn't present/executable when first needed, so a transient
 * postinstall failure on a given host doesn't permanently break downloads.
 */
const BINARY_FETCH_TIMEOUT_MS = 30000;
const MAX_REDIRECTS = 5;

function fetchBinaryDirect() {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(BIN_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = fs.createWriteStream(BIN_PATH);
    let settled = false;
    const fail = (err) => { if (!settled) { settled = true; file.close(); fs.unlink(BIN_PATH, () => {}); reject(err); } };
    const succeed = () => { if (!settled) { settled = true; resolve(); } };

    const request = (url, redirectsLeft) => {
      const req = https.get(url, { headers: { "User-Agent": "vorte-pro" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume(); // drain so the socket can be reused/closed cleanly
          if (redirectsLeft <= 0) return fail(new Error("Too many redirects fetching yt-dlp binary"));
          return request(res.headers.location, redirectsLeft - 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return fail(new Error(`Binary download failed: HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on("finish", () => {
          file.close(() => {
            try { fs.chmodSync(BIN_PATH, 0o755); } catch (e) { return fail(e); }
            succeed();
          });
        });
      });
      // Every hop gets its own timeout — a single stalled hop can never hang this forever.
      req.setTimeout(BINARY_FETCH_TIMEOUT_MS, () => {
        req.destroy(new Error("Timed out fetching yt-dlp binary"));
      });
      req.on("error", fail);
    };
    request(BINARY_FALLBACK_URL, MAX_REDIRECTS);
  });
}

async function isBinaryAvailable() {
  try {
    fs.accessSync(BIN_PATH, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureBinary() {
  if (await isBinaryAvailable()) return true;
  try {
    await fetchBinaryDirect();
    return await isBinaryAvailable();
  } catch (err) {
    console.error("❌ yt-dlp binary install failed:", err.message);
    return false;
  }
}

function uniqueFilePath(ext) {
  ensureTmpDir();
  return path.join(TMP_DIR, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`);
}

/** Convert a raw yt-dlp/execa failure into a short, honest, user-facing reason. */
function classifyError(err) {
  const msg = String(err?.stderr || err?.message || err || "").toLowerCase();
  if (err?.timedOut) return "Download timed out.";
  if (msg.includes("private video") || msg.includes("login required")) return "This content is private.";
  if (msg.includes("video unavailable") || msg.includes("this video is not available")) return "Video unavailable.";
  if (msg.includes("unsupported url") || msg.includes("no extractor")) return "Unsupported URL.";
  if (msg.includes("file is larger than max-filesize") || msg.includes("max-filesize")) return "File is too large.";
  if (msg.includes("unable to download") || msg.includes("network") || msg.includes("timed out")) return "Network error reaching the source.";
  if (msg.includes("this video has been removed") || msg.includes("deleted")) return "This content was deleted.";
  return "Could not extract media.";
}

/**
 * @param {string} url
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<object>} the metadata only (skipDownload) — used for search/info
 */
async function getInfo(url, opts = {}) {
  if (!(await ensureBinary())) throw new Error("yt-dlp is not available on this host.");
  try {
    return await ytdlpExec(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noPlaylist: true,
      skipDownload: true
    }, { timeout: opts.timeoutMs || DEFAULT_TIMEOUT_MS });
  } catch (err) {
    const e = new Error(classifyError(err));
    e.cause = err;
    throw e;
  }
}

/**
 * yt-dlp's own pseudo-URL search (ytsearchN:query) — works with zero API
 * keys, used as the fallback when no YouTube Data API key is configured.
 * @param {string} query
 * @param {number} [limit]
 */
async function search(query, limit = 5) {
  if (!(await ensureBinary())) throw new Error("yt-dlp is not available on this host.");
  try {
    const result = await ytdlpExec(`ytsearch${limit}:${query}`, {
      dumpSingleJson: true,
      noWarnings: true,
      flatPlaylist: true,
      skipDownload: true
    }, { timeout: DEFAULT_TIMEOUT_MS });
    const entries = result?.entries || (Array.isArray(result) ? result : [result]).filter(Boolean);
    return entries.map(e => ({
      title: e.title,
      url: e.webpage_url || e.url || (e.id ? `https://www.youtube.com/watch?v=${e.id}` : null),
      duration: e.duration,
      channel: e.channel || e.uploader
    })).filter(e => e.url);
  } catch (err) {
    const e = new Error(classifyError(err));
    e.cause = err;
    throw e;
  }
}

/**
 * Download a video. Prefers a pre-merged format (no ffmpeg needed); if
 * ffmpeg IS available, allows yt-dlp to merge separate best video+audio
 * streams for better quality.
 * @param {string} url
 * @param {{ maxHeight?: number, timeoutMs?: number }} [opts]
 * @returns {Promise<{ filePath: string, title: string, sizeBytes: number }>}
 */
async function downloadVideo(url, opts = {}) {
  if (!(await ensureBinary())) throw new Error("yt-dlp is not available on this host.");
  const maxHeight = opts.maxHeight || 480; // WhatsApp-friendly default; avoids huge files
  const ffmpeg = await isFfmpegAvailable();
  const outPath = uniqueFilePath("mp4");

  const format = ffmpeg
    ? `bestvideo[height<=${maxHeight}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${maxHeight}][ext=mp4]/best[height<=${maxHeight}]`
    : `best[height<=${maxHeight}][ext=mp4]/best[height<=${maxHeight}]`; // single pre-merged stream only, no merge step

  try {
    await ytdlpExec.exec(url, {
      output: outPath,
      format,
      noWarnings: true,
      noPlaylist: true,
      maxFilesize: `${opts.maxFilesizeMB || DEFAULT_MAX_FILESIZE_MB}M`,
      mergeOutputFormat: ffmpeg ? "mp4" : undefined
    }, { timeout: opts.timeoutMs || DEFAULT_TIMEOUT_MS });

    if (!fs.existsSync(outPath)) throw new Error("yt-dlp reported success but no output file was found.");
    const { size } = fs.statSync(outPath);
    const info = await getInfo(url, { timeoutMs: 15000 }).catch(() => null);
    return { filePath: outPath, title: info?.title || "video", sizeBytes: size };
  } catch (err) {
    cleanup(outPath);
    if (err.message?.startsWith("yt-dlp reported") || err.message?.startsWith("yt-dlp is not")) throw err;
    const e = new Error(classifyError(err));
    e.cause = err;
    throw e;
  }
}

/**
 * Download audio only. Converts to mp3 when ffmpeg is available; otherwise
 * keeps whatever best audio-only format yt-dlp extracts natively (m4a/webm)
 * rather than failing outright.
 * @param {string} url
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<{ filePath: string, title: string, sizeBytes: number, format: string }>}
 */
async function downloadAudio(url, opts = {}) {
  if (!(await ensureBinary())) throw new Error("yt-dlp is not available on this host.");
  const ffmpeg = await isFfmpegAvailable();
  const ext = ffmpeg ? "mp3" : "m4a";
  const outPath = uniqueFilePath(ext);

  try {
    await ytdlpExec.exec(url, {
      output: outPath,
      format: "bestaudio/best",
      extractAudio: true,
      audioFormat: ffmpeg ? "mp3" : undefined,
      audioQuality: ffmpeg ? "5" : undefined,
      noWarnings: true,
      noPlaylist: true,
      maxFilesize: `${opts.maxFilesizeMB || DEFAULT_MAX_FILESIZE_MB}M`
    }, { timeout: opts.timeoutMs || DEFAULT_TIMEOUT_MS });

    if (!fs.existsSync(outPath)) throw new Error("yt-dlp reported success but no output file was found.");
    const { size } = fs.statSync(outPath);
    const info = await getInfo(url, { timeoutMs: 15000 }).catch(() => null);
    return { filePath: outPath, title: info?.title || "audio", sizeBytes: size, format: ext };
  } catch (err) {
    cleanup(outPath);
    if (err.message?.startsWith("yt-dlp reported") || err.message?.startsWith("yt-dlp is not")) throw err;
    const e = new Error(classifyError(err));
    e.cause = err;
    throw e;
  }
}

function cleanup(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {
    console.error("❌ temp file cleanup failed:", e.message);
  }
}

module.exports = { ensureBinary, getInfo, search, downloadVideo, downloadAudio, cleanup, classifyError, TMP_DIR };
