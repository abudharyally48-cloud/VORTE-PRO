// src/bot/events/callHandler.js
async function handleCall(sock, calls, getSettings) {
  const settings = getSettings();
  if (!settings.global?.anticall) return;

  for (const call of calls) {
    if (call.status !== "offer") continue;
    try {
      await sock.rejectCall(call.id, call.from);
      const message = settings.global.anticallMessage || "🚫 Calls are not accepted by this bot. Please send a text message instead.";
      await sock.sendMessage(call.from, { text: message });
    } catch (err) {
      console.error("❌ anticall error:", err.message);
    }
  }
}

module.exports = { handleCall };
