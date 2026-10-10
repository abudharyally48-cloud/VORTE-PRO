// src/server/server.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers
} = require("baileys");
const config = require('../config/config');
const siteStats = require('./siteStats');

const app = express();

// Global state for local bot (still used for /qr locally)
const pairingState = {
  sock: null,
  latestQR: null
};

// Map to track temporary session generator requests
const sessionMap = new Map();

const BOT_FILE = path.join(__dirname, '../../files/VORTE-PRO.zip'); // downloadable bot (see files/README.md)
const COOLDOWN_MS = Number(process.env.PAIRING_COOLDOWN_MS) || 5000; // minimum gap between code requests for the same number (protects it from WhatsApp rate limits)
const PAIRING_EXPIRE_MS = Number(process.env.PAIRING_EXPIRE_MS) || 10 * 60 * 1000; // a pairing nobody completes is cleaned up and counted as failed
const lastRequestAt = new Map();          // phone digits -> time of last code request
const BOT_UA = /bot|crawl|spider|slurp|curl|wget|python-requests|monitor|uptime|pingdom|headless|lighthouse|facebookexternalhit/i;

const waitingCount = () => [...sessionMap.values()].filter((e) => e.status === 'waiting').length;
const parseCookies = (h) => Object.fromEntries(String(h || '').split(';').map((c) => c.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, v.join('=')]));
function botVersion() { try { const [a, b] = String(require('../../package.json').version).split('.'); return `v${a}.${b || 0}`; } catch { return 'v1.0'; } }
function baileysVersion() { try { return require('baileys/package.json').version; } catch { return 'unknown'; } }

/** Count a page view and (once per browser, via cookie) a unique visitor. Bots are skipped. */
function countVisit(req, res) {
  if (req.method !== 'GET' || BOT_UA.test(req.headers['user-agent'] || '')) return;
  siteStats.pageView();
  if (!parseCookies(req.headers.cookie).vp_vid) {
    res.cookie('vp_vid', Date.now().toString(36) + Math.random().toString(36).slice(2, 8), { maxAge: 365 * 24 * 3600 * 1000, httpOnly: true, sameSite: 'lax' });
    siteStats.newVisitor();
  }
}

/** Remove temp session folders left behind by an earlier crash/restart. */
function sweepTempSessions() {
  try {
    const base = path.join(process.cwd(), 'storage', 'temp_sessions');
    if (!fs.existsSync(base)) return;
    for (const d of fs.readdirSync(base)) {
      const p = path.join(base, d);
      if (Date.now() - fs.statSync(p).mtimeMs > 30 * 60 * 1000) fs.rmSync(p, { recursive: true, force: true });
    }
  } catch { /* best effort */ }
}

function setupServer() {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  sweepTempSessions();

  // Serve pairing.html
  app.get('/', (req, res) => {
    try { countVisit(req, res); } catch (e) { /* counting must never break the page */ }
    res.sendFile(path.join(__dirname, '../../pairing.html'));
  });

  // QR Route (for local bot instance monitoring)
  app.get('/qr', async (req, res) => {
    if (!pairingState.latestQR) {
      return res.send('<html><body style="background:#111;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><p>No QR available — bot may already be connected, or not started yet. Refresh in a moment.</p></body></html>');
    }
    try {
      const QRCodeLib = require('qrcode');
      const qrImage = await QRCodeLib.toDataURL(pairingState.latestQR);
      res.send(`<!DOCTYPE html><html><head><title>${config.botName} — QR</title></head><body style="display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#030712;font-family:sans-serif">
        <div style="text-align:center;color:#e2e8f0">
          <h2 style="color:#00ff88;margin-bottom:20px">🤖 ${config.botName} — Scan QR Code</h2>
          <img src="${qrImage}" style="width:280px;height:280px;border-radius:12px"/>
          <p style="margin-top:16px;color:#4a5568;font-size:13px">Open WhatsApp → Linked Devices → Link a Device</p>
          <p style="color:#4a5568;font-size:12px">Refresh page if QR expires</p>
          <p style="margin-top:12px"><a href="/" style="color:#00ff88;font-size:13px">← Back to pairing site</a></p>
        </div>
      </body></html>`);
    } catch (e) {
      res.send('Error generating QR.');
    }
  });

  // Centralized Session Generator API
  app.post('/api/request-code', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, error: 'Phone number is required.' });
    
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 7 || cleanPhone.length > 15) {
      return res.status(400).json({ success: false, error: 'Invalid phone number.' });
    }

    const token = cleanPhone;

    // Short pause between requests for the same number (the very first request is never delayed).
    const since = Date.now() - (lastRequestAt.get(token) || 0);
    if (since < COOLDOWN_MS) {
      const wait = Math.ceil((COOLDOWN_MS - since) / 1000);
      return res.status(429).json({ success: false, error: `Please wait ${wait}s before requesting another code for this number.`, retryAfter: wait });
    }
    lastRequestAt.set(token, Date.now());

    // A wrong-code / expired / abandoned attempt for this number must never block a new one:
    // cancel it and carry on, so a fresh code can be requested whenever the user wants.
    const previous = sessionMap.get(token);
    if (previous && previous.status === 'waiting') {
      previous.cancel('replaced');
      siteStats.retry();
    }

    let isFinished = false;
    let cancelled = false;
    let currentSock = null;
    let expireTimer = null;
    const attemptId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    // one folder PER ATTEMPT, so a cancelled attempt can never touch the next one's files
    const tempSessionFolder = path.join(process.cwd(), 'storage', 'temp_sessions', `${token}_${attemptId}`);
    const removeFolderLater = (ms) => setTimeout(() => {
      try { if (fs.existsSync(tempSessionFolder)) fs.rmSync(tempSessionFolder, { recursive: true, force: true }); } catch (e) {}
    }, ms);

    const entry = {
      status: 'waiting',
      sessionId: null,
      createdAt: Date.now(),
      cancel: (reason) => {
        if (isFinished || cancelled) return;
        cancelled = true; isFinished = true;
        clearTimeout(expireTimer);
        try { currentSock?.ev?.removeAllListeners?.('creds.update'); } catch (e) {}
        try { currentSock?.end(undefined); } catch (e) {}
        removeFolderLater(5000); // let any pending credential write drain first
        if (sessionMap.get(token) === entry) sessionMap.delete(token);
        if (!res.headersSent) res.status(409).json({ success: false, error: 'Superseded by a newer request.' });
        console.log(`🛑 Pairing attempt for +${token} cancelled (${reason}).`);
      }
    };
    // only touch the shared map entry while it is still THIS attempt's
    const update = (patch) => { if (sessionMap.get(token) === entry) Object.assign(entry, patch); };

    try {
      sessionMap.set(token, entry);
      expireTimer = setTimeout(() => {
        if (entry.status === 'waiting' && !isFinished) {
          console.log(`⌛ Pairing for +${token} expired without being completed.`);
          siteStats.fail();
          entry.cancel('expired');
        }
      }, PAIRING_EXPIRE_MS);
      if (expireTimer.unref) expireTimer.unref();

      fs.mkdirSync(tempSessionFolder, { recursive: true });

      const { state, saveCreds } = await useMultiFileAuthState(tempSessionFolder);
      const { version } = await fetchLatestBaileysVersion();

      let codeRequested = false;

      const startSock = () => {
        const sock = makeWASocket({
          logger: pino({ level: 'silent' }),
          browser: ["Ubuntu", "Chrome", "20.0.04"],
          auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino().child({ level: "silent" })),
          },
          version,
        });
        currentSock = sock;

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", async (update_) => {
          if (isFinished) return;
          const { connection, lastDisconnect } = update_;

          if (connection === 'open') {
            console.log(`✅ Session connected for +${token}. Extracting Session ID...`);
            try {
              // Wait slight delay to ensure creds.json is fully written
              setTimeout(async () => {
                if (cancelled) return;
                const credsPath = path.join(tempSessionFolder, 'creds.json');
                if (fs.existsSync(credsPath)) {
                  const creds = fs.readFileSync(credsPath);
                  const b64 = creds.toString('base64');
                  const sessionId = 'VORTE_PRO~' + b64;

                  clearTimeout(expireTimer);
                  update({ status: 'ready', sessionId });
                  siteStats.success();
                  console.log(`🎉 Session IDs generated for +${token}`);

                  try {
                    // Send to user's own number
                    let jid = sock.user?.id;
                    if (jid) {
                       jid = jid.split(':')[0] + '@s.whatsapp.net';
                       await sock.sendMessage(jid, {
                           text: `*✅ VORTE-PRO SESSION GENERATED!*\n\n> ⚠️ *Important:* Never share this ID with anyone. It acts as your login credential.\n\nCopy the ID below:`
                       });
                       await new Promise(resolve => setTimeout(resolve, 800));
                       await sock.sendMessage(jid, {
                           text: sessionId
                       });
                       // Wait briefly to allow the WebSocket buffer to successfully deliver the message
                       await new Promise(resolve => setTimeout(resolve, 1500));
                    }
                  } catch(sendErr) {
                    console.error('Failed to send session to self:', sendErr);
                  }

                  isFinished = true;

                  // Cleanup connection and temporary files
                  try { sock.end(); } catch(e) {}

                   setTimeout(() => {
                    if (fs.existsSync(tempSessionFolder)) {
                       fs.rmSync(tempSessionFolder, { recursive: true, force: true });
                    }
                    if (sessionMap.get(token) === entry) sessionMap.delete(token); // Final removal from memory (never a NEWER attempt's entry)
                    console.log(`🧹 Full cleanup completed for +${token}`);
                  }, 60000); // Wait 60s for Baileys saveCreds internal debounce queue to drain completely
                } else {
                  update({ status: 'error', error: 'Credentials file not found.' });
                  siteStats.fail();
                }
              }, 3000);
            } catch(e) {
              console.error('Error in session success handler:', e);
              update({ status: 'error', error: 'Failed to extract session' });
              siteStats.fail();
            }
          } else if (connection === 'close') {
             const reason = lastDisconnect?.error?.output?.statusCode;
             if (reason === DisconnectReason.restartRequired || reason === 515) {
                 console.log(`🔄 Restart required for ${token}. Reconnecting...`);
                 startSock();
             } else if (reason === DisconnectReason.connectionLost || reason === DisconnectReason.connectionClosed || reason === 408) {
                 console.log(`⚠️ Connection lost/closed for ${token}. Reconnecting...`);
                 startSock();
             } else if (reason !== DisconnectReason.loggedOut && sessionMap.get(token)?.status === 'waiting') {
                 console.log(`⚠️ Connection closed for ${token}: ${reason}`);
             }
          }
        });

        // Give Baileys a moment to initialize before requesting code
        if (!codeRequested) {
          setTimeout(async () => {
            if (isFinished) return; // cancelled while waiting
            try {
              if (!sock.authState.creds.me) {
                const code = await sock.requestPairingCode(cleanPhone);
                const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log(`📲 Pairing code issued for +${cleanPhone}: ${formatted}`);
                codeRequested = true;
                if (!res.headersSent) {
                  res.json({ success: true, code: formatted, token });
                }
              }
            } catch(err) {
              console.error('Failed to request code:', err.message);
              if (!isFinished) {
                isFinished = true; clearTimeout(expireTimer);
                try { sock.end(); } catch (e) {}
                removeFolderLater(5000);
                siteStats.fail();
                if (sessionMap.get(token) === entry) sessionMap.delete(token);
              }
              if (!res.headersSent) {
                res.status(500).json({ success: false, error: 'Failed to generate pairing code' });
              }
            }
          }, 2500);
        }
      };

      startSock();

    } catch (err) {
      console.error('❌ Generator error:', err);
      if (!isFinished) { isFinished = true; clearTimeout(expireTimer); siteStats.fail(); removeFolderLater(5000); }
      if (sessionMap.get(token) === entry) sessionMap.delete(token);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Internal server error.' });
      }
    }
  });

  // Session Status API for Web Pairing
  app.get('/api/session-status/:token', (req, res) => {
    const { token } = req.params;
    const sessionInfo = sessionMap.get(token);
    
    if (!sessionInfo) {
      return res.status(404).json({ success: false, error: 'No active pairing session found. Please try again.' });
    }

    if (sessionInfo.status === 'ready') {
      const sessionId = sessionInfo.sessionId;
      return res.json({ success: true, status: 'ready', sessionId });
    } else if (sessionInfo.status === 'error') {
      sessionMap.delete(token);
      return res.json({ success: false, error: sessionInfo.error });
    } else {
      return res.json({ success: true, status: 'waiting' });
    }
  });

  // Status API
  app.get('/api/status', (req, res) => {
    res.json({
      botName: config.botName,
      uptime: Math.floor(process.uptime()),
      activePairings: waitingCount()
    });
  });

  // REAL numbers for the site (counted on the server, saved to disk). No simulation.
  app.get('/api/stats', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const st = siteStats.snapshot();
    res.json({
      visitors: st.visitors,
      pageViews: st.pageViews,
      successful: st.successful,
      failed: st.failed,
      downloads: st.downloads,
      countingSince: st.since,
      uptimeSeconds: Math.floor(process.uptime()),
      startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      activePairings: waitingCount(),
      botName: config.botName,
      botVersion: botVersion(),
      baileysVersion: baileysVersion()
    });
  });

  // Is there a bot file to download? (uploaded ZIP, or an external link from BOT_DOWNLOAD_URL)
  app.get('/api/bot-file', (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      if (fs.existsSync(BOT_FILE)) return res.json({ available: true, kind: 'file', name: 'VORTE-PRO.zip', sizeBytes: fs.statSync(BOT_FILE).size, version: botVersion() });
    } catch (e) { /* fall through */ }
    if (/^https?:\/\//i.test(process.env.BOT_DOWNLOAD_URL || '')) return res.json({ available: true, kind: 'link', name: 'VORTE-PRO', sizeBytes: null, version: botVersion() });
    res.json({ available: false, version: botVersion() });
  });

  app.get('/download/bot', (req, res) => {
    if (fs.existsSync(BOT_FILE)) {
      siteStats.download();
      return res.download(BOT_FILE, 'VORTE-PRO.zip');
    }
    if (/^https?:\/\//i.test(process.env.BOT_DOWNLOAD_URL || '')) {
      siteStats.download();
      return res.redirect(process.env.BOT_DOWNLOAD_URL);
    }
    res.status(404).send('The bot file has not been uploaded yet.');
  });

  // Health and Keep-alive
  app.get('/health', (req, res) => {
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      activeSessions: waitingCount(),
      memory: process.memoryUsage()
    });
  });

  // Start listener
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`🌐 Web server Session Generator running on port ${config.port}`);
  });

  return { app, server, pairingState };
}

module.exports = setupServer;
