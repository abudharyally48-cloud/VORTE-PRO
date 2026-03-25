# 🚀 VORTE-PRO Deployment Guide

This guide will walk you through the process of deploying your VORTE-PRO WhatsApp bot to various platforms.

---

## 💜 Heroku <a name="heroku"></a>

Heroku is a popular cloud platform that makes it easy to deploy Node.js applications.

### Prerequisites
- A [Heroku account](https://signup.heroku.com/).
- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed (optional but recommended).

### Steps
1. **GitHub Link**: Push your bot code to a private GitHub repository.
2. **Create App**: Go to the Heroku Dashboard and create a new app.
3. **Connect GitHub**: In the "Deploy" tab, connect your GitHub repository.
4. **Config Vars**: Go to the "Settings" tab and click "Reveal Config Vars". Add all variables from your `.env` file (e.g., `SESSION_ID`, `PREFIX`, `OWNER_NUMBER`).
5. **Deploy**: Go back to the "Deploy" tab and click "Deploy Branch".
6. **Worker**: (Important) Once deployed, go to the "Resources" tab and ensure the `web` dyno is turned ON.

---

## ⚡ Katabump <a name="katabump"></a>

Katabump is a specialized hosting service for Discord and WhatsApp bots.

### Steps
1. **Register**: Sign up at [Katabump](https://katabump.com/).
2. **Create Server**: Create a new Node.js server.
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
