// src/utils/sudoStore.js
// Persisted list of "sudo" (trusted secondary) users, kept in its own local
// file so helpers.isOwner() can consult it without needing the settings object.
const fs = require("fs");
const path = require("path");

const SUDO_FILE = path.join(__dirname, "../../storage/sudo.json");

function ensureFile() {
  const dir = path.dirname(SUDO_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(SUDO_FILE)) fs.writeFileSync(SUDO_FILE, JSON.stringify([]));
}

function list() {
  ensureFile();
  try {
    const data = JSON.parse(fs.readFileSync(SUDO_FILE, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function add(number) {
  const current = list();
  if (!current.includes(number)) {
    current.push(number);
    fs.writeFileSync(SUDO_FILE, JSON.stringify(current, null, 2));
    return true;
  }
  return false;
}

function remove(number) {
  const current = list();
  const next = current.filter(n => n !== number);
  fs.writeFileSync(SUDO_FILE, JSON.stringify(next, null, 2));
  return next.length !== current.length;
}

module.exports = { list, add, remove };
