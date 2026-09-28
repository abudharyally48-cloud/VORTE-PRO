// src/services/rpgService.js
const fs = require("fs");
const path = require("path");

const RPG_FILE = path.join(__dirname, "../../storage/rpg.json");

function ensureFile() {
  const dir = path.dirname(RPG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(RPG_FILE)) fs.writeFileSync(RPG_FILE, JSON.stringify({}));
}

function readAll() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(RPG_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeAll(data) {
  ensureFile();
  fs.writeFileSync(RPG_FILE, JSON.stringify(data, null, 2));
}

function xpForNextLevel(level) {
  return level * 100;
}

function defaultCharacter() {
  return { level: 1, xp: 0, hp: 100, maxHp: 100, coins: 50, inventory: [], lastAction: 0 };
}

/**
 * Get (and lazily create) a user's RPG character.
 * @param {string} userId - normalized user identifier
 */
function getCharacter(userId) {
  const all = readAll();
  if (!all[userId]) {
    all[userId] = defaultCharacter();
    writeAll(all);
  }
  return all[userId];
}

/**
 * Save a user's RPG character.
 * @param {string} userId
 * @param {object} character
 */
function saveCharacter(userId, character) {
  const all = readAll();
  all[userId] = character;
  writeAll(all);
}

/**
 * Add XP to a character, handling level-ups. Mutates and returns the character.
 */
function addXp(character, amount) {
  character.xp += amount;
  const leveledUp = [];
  while (character.xp >= xpForNextLevel(character.level)) {
    character.xp -= xpForNextLevel(character.level);
    character.level += 1;
    character.maxHp += 10;
    character.hp = character.maxHp;
    leveledUp.push(character.level);
  }
  return leveledUp;
}

module.exports = { getCharacter, saveCharacter, addXp, xpForNextLevel };
