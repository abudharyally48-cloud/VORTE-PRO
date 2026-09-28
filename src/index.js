// src/index.js
const fs = require('fs');
const path = require('path');
const config = require('./config/config');
const helpers = require('./utils/helpers');
const setupServer = require('./server/server');
const { startBot } = require('./bot/client');
const { handleMessage } = require('./bot/events/messageHandler');
const { handleGroupUpdate } = require('./bot/events/groupHandler');
const { handleMessageUpdate } = require('./bot/events/editHandler');
const { handleCall } = require('./bot/events/callHandler');

async function main() {
  console.log('🚀 Starting VORTE PRO WhatsApp Bot (Modular Implementation)...');

  // 1. Ensure storage exists
  helpers.ensureDir(path.dirname(config.settingsPath));
  // One-time migration: older versions stored settings in groupSettings.json.
  const legacySettingsPath = path.join(path.dirname(config.settingsPath), 'groupSettings.json');
  if (!fs.existsSync(config.settingsPath) && fs.existsSync(legacySettingsPath)) {
    fs.copyFileSync(legacySettingsPath, config.settingsPath); // copy, not move: keeps a backup
    console.log('📦 Migrated legacy groupSettings.json -> settings.json');
  }
  if (!fs.existsSync(config.settingsPath)) {
    fs.writeFileSync(config.settingsPath, JSON.stringify({}, null, 2));
  }

  // 2. Settings management functions
  const getSettings = () => JSON.parse(fs.readFileSync(config.settingsPath));
  const saveSettings = (data) => fs.writeFileSync(config.settingsPath, JSON.stringify(data, null, 2));

  // 3. Setup Web Server
  const { pairingState } = setupServer();

  // 4. Start WhatsApp Bot with handlers (unless Render is hosting as a generator purely)
  if (process.env.SESSION_GENERATOR_ONLY === 'true') {
    console.log('🛑 SESSION_GENERATOR_ONLY is true. The main bot logic will NOT be started.');
    console.log('✅ Ready to serve standalone pairing requests on the web server.');
  } else {
    const sock = await startBot(pairingState, {
      onMessage: (sock, upsert) => handleMessage(sock, upsert, getSettings, saveSettings),
      onGroupUpdate: (sock, update) => handleGroupUpdate(sock, update, getSettings),
      onMessageUpdate: (sock, updates) => handleMessageUpdate(sock, updates, getSettings),
      onCall: (sock, calls) => handleCall(sock, calls, getSettings)
    });
  
    console.log('✅ Bot initialization complete. Monitoring events...');
  }
}

main().catch(err => {
  console.error('💥 Critical error during startup:', err);
  process.exit(1);
});
