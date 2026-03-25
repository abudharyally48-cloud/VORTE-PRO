// src/bot/events/groupHandler.js
const helpers = require("../../utils/helpers");

async function handleGroupUpdate(sock, update, getSettings) {
  try {
    const { id, participants, action } = update;
    const settings = getSettings();
    if (!settings[id] || settings[id].welcome !== true) return;

    const metadata = await sock.groupMetadata(id);
    const groupName = metadata.subject;

    for (let user of participants) {
      let pp;
      try {
        pp = await sock.profilePictureUrl(user, "image");
      } catch {
        pp = "https://i.imgur.com/JP1gK9C.png";
      }

      if (action === "add") {
        const rules = `
📜 *GROUP RULES*
1️⃣ Respect everyone
2️⃣ No spam
3️⃣ No links
4️⃣ No adult content
5️⃣ Follow admins
`;
        await sock.sendMessage(id, {
          image: { url: pp },
          caption: `┏▣ ◈ WELCOME ◈\n┃ 👋 Welcome @${user.split("@")[0]}\n┃ 📌 Group: ${groupName}\n┗▣\n\n${rules}`,
          mentions: [user],
        });
      }

      if (action === "remove") {
        await sock.sendMessage(id, {
          text: `┏▣ ◈ GOODBYE ◈\n┃ 😢 @${user.split("@")[0]} left the group\n┃ 👋 Farewell!\n┗▣`,
          mentions: [user],
        });
      }
    }
  } catch (err) {
    console.error("Welcome system error:", err);
  }
}

module.exports = { handleGroupUpdate };
