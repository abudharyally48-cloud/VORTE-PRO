# 🤖 VORTE PRO WhatsApp Bot

[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-green.svg)](https://nodejs.org/)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Baileys-blue.svg)](https://github.com/WhiskeySockets/Baileys)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful, modular, and professional WhatsApp bot built with Node.js and the [Baileys](https://github.com/WhiskeySockets/Baileys) library. Features advanced AI integration, group management, and automated interactions.

---

## ✨ Features

- **🧠 Advanced AI**: Integrated with OpenAI's GPT for intelligent conversations and DALL-E for image generation.
- **🛡️ Group Management**: Automated welcome messages, antilink moderation, and admin tools.
- **🎮 Fun & Games**: Tic-Tac-Toe, Hangman, Quizzes, and more.
- **📂 Modular Architecture**: Clean directory structure for high maintainability and easy command extensibility.
- **🌐 Web Dashboard**: Simple web UI for easy pairing and real-time bot status monitoring.
- **🔍 Media Services**: Integrated with YouTube and OMDb for rich media searches.

---

## 🚀 Quick Start

### 1. Prerequisites
- [Node.js](https://nodejs.org/) v20 or higher.
- A WhatsApp account to link the bot.

### 2. Installation
```bash
git clone https://github.com/your-username/VORTE-PRO.git
cd VORTE-PRO
npm install
```

### 3. Configuration
Copy the `.env.example` to `.env` and fill in your configuration:
```bash
cp .env.example .env
```
> [!TIP]
> Paste your `SESSION_ID` in the `.env` file to skip the QR code scan on every restart.

### 4. Session Management & Pairing
There are two ways to link your WhatsApp account:

#### A. Web Session Generator (Recommended for Servers)
1. Start the bot: `npm start`.
2. Open your browser to `http://localhost:3000` (or your hosted URL).
3. Enter your phone number (including country code, e.g., `255796819436`).
4. Enter the pairing code shown on the site into your WhatsApp (Linked Devices → Link with phone number).
5. Once connected, the bot will send your **Session ID** directly to your WhatsApp.
6. Copy this ID into your `.env` file as `SESSION_ID="YOUR_ID_HERE"`.

#### B. Terminal QR Code (Quick Local Setup)
If no `SESSION_ID` is provided in `.env`, the bot will automatically print a QR code in your terminal. Scan it using WhatsApp → Linked Devices → Link a Device.

### 5. Running the Bot
```bash
# Start the bot
npm start
```
> [!NOTE]
> The bot features **Live Message Tracking**. All incoming messages will be logged directly to your terminal for real-time monitoring.

---

## 🛠️ Project Structure

```text
VORTE-PRO/
├── src/
│   ├── index.js         # Entry point (bootstraps server and bot)
│   ├── config/          # Centralized configuration
│   ├── server/          # Web server & Pairing API
│   ├── bot/             # WhatsApp client & Event logic
│   ├── commands/        # Command handler files
│   ├── services/        # External API wrappers (AI, YouTube)
│   └── utils/           # Shared helper functions
├── storage/             # Session files and group settings
└── index.js             # Root bootloader
```

## 📜 Commands

The default prefix is `.`. 
- `.menu`: Displays the full list of available commands.
- `.gpt <query>`: Interacts with the integrated AI.
- `.tagall`: Tags all group members (Admin only).
- `.ping`: Checks bot latency and server status.

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.

---
*Created with ❤️ by the VORTE PRO Team.*