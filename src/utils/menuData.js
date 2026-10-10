// src/utils/menuData.js
// THE single source for the menu layout. Each entry: { c: command-or-alias-name, u: usage hint, a: [aliases worth showing] }.
// Rules (enforced by tests/menu.e2e.js against the real command registry):
//   - every `c` must resolve to a real command (no phantom entries)
//   - a name appears once in the whole menu (no duplicates across categories)
//   - every command appears via at least one of its names
// Permission badges (👑 owner · 👮 group admin · 👥 group only) are derived from each command's own
// scope metadata, so the menu can never disagree with what the bot actually enforces.
const CATEGORIES = [
  { title: "👥 GROUP", items: [
    { c: "tagall", u: "[msg]", a: ["everyone"] }, { c: "tagadmins", u: "[msg]" }, { c: "hidetag", u: "<msg>" },
    { c: "listadmins", a: ["admins"] }, { c: "ginfo", a: ["groupinfo"] }, { c: "gclink", a: ["link"] }, { c: "revoke", a: ["resetlink"] },
    { c: "add", u: "<number>" }, { c: "kick", u: "@user" }, { c: "kickall" }, { c: "promote", u: "@user" }, { c: "demote", u: "@user" },
    { c: "mute", u: "@user <min>" }, { c: "unmute", u: "@user" }, { c: "warn", u: "@user" }, { c: "delete", u: "(reply)", a: ["del"] },
    { c: "close" }, { c: "open" }, { c: "setgroupname", u: "<name>", a: ["updategname"] }, { c: "updategdesc", u: "<text>", a: ["setgdesc"] }, { c: "delppgroup" },
    { c: "poll", u: "q|opt1|opt2" }, { c: "requests", u: "(accept/reject <n>, acceptall, rejectall)", a: ["accept", "reject", "acceptall", "rejectall"] },
    { c: "welcome", u: "on/off" }, { c: "goodbye", u: "on/off" }, { c: "setwelcome", u: "<text>" }, { c: "setgoodbye", u: "<text>" }, { c: "leave" }
  ] },
  { title: "🛡️ DEFENSE", items: [
    { c: "antilink", u: "on/off/warn/delete/remove" }, { c: "antispam", u: "on/off/warn/delete/remove" },
    { c: "antimention", u: "on/off/warn/delete/remove" }, { c: "antibug", u: "on/off/warn/delete/remove" },
    { c: "antibot", u: "on/off/warn/delete/remove · add/unflag/list <n> · .botlist · .kickbot · .antibothelp", a: ["botlist", "kickbot", "antibothelp"] },
    { c: "antiedit", u: "on/off" }, { c: "antidelete", u: "on/off  (recovered msgs go to owner inbox)" },
    { c: "anticall", u: "on/off" }, { c: "anticallmsg", u: "<text>" },
    { c: "blacklist", u: "add/remove/list", a: ["ban", "unban", "banlist"] }, { c: "safemode", u: "on/off" }
  ] },
  { title: "🤖 AUTOMATION", items: [
    { c: "autotyping", u: "on/off/private/groups/both" }, { c: "autorecording", u: "on/off/private/groups/both" },
    { c: "autoread", u: "on/off/private/groups/both" }, { c: "autoreact", u: "on/off/private/groups/both" }, { c: "reactemojis", u: "😂,🔥" },
    { c: "autostatusview", u: "on/off" }, { c: "autoreacttostatus", u: "on/off" }, { c: "setstatusreact", u: "😍,🔥" }, { c: "online", u: "on/off", a: ["setonline"] }
  ] },
  { title: "🧠 AI", items: [{ c: "gpt", u: "<question>", a: ["ai", "ask", "claude", "deepseek"] }] },
  { title: "🎨 IMAGE AI", items: [
    { c: "image", u: "<prompt>", a: ["imagine"] },
    { c: "1917style" }, { c: "advancedglow" }, { c: "cartoonstyle" }, { c: "luxurygold" }, { c: "matrix" }, { c: "sand" }, { c: "papercutstyle" }
  ] },
  { title: "📥 DOWNLOADS", items: [
    { c: "song", u: "<name>", a: ["play", "music"] }, { c: "yt", u: "<url or search>", a: ["youtube", "video"] }, { c: "ytmp3", u: "<url>" },
    { c: "tiktok", u: "<link>", a: ["tt"] }, { c: "instagram", u: "<link>", a: ["ig"] },
    { c: "tiktokstatus", u: "(check official API config)" }, { c: "igstatus", u: "(check official API config)" }
  ] },
  { title: "🔍 INFO & SEARCH", items: [
    { c: "search", u: "<query>", a: ["ddg"] }, { c: "wiki", u: "<topic>", a: ["wikipedia"] }, { c: "define", u: "<word>", a: ["dictionary"] },
    { c: "weather", u: "<city>" }, { c: "translate", u: "<lang> <text>", a: ["tr"] }, { c: "imdb", u: "<title>", a: ["movie", "tmdb"] },
    { c: "randommovie", a: ["randomtv"] }, { c: "shorten", u: "<url>", a: ["short"] }, { c: "getbio", u: "@user" }, { c: "userid", a: ["id"] }
  ] },
  { title: "🛠️ TOOLS", items: [
    { c: "sticker", u: "(reply to image/video)", a: ["s"] }, { c: "qr", u: "<text>" }, { c: "vv", u: "(reply to view-once)" }, { c: "toviewonce" },
    { c: "math", u: "<expr>" }, { c: "echo" }, { c: "say" }, { c: "reverse" }, { c: "countchars" }, { c: "timer" }, { c: "upper" }, { c: "lower" }, { c: "password" }, { c: "pick" }
  ] },
  { title: "😂 FUN", items: [
    { c: "joke" }, { c: "quote" }, { c: "truth" }, { c: "dare" }, { c: "dice" }, { c: "coin" }, { c: "guess" }, { c: "hack" },
    { c: "8ball", u: "<question>" }, { c: "rps" }, { c: "ship", u: "@a @b" }, { c: "wyr", a: ["wouldyourather"] }, { c: "meme" }, { c: "fact" }
  ] },
  { title: "🎮 GAMES", items: [
    { c: "tictactoe", u: "@user", a: ["ttt"] }, { c: "tttmove" }, { c: "hangmanstart" }, { c: "hangmanguess" }, { c: "quizstart" }, { c: "quizanswer" }
  ] },
  { title: "🎭 RPG", items: [{ c: "rpg", u: "(work/hunt/heal/inventory)" }] },
  { title: "🤖 BOT", items: [
    { c: "menu", a: ["help"] }, { c: "ping" }, { c: "ping2" }, { c: "ping3" }, { c: "runtime", a: ["uptime"] }, { c: "stats" }, { c: "status" }, { c: "system" },
    { c: "owner" }, { c: "ownernumber" }, { c: "channel" }
  ] },
  { title: "⚙️ SETTINGS", items: [
    { c: "settings" }, { c: "mode", u: "public/self" }, { c: "prefix", u: "<symbol>" }, { c: "setmenu1", u: "(1-4: .setmenu1 .setmenu2 .setmenu3 .setmenu4)", a: ["setmenu2", "setmenu3", "setmenu4"] },
    { c: "setmenudisplay", u: "(reply to image/video)" }, { c: "setbotnameto", u: "<name>" }, { c: "setnamebot", u: "<name>", a: ["botname", "setname"] },
    { c: "setbio", u: "<text>", a: ["updatebio", "description"] }, { c: "botdp", u: "(reply to image)" }, { c: "ownername", u: "<name>" },
    { c: "getprivacy", a: ["privacy"] }, { c: "groupsprivacy", u: "all/contacts" }, { c: "blocklist" }
  ] },
  { title: "👑 OWNER", items: [
    { c: "sudo", a: ["eval"] }, { c: "addsudo", u: "<number>" }, { c: "delsudo", u: "<number>" }, { c: "listsudo" },
    { c: "update" }, { c: "restart" }, { c: "broadcast", u: "<msg>" }, { c: "join", u: "<invite link>" }, { c: "newgc", u: "<name> @users", a: ["creategroup"] },
    { c: "tostatusgroup", u: "[color] <text> | attach/reply media", a: ["togroupstatus"] },
    { c: "dltest", u: "[link]  (why a download fails)", a: ["ytdebug"] }
  ] }
];

module.exports = { CATEGORIES };
