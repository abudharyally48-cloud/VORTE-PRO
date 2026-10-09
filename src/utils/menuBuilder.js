// src/utils/menuBuilder.js — renders menuData against the live command registry.
const { CATEGORIES } = require("./menuData");
const access = require("./access");

/** Badge from the command's real requirements (write access for multi-purpose setting keys). */
function badge(command, name) {
  let r;
  try { r = access.requirementsFor(command, name, ["on"]); } catch { return ""; }
  if (r.owner || r.scope === "OWNER") return " 👑";
  if (r.scope === "GROUP" && r.admin) return " 👮";
  if (r.scope === "GROUP") return " 👥";
  return "";
}

/**
 * @param {string} prefix
 * @param {Map<string, object>} registry name/alias -> command
 * @returns {string}
 */
function buildMenuBody(prefix, registry) {
  const blocks = [];
  for (const cat of CATEGORIES) {
    const lines = [];
    for (const it of cat.items) {
      const command = registry.get(it.c);
      if (!command) continue; // never show something that does not exist
      const also = it.a && it.a.length ? `  (also ${it.a.map((x) => prefix + x).join(" ")})` : "";
      lines.push(`│➽ ${prefix}${it.c}${it.u ? " " + it.u : ""}${badge(command, it.c)}${also}`);
    }
    if (lines.length) blocks.push(`┏▣ ◈ ${cat.title} ◈\n${lines.join("\n")}\n┗▣`);
  }
  return "\n" + blocks.join("\n\n") + `\n\n👑 owner only · 👮 group admin · 👥 group only\nType ${prefix} before each command!\n`;
}

module.exports = { buildMenuBody, badge, CATEGORIES };
