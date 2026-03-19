// src/server/server.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers
} = require("@whiskeysockets/baileys");
const config = require('../config/config');

const app = express();

// Global state for local bot (still used for /qr locally)
const pairingState = {
  sock: null,
  latestQR: null
};

// Map to track temporary session generator requests
const sessionMap = new Map();

function setupServer() {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve pairing.html
  app.get('/', (req, res) => {
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
  app.post('/api/pair', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, error: 'Phone number is required.' });
    
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 7 || cleanPhone.length > 15) {
      return res.status(400).json({ success: false, error: 'Invalid phone number.' });
    }

    const token = cleanPhone;
    
    // Check if in-progress
    if (sessionMap.has(token) && sessionMap.get(token).status === 'waiting') {
      return res.status(429).json({ success: false, error: 'A pairing is already in progress for this number. Please wait.' });
    }

    try {
      sessionMap.set(token, { status: 'waiting', sessionId: null });
      
      const tempSessionFolder = path.join(process.cwd(), 'storage', 'temp_sessions', token);
      if (fs.existsSync(tempSessionFolder)) {
        fs.rmSync(tempSessionFolder, { recursive: true, force: true });
      }
      fs.mkdirSync(tempSessionFolder, { recursive: true });

      const { state, saveCreds } = await useMultiFileAuthState(tempSessionFolder);
      const { version } = await fetchLatestBaileysVersion();

      let codeRequested = false;
      let isFinished = false;

      const startSock = () => {
        const sock = makeWASocket({
          logger: pino({ level: 'silent' }),
          browser: Browsers.ubuntu('Chrome'),
          auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino().child({ level: "silent" })),
          },
          version,
        });

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", async (update) => {
          if (isFinished) return;
          const { connection, lastDisconnect } = update;
          
          if (connection === 'open') {
            console.log(`✅ Session connected for +${token}. Extracting Session ID...`);
            try {
              // Wait slight delay to ensure creds.json is fully written
              setTimeout(async () => {
                const credsPath = path.join(tempSessionFolder, 'creds.json');
                if (fs.existsSync(credsPath)) {
                  // Bundle ALL session files into a single object
                  const sessionData = {};
                  const files = fs.readdirSync(tempSessionFolder);
                  for (const file of files) {
                     if (file !== 'creds.json' && fs.statSync(path.join(tempSessionFolder, file)).isDirectory()) continue;
                     sessionData[file] = fs.readFileSync(path.join(tempSessionFolder, file), 'utf8');
                  }
                  
                  const stringified = JSON.stringify(sessionData);
                  const deflated = zlib.deflateSync(stringified).toString('base64');
                  const sessionId = 'VORTE_PRO~' + deflated;
                  
                  sessionMap.set(token, { status: 'ready', sessionId });
                  console.log(`🎉 Session IDs generated for +${token}`);
                  
                  try {
                    // Send to user's own number
                    let jid = sock.user?.id;
                    if (jid) {
                       jid = jid.split(':')[0] + '@s.whatsapp.net';
                       await sock.sendMessage(jid, { 
                           text: `*✅ VORTE-PRO SESSION GENERATED!*\n\n> ⚠️ *Important:* Never share this ID with anyone. It acts as your login credential.\n\nCopy the ID below:` 
                       });
                       await sock.sendMessage(jid, { 
                           text: sessionId 
                       });
                    }
                  } catch(sendErr) {
                    console.error('Failed to send session to self:', sendErr);
                  }

                  isFinished = true;
                  
                  // Cleanup connection and temporary files
                  try { await sock.logout(); } catch(e) {}
                  try { sock.ws.close(); } catch(e) {}
                  
                  setTimeout(() => {
                    if (fs.existsSync(tempSessionFolder)) {
                       fs.rmSync(tempSessionFolder, { recursive: true, force: true });
                    }
                  }, 2500);
                } else {
                  sessionMap.set(token, { status: 'error', error: 'Credentials file not found.' });
                }
              }, 3000);
            } catch(e) {
              console.error('Error in session success handler:', e);
              sessionMap.set(token, { status: 'error', error: 'Failed to extract session' });
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
              sessionMap.delete(token);
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
      sessionMap.delete(token);
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
      activePairings: sessionMap.size
    });
  });

  // Health and Keep-alive
  app.get('/health', (req, res) => {
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
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
