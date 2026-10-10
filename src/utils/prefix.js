// src/utils/prefix.js — THE prefix system (parser, matcher, display). Nothing else decides what a prefix is.
//
// Same rule as Queen Anita v4 (`PREFIX` setting):
//   .        one prefix
//   .!*      several prefixes: each character works on its own
//   all      any symbol works, and so does no prefix at all
// Default: "." only. Set it with the PREFIX environment variable, or at runtime with `.prefix <value>`
// (owner only; saved in settings.global.prefix; `.prefix reset` returns to PREFIX / ".").
const config = require("../config/config");

const DEFAULT_SPEC = ".";
const MAX_CHARS = 10;
// letters and digits can't be prefixes (they would swallow normal words); whitespace never can
const isPrefixChar = (c) => !!c && !/[\p{L}\p{N}\s]/u.test(c);
const isSymbolStart = (c) => isPrefixChar(c);

/**
 * Parse "all" | "." | ".!*" | ". ! *" into a normalized spec.
 * @returns {{all:boolean, chars:string[], error?:string}}
 */
function parse(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return { all: false, chars: [DEFAULT_SPEC] };
  if (raw.toLowerCase() === "all") return { all: true, chars: [] };
  const chars = [...new Set([...raw.replace(/\s+/g, "")])];
  const bad = chars.find((c) => !isPrefixChar(c));
  if (bad) return { all: false, chars: [DEFAULT_SPEC], error: `"${bad}" can't be used as a prefix (use symbols like . ! ? # $ * / , not letters or digits).` };
  if (chars.length > MAX_CHARS) return { all: false, chars: [DEFAULT_SPEC], error: `At most ${MAX_CHARS} prefix characters.` };
  return { all: false, chars };
}

/** The effective spec string: runtime override > legacy extra prefix on top of PREFIX > PREFIX > ".". */
function specString(settings) {
  const g = settings?.global || {};
  if (typeof g.prefix === "string" && g.prefix.trim()) return g.prefix;
  const env = config.prefixSpec || DEFAULT_SPEC;
  if (g.customPrefix && String(env).toLowerCase() !== "all") return env + g.customPrefix; // older `.prefix <symbol>` kept working
  return env;
}

/** @returns {{all:boolean, chars:string[]}} */
function current(settings) {
  const p = parse(specString(settings));
  return p.error ? { all: false, chars: [DEFAULT_SPEC] } : p;
}

/** The character shown in menus and usage messages. */
function display(settings) {
  const c = current(settings);
  return c.all ? "." : c.chars[0];
}

/** "." or ". (also works: ! *)" or "all (any symbol, or none)". */
function headline(settings) {
  const c = current(settings);
  if (c.all) return "all (any symbol, or none)";
  return c.chars.length > 1 ? `${c.chars[0]}  (also works: ${c.chars.slice(1).join(" ")})` : c.chars[0];
}

/**
 * Does `body` start with a command prefix?
 * @returns {{prefix:string, rest:string, loose:boolean}|null}
 *   rest  = everything after the prefix ("ping hello")
 *   loose = true in "all" mode: the first word must be a real command before anything happens
 */
function match(body, settings) {
  const text = String(body ?? "");
  if (!text || /^\s/.test(text)) return null;
  // safety hatch: whatever the prefix is, the owner can always undo it with ".prefix reset"
  if (/^\.prefix\s+reset\s*$/i.test(text)) return { prefix: ".", rest: text.slice(1), loose: false };
  const c = current(settings);
  if (c.all) {
    const first = [...text][0];
    return isSymbolStart(first) ? { prefix: first, rest: text.slice(first.length), loose: true } : { prefix: "", rest: text, loose: true };
  }
  const hit = c.chars.find((p) => text.startsWith(p));
  return hit ? { prefix: hit, rest: text.slice(hit.length), loose: false } : null;
}

/** Commands are written against ".": give them a copy of the message whose text starts with "." */
function canonicalMessage(m, rest) {
  const text = "." + rest;
  const msg = m.message || {};
  const out = { ...msg };
  if (msg.conversation !== undefined) out.conversation = text;
  else if (msg.extendedTextMessage?.text !== undefined) out.extendedTextMessage = { ...msg.extendedTextMessage, text };
  else if (msg.imageMessage?.caption !== undefined) out.imageMessage = { ...msg.imageMessage, caption: text };
  else if (msg.videoMessage?.caption !== undefined) out.videoMessage = { ...msg.videoMessage, caption: text };
  else out.conversation = text;
  return { ...m, message: out };
}

// ---- show the REAL prefix in every reply that mentions a command -----------------------------
const rewriters = new WeakMap();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function rewriterFor(names) {
  let re = rewriters.get(names);
  if (!re) {
    const alt = [...names].sort((a, b) => b.length - a.length).map(esc).join("|");
    re = new RegExp("(^|[\\s\"'`(\\[*_~>])\\.(" + alt + ")(?![A-Za-z0-9_])", "g");
    rewriters.set(names, re);
  }
  return re;
}
/** ".kick @user" -> "!kick @user" — only real command names, so "www.example.com" or "e.g." are never touched. */
function rewriteText(text, shownPrefix, names) {
  if (typeof text !== "string" || shownPrefix === "." || !text.includes(".")) return text;
  return text.replace(rewriterFor(names), (_, lead, name) => lead + shownPrefix + name);
}
/** A view of `sock` whose messages show `shownPrefix`; the real socket is untouched. */
function withDisplayPrefix(sock, shownPrefix, names) {
  if (shownPrefix === ".") return sock;
  const view = Object.create(sock);
  view.sendMessage = (jid, content, opts) => {
    if (content && typeof content === "object") {
      const c = { ...content };
      if (typeof c.text === "string") c.text = rewriteText(c.text, shownPrefix, names);
      if (typeof c.caption === "string") c.caption = rewriteText(c.caption, shownPrefix, names);
      return sock.sendMessage(jid, c, opts);
    }
    return sock.sendMessage(jid, content, opts);
  };
  return view;
}

module.exports = { parse, current, specString, display, headline, match, canonicalMessage, rewriteText, withDisplayPrefix, DEFAULT_SPEC, MAX_CHARS };
