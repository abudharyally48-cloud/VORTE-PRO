// ===== VORTE PRO - Session ID Generator Server =====
// This is a SEPARATE server from the main bot.
// Users visit this to get their SESSION_ID, then deploy the main bot with it.
// Run with: node session-server.js

require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || process.env.SESSION_PORT || 3001;

// Create required folders if they don't exist
const TMP_SESSIONS_DIR = path.join(__dirname, 'tmp_sessions');
if (!fs.existsSync(TMP_SESSIONS_DIR)) fs.mkdirSync(TMP_SESSIONS_DIR, { recursive: true });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the pairing website
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'pairing.html'));
});

// ===== In-memory session store =====
// Maps sessionToken -> { sock, state, saveCreds, phone, status, sessionId }
const sessions = {};

// Cleanup stale sessions after 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, sess] of Object.entries(sessions)) {
    if (sess.createdAt && (now - sess.createdAt) > 10 * 60 * 1000) {
      console.log(`🧹 Cleaning up stale session: ${token}`);
      try { sess.sock?.end(); } catch (e) {}
      // Clean up temp folder
      try {
        const tmpDir = path.join(__dirname, 'tmp_sessions', token);
        if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
      } catch (e) {}
      delete sessions[token];
    }
  }
}, 60 * 1000);

// ===== STEP 1: Request pairing code =====
// User submits their phone number → we spin up a temp Baileys socket for them
// → call requestPairingCode() → return the code to the website
app.post('/api/request-code', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ success: false, error: 'Phone number required.' });

  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.length < 7 || cleanPhone.length > 15)
    return res.status(400).json({ success: false, error: 'Invalid phone number.' });

  // Generate a unique token for this pairing session
  const token = uuidv4();
  const tmpDir = path.join(__dirname, 'tmp_sessions', token);

  try {
    fs.mkdirSync(tmpDir, { recursive: true });

    const {
      default: makeWASocket,
      useMultiFileAuthState,
      fetchLatestBaileysVersion,
      makeCacheableSignalKeyStore,
      DisconnectReason
    } = require('baileys');
    const P = require('pino');

    const { state, saveCreds } = await useMultiFileAuthState(tmpDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      logger: P({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['Ubuntu', 'Chrome', '22.0.0.0'],
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'silent' })),
      },
      fetchAgent: null,
      fireInitQueries: false,
    });

    // Store session
    sessions[token] = {
      sock,
      state,
      saveCreds,
      phone: cleanPhone,
      tmpDir,
      status: 'waiting_pairing',
      sessionId: null,
      createdAt: Date.now(),
    };

    sock.ev.on('creds.update', async () => {
      await saveCreds();
      // After creds update, check if we can generate session ID
      const sess = sessions[token];
      if (sess && sess.status === 'paired') {
        try {
          const sessionId = generateSessionId(tmpDir);
          sess.sessionId = sessionId;
          sess.status = 'ready';
          console.log(`✅ Session ID ready for token: ${token}`);
        } catch (e) {
          console.error('Error generating session ID:', e.message);
        }
      }
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;
      const sess = sessions[token];
      if (!sess) return;

      if (connection === 'open') {
        console.log(`✅ WhatsApp connected for token: ${token}`);
        sess.status = 'paired';
        await saveCreds();

        // Generate session ID from the saved credentials
        setTimeout(async () => {
          try {
            const sessionId = generateSessionId(tmpDir);
            sess.sessionId = sessionId;
            sess.status = 'ready';
            console.log(`🔑 Session ID generated for +${cleanPhone}`);
          } catch (e) {
            console.error('Session ID generation error:', e.message);
            sess.status = 'error';
          }
        }, 1500);
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code === DisconnectReason.loggedOut || sess.status === 'ready') {
          // Expected close after we got what we need
          try { sock.end(); } catch (e) {}
        }
      }
    });

    // Wait for socket to be ready then request pairing code
    console.log(`⏳ Waiting for socket to be ready...`);
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log(`📲 Requesting pairing code for +${cleanPhone}...`);
    const pairingCode = await sock.requestPairingCode(cleanPhone);

    // Delay after requesting to let WhatsApp process
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log(`📲 Raw pairing code response:`, pairingCode);

    if (!pairingCode) throw new Error('No pairing code returned from WhatsApp');

    const formatted = pairingCode?.match(/.{1,4}/g)?.join('-') || pairingCode;

    console.log(`✅ Pairing code for +${cleanPhone}: ${formatted} [token: ${token}]`);

    return res.json({ success: true, code: formatted, token });

  } catch (err) {
    console.error(`❌ Pairing code error for +${cleanPhone}:`, err.message);
    console.error('Full error:', err);
    // Cleanup on error
    try {
      const tmpDir = path.join(__dirname, 'tmp_sessions', token);
      if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
    } catch (e) {}
    delete sessions[token];
    return res.status(500).json({
      success: false,
      error: 'Failed to generate pairing code. Make sure your number is registered on WhatsApp.'
    });
  }
});

// ===== STEP 2: Poll for session ID =====
// Website polls this after the user enters the pairing code in WhatsApp
// Once WhatsApp connects → we read the saved creds → encode as base64 → return as SESSION_ID
app.get('/api/session-status/:token', (req, res) => {
  const { token } = req.params;
  const sess = sessions[token];

  if (!sess) {
    return res.status(404).json({ success: false, error: 'Session not found or expired.' });
  }

  if (sess.status === 'ready' && sess.sessionId) {
    // Session is ready — return the ID and cleanup
    const sessionId = sess.sessionId;

    // Schedule cleanup after 5 minutes (give user time to copy it)
    setTimeout(() => {
      try { sess.sock?.end(); } catch (e) {}
      try {
        if (fs.existsSync(sess.tmpDir)) fs.rmSync(sess.tmpDir, { recursive: true });
      } catch (e) {}
      delete sessions[token];
      console.log(`🧹 Cleaned up session for token: ${token}`);
    }, 5 * 60 * 1000);

    return res.json({ success: true, status: 'ready', sessionId });
  }

  if (sess.status === 'error') {
    return res.json({ success: false, status: 'error', error: 'Failed to generate session. Try again.' });
  }

  // Still waiting for user to enter code in WhatsApp
  return res.json({ success: true, status: sess.status });
});

// ===== HEALTH =====
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    activeSessions: Object.keys(sessions).length,
    uptime: Math.floor(process.uptime())
  });
});

// ===== GENERATE SESSION ID =====
// Reads the saved credentials from the temp session folder,
// encodes them as a base64 string prefixed with "VORTE_"
function generateSessionId(tmpDir) {
  const credsFile = path.join(tmpDir, 'creds.json');
  if (!fs.existsSync(credsFile)) {
    throw new Error('creds.json not found — session not saved yet');
  }
  const creds = fs.readFileSync(credsFile, 'utf8');
  const encoded = Buffer.from(creds).toString('base64');
  return `VORTE_${encoded}`;
}

// ===== START SERVER =====
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🔑 VORTE PRO Session Server running on port ${PORT}`);
  console.log(`🌐 Pairing website: http://localhost:${PORT}/`);
  console.log(`📦 Users visit the site to get their SESSION_ID\n`);
});

process.on('uncaughtException', err => console.error('Uncaught:', err.message));
process.on('unhandledRejection', reason => console.error('Unhandled rejection:', reason));
  
