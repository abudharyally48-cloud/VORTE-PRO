// src/utils/settingsMigrate.js — one-time, idempotent upgrade of stored settings to the scoped formats.
//  - autotyping/autorecording/autoread/autoreact: per-chat booleans -> settings.global.automation[key] {enabled, scope}
//  - antidelete: per-chat boolean -> settings.global.antidelete {enabled}  (recovered messages now go to the owner inbox)
const automation = require("./automation");

function migrate(settings) {
  if (!settings || typeof settings !== "object") return false;
  let changed = automation.migrate(settings);

  const legacyChats = Object.entries(settings).filter(([jid, s]) => jid !== "global" && s && typeof s === "object" && "antidelete" in s);
  if (legacyChats.length) {
    if (settings.global?.antidelete === undefined && legacyChats.some(([, s]) => s.antidelete === true)) {
      settings.global = settings.global || {};
      settings.global.antidelete = { enabled: true };
    }
    for (const [, s] of legacyChats) delete s.antidelete;
    changed = true;
  }
  return changed;
}

module.exports = { migrate };
