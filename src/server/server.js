// src/server/server.js
const express = require('express');
const path = require('path');
const config = require('../config/config');

const app = express();

// Global state for pairing (will be updated by the bot)
const pairingState = {
  sock: null,
  pairingInProgress: {},
  latestQR: null
};

function setupServer() {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve pairing.html
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../pairing.html'));
  });

  // QR Route
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

  // Pairing API
  app.post('/api/pair', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, error: 'Phone number is required.' });
    
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 7 || cleanPhone.length > 15)
      return res.status(400).json({ success: false, error: 'Invalid phone number.' });

    if (!pairingState.sock)
      return res.status(503).json({ success: false, error: 'Bot is not connected yet. Try again in a moment.' });

    if (pairingState.pairingInProgress[cleanPhone])
      return res.status(429).json({ success: false, error: 'A pairing code was recently generated for this number. Please wait 60 seconds.' });

    try {
      pairingState.pairingInProgress[cleanPhone] = true;
      setTimeout(() => { delete pairingState.pairingInProgress[cleanPhone]; }, 60000);
      
      const code = await pairingState.sock.requestPairingCode(cleanPhone);
      const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
      
      console.log(`📲 Pairing code issued for +${cleanPhone}: ${formatted}`);
      return res.json({ success: true, code: formatted });
    } catch (err) {
      delete pairingState.pairingInProgress[cleanPhone];
      console.error('❌ Pairing code error:', err.message);
      return res.status(500).json({ success: false, error: 'Failed to generate pairing code.' });
    }
  });

  // Status API
  app.get('/api/status', (req, res) => {
    res.json({
      connected: !!pairingState.sock,
      botName: config.botName,
      uptime: Math.floor(process.uptime())
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
    console.log(`🌐 Web server running on port ${config.port}`);
  });

  return { app, server, pairingState };
}

module.exports = setupServer;
