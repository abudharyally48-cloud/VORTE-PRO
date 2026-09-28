// src/bot/events/groupHandler.js
const helpers = require("../../utils/helpers");

function applyTemplate(template, user, groupName) {
  return template
    .replace(/\{user\}/g, `@${user.split("@")[0]}`)
    .replace(/\{group\}/g, groupName);
}

async function handleGroupUpdate(sock, update, getSettings) {
  try {
    const { id, action } = update;
    // Newer Baileys can report participants as objects; accept both shapes.
    const participants = (update.participants || []).map(p => (typeof p === "string" ? p : (p.id || p.jid))).filter(Boolean);
    const settings = getSettings();
    const chatSetting = settings[id] || {};
    // Anti-bot: remove flagged bot numbers the moment they join
    if (action === "add" && chatSetting.antibot && (chatSetting.knownBots || []).length) {
      const flagged = participants.filter(p => chatSetting.knownBots.includes(helpers.normalizeJid(p)));
      if (flagged.length && (await helpers.isBotAdmin(sock, id))) {
        try {
          await sock.groupParticipantsUpdate(id, flagged, "remove");
          await sock.sendMessage(id, { text: `🤖 Removed ${flagged.length} flagged bot(s).` });
        } catch (e) { console.error('❌ antibot join-removal failed:', e.message); }
      }
    }

    if (!chatSetting.welcome && !chatSetting.goodbye) return;

    const metadata = await sock.groupMetadata(id);
    const groupName = metadata.subject;

    for (let user of participants) {
      let pp;
      try {
        pp = await sock.profilePictureUrl(user, "image");
      } catch {
        pp = "https://i.imgur.com/JP1gK9C.png";
      }

      if (action === "add" && chatSetting.welcome) {
        const rules = `
📜 *GROUP RULES*
1️⃣ Respect everyone
2️⃣ No spam
3️⃣ No links
4️⃣ No adult content
5️⃣ Follow admins
`;
        const caption = chatSetting.welcomeMessage
          ? applyTemplate(chatSetting.welcomeMessage, user, groupName)
          : `┏▣ ◈ WELCOME ◈\n┃ 👋 Welcome @${user.split("@")[0]}\n┃ 📌 Group: ${groupName}\n┗▣\n\n${rules}`;

        await sock.sendMessage(id, {
          image: { url: pp },
          caption,
          mentions: [user],
        });
      }

      if (action === "remove" && chatSetting.goodbye) {
        const text = chatSetting.goodbyeMessage
          ? applyTemplate(chatSetting.goodbyeMessage, user, groupName)
          : `┏▣ ◈ GOODBYE ◈\n┃ 😢 @${user.split("@")[0]} left the group\n┃ 👋 Farewell!\n┗▣`;

        await sock.sendMessage(id, {
          text,
          mentions: [user],
        });
      }
    }
  } catch (err) {
    console.error("Welcome system error:", err);
  }
}

module.exports = { handleGroupUpdate };
