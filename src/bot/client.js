// src/bot/client.js
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const config = require("../config/config");
const helpers = require("../utils/helpers");

async function startBot(pairingState, handlers = {}) {
  console.log('🤖 Initializing WhatsApp Bot Client...');

  helpers.ensureDir(config.sessionFolder);

  const { state, saveCreds } = await useMultiFileAuthState(config.sessionFolder);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    logger: pino({ level: "silent" }),
    browser: ["VORTE-PRO", "Chrome", "1.0.0"],
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
