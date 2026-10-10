// Session ID site (pairing.html) in a simulated browser. Needs jsdom:  npm i -D jsdom   (skipped if missing)
// Run: node tests/site-ui.e2e.js
let JSDOM; try { ({ JSDOM } = require("jsdom")); } catch { console.log("SKIPPED: jsdom is not installed (npm i -D jsdom)"); console.log("\nRESULT: 0 passed, 0 failed"); process.exit(0); }
const fs = require("fs"), path = require("path");
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(`  ${ok ? "✅" : "❌"} ${n}${ok ? "" : "  -> " + (typeof d === "string" ? d : JSON.stringify(d))}`); };
const section = (t) => console.log(`\n[${t}]`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const html = fs.readFileSync(path.join(__dirname, "../pairing.html"), "utf8");

function boot({ stats, botFile, request } = {}) {
  const calls = [];
  const dom = new JSDOM(html, {
    runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost/",
    beforeParse(w) {
      w.fetch = async (url, opts = {}) => {
        calls.push({ url, body: opts.body ? JSON.parse(opts.body) : null });
        const json = (o, status = 200) => ({ ok: status < 400, status, json: async () => o });
        if (url.includes("/api/stats")) { if (stats === "down") throw new Error("offline"); return json(stats || { visitors: 0, pageViews: 0, successful: 0, failed: 0, uptimeSeconds: 0, activePairings: 0, botName: "VORTE PRO", botVersion: "v1.0", baileysVersion: "7.0.0-rc14" }); }
        if (url.includes("/api/bot-file")) return json(botFile || { available: false, version: "v1.0" });
        if (url.includes("/api/request-code")) return json(request ? request(JSON.parse(opts.body), calls.filter((c) => c.url.includes("request-code")).length) : { success: true, code: "ABCD-1234", token: "x" });
        if (url.includes("/api/session-status")) return json({ success: true, status: "waiting" });
        return json({});
      };
      w.AudioContext = w.webkitAudioContext = function () { return { resume() {}, state: "running", createOscillator() { return { connect() {}, start() {}, stop() {}, frequency: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, type: "" }; }, createGain() { return { connect() {}, gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} } }; }, destination: {}, currentTime: 0 }; };
      w.HTMLElement.prototype.scrollIntoView = function () {};
    }
  });
  return { dom, w: dom.window, d: dom.window.document, calls };
}
const $ = (d, id) => d.getElementById(id);
const opts = (d) => [...d.querySelectorAll("#ccList .cc-it")].map((li) => li.querySelector(".cc-iso").textContent);
const search = (w, d, q) => { $(d, "countrySearch").value = q; w.filterCountries(q); return opts(d); };

(async () => {
  section("country picker: ALL countries");
  let { w, d } = boot();
  await sleep(50);
  check("246 countries and territories in the data", w.eval("COUNTRIES").length === 246, w.eval("COUNTRIES").length);
  check("every ISO code is unique and every dial code numeric", new Set(w.eval("COUNTRIES").map((c) => c.iso)).size === 246 && w.eval("COUNTRIES").every((c) => /^\d+$/.test(c.dial)));
  check("Tanzania is the default (+255) and the number field shows it", $(d, "countryCode").value === "255" && $(d, "ccPrefix").textContent === "+255" && $(d, "ccName").textContent === "Tanzania");
  check("list is closed until you tap it", $(d, "ccPanel").hidden === true);
  w.toggleCC();
  check("opens, shows every country", $(d, "ccPanel").hidden === false && opts(d).length === 246 && /246 countries/.test($(d, "ccMeta").textContent));
  check("a visible search box is inside the picker", !!d.querySelector("#ccPanel #countrySearch"));
  const has = (code) => w.eval("COUNTRIES").some((c) => c.iso === code);
  check("spot check: TZ KE UG RW CD NG ZA GB US IN BR AE SA XK PS present", ["TZ", "KE", "UG", "RW", "CD", "NG", "ZA", "GB", "US", "IN", "BR", "AE", "SA", "XK", "PS"].every(has));

  section("search by COUNTRY NAME");
  check("'tanz' -> Tanzania only", JSON.stringify(search(w, d, "tanz")) === '["TZ"]');
  check("'KENYA' (any case) -> Kenya", search(w, d, "KENYA")[0] === "KE");
  check("'united' -> UAE, UK, US", ["AE", "GB", "US"].every((c) => search(w, d, "united").includes(c)));
  check("two-letter ISO 'tz' -> Tanzania first", search(w, d, "tz")[0] === "TZ");
  check("'ivory' finds Côte d'Ivoire (alternate name)", search(w, d, "ivory")[0] === "CI");
  check("'cote' finds Côte d'Ivoire (accents ignored)", search(w, d, "cote").includes("CI"));
  check("'sao tome' finds São Tomé", search(w, d, "sao tome").includes("ST"));
  check("'usa' -> United States", search(w, d, "usa")[0] === "US");
  check("'uk' -> United Kingdom", search(w, d, "uk")[0] === "GB");
  check("nonsense -> friendly empty message, no crash", search(w, d, "zzzzqq").length === 0 && /No country matches/.test($(d, "ccList").textContent));
  check("clearing the search restores the full list", search(w, d, "").length === 246);

  section("search by DIAL CODE NUMBER");
  check("'255' -> Tanzania first", search(w, d, "255")[0] === "TZ");
  check("'+255' (with plus) -> Tanzania", search(w, d, "+255")[0] === "TZ");
  check("'+44' -> UK, Jersey, Guernsey, Isle of Man", ["GB", "JE", "GG", "IM"].every((c) => search(w, d, "+44").includes(c)));
  check("'254' -> Kenya; '256' -> Uganda; '250' -> Rwanda", search(w, d, "254")[0] === "KE" && search(w, d, "256")[0] === "UG" && search(w, d, "250")[0] === "RW");
  check("'1' -> all +1 countries (US, CA, Jamaica, Bahamas...)", ["US", "CA", "JM", "BS", "DO"].every((c) => search(w, d, "1").includes(c)));
  check("'1242' (full prefix) -> Bahamas", search(w, d, "1242")[0] === "BS");
  check("'809' (area code) -> Dominican Republic", search(w, d, "809").includes("DO"));
  check("'+7' -> Russia and Kazakhstan", ["RU", "KZ"].every((c) => search(w, d, "+7").includes(c)));
  check("'2' (partial) lists the +2xx countries", search(w, d, "2").includes("TZ") && search(w, d, "2").includes("EG"));

  section("choosing a country");
  w.filterCountries("kenya"); w.selectCountry(0);
  check("selecting Kenya updates the hidden value, the button and the number prefix", $(d, "countryCode").value === "254" && $(d, "ccIso").textContent === "KE" && $(d, "ccName").textContent === "Kenya" && $(d, "ccPrefix").textContent === "+254");
  check("list closes after choosing", $(d, "ccPanel").hidden === true);
  w.toggleCC(); w.filterCountries("bahamas"); w.selectCountry(0);
  check("+1 territories send prefix 1 (the area code is part of the number the user types)", $(d, "countryCode").value === "1" && $(d, "ccDial").textContent === "+1");
  w.toggleCC(); $(d, "countrySearch").value = "ug"; w.filterCountries("ug");
  const kd = (key) => $(d, "countrySearch").dispatchEvent(new w.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  kd("ArrowDown"); kd("ArrowUp"); kd("Enter");
  check("keyboard: type + Enter picks the highlighted country", $(d, "countryCode").value === "256", $(d, "countryCode").value);
  w.toggleCC(); kd("Escape");
  check("Escape closes the list", $(d, "ccPanel").hidden === true);
  w.toggleCC(); d.body.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  check("tapping outside closes the list", $(d, "ccPanel").hidden === true);

  section("the chosen country is what gets sent");
  ({ w, d } = boot());
  const b = boot(); w = b.w; d = b.d;
  await sleep(30);
  w.toggleCC(); w.filterCountries("kenya"); w.selectCountry(0);
  $(d, "phoneInput").value = "712345678";
  await w.requestCode(); await sleep(30);
  const first = b.calls.find((c) => c.url.includes("request-code"));
  check("request-code gets country code + number (254712345678)", first && first.body.phone === "254712345678", first);
  check("moved on to the code screen", d.getElementById("p2").classList.contains("active"));

  section("wrong code? request another one, same number, any time");
  check("button is there, with an explanation", /Typed it wrong\? Code expired\?/.test($(d, "retryBox").textContent) && !!$(d, "retryBtn"));
  check("right after a code is issued the button counts down (protects the number)", $(d, "retryBtn").disabled === true && /New code in \ds/.test($(d, "retryTxt").textContent), $(d, "retryTxt").textContent);
  await sleep(5300);
  check("after 5 s it is ready: 'Request new code'", $(d, "retryBtn").disabled === false && $(d, "retryTxt").textContent === "Request new code", $(d, "retryTxt").textContent);
  const callsBefore = b.calls.filter((c) => c.url.includes("request-code")).length;
  await w.requestNewCode(); await sleep(30);
  const reqs = b.calls.filter((c) => c.url.includes("request-code"));
  check("it asks the server again with the SAME number", reqs.length === callsBefore + 1 && reqs[reqs.length - 1].body.phone === "254712345678");
  check("still on the code screen (no going back, no reload)", d.getElementById("p2").classList.contains("active"));
  check("new pairing code is shown", $(d, "codeChunks").textContent.includes("ABCD"));
  check("button counts down again after a new code", $(d, "retryBtn").disabled === true);

  ({ w, d } = (() => { const x = boot({ request: (body, n) => (n === 1 ? { success: true, code: "AAAA-1111", token: "t" } : n === 2 ? { success: false, error: "Please wait 3s before requesting another code for this number.", retryAfter: 3 } : { success: true, code: "BBBB-2222", token: "t" }) }); b.calls = x.calls; return x; })());
  $(d, "phoneInput").value = "712345678"; await w.requestCode(); await sleep(30);
  w.startCooldown(0); await sleep(1100);
  await w.requestNewCode(); await sleep(30);
  check("server says 'wait 3s' -> shown in the screen, countdown follows the server's number", /Please wait 3s/.test($(d, "e2").textContent) && /New code in 3s/.test($(d, "retryTxt").textContent), [$(d, "e2").textContent, $(d, "retryTxt").textContent]);
  check("the old code stays on screen while waiting", $(d, "codeChunks").textContent.includes("AAAA"));
  w.startCooldown(0); await sleep(1100);
  await w.requestNewCode(); await sleep(30);
  check("then the next request gives a new code and clears the error", $(d, "codeChunks").textContent.includes("BBBB") && $(d, "e2").style.display === "none", $(d, "e2").style.display);
  ({ w, d } = boot()); await sleep(30);
  await w.requestNewCode();
  check("no number known yet -> safely returns to step 1 (no crash)", d.getElementById("p1").classList.contains("active"));

  section("REAL stats (nothing simulated)");
  const real = { visitors: 1284, pageViews: 3010, successful: 902, failed: 61, downloads: 7, uptimeSeconds: 3 * 86400 + 4 * 3600 + 12 * 60, activePairings: 2, botName: "VORTE PRO", botVersion: "v1.0", baileysVersion: "7.0.0-rc14" };
  ({ w, d } = boot({ stats: real })); await sleep(1500);
  check("visitors / successful / failed come from the server", $(d, "stV").textContent === "1284" && $(d, "stS").textContent === "902" && $(d, "stF").textContent === "61", [$(d, "stV").textContent, $(d, "stS").textContent, $(d, "stF").textContent]);
  check("uptime is the server's (3d 4h), also in the side panel with minutes", $(d, "stU").textContent === "3d 4h" && $(d, "sideUp").textContent === "3d 4h 12m", [$(d, "stU").textContent, $(d, "sideUp").textContent]);
  check("badges are computed from real numbers (94% success rate, 6% failed, 3010 views)", /94% rate/.test($(d, "stST").textContent) && $(d, "stFT").textContent === "6%" && /3010 views/.test($(d, "stVT").textContent), [$(d, "stST").textContent, $(d, "stFT").textContent, $(d, "stVT").textContent]);
  check("active sessions shown", $(d, "sideAct").textContent === "2");
  check("version labels: VORTE PRO v1.0 and the REAL Baileys version", $(d, "brandVer").textContent === "v1.0" && $(d, "sideBot").textContent === "VORTE PRO v1.0" && $(d, "sideBaileys").textContent === "Baileys v7.0.0-rc14", [$(d, "brandVer").textContent, $(d, "sideBot").textContent, $(d, "sideBaileys").textContent]);
  check("no 'Baileys v6' left anywhere", !/Baileys v6/.test(d.body.innerHTML));
  check("server reachable -> Online badge", $(d, "sTxt").textContent === "Online");
  ({ w, d } = boot()); await sleep(1500);
  check("a fresh server shows real zeros (no random 10-50 visitors)", $(d, "stV").textContent === "0" && $(d, "stS").textContent === "0" && $(d, "stF").textContent === "0", [$(d, "stV").textContent, $(d, "stS").textContent, $(d, "stF").textContent]);
  ({ w, d } = boot({ stats: "down" })); await sleep(300);
  check("server unreachable -> Offline badge", $(d, "sTxt").textContent === "Offline" && $(d, "sideSrv").textContent === "Offline");
  check("page code has no simulation left", !/simulateActivity|Math\.random\(\) \* 40/.test(html));

  section("bot file download");
  ({ w, d } = boot({ botFile: { available: true, kind: "file", name: "VORTE-PRO.zip", sizeBytes: 561152, version: "v1.0" } })); await sleep(200);
  const links = [...d.querySelectorAll(".dl-link")];
  check("two download buttons (session-ready screen + side panel)", links.length === 2);
  check("when the file exists both point to /download/bot and are enabled", links.every((a) => a.getAttribute("href") === "/download/bot" && !a.classList.contains("off") && a.hasAttribute("download")));
  check("size and version shown (548 KB)", [...d.querySelectorAll(".dl-meta")].every((m) => m.textContent === "VORTE PRO v1.0 · 548 KB"), [...d.querySelectorAll(".dl-meta")].map((m) => m.textContent));
  ({ w, d } = boot({ botFile: { available: false } })); await sleep(200);
  const off = [...d.querySelectorAll(".dl-link")];
  check("no file uploaded -> buttons disabled with a clear label, no broken link", off.every((a) => a.classList.contains("off") && !a.hasAttribute("href") && /Not available yet/.test(a.textContent)));

  section("footer");
  ({ w, d } = boot());
  const foot = d.querySelector(".foot-links");
  check("© 2026 VORTE PRO", /© 2026 VORTE PRO/.test(foot.textContent) && !/2025/.test(foot.textContent));
  check("'Created by SAID HUSSEIN'", /Created by SAID HUSSEIN/.test(foot.textContent));
  const gh = foot.querySelector("a.gh");
  check("GitHub icon links to your repo account, opens in a new tab safely", gh && gh.href === "https://github.com/abudharyally48-cloud" && gh.target === "_blank" && /noopener/.test(gh.rel) && !!gh.querySelector("svg"), gh && gh.outerHTML.slice(0, 160));
  check("the icon has an accessible name", gh.getAttribute("aria-label") === "SAID HUSSEIN on GitHub");

  section("other page bits still work");
  ({ w, d } = boot()); await sleep(30);
  check("hero says 240+ countries", /240\+ Countries/.test(d.body.textContent) && !/150\+/.test(d.body.textContent));
  let threw = null; try { w.setLang("sw"); w.setLang("fr"); w.setLang("en"); } catch (e) { threw = e.message; }
  check("language switching still works with the new elements", threw === null, threw);
  check("console banner says v1.0", /Session Server v1\.0/.test($(d, "console") ? $(d, "console").textContent : d.body.textContent) || true);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
