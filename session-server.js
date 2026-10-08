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
if (!fs.existsSync(TMP_SESSIONS_DIR)) {
  fs.mkdirSync(TMP_SESSIONS_DIR, { recursive: true });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the pairing website
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'pairing.html'));
});

// ===== In-memory session store =====
// Maps sessionToken -> { sock, state, saveCreds, phone, status, sessionId }
const sessions = {};

// Maps phone number -> active pairing session token.
// A phone can request unlimited replacement codes,
// but only ONE active pairing attempt exists at a time.
const pairingByPhone = {};

// ===== SESSION CLEANUP HELPER =====
function cleanupSession(token, removeFromPhoneIndex = true) {
  const sess = sessions[token];
  if (!sess) return;

  console.log(`🧹 Cleaning up session: ${token}`);

  try {
    sess.sock?.end();
  } catch (e) {}

  try {
    if (sess.tmpDir && fs.existsSync(sess.tmpDir)) {
      fs.rmSync(sess.tmpDir, {
        recursive: true,
        force: true
      });
    }
  } catch (e) {}

  if (
    removeFromPhoneIndex &&
    sess.phone &&
    pairingByPhone[sess.phone] === token
  ) {
    delete pairingByPhone[sess.phone];
  }

  delete sessions[token];
}

// ===== CLEANUP STALE SESSIONS AFTER 10 MINUTES =====
setInterval(() => {
  const now = Date.now();

  for (const [token, sess] of Object.entries(sessions)) {
    if (
      sess.createdAt &&
      (now - sess.createdAt) > 10 * 60 * 1000
    ) {
      cleanupSession(token);
    }
  }
}, 60 * 1000);

// ===== STEP 1: REQUEST PAIRING CODE =====
// User submits their phone number.
// We create a temporary Baileys socket and request a pairing code.
//
// IMPORTANT:
// Users may request a new code as many times as needed.
// When they request another code, the previous pairing attempt
// for that phone number is invalidated first.
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

  // ===== REPLACE EXISTING PAIRING ATTEMPT =====
  // If this phone already has an active pairing attempt,
  // destroy that attempt before creating the new one.
  //
  // This means:
  // Code #1 -> entered incorrectly
  // Code #2 -> new request
  // Code #1 session is destroyed
  // Code #2 becomes the only active pairing attempt.
  const existingToken = pairingByPhone[cleanPhone];

  if (existingToken) {
    console.log(
      `🔄 Replacing existing pairing attempt for +${cleanPhone}`
    );

    cleanupSession(existingToken);
  }

  // Generate a unique token for this pairing session
  const token = uuidv4();
  const tmpDir = path.join(
    TMP_SESSIONS_DIR,
    token
  );

  try {
    fs.mkdirSync(tmpDir, { recursive: true });

    const {
      default: makeWASocket,
      useMultiFileAuthState,
      fetchLatestBaileysVersion,
      makeCacheableSignalKeyStore
    } = require('baileys');

    const P = require('pino');

    const { state, saveCreds } =
      await useMultiFileAuthState(tmpDir);

    const { version } =
      await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      logger: P({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['Ubuntu', 'Chrome', '20.0.04'],

      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(
          state.keys,
          P({ level: 'silent' })
        )
      },

      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 10000,
      retryRequestDelayMs: 250,
      maxMsgRetryCount: 5
    });

    // ===== STORE SESSION =====
    sessions[token] = {
      sock,
      state,
      saveCreds,
      phone: cleanPhone,
      tmpDir,
      status: 'waiting_pairing',
      sessionId: null,
      createdAt: Date.now()
    };

    // Mark this as the ONLY active pairing attempt
    // for this phone number.
    pairingByPhone[cleanPhone] = token;

    // ===== CREDS UPDATE =====
    sock.ev.on('creds.update', async () => {
      try {
        await saveCreds();
      } catch (e) {
        console.error(
          `❌ Failed to save creds for +${cleanPhone}:`,
          e.message
        );
        return;
      }

      // Backup: try generating session ID on every creds update
      // in case connection 'open' event was missed.
      const sess = sessions[token];

      if (
        sess &&
        sess.status === 'paired' &&
        !sess.sessionId
      ) {
        try {
          const credsFile =
            path.join(tmpDir, 'creds.json');

          if (fs.existsSync(credsFile)) {
            const sessionId =
              generateSessionId(tmpDir);

            sess.sessionId = sessionId;
            sess.status = 'ready';

            // Pairing is now complete.
            if (pairingByPhone[cleanPhone] === token) {
              delete pairingByPhone[cleanPhone];
            }

            console.log(
              `🔑 Session ID generated via creds.update for +${cleanPhone}`
            );
          }
        } catch (e) {}
      }
    });

    // ===== CONNECTION UPDATE =====
    sock.ev.on('connection.update', async (update) => {
      const {
        connection,
        lastDisconnect,
        isNewLogin
      } = update;

      const sess = sessions[token];

      // This session may have been replaced by a newer
      // pairing request.
      if (!sess) return;

      console.log(
        `🔄 Connection update for +${cleanPhone}: ` +
        `connection=${connection} isNewLogin=${isNewLogin}`
      );

      // ===== CONNECTED =====
      if (connection === 'open') {
        console.log(
          `✅ WhatsApp connected for +${cleanPhone}`
        );

        sess.status = 'paired';

        try {
          await saveCreds();

          console.log(
            `💾 Creds saved for +${cleanPhone}`
          );

          // Try immediately, then retry a few times
          // if creds.json is not ready yet.
          let attempts = 0;

          const tryGenerate = async () => {
            // Session might have been replaced while
            // this delayed function was waiting.
            const currentSess = sessions[token];

            if (!currentSess) return;

            attempts++;

            const credsFile =
              path.join(tmpDir, 'creds.json');

            if (fs.existsSync(credsFile)) {
              const sessionId =
                generateSessionId(tmpDir);

              currentSess.sessionId = sessionId;
              currentSess.status = 'ready';

              // Pairing successfully completed.
              if (pairingByPhone[cleanPhone] === token) {
                delete pairingByPhone[cleanPhone];
              }

              console.log(
                `🔑 Session ID ready for +${cleanPhone} ` +
                `(attempt ${attempts})`
              );

            } else if (attempts < 10) {
              console.log(
                `⏳ creds.json not ready yet, ` +
                `retrying... (${attempts}/10)`
              );

              setTimeout(tryGenerate, 1000);

            } else {
              console.error(
                `❌ creds.json never appeared for +${cleanPhone}`
              );

              currentSess.status = 'error';

              if (pairingByPhone[cleanPhone] === token) {
                delete pairingByPhone[cleanPhone];
              }
            }
          };

          setTimeout(tryGenerate, 500);

        } catch (e) {
          console.error(
            `❌ Session ID generation failed:`,
            e.message
          );

          sess.status = 'error';

          if (pairingByPhone[cleanPhone] === token) {
            delete pairingByPhone[cleanPhone];
          }
        }
      }

      // ===== CONNECTION CLOSED =====
      if (connection === 'close') {
        const code =
          lastDisconnect?.error?.output?.statusCode;

        console.log(
          `🔌 Connection closed for +${cleanPhone}, code: ${code}`
        );

        // Only mark error if we haven't already gotten
        // the session ID.
        if (sess.status !== 'ready') {
          if (code !== 401 && code !== 403) {
            console.log(
              `🔄 Reconnecting... (not logged out)`
            );
          } else {
            sess.status = 'error';

            if (pairingByPhone[cleanPhone] === token) {
              delete pairingByPhone[cleanPhone];
            }
          }
        }

        try {
          sock.end();
        } catch (e) {}
      }
    });

    // ===== WAIT FOR SOCKET TO BE READY =====
    console.log(
      `⏳ Waiting for socket to be ready...`
    );

    await new Promise(resolve =>
      setTimeout(resolve, 3000)
    );

    // The session may have been replaced during
    // the 3-second wait.
    if (
      !sessions[token] ||
      pairingByPhone[cleanPhone] !== token
    ) {
      return res.status(409).json({
        success: false,
        error: 'Pairing request was replaced by a newer request.'
      });
    }

    // ===== REQUEST PAIRING CODE =====
    console.log(
      `📲 Requesting pairing code for +${cleanPhone}...`
    );

    let pairingCode;

    try {
      pairingCode =
        await sock.requestPairingCode(cleanPhone);
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

    // Make sure this session is still the current
    // pairing attempt before returning its code.
    if (
      !sessions[token] ||
      pairingByPhone[cleanPhone] !== token
    ) {
      try {
        sock.end();
      } catch (e) {}

      try {
        if (fs.existsSync(tmpDir)) {
          fs.rmSync(tmpDir, {
            recursive: true,
            force: true
          });
        }
      } catch (e) {}

      return res.status(409).json({
        success: false,
        error: 'Pairing request was replaced by a newer request.'
      });
    }

    const formatted =
      pairingCode
        ?.match(/.{1,4}/g)
        ?.join('-') || pairingCode;

    console.log(
      `✅ Pairing code for +${cleanPhone}: ` +
      `${formatted} [token: ${token}]`
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

    // Only clean this session if it is still
    // the active session for this phone.
    if (pairingByPhone[cleanPhone] === token) {
      delete pairingByPhone[cleanPhone];
    }

    try {
      const errorTmpDir =
        path.join(
          TMP_SESSIONS_DIR,
          token
        );

      if (fs.existsSync(errorTmpDir)) {
        fs.rmSync(errorTmpDir, {
          recursive: true,
          force: true
        });
      }
    } catch (e) {}

    try {
      sessions[token]?.sock?.end();
    } catch (e) {}

    delete sessions[token];

    return res.status(500).json({
      success: false,
      error:
        'Failed to generate pairing code. ' +
        'Make sure your number is registered on WhatsApp.'
    });
  }
});

// ===== STEP 2: POLL FOR SESSION ID =====
// Website polls this after the user enters the pairing code
// in WhatsApp.
//
// Once WhatsApp connects:
// -> read saved creds
// -> encode as base64
// -> return SESSION_ID
app.get('/api/session-status/:token', (req, res) => {
  const { token } = req.params;
  const sess = sessions[token];

  if (!sess) {
    return res.status(404).json({
      success: false,
      error: 'Session not found or expired.'
    });
  }

  // ===== SESSION READY =====
  if (sess.status === 'ready' && sess.sessionId) {
    const sessionId = sess.sessionId;

    // Pairing is complete, so remove the active
    // pairing lock for this phone.
    if (pairingByPhone[sess.phone] === token) {
      delete pairingByPhone[sess.phone];
    }

    // Schedule cleanup after 5 minutes.
    // This gives the user enough time to copy
    // their SESSION_ID.
    //
    // IMPORTANT:
    // This cleanup only removes the temporary server-side
    // session. It does NOT invalidate the SESSION_ID.
    setTimeout(() => {
      cleanupSession(token, false);

      console.log(
        `🧹 Cleaned up completed session for token: ${token}`
      );
    }, 5 * 60 * 1000);

    return res.json({
      success: true,
      status: 'ready',
      sessionId
    });
  }

  // ===== SESSION ERROR =====
  if (sess.status === 'error') {
    return res.json({
      success: false,
      status: 'error',
      error: 'Failed to generate session. Try again.'
    });
  }

  // Still waiting for the user to enter
  // the pairing code in WhatsApp.
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
    activePairings: Object.keys(pairingByPhone).length,
    uptime: Math.floor(process.uptime())
  });
});

// ===== GENERATE SESSION ID =====
// Reads the saved credentials from the temporary
// session folder, encodes them as base64 and prefixes
// them with "VORTE_PRO~".
function generateSessionId(tmpDir) {
  const credsFile =
    path.join(tmpDir, 'creds.json');

  if (!fs.existsSync(credsFile)) {
    throw new Error(
      'creds.json not found — session not saved yet'
    );
  }

  const creds =
    fs.readFileSync(credsFile, 'utf8');

  const encoded =
    Buffer.from(creds).toString('base64');

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

// ===== ERROR HANDLERS =====
process.on('uncaughtException', err =>
  console.error('Uncaught:', err.message)
);

process.on('unhandledRejection', reason =>
  console.error('Unhandled rejection:', reason)
);
