// src/utils/ui.js
// One place for the wording/format of replies so every command feels the same.

const MSG = {
  groupOnly: "⚠️ This command can only be used in a group.",
  privateOnly: "⚠️ This command can only be used in private chat.",
  ownerOnly: "🚫 Only the bot owner can use this command.",
  adminOnly: "🚫 Only group admins or the bot owner can use this command.",
  noPermission: "🚫 You don't have permission to use this command.",
  botNotAdmin: "⚠️ I need to be a group admin to perform this action.",
  failed: "❌ Operation failed.",
  done: "✅ Completed successfully."
};

/** "🛡️ ANTILINK\n\nStatus: ✅ ON\nAction: ⚠️ WARN" */
function panel(title, rows = []) {
  const body = rows.filter((r) => r !== null && r !== undefined && r !== false).join("\n");
  return body ? `${title}\n\n${body}` : title;
}

const onOff = (v) => (v ? "✅ ON" : "❌ OFF");

/**
 * A single status message that is edited as work progresses (instead of 5 separate
 * messages). Falls back to a new message if WhatsApp refuses the edit.
 *   const s = await status(sock, chat, "🔎 Searching...", { quoted: m });
 *   await s.update("📥 Fetching media...");
 *   await s.finish("✅ Ready!");
 */
async function status(sock, chat, text, opts = {}) {
  let sent = null;
  try { sent = await sock.sendMessage(chat, { text }, opts.quoted ? { quoted: opts.quoted } : undefined); } catch { /* ignore */ }
  const edit = async (t) => {
    if (sent?.key) {
      try { await sock.sendMessage(chat, { text: t, edit: sent.key }); return; } catch { /* fall through */ }
    }
    try { sent = await sock.sendMessage(chat, { text: t }); } catch { /* ignore */ }
  };
  return { update: edit, finish: edit, fail: edit, key: sent?.key || null };
}

module.exports = { MSG, panel, onOff, status };
