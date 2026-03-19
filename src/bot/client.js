// src/bot/client.js
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const config = require("../config/config");
const helpers = require("../utils/helpers");

async function startBot(pairingState, handlers = {}) {
  console.log('🤖 Initializing WhatsApp Bot Client...');

  helpers.ensureDir(config.sessionFolder);

  let shouldPrintQR = !process.env.SESSION_ID;

  if (process.env.SESSION_ID) {
    const match = process.env.SESSION_ID.match(/VORTE_PRO~([A-Za-z0-9+/=]+)/);
    if (match) {
      try {
        const credsPath = path.join(config.sessionFolder, 'creds.json');
        const hashPath = path.join(config.sessionFolder, '.session_hash');
        
        let lastSessionId = '';
        if (fs.existsSync(hashPath)) {
          lastSessionId = fs.readFileSync(hashPath, 'utf8');
        }

        const fullSessionId = match[0];
        const b64 = match[1];

        if (fullSessionId !== lastSessionId) {
          console.log('📦 New SESSION_ID detected in environment. Loading credentials...');
          
          // Clear out old session files
          if (fs.existsSync(config.sessionFolder)) {
            const files = fs.readdirSync(config.sessionFolder);
            for (const file of files) {
               try { fs.unlinkSync(path.join(config.sessionFolder, file)); } catch(e) {}
            }
          } else {
            helpers.ensureDir(config.sessionFolder);
          }

          try {
            const zlib = require('zlib');
            const inflated = zlib.inflateSync(Buffer.from(b64, 'base64')).toString('utf8');
            const sessionData = JSON.parse(inflated);
            for (const [filename, content] of Object.entries(sessionData)) {
              fs.writeFileSync(path.join(config.sessionFolder, filename), content);
            }
          } catch(e) {
            // Fallback for older VORTE-PRO~ session IDs that were just the base64 creds.json
            console.log('⚠️ Session ID is not compressed folder, falling back to legacy format...');
            const credsBuffer = Buffer.from(b64, 'base64');
            fs.writeFileSync(credsPath, credsBuffer);
          }

          fs.writeFileSync(hashPath, fullSessionId);
          console.log('✅ Session loaded successfully from SESSION_ID.');
        }
      } catch (err) {
        console.error('❌ Failed to load SESSION_ID from environment:', err.message);
      }
    } else {
      console.log('⚠️ SESSION_ID found in environment but does not contain a valid VORTE_PRO~ segment.');
      shouldPrintQR = true;
    }
  }

  const { state, saveCreds } = await useMultiFileAuthState(config.sessionFolder);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    logger: pino({ level: "silent" }),
    browser: ["VORTE-PRO", "Chrome", "1.0.0"],
    printQRInTerminal: shouldPrintQR,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino().child({ level: "silent" })),
    },
    version,
  });

  sock.ev.on("creds.update", saveCreds);

  // Update pairing state reference
  pairingState.sock = sock;

  // Immediately register handlers to avoid missing initial events
  if (handlers.onMessage) {
    sock.ev.on("messages.upsert", (upsert) => {
      handlers.onMessage(sock, upsert);
    });
  }
  if (handlers.onGroupUpdate) {
    sock.ev.on("group-participants.update", (update) => handlers.onGroupUpdate(sock, update));
  }

  // Connection handling
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      pairingState.latestQR = qr;
      console.log(`📷 QR updated - visit /qr to scan`);
    }

    if (connection === "close") {
      pairingState.sock = null;
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      console.log(`🔌 Connection closed (Code: ${code}). Reconnecting: ${shouldReconnect}`);

      if (shouldReconnect) {
        setTimeout(() => startBot(pairingState, handlers), 5000);
      }
    }

    if (connection === "open") {
      console.log(`✅ Connected successfully as ${sock.user.id.split(':')[0]}`);
      pairingState.latestQR = null;
    }
  });

  return sock;
}

module.exports = { startBot };
