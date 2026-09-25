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

// Suppress annoying libsignal Bad MAC errors during initial sync
const originalConsoleError = console.error;
console.error = function() {
  const arg1 = arguments[0];
  const arg2 = arguments.length > 1 ? arguments[1] : '';
  if (typeof arg1 === 'string' && (arg1.includes('Bad MAC') || arg1.includes('Failed to decrypt'))) return;
  if (typeof arg2 === 'string' && (arg2.includes('Bad MAC') || arg2.includes('Failed to decrypt'))) return;
  originalConsoleError.apply(console, arguments);
};

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

          const credsBuffer = Buffer.from(b64, 'base64');
          fs.writeFileSync(credsPath, credsBuffer);
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
      const devicePhone = sock.user.id.split(':')[0];
      console.log(`✅ Connected successfully as ${devicePhone}`);
      pairingState.latestQR = null;

      // Send startup confirmation to the bot's own number
      const jid = `${devicePhone}@s.whatsapp.net`;
      sock.sendMessage(jid, { 
        text: `🤖 *VORTE-PRO SYSTEM ONLINE*\n\n✅ Successfully securely connected.\n📡 Environment: ${process.env.SESSION_ID ? 'Render/Hosted (.env)' : 'Local Storage'}\n⚡ The bot is now actively monitoring events.`
      }).catch(err => console.error("Failed to send startup message:", err));
    }
  });

  return sock;
}

module.exports = { startBot };
