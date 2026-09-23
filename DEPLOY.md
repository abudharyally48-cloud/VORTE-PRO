# 🚀 VORTE-PRO Deployment Guide

This guide will walk you through the process of deploying your VORTE-PRO WhatsApp bot to various platforms.

---

## ⚠️ Important: ephemeral storage

Most free/low-cost hosts (Heroku, Railway free tier, most "panel" hosts) wipe the filesystem on every restart/redeploy. This bot already handles the WhatsApp **session** correctly for that (via `SESSION_ID`, generated from the pairing site — no local file needed).

However, the **menu picture/video** set via `.setmenudisplay` is saved locally to `storage/menu/` and is **not** covered by `SESSION_ID`. On an ephemeral host, you'll need to re-run `.setmenudisplay` after each redeploy/restart. If your host offers a persistent volume/disk, mount it at `storage/` to avoid this.

---

## 🐳 Docker-based panels (Pterodactyl, Katabump, Railway, generic VPS panels) <a name="docker"></a>

A `Dockerfile` is included. Any panel that supports "deploy from Dockerfile" or "Docker image" will work:

1. Point the panel at this repo (or upload the zip).
2. Set your environment variables in the panel's env/variables section — see `.env.example` for the full list.
3. The panel should auto-detect the `Dockerfile` and build/run it. If it asks for a start command anyway, use `node index.js`.
4. Make sure the panel exposes/forwards port `3000` (or set `PORT` to whatever the panel requires).

---

## 🟣 Heroku <a name="heroku"></a>

Heroku is a popular cloud platform that makes it easy to deploy Node.js applications.

### Prerequisites
- A [Heroku account](https://signup.heroku.com/).
- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed (optional but recommended).

### Steps
1. **GitHub Link**: Push your bot code to a private GitHub repository.
2. **Create App**: Go to the Heroku Dashboard and create a new app — or use the included `app.json` for a one-click "Deploy to Heroku" button (update the `repository` field in `app.json` to point at your repo first).
3. **Connect GitHub**: In the "Deploy" tab, connect your GitHub repository.
4. **Config Vars**: Go to the "Settings" tab and click "Reveal Config Vars". Add all variables listed in `.env.example` (at minimum: `OWNER_1`, `SESSION_ID`).
5. **Deploy**: Go back to the "Deploy" tab and click "Deploy Branch".
6. **Worker**: (Important) Once deployed, go to the "Resources" tab and ensure the `web` dyno is turned ON.

---

## 🌐 Render <a name="render"></a>

1. Create a new **Web Service** on [Render](https://render.com), pointed at your repo.
2. Build command: `npm install`. Start command: `npm start` (or `node index.js`).
3. Add your environment variables (same list as `.env.example`) under the service's **Environment** tab.
4. Render's free tier also wipes disk on redeploy — see the ephemeral storage note above.

*Note: this is separate from the pairing site (`vorte-pro-pairing.onrender.com`), which is its own Render deployment and isn't affected by anything here.*

---

## ⚡ Katabump <a name="katabump"></a>

Katabump is a specialized hosting service for Discord and WhatsApp bots.

### Steps
1. **Register**: Sign up at [Katabump](https://katabump.com/).
2. **Create Server**: Create a new Node.js (or Docker) server.
3. **Upload Files**: You can either link your GitHub or upload your files as a ZIP (excluding `node_modules`).
4. **Environment Variables**: Add your `.env` variables in the Katabump panel.
5. **Start**: The platform will automatically run `npm install` and `npm start`.

---

## 🖥️ VPS (Ubuntu/Linux) <a name="vps"></a>

For users who want full control and better performance.

### Prerequisites
- A VPS running Ubuntu 20.04+ (DigitalOcean, AWS, Google Cloud, etc.).
- [Node.js](https://nodejs.org/) installed.
- [PM2](https://pm2.keymetrics.io/) installed.

### Steps
1. **Connect**: SSH into your VPS.
2. **Clone**: 
   ```bash
   git clone https://github.com/your-username/VORTE-PRO.git
   cd VORTE-PRO
   ```
3. **Install**:
   ```bash
   npm install
   ```
4. **Configure**:
   ```bash
   cp .env.example .env
   nano .env # Fill in your details
   ```
5. **Run with PM2**:
   ```bash
   pm2 start index.js --name "vorte-pro"
   pm2 save
   pm2 startup
   ```
6. **Monitor**:
   ```bash
   pm2 logs vorte-pro
   ```

---

*Need help? Contact the developers or check the [GitHub Issues](https://github.com/your-username/VORTE-PRO/issues).*

