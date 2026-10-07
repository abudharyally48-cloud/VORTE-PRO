// src/services/downloaders/ytdlpRunner.js
// Minimal yt-dlp launcher that replaces the `yt-dlp-exec` npm package.
//
// Why: yt-dlp-exec's preinstall requires `python` on the host and aborts the
// WHOLE `npm install` when it is missing (e.g. Katabump / Pterodactyl
// containers), leaving the bot without dotenv etc. The plain `yt-dlp` release
// file is also a Python zipapp, so it needs Python at runtime too.
//
// This runner needs NO Python and NO install scripts:
//   1. YTDLP_PATH env var (explicit override), else
//   2. a `yt-dlp` already on PATH, else
//   3. the self-contained standalone build (yt-dlp_linux / _aarch64 / _macos /
//      .exe) downloaded once into storage/bin on first use.
const fs = require("fs");
const path = require("path");
const https = require("https");
const { spawn } = require("child_process");

const BIN_DIR = path.join(__dirname, "../../../storage/bin");
const FETCH_TIMEOUT_MS = 30000;
const MAX_REDIRECTS = 5;
const MAX_OUTPUT_BYTES = 50 * 1024 * 1024;
const RELEASE_BASE = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/";

function standaloneAsset() {
  const { platform, arch } = process;
  if (platform === "win32") return "yt-dlp.exe";
  if (platform === "darwin") return "yt-dlp_macos";
  if (platform === "linux") return arch === "arm64" ? "yt-dlp_linux_aarch64" : "yt-dlp_linux";
  return null;
}

const localBinPath = () => path.join(BIN_DIR, standaloneAsset() || "yt-dlp");

function isExecutable(p) {
  try { fs.accessSync(p, fs.constants.X_OK); return true; } catch { return false; }
}

function probe(cmd) {
  return new Promise((resolve) => {
    let child;
    try { child = spawn(cmd, ["--version"], { stdio: "ignore" }); } catch { return resolve(false); }
    const t = setTimeout(() => { child.kill("SIGKILL"); resolve(false); }, 15000);
    child.on("error", () => { clearTimeout(t); resolve(false); });
    child.on("close", (code) => { clearTimeout(t); resolve(code === 0); });
  });
}

function download(url, dest, redirectsLeft = MAX_REDIRECTS) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const tmp = `${dest}.part`;
    const fail = (err) => { fs.unlink(tmp, () => {}); reject(err); };
    const req = https.get(url, { headers: { "User-Agent": "vorte-pro" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirectsLeft <= 0) return fail(new Error("Too many redirects fetching yt-dlp"));
        return download(new URL(res.headers.location, url).toString(), dest, redirectsLeft - 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) { res.resume(); return fail(new Error(`yt-dlp download failed: HTTP ${res.statusCode}`)); }
      const file = fs.createWriteStream(tmp);
      res.pipe(file);
      file.on("error", fail);
      file.on("finish", () => file.close(() => {
        try { fs.chmodSync(tmp, 0o755); fs.renameSync(tmp, dest); resolve(); } catch (e) { fail(e); }
      }));
    });
    req.setTimeout(FETCH_TIMEOUT_MS, () => req.destroy(new Error("Timed out fetching yt-dlp")));
    req.on("error", fail);
  });
}

let resolved = null;      // cached command once found
let pending = null;       // in-flight resolution (avoids parallel downloads)

/** Resolve (and if needed install) a usable yt-dlp command. @returns {Promise<string|null>} */
function ensureBinary() {
  if (resolved) return Promise.resolve(resolved);
  if (pending) return pending;
  pending = (async () => {
    try {
      if (process.env.YTDLP_PATH && isExecutable(process.env.YTDLP_PATH)) return (resolved = process.env.YTDLP_PATH);
      if (await probe("yt-dlp")) return (resolved = "yt-dlp");
      const asset = standaloneAsset();
      if (!asset) throw new Error(`No standalone yt-dlp build for ${process.platform}/${process.arch}`);
      const dest = localBinPath();
      if (!isExecutable(dest) || !(await probe(dest))) {
        console.log(`⬇️  Downloading yt-dlp (${asset})...`);
        await download(RELEASE_BASE + asset, dest);
        if (!(await probe(dest))) throw new Error("Downloaded yt-dlp does not run on this host");
        console.log("✅ yt-dlp ready");
      }
      return (resolved = dest);
    } catch (err) {
      console.error("❌ yt-dlp binary install failed:", err.message);
      return null;
    } finally {
      pending = null;
    }
  })();
  return pending;
}

const kebab = (s) => s.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());

/** { noPlaylist: true, maxFilesize: "100M", format: undefined } -> ["--no-playlist","--max-filesize","100M"] */
function buildArgs(flags = {}) {
  const args = [];
  for (const [key, val] of Object.entries(flags)) {
    if (val === undefined || val === null || val === false) continue;
    args.push("--" + kebab(key));
    if (val !== true) args.push(String(val));
  }
  return args;
}

/**
 * Run yt-dlp. Resolves with stdout; rejects with an Error carrying
 * .stderr, .exitCode and .timedOut (read by ytdlp.js classifyError).
 */
/**
 * Accept either a Netscape cookies.txt or a Cookie-Editor-style JSON export
 * (array of {domain,path,secure,expirationDate,name,value,...}); JSON is
 * converted to a Netscape file in storage/tmp so yt-dlp can read it.
 * Returns the path to hand to --cookies, or null if unusable.
 */
function prepareCookies(file) {
  try {
    const raw = fs.readFileSync(file, "utf8");
    const t = raw.trimStart();
    if (!(t.startsWith("[") || t.startsWith("{"))) return file; // already Netscape
    let list = JSON.parse(t);
    if (!Array.isArray(list)) list = list.cookies;
    if (!Array.isArray(list)) throw new Error("JSON is not a cookie array");
    const lines = ["# Netscape HTTP Cookie File"];
    for (const c of list) {
      if (!c || !c.domain || !c.name) continue;
      const domain = String(c.domain);
      const exp = c.expirationDate ? Math.floor(Number(c.expirationDate)) : 0;
      lines.push([
        (c.httpOnly ? "#HttpOnly_" : "") + domain,
        domain.startsWith(".") ? "TRUE" : "FALSE",
        c.path || "/",
        c.secure ? "TRUE" : "FALSE",
        exp,
        c.name,
        String(c.value ?? "").replace(/[\r\n\t]/g, "")
      ].join("\t"));
    }
    const out = path.join(__dirname, "../../../storage/tmp/cookies.netscape.txt");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, lines.join("\n") + "\n", { mode: 0o600 });
    return out;
  } catch (e) {
    console.error("⚠️ Could not read YTDLP_COOKIES file:", e.message);
    return null;
  }
}

/** Host-level options from env, applied to every call (see .env.example). */
let warnedCookies = false;
function globalFlags() {
  const f = {};
  const cookies = process.env.YTDLP_COOKIES;               // path to a Netscape cookies.txt
  if (cookies && fs.existsSync(cookies)) { const c = prepareCookies(cookies); if (c) f.cookies = c; }
  else if (cookies && !warnedCookies) { warnedCookies = true; console.error(`⚠️ YTDLP_COOKIES is set to "${cookies}" but that file does not exist — downloads will run without cookies.`); }
  if (process.env.YTDLP_PROXY) f.proxy = process.env.YTDLP_PROXY;
  const js = process.env.YTDLP_JS_RUNTIME || "node";       // YouTube extraction needs a JS runtime; "off" disables
  if (js !== "off") f.jsRuntimes = js;
  return f;
}

async function exec(url, flags = {}, { timeout = 120000 } = {}) {
  const cmd = await ensureBinary();
  if (!cmd) throw new Error("yt-dlp is not available on this host.");
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, [...buildArgs({ ...globalFlags(), ...flags }), "--", String(url)], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "", timedOut = false, overflow = false;
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeout);
    child.stdout.on("data", (d) => {
      out += d;
      if (out.length > MAX_OUTPUT_BYTES) { overflow = true; child.kill("SIGKILL"); }
    });
    child.stderr.on("data", (d) => { if (err.length < 200000) err += d; });
    child.on("error", (e) => { clearTimeout(timer); reject(Object.assign(e, { stderr: err })); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && !timedOut && !overflow) return resolve(out);
      const e = new Error(timedOut ? "yt-dlp timed out" : overflow ? "yt-dlp output too large" : (err.trim().split("\n").pop() || `yt-dlp exited with code ${code}`));
      e.stderr = err; e.exitCode = code; e.timedOut = timedOut;
      if (!timedOut) console.error(`❌ [yt-dlp] exit ${code} for ${String(url).slice(0, 80)}:\n${err.trim().split("\n").slice(-6).join("\n")}`);
      reject(e);
    });
  });
}

/** exec() + JSON.parse, for dumpSingleJson calls. */
async function json(url, flags, opts) {
  return JSON.parse(await exec(url, flags, opts));
}

module.exports = { prepareCookies, ensureBinary, exec, json, buildArgs, standaloneAsset, BIN_DIR };
