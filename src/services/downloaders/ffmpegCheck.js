// src/services/downloaders/ffmpegCheck.js
// Finds ffmpeg AND ffprobe (yt-dlp needs both to merge separate picture/sound streams or convert to mp3).
// Search order:  FFMPEG_PATH  ->  ffmpeg/ffprobe already on the host (PATH)  ->  the bundled npm packages
// (@ffmpeg-installer/ffmpeg + @ffprobe-installer/ffprobe, installed by `npm install`, no system install needed).
// FFMPEG_DISABLE=true switches it all off.
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const LINK_DIR = path.join(__dirname, "../../../storage/bin/ffmpeg-bin");
const isWin = process.platform === "win32";
const EXE = (n) => (isWin ? n + ".exe" : n);

let cache; // undefined = not looked yet, null = nothing usable, object = found
let looking = null;

function probe(cmd) {
  return new Promise((resolve) => {
    try { execFile(cmd, ["-version"], { timeout: 8000 }, (err) => resolve(!err)); } catch { resolve(false); }
  });
}
function npmPath(mod) { try { const p = require(mod).path; return p && fs.existsSync(p) ? p : null; } catch { return null; } }

/** One folder that holds both tools under their real names (what yt-dlp's --ffmpeg-location wants). */
function linkBoth(ffmpegBin, ffprobeBin) {
  fs.mkdirSync(LINK_DIR, { recursive: true });
  for (const [name, target] of [["ffmpeg", ffmpegBin], ["ffprobe", ffprobeBin]]) {
    const dest = path.join(LINK_DIR, EXE(name));
    try { if (fs.existsSync(dest) && fs.realpathSync(dest) === fs.realpathSync(target)) continue; fs.rmSync(dest, { force: true }); } catch { /* recreate */ }
    try { fs.symlinkSync(target, dest); }
    catch { fs.copyFileSync(target, dest); fs.chmodSync(dest, 0o755); } // symlinks not allowed on this host: copy instead
  }
  return LINK_DIR;
}

async function findOnce() {
  if (String(process.env.FFMPEG_DISABLE || "").toLowerCase() === "true") return null;

  const custom = process.env.FFMPEG_PATH;
  if (custom) {
    const dir = fs.existsSync(custom) && fs.statSync(custom).isDirectory() ? custom : path.dirname(custom);
    const ff = path.join(dir, EXE("ffmpeg")), fp = path.join(dir, EXE("ffprobe"));
    if (fs.existsSync(ff) && fs.existsSync(fp) && (await probe(ff))) return { via: "FFMPEG_PATH", dir, ffmpeg: ff, ffprobe: fp };
  }
  if ((await probe("ffmpeg")) && (await probe("ffprobe"))) return { via: "system", dir: null, ffmpeg: "ffmpeg", ffprobe: "ffprobe" };

  const nf = npmPath("@ffmpeg-installer/ffmpeg"), np = npmPath("@ffprobe-installer/ffprobe");
  if (nf && np && (await probe(nf)) && (await probe(np))) {
    try { return { via: "npm", dir: linkBoth(nf, np), ffmpeg: nf, ffprobe: np }; } catch (e) { console.error("⚠️ ffmpeg setup failed:", e.message); }
  }
  return null;
}

/** @returns {Promise<{via:string, dir:string|null, ffmpeg:string, ffprobe:string}|null>} */
async function ensureFfmpeg() {
  if (cache !== undefined) return cache;
  if (!looking) looking = findOnce().then((r) => { cache = r; looking = null; if (r) console.log(`🎞️  ffmpeg ready (${r.via})`); else console.log("ℹ️  ffmpeg not available — only single-stream downloads and m4a audio will work"); return r; });
  return looking;
}

async function isFfmpegAvailable() { return !!(await ensureFfmpeg()); }

/** Folder to pass to yt-dlp --ffmpeg-location (null = yt-dlp finds it on PATH itself). Sync: call after ensureFfmpeg(). */
const location = () => (cache && cache.dir) || null;

const describe = () => (cache ? { available: true, via: cache.via, dir: cache.dir } : { available: false, via: null, dir: null });
const _reset = () => { cache = undefined; looking = null; };

module.exports = { ensureFfmpeg, isFfmpegAvailable, location, describe, _reset };
