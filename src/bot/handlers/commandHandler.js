// src/bot/handlers/commandHandler.js
const fs = require('fs');
const path = require('path');
const config = require('../../config/config');
const helpers = require('../../utils/helpers');

class CommandHandler {
  constructor() {
    this.commands = new Map();
    this.loadCommands();
  }

  loadCommands() {
    const commandsDir = path.join(__dirname, '../../commands');
    if (!fs.existsSync(commandsDir)) return;

    const files = fs.readdirSync(commandsDir);
    for (const file of files) {
      if (file.endsWith('.js')) {
        try {
          const command = require(path.join(commandsDir, file));
          if (command.name) {
            this.commands.set(command.name, command);
            if (command.aliases && Array.isArray(command.aliases)) {
              command.aliases.forEach(alias => this.commands.set(alias, command));
            }
          }
        } catch (err) {
          // A single broken command file must never prevent the rest of the
          // bot from loading — report it and keep going.
          console.error(`❌ Failed to load command file "${file}":`, err.message);
        }
      }
    }
    console.log(`✅ Loaded ${this.commands.size} commands (including aliases)`);
  }

  getCommandCount() {
    return this.commands.size;
  }

  async handle(sock, m, body, getSettings, saveSettings) {
    const settingsSnapshot = getSettings?.() || {};
    const customPrefix = settingsSnapshot.global?.customPrefix;
    const matchedPrefix = helpers.matchPrefix(body, customPrefix ? [customPrefix] : []);
    if (!matchedPrefix) return;

    const args = body.slice(matchedPrefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();
    if (!commandName) return;
    const command = this.commands.get(commandName);

    if (command) {
      // Runtime info commands may need (like the total command count) is
      // injected here via context, rather than a command file require()ing
      // commandHandler itself — that created a circular dependency.
      const context = {
        commandCount: this.commands.size,
        prefix: matchedPrefix,
        botName: config.botName
      };
      try {
        await command.execute(sock, m, args, getSettings, saveSettings, context);
      } catch (error) {
        console.error(`❌ Error executing command "${commandName}":`, error);
        try {
          await sock.sendMessage(m.key.remoteJid, { text: '❌ An error occurred while executing this command.' });
        } catch (sendErr) {
          console.error('❌ Additionally failed to send the error message:', sendErr.message);
        }
      }
    }
  }
}

module.exports = new CommandHandler();
