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

// Maps phone number -> currently active pairing token
// This allows unlimited sequential retries while ensuring
// only ONE pairing attempt is active for a phone at a time.
const activePairings = {};

// ===== SESSION CLEANUP =====
function cleanupSession(token) {
  const sess = sessions[token];
  if (!sess) return;

  console.log(`🧹 Cleaning up session: ${token}`);

  // Mark inactive BEFORE ending the socket so any late async
  // events from the old socket cannot affect anything.
  sess.active = false;

  try {
    sess.sock?.end();
  } catch (e) {}

  try {
    if (sess.tmpDir && fs.existsSync(sess.tmpDir)) {
      fs.rmSync(sess.tmpDir, { recursive: true, force: true });
    }
  } catch (e) {}

  // Only remove the phone mapping if this token is still
  // the active pairing attempt for that phone.
  if (sess.phone && activePairings[sess.phone] === token) {
    delete activePairings[sess.phone];
  }

  delete sessions[token];
}

// Check whether this socket/session is still the active
// pairing attempt for its phone.
function isActivePairing(token, phone) {
  const sess = sessions[token];

  return !!(
    sess &&
    sess.active &&
    activePairings[phone] === token
  );
}

// Cleanup stale sessions after 10 minutes
setInterval(() => {
  const now = Date.now();

  for (const [token, sess] of Object.entries(sessions)) {
    if (sess.createdAt && (now - sess.createdAt) > 10 * 60 * 1000) {
      cleanupSession(token);
    }
  }
}, 60 * 1000);

// ===== STEP 1: Request pairing code =====
// User submits their phone number → we spin up a temp Baileys socket for them
// → call requestPairingCode() → return the code to the website
app.post('/api/request-code', async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({
      success: false,
      error: 'Phone number required.'
    });
  }

  const cleanPhone = phone.replace(/[^0-9]/g, '');

  if (cleanPhone.length < 7 || cleanPhone.length > 15) {
    return res.status(400).json({
      success: false,
      error: 'Invalid phone number.'
    });
  }

  // ============================================================
  // RETRY HANDLING ONLY
  // ============================================================
  //
  // If this phone already has a pairing attempt, completely
  // invalidate that attempt before creating the new one.
  //
  // This allows:
  //
  // Attempt 1 → wrong code
  // Attempt 2 → wrong code
  // Attempt 3 → wrong code
  // Attempt 4 → success
  //
  // There is no retry limit.
  // ============================================================

  const previousToken = activePairings[cleanPhone];

  if (previousToken) {
    console.log(
      `🔄 Replacing previous pairing attempt for +${cleanPhone}: ${previousToken}`
    );

    cleanupSession(previousToken);
  }

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
      DisconnectReason,
      Browsers
    } = require('baileys');

    const P = require('pino');

    const { state, saveCreds } = await useMultiFileAuthState(tmpDir);
    const { version } = await fetchLatestBaileysVersion();

    // ============================================================
    // ORIGINAL PAIRING ALGORITHM
    // DO NOT CHANGE
    // ============================================================

    const sock = makeWASocket({
      version,
      logger: P({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ["Ubuntu", "Chrome", "20.0.04"],
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(
          state.keys,
          P({ level: 'silent' })
        ),
      },
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 10000,
      retryRequestDelayMs: 250,
      maxMsgRetryCount: 5,
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
      active: true,
    };

    // This token becomes the ONLY active pairing attempt
    // for this phone.
    activePairings[cleanPhone] = token;

    // ============================================================
    // CREDENTIALS UPDATE
    // ============================================================

    sock.ev.on('creds.update', async () => {
      // Ignore events from an old/replaced pairing attempt.
      if (!isActivePairing(token, cleanPhone)) return;

      await saveCreds();

      // Backup: try generating session ID on every creds update
      // in case connection 'open' event was missed
      const sess = sessions[token];

      if (sess && sess.status === 'paired' && !sess.sessionId) {
        try {
          const credsFile = path.join(tmpDir, 'creds.json');

          if (fs.existsSync(credsFile)) {
            const sessionId = generateSessionId(tmpDir);

            // Check AGAIN because this operation is async and
            // another pairing attempt could have replaced this one.
            if (!isActivePairing(token, cleanPhone)) return;

            sess.sessionId = sessionId;
            sess.status = 'ready';

            // Pairing is finished, so remove the retry lock.
            if (activePairings[cleanPhone] === token) {
              delete activePairings[cleanPhone];
            }

            console.log(
              `🔑 Session ID generated via creds.update for +${cleanPhone}`
            );
          }
        } catch (e) {}
      }
    });

    // ============================================================
    // CONNECTION UPDATE
    // ============================================================

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, isNewLogin } = update;

      const sess = sessions[token];

      // If this is an old/replaced socket, completely ignore it.
      if (!sess || !isActivePairing(token, cleanPhone)) return;

      console.log(
        `🔄 Connection update for +${cleanPhone}: connection=${connection} isNewLogin=${isNewLogin}`
      );

      if (connection === 'open') {
        // Check one more time before changing state.
        if (!isActivePairing(token, cleanPhone)) return;

        console.log(`✅ WhatsApp connected for +${cleanPhone}`);

        sess.status = 'paired';

        try {
          await saveCreds();

          // The pairing attempt could have been replaced while
          // saveCreds() was running.
          if (!isActivePairing(token, cleanPhone)) return;

          console.log(`💾 Creds saved for +${cleanPhone}`);

          // Try immediately, then retry a few times if creds.json
          // is not ready yet.
          let attempts = 0;

          const tryGenerate = async () => {
            // Ignore this timer if the pairing was replaced.
            if (!isActivePairing(token, cleanPhone)) return;

            attempts++;

            const credsFile = path.join(tmpDir, 'creds.json');

            if (fs.existsSync(credsFile)) {
              const sessionId = generateSessionId(tmpDir);

              // Make sure this is STILL the active attempt.
              if (!isActivePairing(token, cleanPhone)) return;

              sess.sessionId = sessionId;
              sess.status = 'ready';

              // Pairing completed successfully.
              if (activePairings[cleanPhone] === token) {
                delete activePairings[cleanPhone];
              }

              console.log(
                `🔑 Session ID ready for +${cleanPhone} (attempt ${attempts})`
              );

            } else if (attempts < 10) {

              console.log(
                `⏳ creds.json not ready yet, retrying... (${attempts}/10)`
              );

              setTimeout(tryGenerate, 1000);

            } else {

              console.error(
                `❌ creds.json never appeared for +${cleanPhone}`
              );

              if (isActivePairing(token, cleanPhone)) {
                sess.status = 'error';

                if (activePairings[cleanPhone] === token) {
                  delete activePairings[cleanPhone];
                }
              }
            }
          };

          setTimeout(tryGenerate, 500);

        } catch (e) {

          console.error(
            `❌ Session ID generation failed:`,
            e.message
          );

          if (isActivePairing(token, cleanPhone)) {
            sess.status = 'error';

            if (activePairings[cleanPhone] === token) {
              delete activePairings[cleanPhone];
            }
          }
        }
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;

        console.log(
          `🔌 Connection closed for +${cleanPhone}, code: ${code}`
        );

        // Only modify this session if it is still the active attempt.
        if (!isActivePairing(token, cleanPhone)) return;

        // Only mark error if we haven't already gotten the session
        if (sess.status !== 'ready') {

          // Reconnect logic — don't give up on first close
          if (code !== 401 && code !== 403) {

            console.log(
              `🔄 Reconnecting... (not logged out)`
            );

          } else {

            sess.status = 'error';

            if (activePairings[cleanPhone] === token) {
              delete activePairings[cleanPhone];
            }
          }
        }

        try {
          sock.end();
        } catch (e) {}
      }
    });

    // ============================================================
    // ORIGINAL PAIRING CODE REQUEST FLOW
    // ============================================================

    console.log(`⏳ Waiting for socket to be ready...`);

    await new Promise(resolve => setTimeout(resolve, 3000));

    // If another request replaced this attempt during the
    // 3-second wait, DO NOT request a code from the old socket.
    if (!isActivePairing(token, cleanPhone)) {
      console.log(
        `⚠️ Pairing attempt ${token} was replaced before code request.`
      );

      try {
        sock.end();
      } catch (e) {}

      return res.status(409).json({
        success: false,
        error: 'This pairing request was replaced by a newer request.'
      });
    }

    console.log(
      `📲 Requesting pairing code for +${cleanPhone}...`
    );

    let pairingCode;

    try {

      // ========================================================
      // THIS IS YOUR ORIGINAL ALGORITHM
      // ========================================================

      pairingCode = await sock.requestPairingCode(cleanPhone);

    } catch (e) {

      console.error(
        `❌ Baileys requestPairingCode failed:`,
        e.message
      );

      throw new Error(
        'WhatsApp rejected the pairing request. Try again later.'
      );
    }

    if (!pairingCode) {
      throw new Error(
        'No pairing code returned from WhatsApp'
      );
    }

    // If another request replaced this one while
    // requestPairingCode() was running, do not return
    // the old code as the current code.
    if (!isActivePairing(token, cleanPhone)) {

      console.log(
        `⚠️ Pairing attempt ${token} was replaced while generating the code.`
      );

      try {
        sock.end();
      } catch (e) {}

      return res.status(409).json({
        success: false,
        error: 'This pairing request was replaced by a newer request.'
      });
    }

    const formatted =
      pairingCode?.match(/.{1,4}/g)?.join('-') || pairingCode;

    console.log(
      `✅ Pairing code for +${cleanPhone}: ${formatted} [token: ${token}]`
    );

    return res.json({
      success: true,
      code: formatted,
      token
    });

  } catch (err) {

    console.error(
      `❌ Pairing code error for +${cleanPhone}:`,
      err.message
    );

    console.error('Full error:', err);

    // Cleanup ONLY this session.
    // Never delete a newer pairing attempt for the same phone.
    const currentSession = sessions[token];

    if (currentSession) {
      currentSession.active = false;
    }

    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, {
          recursive: true,
          force: true
        });
      }
    } catch (e) {}

    try {
      const current = sessions[token];

      if (current?.sock) {
        current.sock.end();
      }
    } catch (e) {}

    if (activePairings[cleanPhone] === token) {
      delete activePairings[cleanPhone];
    }

    delete sessions[token];

    return res.status(500).json({
      success: false,
      error:
        'Failed to generate pairing code. Make sure your number is registered on WhatsApp.'
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
    return res.status(404).json({
      success: false,
      error: 'Session not found or expired.'
    });
  }

  if (sess.status === 'ready' && sess.sessionId) {

    // Session is ready — return the ID and cleanup
    const sessionId = sess.sessionId;

    // Pairing has already completed.
    if (activePairings[sess.phone] === token) {
      delete activePairings[sess.phone];
    }

    // Schedule cleanup after 5 minutes
    // (give user time to copy it)
    setTimeout(() => {
      cleanupSession(token);

      console.log(
        `🧹 Cleaned up session for token: ${token}`
      );
    }, 5 * 60 * 1000);

    return res.json({
      success: true,
      status: 'ready',
      sessionId
    });
  }

  if (sess.status === 'error') {
    return res.json({
      success: false,
      status: 'error',
      error: 'Failed to generate session. Try again.'
    });
  }

  // Still waiting for user to enter code in WhatsApp
  return res.json({
    success: true,
    status: sess.status
  });
});

// ===== HEALTH =====
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    activeSessions: Object.keys(sessions).length,
    activePairings: Object.keys(activePairings).length,
    uptime: Math.floor(process.uptime())
  });
});

// ===== GENERATE SESSION ID =====
// Reads the saved credentials from the temp session folder,
// encodes them as a base64 string prefixed with "VORTE_"
function generateSessionId(tmpDir) {
  const credsFile = path.join(tmpDir, 'creds.json');

  if (!fs.existsSync(credsFile)) {
    throw new Error(
      'creds.json not found — session not saved yet'
    );
  }

  const creds = fs.readFileSync(
    credsFile,
    'utf8'
  );

  const encoded = Buffer
    .from(creds)
    .toString('base64');

  return `VORTE_PRO~${encoded}`;
}

// ===== START SERVER =====
app.listen(PORT, '0.0.0.0', () => {
  console.log(
    `\n🔑 VORTE PRO Session Server running on port ${PORT}`
  );

  console.log(
    `🌐 Pairing website: http://localhost:${PORT}/`
  );

  console.log(
    `📦 Users visit the site to get their SESSION_ID\n`
  );
});

process.on(
  'uncaughtException',
  err => console.error('Uncaught:', err.message)
);

process.on(
  'unhandledRejection',
  reason => console.error('Unhandled rejection:', reason)
);
