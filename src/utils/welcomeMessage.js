// src/utils/welcomeMessage.js — builds the welcome text for new members.
// The info block is the group's REAL description; if the group has none, it falls back to the
// rules below (the default rules that live in the bot code).
const DEFAULT_RULES_LINES = ["1️⃣ Respect everyone", "2️⃣ No spam", "3️⃣ No links", "4️⃣ No adult content", "5️⃣ Follow admins"];
const DEFAULT_RULES = `📜 *GROUP RULES*\n${DEFAULT_RULES_LINES.join("\n")}`;
const CAPTION_LIMIT = 1000; // WhatsApp image captions are capped (~1024)

const clean = (d) => String(d || "").replace(/\r\n/g, "\n").trim();
const mentionOf = (jid) => `@${String(jid).split("@")[0].split(":")[0]}`;

/** Block shown under the welcome header. */
function infoBlock(description) {
  const d = clean(description);
  return d ? `📜 *GROUP DESCRIPTION*\n${d}` : DEFAULT_RULES;
}

/**
 * @param {{user:string, groupName:string, description?:string, template?:string}} o
 * @returns {{caption:string, followUp:string|null, usedDescription:boolean}}
 *   caption  — goes under the profile picture
 *   followUp — extra text message when the full text would not fit in a caption
 */
function buildWelcome({ user, groupName, description, template }) {
  const d = clean(description);
  const info = infoBlock(d);

  if (template) {
    // custom .setwelcome text: {user} {group}; {desc}/{description} = real description, else the default rules
    const text = template
      .replace(/\{user\}/g, mentionOf(user))
      .replace(/\{group\}/g, groupName)
      .replace(/\{desc(?:ription)?\}/gi, d || DEFAULT_RULES_LINES.join("\n"));
    return text.length > CAPTION_LIMIT ? { caption: "", followUp: text, usedDescription: !!d } : { caption: text, followUp: null, usedDescription: !!d };
  }

  const header = `┏▣ ◈ WELCOME ◈\n┃ 👋 Welcome ${mentionOf(user)}\n┃ 📌 Group: ${groupName}\n┗▣`;
  const whole = `${header}\n\n${info}`;
  if (whole.length <= CAPTION_LIMIT) return { caption: whole, followUp: null, usedDescription: !!d };
  return { caption: header, followUp: info, usedDescription: !!d }; // long description: header on the picture, full text right after
}

module.exports = { buildWelcome, infoBlock, DEFAULT_RULES, DEFAULT_RULES_LINES, CAPTION_LIMIT };
