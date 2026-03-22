// ===== VORTE PRO WhatsApp Bot - Complete Single File =====
console.log('🚀 Starting VORTE PRO WhatsApp Bot...');

// ===== 1. EXPRESS SERVER SETUP =====
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
const path = require('path');
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'pairing.html'));
});
  grep -n "SESSION_FOLDER\|mkdirSync\|session 
// ===== GROUP SETTINGS & WARNINGS =====
const groupSettings = {};
const groupWarnings = {};

// ===== 2. ENVIRONMENT & API SETUP =====
require('dotenv').config();

// ===== OpenAI Setup (Modern SDK) =====
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function generateImage(prompt, style = "") {
  try {
    const finalPrompt = style ? `${prompt}, in ${style} style` : prompt;

    const response = await openai.images.generate({
      prompt: finalPrompt,
      n: 1,
      size: "1024x1024"
    });

    const imageUrl = response.data[0].url;
    return imageUrl;

  } catch (err) {
    console.error("❌ Image generation error:", err);
    return null;
  }
}

// --- OMDb Setup ---
const axios = require('axios');

// --- YouTube API Setup ---
const { google } = require('googleapis');
const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
});

// ===== Global sock reference for pairing endpoint =====
let globalSock = null;
let pairingInProgress = {};

// ===== PAIRING CODE API =====
app.post('/api/pair', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ success: false, error: 'Phone number is required.' });
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.length < 7 || cleanPhone.length > 15)
    return res.status(400).json({ success: false, error: 'Invalid phone number.' });
  if (!globalSock)
    return res.status(503).json({ success: false, error: 'Bot is not connected yet. Try again in a moment.' });
  if (pairingInProgress[cleanPhone])
    return res.status(429).json({ success: false, error: 'A pairing code was recently generated for this number. Please wait 60 seconds.' });
  try {
    pairingInProgress[cleanPhone] = true;
    setTimeout(() => { delete pairingInProgress[cleanPhone]; }, 60000);
    const code = await globalSock.requestPairingCode(cleanPhone);
    const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
    console.log(`📲 Pairing code issued for +${cleanPhone}: ${formatted}`);
    return res.json({ success: true, code: formatted });
  } catch (err) {
    delete pairingInProgress[cleanPhone];
    console.error('❌ Pairing code error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to generate pairing code. Make sure the number is registered on WhatsApp.' });
  }
});

// ===== BOT STATUS API =====
app.get('/api/status', (req, res) => {
  res.json({
    connected: !!globalSock,
    waConnected: botStarted,
    botName: process.env.BOT_NAME || 'VORTE PRO',
    uptime: Math.floor(process.uptime())
  });
});

// ===== Health check endpoint for Render =====
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'whatsapp-bot',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Keep-alive endpoint
app.get('/keep-alive', (req, res) => {
  res.status(200).json({ 
    alive: true, 
    time: new Date().toISOString(),
    bot: 'VORTE PRO'
  });
});

// Start Express server
let server;
try {
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web server running on port ${PORT}`);
    console.log('📦 Node version:', process.version);
    console.log('📁 Current directory:', __dirname);
  });
} catch (error) {
  console.error('❌ Failed to start server:', error.message);
  const altPort = parseInt(PORT) + 1;
  server = app.listen(altPort, '0.0.0.0', () => {
    console.log(`🌐 Web server running on alternative port ${altPort}`);
  });
}

// Auto-ping to prevent Render shutdown
setInterval(() => {
  const http = require('http');
  const options = {
    hostname: 'localhost',
    port: PORT,
    path: '/health',
    method: 'GET',
    timeout: 5000
  };

  const req = http.request(options, () => {});
  req.on('error', () => {});
  req.end();
}, 300000); // Every 5 minutes

// ===== 2. CHECK AND INSTALL DEPENDENCIES =====
console.log('🔍 Checking dependencies...');

const requiredPackages = [
  '@whiskeysockets/baileys',
  'qrcode',
  'yt-search',
  'pino'
];

function checkDependencies() {
  const missing = [];
  for (const pkg of requiredPackages) {
    try {
      require.resolve(pkg);
    } catch (e) {
      missing.push(pkg);
    }
  }

  if (missing.length > 0) {
    console.error('❌ Missing dependencies:', missing);
    console.log('📦 Installing dependencies...');

    const { execSync } = require('child_process');
    try {
      execSync(`npm install ${missing.join(' ')} --no-audit --no-fund`, { stdio: 'inherit' });
      console.log('✅ Dependencies installed');
    } catch (installError) {
      console.error('❌ Failed to install dependencies. Please run:');
      console.error(`npm install ${missing.join(' ')}`);
      process.exit(1);
    }
  } else {
    console.log('✅ All dependencies found');
  }
}

setTimeout(checkDependencies, 1000);

// ===== 3. WHATSAPP BOT CODE =====
let botStarted = false;

async function startWhatsAppBot() {
  if (botStarted) {
    console.log('⚠️ Bot already started');
    return;
  }

  console.log('🤖 Starting WhatsApp bot...');

  try {
    const {
      default: makeWASocket,
      useMultiFileAuthState,
      DisconnectReason,
      fetchLatestBaileysVersion,
      makeCacheableSignalKeyStore,
    } = require("baileys");

    const P = require("pino");
    const fs = require("fs");
    const path = require("path");
    const yts = require("yt-search");
    const QRCode = require("qrcode");

    // ===== CONFIGURATION =====
    const BOT_NAME = process.env.BOT_NAME || "VORTE PRO";
    const PREFIX = process.env.PREFIX || ".";

    global.owner = [
      [process.env.OWNER_1 || "+255778271055", "Primary Owner", true],
      [process.env.OWNER_2 || "+6285863023532", "Secondary Owner", true],
    ];

    global.sudo = ["255778271055", "+6285863023532"];

    const SESSION_FOLDER = process.env.SESSION_FOLDER || "./session";

    try {
      if (!fs.existsSync(SESSION_FOLDER)) {
        fs.mkdirSync(SESSION_FOLDER, { recursive: true });
        console.log(`✅ Created session folder: ${SESSION_FOLDER}`);
      }
    } catch (folderError) {
      console.error('❌ Failed to create session folder:', folderError.message);
      const altFolder = path.join(__dirname, 'tmp_session');
      if (!fs.existsSync(altFolder)) {
        fs.mkdirSync(altFolder, { recursive: true });
      }
      console.log(`✅ Using alternative session folder: ${altFolder}`);
    }

    // ===== DATA STORES =====
    const games = {
      ticTacToe: {},
      hangman: {},
      quizzes: {},
    };

    const lastCommand = {};
    const messageCounters = {};

    // ===== SETTINGS FILE =====
    const settingsPath = "./groupSettings.json";
    if (!fs.existsSync(settingsPath)) {
      fs.writeFileSync(settingsPath, JSON.stringify({}, null, 2));
    }

    function getSettings() {
      return JSON.parse(fs.readFileSync(settingsPath));
    }

    function saveSettings(data) {
      fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2));
    }

    // ===== HELPER FUNCTIONS =====
    function isGroup(jid) {
      return jid && jid.endsWith("@g.us");
    }

    function jidToNumber(jid) {
      return jid ? jid.split("@")[0] : jid;
    }

    function formatTime() {
      return new Date().toLocaleTimeString();
    }

    function tttBoardToText(board) {
      let b = board.map((c, i) => c || (i + 1)).map(c => ` ${c} `);
      return `${b[0]}|${b[1]}|${b[2]}\n───┼───┼───\n${b[3]}|${b[4]}|${b[5]}\n───┼───┼───\n${b[6]}|${b[7]}|${b[8]}`;
    }

    // Cleanup old games
    setInterval(() => {
      const now = Date.now();
      const oneHour = 3600000;

      Object.keys(games.ticTacToe).forEach(key => {
        if (games.ticTacToe[key].createdAt && (now - games.ticTacToe[key].createdAt) > oneHour) {
          delete games.ticTacToe[key];
        }
      });

      Object.keys(games.hangman).forEach(key => {
        if (games.hangman[key].createdAt && (now - games.hangman[key].createdAt) > oneHour) {
          delete games.hangman[key];
        }
      });
    }, 300000);

    // ===== BOT INITIALIZATION =====
    // If SESSION_ID env var is set, restore credentials from it
    const SESSION_ID = process.env.SESSION_ID || null;
    if (SESSION_ID) {
      try {
        const encoded = SESSION_ID.startsWith('VORTE_') ? SESSION_ID.slice(6) : SESSION_ID;
        const credsJson = Buffer.from(encoded, 'base64').toString('utf8');
        const credsData = JSON.parse(credsJson);
        if (!fs.existsSync(SESSION_FOLDER)) fs.mkdirSync(SESSION_FOLDER, { recursive: true });
        fs.writeFileSync(path.join(SESSION_FOLDER, 'creds.json'), JSON.stringify(credsData, null, 2));
        console.log('✅ Session restored from SESSION_ID');
      } catch (e) {
        console.error('❌ Failed to restore session from SESSION_ID:', e.message);
        console.log('⚠️  Falling back to existing session or fresh start');
      }
    }

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_FOLDER);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      logger: P({ level: "silent" }),
      printQRInTerminal: !SESSION_ID, // only show QR if no session ID
      browser: [Ubuntu, "Chrome", "1.0.0"],
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, P().child({ level: "silent" })),
      },
      version,
    });

    sock.ev.on("creds.update", saveCreds);

    // Expose sock globally immediately
    globalSock = sock;

    if (!sock.authState.creds.registered) {
      if (SESSION_ID) {
        console.log(`\n⏳ Connecting with provided SESSION_ID...`);
      } else {
        console.log(`\n🌐 ========================================`);
        console.log(`   No SESSION_ID found.`);
        console.log(`   Get one at the pairing site: http://localhost:${PORT}/`);
        console.log(`   Then set SESSION_ID=VORTE_xxxxx in your .env`);
        console.log(`   (or scan the QR in terminal above)`);
        console.log(`🌐 ========================================\n`);
      }
    }

    // ===== CONNECTION HANDLING =====
    // Track latest QR for the /qr endpoint
    let latestQR = null;

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        latestQR = qr;
        console.log(`📷 QR updated — scan at: http://localhost:${PORT}/qr`);
      }

      if (connection === "close") {
        globalSock = null; // mark as disconnected
        const code = lastDisconnect?.error?.output?.statusCode;
        console.log(`🔌 Connection closed. Code: ${code}`);

        if (code !== DisconnectReason.loggedOut) {
          console.log("🔄 Reconnecting in 5 seconds...");
          botStarted = false;
          setTimeout(startWhatsAppBot, 5000);
        } else {
          console.log("🚪 Logged out. Delete session folder to reconnect.");
        }
      }

      if (connection === "open") {
        console.log(`✅ ${BOT_NAME} connected successfully at ${formatTime()}`);
        botStarted = true;
        globalSock = sock;
        latestQR = null; // clear QR once connected
      }
    });

    // Register /qr route once (uses latestQR closure)
    app._qrRouteRegistered = app._qrRouteRegistered || false;
    if (!app._qrRouteRegistered) {
      app._qrRouteRegistered = true;
      app.get('/qr', async (req, res) => {
        if (!latestQR) {
          return res.send('<html><body style="background:#111;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><p>No QR available — bot may already be connected, or not started yet. Refresh in a moment.</p></body></html>');
        }
        try {
          const QRCodeLib = require('qrcode');
          const qrImage = await QRCodeLib.toDataURL(latestQR);
          res.send(`<!DOCTYPE html><html><head><title>VORTE PRO — QR</title></head><body style="display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#030712;font-family:sans-serif">
            <div style="text-align:center;color:#e2e8f0">
              <h2 style="color:#00ff88;margin-bottom:20px">🤖 ${BOT_NAME} — Scan QR Code</h2>
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
    }

    // ===== GROUP PARTICIPANTS WELCOME/GOODBYE =====
    sock.ev.on("group-participants.update", async (update) => {
      try {
        const { id, participants, action } = update;

        const settings = getSettings();
        if (!settings[id] || settings[id].welcome !== true) return;

        const metadata = await sock.groupMetadata(id);
        const groupName = metadata.subject;

        for (let user of participants) {
          let pp;
          try {
            pp = await sock.profilePictureUrl(user, "image");
          } catch {
            pp = "https://i.imgur.com/JP1gK9C.png";
          }

          if (action === "add") {
            const rules = `
📜 *GROUP RULES*
1️⃣ Respect everyone
2️⃣ No spam
3️⃣ No links
4️⃣ No adult content
5️⃣ Follow admins
`;
            await sock.sendMessage(id, {
              image: { url: pp },
              caption: `┏▣ ◈ WELCOME ◈\n┃ 👋 Welcome @${user.split("@")[0]}\n┃ 📌 Group: ${groupName}\n┗▣\n\n${rules}`,
              mentions: [user],
            });
          }

          if (action === "remove") {
            await sock.sendMessage(id, {
              text: `┏▣ ◈ GOODBYE ◈\n┃ 😢 @${user.split("@")[0]} left the group\n┃ 👋 Farewell!\n┗▣`,
              mentions: [user],
            });
          }
        }
      } catch (err) {
        console.log("Welcome system error:", err);
      }
    });

    // ===== MESSAGE HANDLER =====
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;

      const m = messages[0];
      if (!m || m.key?.fromMe) return;

      const chat = m.key.remoteJid;
      const sender = m.key.participant || m.key.remoteJid;
      const senderNum = jidToNumber(sender);
      const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const isGroupChat = chat.endsWith("@g.us");

      // Get message text
      const msgText =
        m.message?.conversation ||
        m.message?.extendedTextMessage?.text ||
        m.message?.imageMessage?.caption ||
        m.message?.videoMessage?.caption ||
        "";

      const body = (msgText || "").trim();

      // ===== ADMIN CHECK =====
      let isAdmin = false;
      let isBotAdmin = false;

      if (isGroupChat) {
        try {
          const metadata = await sock.groupMetadata(chat);
          const admins = metadata.participants
            .filter(p => p.admin)
            .map(p => p.id);
          isAdmin = admins.includes(sender);
          isBotAdmin = admins.includes(sock.user.id);
        } catch (e) {}
      }

      // ===== AUTO LINK MODERATION =====
      if (groupSettings[chat]?.antilink) {
        const text = m.message?.conversation || m.message?.extendedTextMessage?.text || "";
        const linkRegex = /(https?:\/\/[^\s]+)/i;

        if (linkRegex.test(text) && !isAdmin) {
          await sock.sendMessage(chat, { delete: m.key });

          groupWarnings[chat] = groupWarnings[chat] || {};
          groupWarnings[chat][sender] = (groupWarnings[chat][sender] || 0) + 1;
          const warns = groupWarnings[chat][sender];

          await sock.sendMessage(chat, {
            text: `🚫 @${sender.split("@")[0]} links are not allowed!\n⚠️ Warning: ${warns}/3`,
            mentions: [sender]
          });

          if (warns >= 3 && isBotAdmin) {
            await sock.groupParticipantsUpdate(chat, [sender], "remove");
            await sock.sendMessage(chat, {
              text: `❌ @${sender.split("@")[0]} removed after 3 warnings.`,
              mentions: [sender]
            });
            delete groupWarnings[chat][sender];
          }
          return;
        }
      }

      // ===== AUTOMATION =====
      if (groupSettings[chat]?.autostatusview) {
        try {
          if (m.key.remoteJid.endsWith("@s.whatsapp.net")) {
            await sock.readMessages([m.key]);
          }
        } catch (err) {
          console.log("⚠️ Auto status view error:", err);
        }
      }

      if (isGroupChat && groupSettings[chat]?.autotyping) {
        setTimeout(() => sock.sendPresenceUpdate("composing", chat), 100);
        setTimeout(() => sock.sendPresenceUpdate("paused", chat), 2000);
      }

      if (isGroupChat && groupSettings[chat]?.autorecording) {
        setTimeout(() => sock.sendPresenceUpdate("recording", chat), 100);
        setTimeout(() => sock.sendPresenceUpdate("paused", chat), 2000);
      }

      if (groupSettings[chat]?.autoreact) {
        const emojis = ["❤️","😂","🤔","😅","🙂","🥺","🤒","🥹","😞","💔","🤖","😊","😁","😭","😘","🥰","🥲","🤩","😬","😝","😜","😔","😌","😋","🤬","🙄","😒","😶‍🌫️","😕","🤮","🥵","⭐","💥","👥","🫂","👁️","🦿","🦾"];
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        try {
          await sock.sendMessage(chat, { react: { text: randomEmoji, key: m.key } });
        } catch (err) {
          console.log("⚠️ Autoreact error:", err);
        }
      }

      if (groupSettings[chat]?.autoreacttostatus) {
        if (m.key.remoteJid.endsWith("@s.whatsapp.net")) {
          const emojis = ["❤️","😂","🤔","😅","🙂","🥺","🤒","🥹","😞","💔","🤖","😊","😁","😭","😘","🥰","🥲","🤩","😬","😝","😜","😔","😌","😋","🤬","🙄","😒","😶‍🌫️","😕","🤮","🥵","⭐","💥","👥","🫂","👁️","🦿","🦾"];
          const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
          try {
            await sock.sendMessage(m.key.remoteJid, { react: { text: randomEmoji, key: m.key } });
          } catch (err) {
            console.log("⚠️ Autoreact to status error:", err);
          }
        }
      }

      // Initialize message counter
      if (!messageCounters[chat]) {
        messageCounters[chat] = { total: 0, today: 0 };
      }
      messageCounters[chat].total++;

      // Command cooldown
      const now = Date.now();
      const cooldownKey = `${chat}_${sender}`;
      if (lastCommand[cooldownKey] && (now - lastCommand[cooldownKey]) < 1000) {
        return;
      }
      lastCommand[cooldownKey] = now;

      // Presence updates
      setTimeout(() => sock.sendPresenceUpdate("composing", chat), 200);
      setTimeout(() => sock.sendPresenceUpdate("recording", chat), 1500);

      // Anti-delete feature
      if (m.message?.protocolMessage && m.message.protocolMessage.type === 0) {
        const deleted = m.message.protocolMessage.key;
        const user = deleted.participant || m.key.remoteJid;
        await sock.sendMessage(deleted.remoteJid || chat, {
          text: `⚠️ Anti-Delete: Message deleted by @${jidToNumber(user)}`,
          mentions: [user]
        });
        return;
      }

      const isCmd = body.startsWith(PREFIX);
      const command = isCmd ? body.slice(PREFIX.length).split(/\s+/)[0].toLowerCase() : "";
      const args = isCmd ? body.slice(PREFIX.length).split(/\s+/).slice(1) : [];
      const arg = args.join(" ");

      // Auto-reply AI when bot is mentioned
      if (body.toLowerCase().includes("@bot")) {
        try {
          const query = body.replace(/@bot/gi, "").trim();
          if (query) {
            const response = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: query }]
            });
            const reply = response.choices?.[0]?.message?.content;
            if (reply) await sock.sendMessage(chat, { text: reply });
          }
        } catch (err) {
          console.error("⚠️ Auto-reply AI error:", err);
        }
        return;
      }

      if (!isCmd) return;

      console.log(`📨 Command: ${command} from ${senderNum} in ${isGroup(chat) ? 'group' : 'DM'}`);

      try {

        // ===== .WELCOME ON/OFF =====
        if (command === "welcome") {
          if (!isGroupChat) return sock.sendMessage(chat, { text: "❌ Group only command." });
          if (!isAdmin) return sock.sendMessage(chat, { text: "❌ Admin only command." });
          if (!args[0]) return sock.sendMessage(chat, { text: "Use: .welcome on / off" });

          let settings = getSettings();
          if (!settings[chat]) settings[chat] = {};

          if (args[0] === "on") {
            settings[chat].welcome = true;
            saveSettings(settings);
            return sock.sendMessage(chat, { text: "✅ Welcome enabled." });
          }
          if (args[0] === "off") {
            settings[chat].welcome = false;
            saveSettings(settings);
            return sock.sendMessage(chat, { text: "❌ Welcome disabled." });
          }
          return;
        }

        // ===== COMMAND HANDLERS =====

        if (command === "ping") {
          const start = Date.now();
          await sock.sendMessage(chat, { text: "Pinging..." });
          const latency = Date.now() - start;
          await sock.sendMessage(chat, { text: `🏓 Pong! Latency: ${latency}ms` });
          return;
        }

        if (command === "menu") {
          const os = require("os");
          const menuImageUrl = "https://files.catbox.moe/dy3s7k.jpg";

          const botName = "VORTE PRO";
          const ownerName = "𝕽𝟜𝕲𝕰";
          const prefix = ".";
          const version = "1.0.0";
          const mode = "Public";

          const speed = `${(Math.random() * 0.5 + 0.1).toFixed(3)}s`;
          const usedRam = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
          const totalRam = (os.totalmem() / 1024 / 1024).toFixed(0);

          const uptime = process.uptime();
          const hours = Math.floor(uptime / 3600);
          const minutes = Math.floor((uptime % 3600) / 60);
          const seconds = Math.floor(uptime % 60);

          const plugins = 67;

          const header = `
╔══════════════════════╗
║        🤖 ${botName}        ║
╚══════════════════════╝

➤ Owner   : ${ownerName}
➤ Prefix  : ${prefix}
➤ Version : ${version}
➤ Mode    : ${mode}
➤ Plugins : ${plugins}
➤ Speed   : ${speed}
➤ Usage   : ${hours}h ${minutes}m ${seconds}s
➤ Ram     : ${usedRam}MB / ${totalRam}MB
`;

          const menuBody = `
┏▣ ◈ GROUP COMMANDS ◈
│➽ .tagall
│➽ .promote @user
│➽ .demote @user
│➽ .kick @user
│➽ .leave
│➽ .kickall
│➽ .listadmins
│➽ .tagadmins
│➽ .welcome
│➽ .goodbye
│➽ .close
│➽ .open
│➽ .gclink
│➽ .antilink
│➽ .setgroupname
│➽ .warn
│➽ .userid
│➽ .poll
│➽ .tostatusgroup
│➽ .hidetag
│➽ .delppgroup
┗▣

┏▣ ◈ BOT CONTROLS ◈
│➽ .ping
│➽ .menu
│➽ .owner
│➽ .setnamebot
│➽ .setbio
┗▣

┏▣ ◈ AUTOMATION ◈
│➽ .autotyping
│➽ .autorecording
│➽ .autostatusview
│➽ .autoreacttostatus
│➽ .autoreact
┗▣

┏▣ ◈ GAMES ◈
│➽ .tictactoe @user
│➽ .tttmove
│➽ .hangmanstart
│➽ .hangmanguess
│➽ .quizstart
│➽ .quizanswer
┗▣

┏▣ ◈ MEDIA & UTILS ◈
│➽ .sticker
│➽ .qr
│➽ .song
│➽ .yt
│➽ .imdb
┗▣

┏▣ ◈ AI ◈
│➽ .gpt
┗▣

┏▣ ◈ IMAGE AI ◈
│➽ .1917style
│➽ .advancedglow
│➽ .cartoonstyle
│➽ .luxurygold
│➽ .matrix
│➽ .sand
│➽ .papercutstyle
┗▣

┏▣ ◈ FUN COMMANDS ◈
│➽ .joke
│➽ .quote
│➽ .truth
│➽ .dare
│➽ .dice
│➽ .coin
│➽ .guess
┗▣

┏▣ ◈ TOOLS ◈
│➽ .math
│➽ .echo
│➽ .say
│➽ .reverse
│➽ .countchars
│➽ .vv
│➽ .toviewonce
┗▣

┏▣ ◈ OWNER ONLY ◈
│➽ .sudo
│➽ .broadcast
┗▣

VORTE PRO YOUR POWERFUL WHATSAPP ASSISTANT 
made with hate by 𝕽𝟜𝕲𝕰
`;

          await sock.sendMessage(chat, {
            image: { url: menuImageUrl },
            caption: header + menuBody
          });
          return;
        }

        if (command === "owner") {
          const owners = global.owner.map((o, i) => `${i+1}. ${o[0]} - ${o[1]}`).join("\n");
          await sock.sendMessage(chat, { text: `👑 *Bot Owners*\n\n${owners}` });
          return;
        }

        if (command === "stats") {
          const totalChats = Object.keys(messageCounters).length;
          const totalMsgs = Object.values(messageCounters).reduce((sum, counter) => sum + counter.total, 0);
          const uptime = process.uptime();
          const hours = Math.floor(uptime / 3600);
          const minutes = Math.floor((uptime % 3600) / 60);
          const seconds = Math.floor(uptime % 60);

          const stats = `📊 *Bot Statistics*
• Active chats: ${totalChats}
• Total messages: ${totalMsgs}
• Uptime: ${hours}h ${minutes}m ${seconds}s
• Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
• Platform: ${process.platform}`;

          await sock.sendMessage(chat, { text: stats });
          return;
        }

        if (command === "setnamebot") {
          if (!arg) return sock.sendMessage(chat, { text: `Usage: .setnamebot <name>` });
          const isOwner = global.owner.some(owner => owner[0].includes(senderNum.replace('+', '')));
          if (!isOwner) return sock.sendMessage(chat, { text: "❌ Owner only command." });

          try {
            await sock.updateProfileName(arg);
            await sock.sendMessage(chat, { text: `✅ Bot name changed to: ${arg}` });
          } catch (e) {
            await sock.sendMessage(chat, { text: "❌ Failed to change name." });
          }
          return;
        }

        if (command === "setbio") {
          if (!arg) return sock.sendMessage(chat, { text: `Usage: .setbio <text>` });
          const isOwner = global.owner.some(owner => owner[0].includes(senderNum.replace('+', '')));
          if (!isOwner) return sock.sendMessage(chat, { text: "❌ Owner only command." });

          try {
            await sock.updateProfileStatus(arg);
            await sock.sendMessage(chat, { text: `✅ Bio updated to: ${arg}` });
          } catch (e) {
            await sock.sendMessage(chat, { text: "❌ Failed to update bio." });
          }
          return;
        }

        // Automation toggle commands
        if (command === "autotyping" || command === "autorecording" || command === "autostatusview" || command === "autoreact" || command === "autoreacttostatus" || command === "antilink") {
          if (!isGroupChat) return sock.sendMessage(chat, { text: "❌ Group only command." });
          if (!isAdmin) return sock.sendMessage(chat, { text: "❌ Admin only command." });
          if (!args[0]) return sock.sendMessage(chat, { text: `Use: .${command} on / off` });

          if (!groupSettings[chat]) groupSettings[chat] = {};

          if (args[0] === "on") {
            groupSettings[chat][command] = true;
            return sock.sendMessage(chat, { text: `✅ ${command} enabled.` });
          }
          if (args[0] === "off") {
            groupSettings[chat][command] = false;
            return sock.sendMessage(chat, { text: `❌ ${command} disabled.` });
          }
          return;
        }

        if (command === "tagall" || command === "everyone") {
          if (!isGroupChat) return sock.sendMessage(chat, { text: "❌ Group only command." });
          if (!isAdmin) return sock.sendMessage(chat, { text: "❌ Admin only command." });

          try {
            const metadata = await sock.groupMetadata(chat);
            const members = metadata.participants.map(u => u.id);
            let textTag = "📣 *Tagging Everyone*\n\n";
            members.forEach(u => textTag += `@${u.split("@")[0]}\n`);
            await sock.sendMessage(chat, { text: textTag, mentions: members });
          } catch (e) {
            await sock.sendMessage(chat, { text: "❌ Failed to tag everyone." });
          }
          return;
        }

        if (command === "gclink") {
          if (!isGroupChat) return sock.sendMessage(chat, { text: "❌ Group only command." });
          if (!isAdmin) return sock.sendMessage(chat, { text: "❌ Admin only." });

          try {
            const res = await sock.groupInviteCode(chat);
            const link = `https://chat.whatsapp.com/${res}`;
            await sock.sendMessage(chat, { text: `🔗 Group Link: ${link}` });
          } catch (err) {
            await sock.sendMessage(chat, { text: "❌ Failed to fetch group link." });
          }
          return;
        }

        if (command === "listadmins") {
          if (!isGroupChat) return sock.sendMessage(chat, { text: "❌ Group only command." });

          try {
            const metadata = await sock.groupMetadata(chat);
            const admins = metadata.participants.filter(p => p.admin).map(p => p.id);

            if (admins.length === 0) {
              await sock.sendMessage(chat, { text: "ℹ️ No admins found in this group." });
              return;
            }

            let text = "👑 *Group Admins:*\n\n";
            for (let a of admins) text += `• @${a.split("@")[0]}\n`;
            await sock.sendMessage(chat, { text, mentions: admins });
          } catch (err) {
            await sock.sendMessage(chat, { text: "❌ Failed to fetch group admins." });
          }
          return;
        }

        if (command === "tagadmins") {
          if (!isGroupChat) return sock.sendMessage(chat, { text: "❌ Group only command." });

          try {
            const metadata = await sock.groupMetadata(chat);
            const admins = metadata.participants.filter(p => p.admin).map(p => p.id);

            if (admins.length === 0) {
              await sock.sendMessage(chat, { text: "ℹ️ No admins found in this group." });
              return;
            }

            let text = "👑 *Attention Admins:*\n\n";
            for (let a of admins) text += `• @${a.split("@")[0]}\n`;
            await sock.sendMessage(chat, { text, mentions: admins });
          } catch (err) {
            await sock.sendMessage(chat, { text: "❌ Failed to tag admins." });
          }
          return;
        }

        if (command === "setgroupname") {
          if (!isGroupChat) return sock.sendMessage(chat, { text: "❌ Group only." });
          if (!isAdmin) return sock.sendMessage(chat, { text: "❌ Admin only." });
          if (!arg) return sock.sendMessage(chat, { text: "Usage: .setgroupname <new name>" });

          await sock.groupUpdateSubject(chat, arg);
          await sock.sendMessage(chat, { text: `✅ Group name updated to: ${arg}` });
          return;
        }

        if (command === "userid") {
          await sock.sendMessage(chat, { text: `👤 Your ID: ${sender}` });
          return;
        }

        if (command === "poll") {
          if (!isGroupChat) return sock.sendMessage(chat, { text: "❌ Group only." });
          if (!isAdmin) return sock.sendMessage(chat, { text: "❌ Admin only." });
          if (!arg) return sock.sendMessage(chat, { text: "Usage: .poll <question>|<option1>|<option2>|..." });

          const [question, ...options] = arg.split("|");
          if (options.length < 2) return sock.sendMessage(chat, { text: "❌ Provide at least 2 options." });

          const buttons = options.map((opt, i) => ({
            buttonId: `poll_${i}`,
            buttonText: { displayText: opt },
            type: 1
          }));

          await sock.sendMessage(chat, {
            text: `📊 *Poll:* ${question}`,
            buttons,
            headerType: 1
          });
          return;
        }

        if (command === "tostatusgroup") {
          if (!arg) return sock.sendMessage(chat, { text: "Usage: .tostatusgroup <text>" });
          await sock.sendMessage(sock.user.id + "@s.whatsapp.net", { text: arg });
          await sock.sendMessage(chat, { text: "✅ Message posted to your status." });
          return;
        }

        if (command === "hidetag") {
          if (!isGroupChat) return sock.sendMessage(chat, { text: "❌ Group only." });
          if (!arg) return sock.sendMessage(chat, { text: "Usage: .hidetag <text>" });

          try {
            const metadata = await sock.groupMetadata(chat);
            const allMembers = metadata.participants.map(p => p.id);
            await sock.sendMessage(chat, { text: arg, mentions: allMembers });
          } catch (err) {
            await sock.sendMessage(chat, { text: "❌ Failed to send hidetag." });
          }
          return;
        }

        if (command === "delppgroup") {
          if (!isAdmin) return sock.sendMessage(chat, { text: "❌ Admin only." });
          await sock.updateProfilePicture(chat, { url: "https://i.ibb.co/0r5MZ9X/blank.png" });
          await sock.sendMessage(chat, { text: "✅ Group profile picture deleted." });
          return;
        }

        if (command === "warn") {
          if (!isGroupChat) return sock.sendMessage(chat, { text: "❌ Group only." });
          if (!isAdmin) return sock.sendMessage(chat, { text: "❌ Admin only command." });

          const warnUser = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
          if (!warnUser) return sock.sendMessage(chat, { text: "Tag a user to warn." });

          groupWarnings[chat] = groupWarnings[chat] || {};
          groupWarnings[chat][warnUser] = (groupWarnings[chat][warnUser] || 0) + 1;

          await sock.sendMessage(chat, {
            text: `⚠️ @${warnUser.split("@")[0]} has been warned. Total warnings: ${groupWarnings[chat][warnUser]}`,
            mentions: [warnUser]
          });
          return;
        }

        if (command === "vv") {
          if (!m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            return sock.sendMessage(chat, { text: "❌ Reply to a view-once message." });
          }

          const quoted = m.message.extendedTextMessage.contextInfo.quotedMessage;

          if (quoted.viewOnceMessageV2 || quoted.viewOnceMessage) {
            const viewOnce = quoted.viewOnceMessageV2?.message || quoted.viewOnceMessage?.message;

            if (viewOnce.imageMessage) {
              return sock.sendMessage(chat, {
                image: viewOnce.imageMessage,
                caption: viewOnce.imageMessage.caption || "",
              });
            }

            if (viewOnce.videoMessage) {
              return sock.sendMessage(chat, {
                video: viewOnce.videoMessage,
                caption: viewOnce.videoMessage.caption || "",
              });
            }
          } else {
            return sock.sendMessage(chat, { text: "❌ That is not a view-once message." });
          }
          return;
        }

        if (command === "toviewonce") {
          if (!m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            return sock.sendMessage(chat, { text: "❌ Reply to an image or video." });
          }

          const quoted = m.message.extendedTextMessage.contextInfo.quotedMessage;

          if (quoted.imageMessage) {
            return sock.sendMessage(chat, {
              viewOnceMessage: { message: { imageMessage: quoted.imageMessage } },
            });
          }

          if (quoted.videoMessage) {
            return sock.sendMessage(chat, {
              viewOnceMessage: { message: { videoMessage: quoted.videoMessage } },
            });
          }

          return sock.sendMessage(chat, { text: "❌ Only image or video supported." });
        }

        if (command === "promote") {
          if (!isGroupChat) return sock.sendMessage(chat, { text: "❌ Group only command." });
          if (!mentions || mentions.length === 0) return sock.sendMessage(chat, { text: "Usage: .promote @user" });
          if (!isAdmin) return sock.sendMessage(chat, { text: "❌ Admin only command." });
          if (!isBotAdmin) return sock.sendMessage(chat, { text: "❌ Bot needs to be admin." });

          try {
            await sock.groupParticipantsUpdate(chat, mentions, "promote");
            await sock.sendMessage(chat, { text: `✅ Promoted ${mentions.length} user(s)`, mentions });
          } catch (err) {
            await sock.sendMessage(chat, { text: "❌ Failed to promote user(s)." });
          }
          return;
        }

        if (command === "demote") {
          if (!isGroupChat) return sock.sendMessage(chat, { text: "❌ Group only command." });
          if (!mentions || mentions.length === 0) return sock.sendMessage(chat, { text: "Usage: .demote @user" });
          if (!isAdmin) return sock.sendMessage(chat, { text: "❌ Admin only command." });
          if (!isBotAdmin) return sock.sendMessage(chat, { text: "❌ Bot needs to be admin." });

          try {
            await sock.groupParticipantsUpdate(chat, mentions, "demote");
            await sock.sendMessage(chat, { text: `⚠️ Demoted ${mentions.length} user(s)`, mentions });
          } catch (err) {
            await sock.sendMessage(chat, { text: "❌ Failed to demote user(s)." });
          }
          return;
        }

        if (command === "kick") {
          if (!isGroupChat) return sock.sendMessage(chat, { text: "❌ Group only command." });
          if (!mentions || mentions.length === 0) return sock.sendMessage(chat, { text: "Usage: .kick @user" });
          if (!isAdmin) return sock.sendMessage(chat, { text: "❌ Admin only command." });
          if (!isBotAdmin) return sock.sendMessage(chat, { text: "❌ Bot needs to be admin." });

          try {
            await sock.groupParticipantsUpdate(chat, mentions, "remove");
            await sock.sendMessage(chat, { text: `👢 Removed ${mentions.length} user(s)`, mentions });
          } catch (err) {
            await sock.sendMessage(chat, { text: "❌ Failed to remove user(s)." });
          }
          return;
        }

        if (command === "kickall") {
          if (!isGroupChat) return sock.sendMessage(chat, { text: "❌ Group only." });
          if (!isAdmin) return sock.sendMessage(chat, { text: "❌ Admin only command." });
          if (!isBotAdmin) return sock.sendMessage(chat, { text: "❌ Bot must be admin." });

          try {
            const metadata = await sock.groupMetadata(chat);
            for (let member of metadata.participants) {
              if (!member.admin) {
                await sock.groupParticipantsUpdate(chat, [member.id], "remove");
              }
            }
            await sock.sendMessage(chat, { text: "✅ All non-admin members removed." });
          } catch (err) {
            await sock.sendMessage(chat, { text: "❌ Failed to kick all members." });
          }
          return;
        }

        if (command === "close" || command === "open") {
          if (!isGroupChat) return sock.sendMessage(chat, { text: "❌ Group only." });
          if (!isAdmin) return sock.sendMessage(chat, { text: "❌ Admin only command." });
          if (!isBotAdmin) return sock.sendMessage(chat, { text: "❌ Bot must be admin." });

          try {
            await sock.groupSettingUpdate(chat, command === "close" ? "announcement" : "not_announcement");
            await sock.sendMessage(chat, { text: `✅ Group is now ${command === "close" ? "closed (only admins can send messages)" : "open"}` });
          } catch (err) {
            await sock.sendMessage(chat, { text: "❌ Failed to update group settings." });
          }
          return;
        }

        if (command === "leave") {
          if (!isGroupChat) return sock.sendMessage(chat, { text: "❌ This command only works in groups." });
          const isOwner = global.owner.some(owner => owner[0].includes(senderNum.replace('+', '')));
          if (!isOwner) return sock.sendMessage(chat, { text: "❌ Owner only command." });

          await sock.sendMessage(chat, { text: "👋 Leaving group..." });
          await sock.groupLeave(chat);
          return;
        }

        // ===== IMAGE GENERATION COMMANDS =====
        const imageStyles = {
          "1917style": "1917 cinematic, realistic",
          "advancedglow": "advanced glow, futuristic",
          "cartoonstyle": "cartoon style, colorful",
          "luxurygold": "luxury gold, elegant, shiny",
          "matrix": "matrix cyberpunk, green digital",
          "sand": "sand texture, desert, grainy",
          "papercutstyle": "papercut art style, layered"
        };

        if (imageStyles[command]) {
          if (!arg) return sock.sendMessage(chat, { text: `Usage: .${command} <prompt>` });

          await sock.sendMessage(chat, { text: `🎨 Generating ${command} image...` });

          const imageUrl = await generateImage(arg, imageStyles[command]);
          if (!imageUrl) return sock.sendMessage(chat, { text: "❌ Failed to generate image." });

          await sock.sendMessage(chat, { image: { url: imageUrl }, caption: `✨ *${command} image* for: "${arg}"` });
          return;
        }

        if (command === "sticker" || command === "s") {
          try {
            let mediaMsg = m;
            if (m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
              mediaMsg = { key: m.key, message: m.message.extendedTextMessage.contextInfo.quotedMessage };
            }

            const media = mediaMsg.message?.imageMessage || mediaMsg.message?.videoMessage;
            if (!media) return sock.sendMessage(chat, { text: "📸 Reply to an image/video or send one with caption .sticker" });

            const stream = await sock.downloadMediaMessage(mediaMsg);
            await sock.sendMessage(chat, { sticker: stream });
          } catch (err) {
            await sock.sendMessage(chat, { text: "❌ Could not create sticker." });
          }
          return;
        }

        if (command === "song" || command === "yt") {
          if (!arg) return sock.sendMessage(chat, { text: "Usage: .song <song name>" });

          try {
            const response = await youtube.search.list({
              part: "snippet",
              q: arg,
              maxResults: 3,
              type: "video",
            });

            const videos = response.data.items;
            if (!videos || videos.length === 0) {
              return sock.sendMessage(chat, { text: "❌ No results found." });
            }

            let resultText = "🎵 *Search Results:*\n\n";
            videos.forEach((video, i) => {
              resultText += `${i + 1}. *${video.snippet.title}*\n`;
              resultText += `   🔗 https://www.youtube.com/watch?v=${video.id.videoId}\n\n`;
            });

            await sock.sendMessage(chat, { text: resultText });
          } catch (err) {
            await sock.sendMessage(chat, { text: "❌ Error searching for song." });
          }
          return;
        }

        if (command === "imdb") {
          if (!arg) return sock.sendMessage(chat, { text: "Usage: .imdb <movie name>" });

          try {
            const apiKey = process.env.IMDB_API_KEY;
            if (!apiKey) return sock.sendMessage(chat, { text: "❌ IMDB_API_KEY not set in environment." });

            const url = `https://www.omdbapi.com/?t=${encodeURIComponent(arg)}&apikey=${apiKey}`;
            const res = await axios.get(url);
            const movie = res.data;

            if (movie.Response === "False") throw new Error("Movie not found");

            const movieInfo = `🎬 *${movie.Title || "N/A"}* (${movie.Year || "N/A"})

⭐ Rating: ${movie.imdbRating || "N/A"}
🎭 Genre: ${movie.Genre || "N/A"}
🎥 Director: ${movie.Director || "N/A"}
👥 Actors: ${movie.Actors || "N/A"}

📖 Plot:
${movie.Plot || "N/A"}`;

            if (movie.Poster && movie.Poster !== "N/A") {
              await sock.sendMessage(chat, { image: { url: movie.Poster }, caption: movieInfo });
            } else {
              await sock.sendMessage(chat, { text: movieInfo });
            }
          } catch (err) {
            await sock.sendMessage(chat, { text: "❌ Movie not found." });
          }
          return;
          return;
        }

        if (command === "math") {
          if (!arg) return sock.sendMessage(chat, { text: `Usage: .math 5+5*2` });

          try {
            const safeArg = arg.replace(/[^0-9+\-*/().\s]/g, '');
            const answer = eval(safeArg);
            await sock.sendMessage(chat, { text: `🧮 ${arg} = *${answer}*` });
          } catch (err) {
            await sock.sendMessage(chat, { text: "❌ Invalid equation." });
          }
          return;
        }

        if (command === "qr") {
          if (!arg) return sock.sendMessage(chat, { text: `Usage: .qr hello world` });

          try {
            const qrText = arg.slice(0, 500);
            const qrImg = await QRCode.toBuffer(qrText, {
              errorCorrectionLevel: 'M',
              margin: 2,
              width: 300
            });
            const caption = `QR Code for: ${qrText.length > 50 ? qrText.slice(0, 50) + "..." : qrText}`;
            await sock.sendMessage(chat, { image: qrImg, caption });
          } catch (err) {
            await sock.sendMessage(chat, { text: "❌ Failed to generate QR code." });
          }
          return;
        }

        if (command === "gpt") {
          if (!arg) return sock.sendMessage(chat, { text: `Usage: .gpt <question>` });

          try {
            const response = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: arg }]
            });
            const reply = response.choices?.[0]?.message?.content;
            if (reply) await sock.sendMessage(chat, { text: reply });
          } catch (err) {
            await sock.sendMessage(chat, { text: "❌ AI error. Try again." });
          }
          return;
        }

        if (command === "sudo") {
          const primaryOwner = global.owner[0][0].replace('+', '');
          if (senderNum !== primaryOwner) return sock.sendMessage(chat, { text: "❌ Owner only command." });
          if (!arg) return sock.sendMessage(chat, { text: `Usage: .sudo <javascript code>` });

          try {
            let result = eval(arg);
            const resultStr = String(result).slice(0, 2000);
            await sock.sendMessage(chat, { text: `✅ Result:\n\`\`\`${resultStr}\`\`\`` });
          } catch (err) {
            await sock.sendMessage(chat, { text: `❌ Error:\n\`\`\`${String(err)}\`\`\`` });
          }
          return;
        }

        if (command === "broadcast") {
          const primaryOwner = global.owner[0][0].replace('+', '');
          if (senderNum !== primaryOwner) return sock.sendMessage(chat, { text: "❌ Owner only command." });
          if (!arg) return sock.sendMessage(chat, { text: `Usage: .broadcast <message>` });

          await sock.sendMessage(chat, { text: `📢 Starting broadcast to all chats...` });

          let success = 0;
          let failed = 0;
          const chats = Object.keys(sock.store?.chats || {}).slice(0, 50);

          for (const c of chats) {
            if (c.endsWith("@g.us") || c.endsWith("@s.whatsapp.net")) {
              try {
                await sock.sendMessage(c, { text: `📢 *Broadcast from ${BOT_NAME}*\n\n${arg}` });
                success++;
                await new Promise(resolve => setTimeout(resolve, 100));
              } catch (e) {
                failed++;
              }
            }
          }

          await sock.sendMessage(chat, { text: `✅ Broadcast completed!\n• Sent: ${success}\n• Failed: ${failed}` });
          return;
        }

        if (command === "quote") {
          const quotes = [
            "The only way to do great work is to love what you do. - Steve Jobs",
            "Innovation distinguishes between a leader and a follower. - Steve Jobs",
            "Your time is limited, don't waste it living someone else's life. - Steve Jobs",
            "Stay hungry, stay foolish. - Steve Jobs"
          ];
          const quote = quotes[Math.floor(Math.random() * quotes.length)];
          await sock.sendMessage(chat, { text: `💬 "${quote}"` });
          return;
        }

        if (command === "joke") {
          const jokes = [
            "Why don't scientists trust atoms? Because they make up everything!",
            "Why did the scarecrow win an award? He was outstanding in his field!",
            "What do you call a bear with no teeth? A gummy bear!",
            "Why don't eggs tell jokes? They'd crack each other up!"
          ];
          const joke = jokes[Math.floor(Math.random() * jokes.length)];
          await sock.sendMessage(chat, { text: `😂 ${joke}` });
          return;
        }

        if (command === "guess") {
          const number = Math.floor(Math.random() * 10) + 1;
          await sock.sendMessage(chat, { text: `🎲 I'm thinking of a number between 1-10...\nIt's *${number}*!` });
          return;
        }

        if (command === "truth") {
          const truths = [
            "What's your biggest fear?",
            "What's the most embarrassing thing you've ever done?",
            "Have you ever lied to get out of trouble?",
            "What's one thing you would change about yourself?"
          ];
          const truth = truths[Math.floor(Math.random() * truths.length)];
          await sock.sendMessage(chat, { text: `🤔 Truth: ${truth}` });
          return;
        }

        if (command === "dare") {
          const dares = [
            "Send a voice note singing your favorite song!",
            "Change your profile picture to something funny for 1 hour!",
            "Send the last photo in your gallery!",
            "Call a random contact and say hello!"
          ];
          const dare = dares[Math.floor(Math.random() * dares.length)];
          await sock.sendMessage(chat, { text: `😈 Dare: ${dare}` });
          return;
        }

        if (command === "dice") {
          const dice = Math.floor(Math.random() * 6) + 1;
          await sock.sendMessage(chat, { text: `🎲 You rolled: ${dice}` });
          return;
        }

        if (command === "coin") {
          const result = Math.random() < 0.5 ? "Heads" : "Tails";
          await sock.sendMessage(chat, { text: `🪙 ${result}!` });
          return;
        }

        if (command === "say") {
          if (!arg) return sock.sendMessage(chat, { text: `Usage: .say <text>` });
          await sock.sendMessage(chat, { text: arg });
          return;
        }

        if (command === "tictactoe" || command === "ttt") {
          const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
          if (mentioned.length === 0) {
            return sock.sendMessage(chat, { text: `Usage: .ttt @user — mention the user you challenge` });
          }

          const opponent = mentioned[0];
          const initiator = m.key.participant || m.key.remoteJid;

          if (opponent === initiator) {
            return sock.sendMessage(chat, { text: "You cannot challenge yourself." });
          }

          games.ticTacToe[chat] = {
            board: Array(9).fill(""),
            players: [initiator, opponent],
            turn: initiator,
            status: "playing",
            createdAt: Date.now()
          };

          await sock.sendMessage(chat, { 
            text: `🎮 *Tic Tac Toe Started!*\n\nPlayer X: @${jidToNumber(initiator)}\nPlayer O: @${jidToNumber(opponent)}\n\nCurrent board:\n${tttBoardToText(games.ticTacToe[chat].board)}\n\nIt's X's turn! Use .tttmove <1-9>` 
          });
          return;
        }

        if (command === "tttmove") {
          const game = games.ticTacToe[chat];
          if (!game) return sock.sendMessage(chat, { text: `No active game. Start with ${PREFIX}ttt @user` });

          const move = parseInt(args[0]);
          if (!move || move < 1 || move > 9) return sock.sendMessage(chat, { text: `Usage: .tttmove <1-9>` });

          const player = m.key.participant || m.key.remoteJid;
          if (player !== game.turn) return sock.sendMessage(chat, { text: "It's not your turn!" });

          if (game.board[move - 1]) return sock.sendMessage(chat, { text: "Cell already taken!" });

          const symbol = game.players[0] === player ? "X" : "O";
          game.board[move - 1] = symbol;

          const wins = [
            [0,1,2],[3,4,5],[6,7,8],
            [0,3,6],[1,4,7],[2,5,8],
            [0,4,8],[2,4,6]
          ];

          let winner = null;
          for (const [a,b,c] of wins) {
            if (game.board[a] && game.board[a] === game.board[b] && game.board[a] === game.board[c]) {
              winner = game.board[a];
              break;
            }
          }

          let boardText = tttBoardToText(game.board);

          if (winner) {
            const winnerJid = game.players[winner === "X" ? 0 : 1];
            const winnerNum = jidToNumber(winnerJid);
            await sock.sendMessage(chat, { 
              text: `🎉 *Game Over!*\n\n${boardText}\n\nWinner: @${winnerNum} (${winner})`, 
              mentions: [winnerJid] 
            });
            delete games.ticTacToe[chat];
            return;
          }

          if (game.board.every(cell => cell)) {
            await sock.sendMessage(chat, { text: `🤝 *Draw!*\n\n${boardText}` });
            delete games.ticTacToe[chat];
            return;
          }

          game.turn = game.players.find(p => p !== player);
          const nextPlayerNum = jidToNumber(game.turn);
          const nextSymbol = game.players[0] === game.turn ? "X" : "O";

          await sock.sendMessage(chat, { 
            text: `Next move:\n\n${boardText}\n\nTurn: @${nextPlayerNum} (${nextSymbol})`, 
            mentions: [game.turn] 
          });
          return;
        }

        if (command === "hangmanstart") {
          // Check if game already exists first
          if (games.hangman[chat]) {
            return sock.sendMessage(chat, { text: "❌ A hangman game is already in progress in this chat." });
          }

          const words = ["javascript", "whatsapp", "computer", "internet", "android", "iphone", "python", "programming"];
          const word = words[Math.floor(Math.random() * words.length)];

          games.hangman[chat] = {
            word: word.toLowerCase(),
            display: "_".repeat(word.length).split(""),
            tries: 6,
            guessed: [],
            createdAt: Date.now()
          };

          // Set timeout to auto-delete game after 5 minutes
          setTimeout(() => {
            if (games.hangman[chat]) {
              delete games.hangman[chat];
              sock.sendMessage(chat, { text: "⌛ Hangman game timed out!" }).catch(() => {});
            }
          }, 5 * 60 * 1000);

          await sock.sendMessage(chat, { 
            text: `🎯 *Hangman Started!*\n\nWord: ${games.hangman[chat].display.join(" ")}\nTries left: 6\n\nGuess a letter with: .hangmanguess <letter>` 
          });
          return;
        }

        if (command === "hangmanguess") {
          const game = games.hangman[chat];
          if (!game) return sock.sendMessage(chat, { text: `No active game. Start with ${PREFIX}hangmanstart` });

          const letter = args[0]?.toLowerCase();
          if (!letter || letter.length !== 1 || !/[a-z]/.test(letter)) {
            return sock.sendMessage(chat, { text: `Usage: .hangmanguess <single letter>` });
          }

          if (game.guessed.includes(letter)) {
            return sock.sendMessage(chat, { text: "Letter already guessed!" });
          }

          game.guessed.push(letter);
          let found = false;

          for (let i = 0; i < game.word.length; i++) {
            if (game.word[i] === letter) {
              game.display[i] = letter;
              found = true;
            }
          }

          if (!found) game.tries -= 1;

          if (game.display.join("") === game.word) {
            await sock.sendMessage(chat, { 
              text: `🎉 *You Won!*\n\nThe word was: *${game.word}*\nTries left: ${game.tries}` 
            });
            delete games.hangman[chat];
            return;
          }

          if (game.tries <= 0) {
            await sock.sendMessage(chat, { 
              text: `💀 *Game Over!*\n\nThe word was: *${game.word}*\n\nBetter luck next time!` 
            });
            delete games.hangman[chat];
            return;
          }

          const hangmanStates = [
            "  ____\n  |  |\n     |\n     |\n     |\n     |\n_____|___",
            "  ____\n  |  |\n  O  |\n     |\n     |\n     |\n_____|___",
            "  ____\n  |  |\n  O  |\n  |  |\n     |\n     |\n_____|___",
            "  ____\n  |  |\n  O  |\n /|  |\n     |\n     |\n_____|___",
            "  ____\n  |  |\n  O  |\n /|\\ |\n     |\n     |\n_____|___",
            "  ____\n  |  |\n  O  |\n /|\\ |\n /   |\n     |\n_____|___",
            "  ____\n  |  |\n  O  |\n /|\\ |\n / \\ |\n     |\n_____|___"
          ];

          const stateIndex = 6 - game.tries;
          await sock.sendMessage(chat, { 
            text: `${hangmanStates[stateIndex]}\n\nWord: ${game.display.join(" ")}\nTries left: ${game.tries}\nGuessed: ${game.guessed.join(", ")}` 
          });
          return;
        }

        if (command === "quizstart") {
          if (games.quizzes[chat]?.active) {
            return sock.sendMessage(chat, { text: "❌ A quiz is already active in this chat!" });
          }

          const quizzes = [
            { q: "What is the capital of France?", choices: ["London", "Berlin", "Paris", "Madrid"], answer: "Paris" },
            { q: "How many continents are there?", choices: ["5", "6", "7", "8"], answer: "7" },
            { q: "What is 2+2?", choices: ["3", "4", "5", "6"], answer: "4" }
          ];

          const quiz = quizzes[Math.floor(Math.random() * quizzes.length)];
          games.quizzes[chat] = { ...quiz, active: true, createdAt: Date.now() };

          setTimeout(() => {
            if (games.quizzes[chat]?.active) {
              delete games.quizzes[chat];
              sock.sendMessage(chat, { text: "⌛ Quiz timed out!" }).catch(() => {});
            }
          }, 5 * 60 * 1000);

          await sock.sendMessage(chat, { 
            text: `🧠 *Quiz Started!*\n\nQuestion: ${quiz.q}\n\nChoices: ${quiz.choices.join(", ")}\n\nAnswer with: .quizanswer <answer>` 
          });
          return;
        }

        if (command === "quizanswer") {
          const quiz = games.quizzes[chat];
          if (!quiz || !quiz.active) return sock.sendMessage(chat, { text: `No active quiz. Start with ${PREFIX}quizstart` });
          if (!arg) return sock.sendMessage(chat, { text: `Usage: .quizanswer <answer>` });

          const userAnswer = arg.trim().toLowerCase();
          const correctAnswer = quiz.answer.toLowerCase();

          if (userAnswer === correctAnswer) {
            await sock.sendMessage(chat, { text: `✅ *Correct!* The answer is ${quiz.answer}` });
          } else {
            await sock.sendMessage(chat, { text: `❌ *Wrong!* The correct answer is ${quiz.answer}` });
          }

          delete games.quizzes[chat];
          return;
        }

        if (command === "echo") {
          await sock.sendMessage(chat, { text: arg || `Usage: .echo <text>` });
          return;
        }

        if (command === "reverse") {
          if (!arg) return sock.sendMessage(chat, { text: `Usage: .reverse <text>` });
          const reversed = arg.split("").reverse().join("");
          await sock.sendMessage(chat, { text: reversed });
          return;
        }

        if (command === "countchars") {
          if (!arg) return sock.sendMessage(chat, { text: `Usage: .countchars <text>` });
          const count = arg.length;
          const wordCount = arg.trim().split(/\s+/).length;
          await sock.sendMessage(chat, { text: `📊 Text Analysis:\n• Characters: ${count}\n• Words: ${wordCount}` });
          return;
        }

        // ----- FALLBACK -----
        await sock.sendMessage(chat, { 
          text: `❓ Unknown command: *${command}*\n\nType .menu for list of commands.` 
        });

      } catch (error) {
        console.error('Message processing error:', error);
        try {
          await sock.sendMessage(chat, { text: '⚠️ An error occurred while processing your command.' });
        } catch (sendError) {
          console.error('Failed to send error message:', sendError);
        }
      }
    });

    // ===== CONTACT WELCOME =====
    sock.ev.on("contacts.upsert", async (contacts) => {
      try {
        for (const contact of contacts) {
          const num = contact.id;
          if (!num || num.endsWith('@g.us')) continue;
          await sock.sendMessage(num, { 
            text: `👋 Hello! I'm *${BOT_NAME}*\n\nType .menu to see all commands.\n\nNeed help? Contact my owner!` 
          });
        }
      } catch (error) {
        console.error('Welcome message error:', error);
      }
    });

    // ===== GROUP UPDATES =====
    sock.ev.on("groups.update", async (updates) => {
      for (const update of updates) {
        console.log(`Group update for ${update.id}:`, update);
      }
    });

    console.log(`✅ ${BOT_NAME} is ready!`);

  } catch (error) {
    console.error('❌ Failed to start WhatsApp bot:', error);

    setTimeout(() => {
      console.log('🔄 Retrying bot startup...');
      startWhatsAppBot();
    }, 10000);

    return null;
  }
}

// ===== 4. START BOT AFTER SERVER IS READY======
async function startWhatsAppBot() {
  try {
    const sock = await makeWASocket({
      // config here
    });

    console.log('🎉 Bot successfully started!');
    console.log(`👉 Access your bot at: http://localhost:${PORT}`);

    return sock;

  } catch (error) {
    console.error('❌ Failed to start WhatsApp bot:', error);
    return null;
  }
}
// ===== 5. ERROR HANDLING =====
process.on('uncaughtException', (error) => {
  console.error('⚠️ Uncaught Exception:', error.message);
  console.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

console.log(`
=========================================
🤖 VORTE PRO WhatsApp Bot
🌐 Server starting on port ${PORT}
📦 Version: 1.0.0
=========================================
`);
