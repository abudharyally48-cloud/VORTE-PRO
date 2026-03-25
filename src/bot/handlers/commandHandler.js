// src/bot/handlers/commandHandler.js
const fs = require('fs');
const path = require('path');
const config = require('../../config/config');

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
        const command = require(path.join(commandsDir, file));
        if (command.name) {
          this.commands.set(command.name, command);
          if (command.aliases && Array.isArray(command.aliases)) {
            command.aliases.forEach(alias => this.commands.set(alias, command));
          }
        }
      }
    }
    console.log(`✅ Loaded ${this.commands.size} commands (including aliases)`);
  }

  async handle(sock, m, body, getSettings, saveSettings) {
    if (!body.startsWith(config.prefix)) return;

    const args = body.slice(config.prefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();
    const command = this.commands.get(commandName);

    if (command) {
      try {
        await command.execute(sock, m, args, getSettings, saveSettings);
      } catch (error) {
        console.error(`❌ Error executing command ${commandName}:`, error);
        await sock.sendMessage(m.key.remoteJid, { text: '❌ An error occurred while executing this command.' });
      }
    }
  }
}

module.exports = new CommandHandler();
