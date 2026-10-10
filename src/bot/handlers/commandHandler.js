// src/bot/handlers/commandHandler.js
const fs = require('fs');
const path = require('path');
const config = require('../../config/config');
const helpers = require('../../utils/helpers');
const access = require('../../utils/access');
const prefixLib = require('../../utils/prefix');

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

  /** Every command name and alias (used to show the real prefix in replies). */
  names() {
    if (!this._names || this._names.size !== this.commands.size) this._names = new Set(this.commands.keys());
    return this._names;
  }

  getCommandCount() {
    return this.commands.size;
  }

  /** Number of distinct commands (aliases not counted). */
  getPrimaryCount() {
    return new Set(this.commands.values()).size;
  }

  async handle(sock, m, body, getSettings, saveSettings) {
    const settingsSnapshot = getSettings?.() || {};
    const hit = prefixLib.match(body, settingsSnapshot);
    if (!hit) return;

    const args = hit.rest.trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();
    if (!commandName) return;
    const command = this.commands.get(commandName);

    if (command) {
      // Commands are written against "."; whatever prefix was typed, they get a "."-form copy of the message,
      // and everything they send shows the REAL prefix (see utils/prefix.js).
      const shown = prefixLib.display(settingsSnapshot);
      if (hit.prefix !== ".") m = prefixLib.canonicalMessage(m, hit.rest);
      sock = prefixLib.withDisplayPrefix(sock, shown, this.names());
      // Runtime info commands may need (like the total command count) is
      // injected here via context, rather than a command file require()ing
      // commandHandler itself — that created a circular dependency.
      const context = {
        commandCount: this.commands.size,
        primaryCount: this.getPrimaryCount(),
        registry: this.commands,
        prefix: shown,
        commandName,
        botName: config.botName
      };
      try {
        // Scope / permission gate (PRIVATE | GROUP | BOTH | OWNER, admin, bot-admin).
        // A wrong-context or unauthorised call always gets a clear reply — never silence.
        const verdict = await access.check(sock, m, command, commandName, args);
        if (!verdict.ok) {
          await sock.sendMessage(m.key.remoteJid, { text: verdict.message });
          return;
        }
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
