/* ============================================================
   GREEN ARENA - Tournament Manager
   Think of "state" as the scoreboard notebook: everything the
   app knows lives in it. render() redraws the screen from it.
   ============================================================ */

const $ = (id) => document.getElementById(id);
let activePage = "dashboard";

/* ---------- The games ----------
   Want a new game? Copy one block, give it a new key, and add a
   matching `.g-yourkey` colour block in style.css.            */
const icon = (inner) =>
  `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

const GAMES = {
  general: {
    name: "General Arena",
    tag: "Any sport, any rules. Your arena, your game.",
    unit: "Points",
    chips: ["Custom", "Any score"],
    titles: ["Chess", "Table Tennis", "Pool / Snooker", "Darts", "Card Game", "Board Game"],
    icon: icon('<path d="M20 10h24v14a12 12 0 0 1-24 0z"/><path d="M20 14h-8c0 8 4 12 10 13M44 14h8c0 8-4 12-10 13M32 36v10M22 54h20M26 46h12"/>')
  },
  soccer: {
    name: "Soccer",
    tag: "Goals, glory and the golden boot.",
    unit: "Goals",
    chips: ["Goals", "3 pts a win"],
    titles: ["EA Sports FC", "eFootball", "Real-life 11-a-side", "5-a-side", "Futsal", "Table Football"],
    icon: icon('<circle cx="32" cy="32" r="26"/><path d="M32 21l10 7-4 12H26l-4-12z" fill="currentColor" fill-opacity=".25"/><path d="M32 21V8M42 28l13-4M38 40l8 11M26 40l-8 11M22 28L9 24"/>')
  },
  fighting: {
    name: "Fighting Game",
    tag: "Win the rounds. Take the match. No mercy.",
    unit: "Rounds",
    chips: ["Rounds won", "1v1 battles"],
    titles: ["Street Fighter 6", "Tekken 8", "Mortal Kombat 1", "Super Smash Bros. Ultimate", "Guilty Gear -Strive-", "Dragon Ball FighterZ", "Soulcalibur VI", "Injustice 2", "Brawlhalla"],
    icon: icon('<path d="M12 12L42 42M42 42L52 52M36 48L48 36"/><path d="M52 12L22 42M22 42L12 52M16 36L28 48"/><circle cx="52" cy="52" r="2" fill="currentColor"/><circle cx="12" cy="52" r="2" fill="currentColor"/>')
  },
  shooter: {
    name: "Shooter",
    tag: "Frags, headshots, last squad standing.",
    unit: "Kills",
    chips: ["Kills", "Frag count"],
    titles: ["Call of Duty", "Valorant", "Counter-Strike 2", "Fortnite", "Apex Legends", "Overwatch 2", "Rainbow Six Siege", "Halo Infinite", "PUBG"],
    icon: icon('<circle cx="32" cy="32" r="18"/><circle cx="32" cy="32" r="3" fill="currentColor"/><path d="M32 4v14M32 46v14M4 32h14M46 32h14"/>')
  }
};
const unitOf = () => (GAMES[state.game] || GAMES.general).unit;
const gameTitle = () => state.title || (GAMES[state.game] || GAMES.general).name;

// ---------- State (saved in the browser so refresh keeps it) ----------
function freshState() {
  return { name: "", format: "single", game: "general", title: "", titleCustom: false, cover: "", players: [], rounds: [], matches: [], started: false, archived: false, champion: null, cloudId: null, ownerUid: null, historyId: null };
}
const firebaseConfig = window.GREEN_ARENA_FIREBASE_CONFIG;
const cloudConfigured = !!(firebaseConfig && firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== "YOUR_API_KEY" && firebaseConfig.databaseURL &&
  !firebaseConfig.databaseURL.includes("YOUR_"));
let cloudDatabase = null;
let cloudAuth = null;
let cloudUserPromise = null;
let cloudWriteQueue = Promise.resolve();
function save() {
  if (publicView) return;
  try { localStorage.setItem("greenArena", JSON.stringify(state)); } catch { /* storage blocked - keep running */ }
  if (state.started && cloudConfigured) queueCloudSave();
}
function saveHistory() {
  if (publicView) return;
  try { localStorage.setItem("greenArenaHistory", JSON.stringify(tournamentHistory)); } catch { /* storage blocked - keep running */ }
}
function loadHistory() {
  try { return JSON.parse(localStorage.getItem("greenArenaHistory")) || []; } catch { return []; }
}
function load() {
  try { return JSON.parse(localStorage.getItem("greenArena")); } catch { return null; }
}
let state = Object.assign(freshState(), load() || {});   // merge keeps old saves working
let tournamentHistory = loadHistory();
let publicView = readPublicShare();
if (publicView) state = Object.assign(freshState(), publicView.snapshot);

function readPublicShare() {
  const params = new URLSearchParams(location.search);
  const view = params.get("view");
  if (view !== "guest" && view !== "competitor") return null;
  const id = params.get("id");
  if (id && /^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    return { type: view, competitor: params.get("competitor"), id, live: true };
  }
  const encoded = params.get("data");
  if (!encoded) return null;
  try {
    const snapshot = decodePublicSnapshot(encoded);
    if (!snapshot.started) return null;
    return { type: view, competitor: params.get("competitor"), snapshot, live: false };
  } catch {
    return null;
  }
}

function encodeSnapshot(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodePublicSnapshot(encoded) {
  encoded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  encoded += "=".repeat((4 - encoded.length % 4) % 4);
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

// Stops names like <b>hi</b> from being treated as HTML
function esc(text) {
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
}

const escAttr = (text) => esc(text).replace(/"/g, "&quot;");

function imageSplash(game) {
  const splashes = {
    general: `linear-gradient(135deg, rgba(8,16,12,.25), rgba(8,16,12,.92)), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 500'%3E%3Crect width='1200' height='500' fill='%2308100c'/%3E%3Cg fill='none' stroke='%235cae78' stroke-opacity='.24' stroke-width='2'%3E%3Ccircle cx='600' cy='250' r='210'/%3E%3Ccircle cx='600' cy='250' r='140'/%3E%3Cpath d='M390 250h420M600 40v420'/%3E%3C/g%3E%3Cg fill='%2378f29a' fill-opacity='.12'%3E%3Cpath d='M520 110h160l40 220H480z'/%3E%3C/g%3E%3C/svg%3E")`,
    soccer: `linear-gradient(135deg, rgba(8,28,18,.15), rgba(8,16,12,.92)), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 500'%3E%3Crect width='1200' height='500' fill='%230b1b12'/%3E%3Cg fill='none' stroke='%237bd99b' stroke-opacity='.28' stroke-width='3'%3E%3Cpath d='M0 250h1200M600 0v500'/%3E%3Ccircle cx='600' cy='250' r='110'/%3E%3Crect x='40' y='150' width='180' height='200'/%3E%3Crect x='980' y='150' width='180' height='200'/%3E%3C/g%3E%3C/svg%3E")`,
    fighting: `linear-gradient(135deg, rgba(28,18,8,.12), rgba(10,8,4,.94)), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 500'%3E%3Crect width='1200' height='500' fill='%23120d08'/%3E%3Cg stroke='%23f0a64a' stroke-opacity='.25' stroke-width='18'%3E%3Cpath d='M-40 540L520-20M1240 540L680-20'/%3E%3C/g%3E%3Cg fill='%23f0a64a' fill-opacity='.10'%3E%3Ccircle cx='600' cy='250' r='180'/%3E%3C/g%3E%3C/svg%3E")`,
    shooter: `linear-gradient(135deg, rgba(18,8,28,.12), rgba(9,7,12,.94)), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 500'%3E%3Crect width='1200' height='500' fill='%230d0912'/%3E%3Cg fill='none' stroke='%23ba9cff' stroke-opacity='.22' stroke-width='3'%3E%3Ccircle cx='600' cy='250' r='190'/%3E%3Ccircle cx='600' cy='250' r='110'/%3E%3Cpath d='M600 20v460M370 250h460'/%3E%3C/g%3E%3C/svg%3E")`
  };
  return splashes[game] || splashes.general;
}

// ---------- Little helpers: toast, count-up, confetti ----------
function toast(msg, type = "ok") {
  const t = document.createElement("div");
  t.className = "toast " + type;
  t.textContent = msg;
  $("toasts").appendChild(t);
  setTimeout(() => t.classList.add("out"), 2600);
  setTimeout(() => t.remove(), 3100);
}

function setCloudStatus(message, isError = false) {
  const status = $("cloudStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("hidden", !message);
  status.classList.toggle("error", isError);
}

function initializeCloud() {
  if (!cloudConfigured) {
    setCloudStatus("Live sharing is not configured. Follow FIREBASE_SETUP.md to connect Firebase.");
    return false;
  }
  if (!window.firebase) {
    setCloudStatus("Firebase SDK failed to load. Check your connection and reload.", true);
    return false;
  }
  try {
    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
    cloudDatabase = app.database();
    cloudAuth = app.auth();
    return true;
  } catch (error) {
    setCloudStatus(`Firebase could not start: ${error.message}`, true);
    return false;
  }
}

async function getCloudUser() {
  if (cloudAuth.currentUser) return cloudAuth.currentUser;
  if (!cloudUserPromise) {
    cloudUserPromise = (async () => {
      const currentUser = await new Promise((resolve, reject) => {
        let unsubscribe = () => {};
        unsubscribe = cloudAuth.onAuthStateChanged((user) => {
          unsubscribe();
          resolve(user);
        }, reject);
      });
      if (currentUser) return currentUser;
      const credential = await cloudAuth.signInAnonymously();
      return credential.user;
    })();
  }
  try {
    return await cloudUserPromise;
  } catch (error) {
    cloudUserPromise = null;
    throw error;
  }
}

async function publishCloudState(targetState = state) {
  if (publicView || !targetState.started) return false;
  if (!initializeCloud()) throw new Error("Firebase is not configured or could not initialize.");
  const user = await getCloudUser();
  const uid = user.uid;
  if (targetState.ownerUid && targetState.ownerUid !== uid) {
    throw new Error("This browser is no longer signed in as the tournament owner. Use the original browser profile.");
  }
  if (!targetState.cloudId) targetState.cloudId = cloudDatabase.ref("tournaments").push().key;
  targetState.ownerUid = uid;
  if (targetState === state) {
    try { localStorage.setItem("greenArena", JSON.stringify(state)); } catch { /* Local storage may be unavailable. */ }
  }

  await cloudDatabase.ref(`tournaments/${targetState.cloudId}`).set({
    ownerUid: uid,
    snapshot: targetState
  });
  if (targetState === state) $("guestLinkInput").value = buildShareLink("guest");
  setCloudStatus("Live sharing connected. ");
  return true;
}

function queueCloudSave() {
  const targetState = state;
  cloudWriteQueue = cloudWriteQueue
    .then(() => publishCloudState(targetState))
    .catch((error) => {
      console.error("Tournament cloud sync failed:", error);
      setCloudStatus(`Live sync failed: ${error.message}. Your changes are still saved on this device.`, true);
    });
}

async function prepareShareLink(type = "guest", competitor = "") {
  if (cloudConfigured && state.started) {
    await cloudWriteQueue;
    await publishCloudState();
  }
  return buildShareLink(type, competitor);
}

function subscribeToLiveTournament() {
  if (!publicView?.live) return;
  if (!initializeCloud()) return;
  setCloudStatus("Connecting to live tournament…");
  cloudDatabase.ref(`tournaments/${publicView.id}`).on("value", (snapshot) => {
    const record = snapshot.val();
    if (!record || !record.snapshot || !record.snapshot.started) {
      setCloudStatus("This live tournament link is unavailable or has not started.", true);
      return;
    }
    state = Object.assign(freshState(), record.snapshot);
    showPage(publicView.type === "competitor" ? "competitors" : "tournament");
    render();
    if (publicView.type === "competitor" && publicView.competitor) {
      selectCompetitor(publicView.competitor);
    }
    setCloudStatus("Live tournament · updates appear automatically.");
  }, (error) => {
    console.error("Could not read live tournament:", error);
    setCloudStatus(`Could not load live tournament: ${error.message}`, true);
  });
}

function setNum(el, to) {
  const from = Number(el.textContent) || 0;
  if (from === to || matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = to; return; }
  const start = performance.now();
  (function step(now) {
    const p = Math.min(1, (now - start) / 600);
    el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  })(start);
}

function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = $("confetti"), ctx = c.getContext("2d");
  c.width = innerWidth; c.height = innerHeight;
  c.classList.add("on");
  const css = getComputedStyle(document.body);
  const colors = [css.getPropertyValue("--green").trim(), css.getPropertyValue("--green-bright").trim(), "#ffffff", "#ffd166"];
  const bits = Array.from({ length: 170 }, () => ({
    x: innerWidth / 2, y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 18, vy: Math.random() * -15 - 4,
    s: Math.random() * 8 + 4, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
    c: colors[Math.floor(Math.random() * colors.length)]
  }));
  let frame = 0;
  (function tick() {
    ctx.clearRect(0, 0, c.width, c.height);
    bits.forEach((b) => {
      b.vy += 0.35; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.r += b.vr;
      ctx.save();
      ctx.translate(b.x, b.y); ctx.rotate(b.r);
      ctx.fillStyle = b.c;
      ctx.globalAlpha = Math.max(0, 1 - frame / 210);
      ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2);
      ctx.restore();
    });
    if (++frame < 210) requestAnimationFrame(tick);
    else { ctx.clearRect(0, 0, c.width, c.height); c.classList.remove("on"); }
  })();
}

// ---------- Theme: the whole app takes the colour of the game ----------
function applyTheme() {
  const game = state.started || activePage === "setup" ? state.game : "general";
  document.body.className = "g-" + (GAMES[game] ? game : "general");
}

// ---------- Game selector (the dope cards) ----------
function buildGameSelector() {
  $("gameSelector").innerHTML = Object.entries(GAMES).map(([key, g], i) => `
    <button type="button" class="game-card g-${key}" data-game="${key}" role="radio" aria-checked="false" style="--splash:${escAttr(imageSplash(key))}">
      <span class="gc-index">0${i + 1}</span>
      <span class="gc-check" aria-hidden="true">✓</span>
      <span class="gc-icon">${g.icon}</span>
      <span class="gc-text"><b>${g.name}</b><small>${g.tag}</small></span>
      <span class="gc-chips">${g.chips.map((c) => `<i>${c}</i>`).join("")}</span>
    </button>`).join("");

  document.querySelectorAll(".game-card").forEach((card) => {
    card.onclick = () => selectGame(card.dataset.game);
    // 3D tilt + spotlight that follows the mouse
    card.addEventListener("mousemove", (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.setProperty("--mx", x * 100 + "%");
      card.style.setProperty("--my", y * 100 + "%");
      card.style.setProperty("--rx", (0.5 - y) * 10 + "deg");
      card.style.setProperty("--ry", (x - 0.5) * 12 + "deg");
    });
    card.addEventListener("mouseleave", () => {
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    });
  });
}

function buildQuickGames() {
  $("quickGames").innerHTML = Object.entries(GAMES).map(([key, g]) => `
    <button type="button" class="quick-game g-${key}" onclick="openSetup('${key}')">
      <span class="qg-icon">${g.icon}</span>
      <span><b>${g.name}</b><small>Scored in ${g.unit.toLowerCase()}</small></span>
    </button>`).join("");
}

function selectGame(key) {
  if (publicView) return;
  if (key !== state.game) {
    state.title = "";
    state.titleCustom = false;
  }
  state.game = key;
  save();
  syncGameUI();
  applyTheme();
  if (window.matchMedia("(max-width: 760px)").matches) {
    requestAnimationFrame(() => {
      document.querySelector("#setupView .setup-card")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

function syncGameUI() {
  const g = GAMES[state.game] || GAMES.general;
  document.querySelectorAll(".game-card").forEach((card) => {
    const on = card.dataset.game === state.game;
    card.classList.toggle("active", on);
    card.setAttribute("aria-checked", on);
  });
  $("gamePreview").className = "game-preview g-" + state.game;
  $("gamePreview").innerHTML = `
    <div class="gp-icon">${g.icon}</div>
    <div class="gp-main"><p class="eyebrow">SELECTED ARENA</p><h3>${g.name}</h3></div>
    <div class="gp-stat"><span>Score unit</span><b>${g.unit}</b></div>
    <div class="gp-stat"><span>Knockout</span><b>Winner advances</b></div>
    <div class="gp-stat"><span>Round robin</span><b>Win 3 · Draw 1</b></div>`;

  syncTitleUI();
}

function syncTitleUI() {
  const select = $("titleSelect");
  const custom = $("customTitleInput");
  if (!select || !custom) return;
  const g = GAMES[state.game] || GAMES.general;
  const options = g.titles.map((title) => `<option value="${escAttr(title)}">${esc(title)}</option>`).join("");
  select.innerHTML = options + `<option value="__custom">Custom title...</option>`;

  if (state.titleCustom) {
    select.value = "__custom";
    custom.classList.remove("hidden");
    custom.value = state.title || "";
  } else if (state.title && g.titles.includes(state.title)) {
    select.value = state.title;
    custom.classList.add("hidden");
  } else {
    select.value = g.titles[0] || g.name;
    custom.classList.add("hidden");
  }
}

function syncCoverUI() {
  const preview = $("coverPreview");
  const empty = $("coverEmpty");
  const remove = $("removeCover");
  if (!preview || !empty || !remove) return;
  if (state.cover) {
    preview.src = state.cover;
    preview.hidden = false;
    empty.classList.add("hidden");
    remove.classList.remove("hidden");
  } else {
    preview.removeAttribute("src");
    preview.hidden = true;
    empty.classList.remove("hidden");
    remove.classList.add("hidden");
  }
}

function resizeCover(file) {
  if (publicView || !file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    toast("Choose a JPG, PNG or WebP image.", "error");
    return;
  }
  if (file.size > 12 * 1024 * 1024) {
    toast("Cover images must be under 12 MB.", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      const maxWidth = 1600;
      const scale = Math.min(1, maxWidth / image.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      state.cover = canvas.toDataURL("image/jpeg", 0.82);
      save();
      syncCoverUI();
      renderTournamentHeader();
      toast("Tournament cover added");
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function renderTournamentHeader() {
  const header = $("tournamentHeader");
  if (!header) return;
  if (state.cover) {
    header.style.backgroundImage =
      `linear-gradient(135deg, rgba(4,8,6,.62), rgba(4,8,6,.92)), url("${state.cover}")`;
    header.classList.add("has-cover");
  } else {
    header.style.backgroundImage =
      state.started ? imageSplash(state.game) : "";
    header.classList.remove("has-cover");
  }
}

// ---------- Setup screen ----------
function addPlayer(name) {
  if (publicView) return;
  name = name.trim();
  if (!name) return;
  if (state.players.some((p) => p.toLowerCase() === name.toLowerCase())) {
    $("setupMsg").textContent = "That name is already added.";
    return;
  }
  $("setupMsg").textContent = "";
  state.players.push(name);
  save();
  render();
}

function removePlayer(i) {
  if (publicView) return;
  state.players.splice(i, 1);
  save();
  render();
}

$("addBtn").onclick = () => { addPlayer($("pName").value); $("pName").value = ""; $("pName").focus(); };
$("pName").addEventListener("keydown", (e) => { if (e.key === "Enter") $("addBtn").click(); });

// Save the name + format as you type, so adding a player never wipes them
$("tName").addEventListener("input", () => { if (publicView) return; state.name = $("tName").value; save(); });
$("tFormat").addEventListener("change", () => { if (publicView) return; state.format = $("tFormat").value; save(); });
$("titleSelect").addEventListener("change", () => {
  if (publicView) return;
  const isCustom = $("titleSelect").value === "__custom";
  state.titleCustom = isCustom;
  if (isCustom) {
    $("customTitleInput").classList.remove("hidden");
    $("customTitleInput").value = "";
    state.title = "";
    if (window.matchMedia("(max-width: 760px)").matches) {
      $("customTitleInput").focus({ preventScroll: true });
      $("customTitleInput").scrollIntoView({ behavior: "smooth", block: "center" });
    }
  } else {
    $("customTitleInput").classList.add("hidden");
    state.title = $("titleSelect").value;
  }
  save();
});
$("customTitleInput").addEventListener("input", () => {
  if (publicView) return;
  state.title = $("customTitleInput").value.trim();
  save();
});

$("sampleBtn").onclick = () => {
  if (publicView) return;
  ["Shadow", "Viper", "Blaze", "Frost", "Titan", "Ghost", "Nova", "Rogue"].forEach((n) => {
    if (!state.players.some((p) => p.toLowerCase() === n.toLowerCase())) state.players.push(n);
  });
  save();
  render();
};

$("startBtn").onclick = () => {
  if (publicView) return;
  if (state.players.length < 2) {
    $("setupMsg").textContent = "Add at least 2 players to start.";
    return;
  }
  if ($("titleSelect").value === "__custom" && !$("customTitleInput").value.trim()) {
    $("setupMsg").textContent = "Enter a custom game title.";
    $("customTitleInput").focus();
    return;
  }
  $("setupMsg").textContent = "";
  state.name = $("tName").value.trim() || "My Tournament";
  state.format = $("tFormat").value;
  state.titleCustom = $("titleSelect").value === "__custom";
  state.title = state.titleCustom
    ? $("customTitleInput").value.trim()
    : $("titleSelect").value;
  state.started = true;
  state.archived = false;
  state.champion = null;
  if (state.format === "single") buildBracket();
  else buildRoundRobin();
  save();
  showPage("tournament");
  render();
  toast(`${gameTitle()} tournament started!`);
};

// Open the setup page (optionally with a game pre-selected)
function openSetup(game) {
  if (publicView) return;
  if (state.started) {
    if (!confirm("Start a new tournament? The current one will be saved to History.")) return;
    archiveTournament();
    state = freshState();
  }
  if (game) state.game = game;
  save();
  showPage("setup");
  render();
}

$("resetBtn").onclick = () => {
  if (publicView) return;
  if (confirm("Start over? Current tournament will be saved to History.")) {
    archiveTournament();
    state = freshState();
    save();
    showPage("dashboard");
    render();
  }
};

// ---------- Single elimination ----------
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newMatch(p1 = null, p2 = null) {
  return { p1, p2, s1: null, s2: null, winner: null, bye: false };
}

function buildBracket() {
  const players = shuffle(state.players);
  let size = 1;
  while (size < players.length) size *= 2;       // 5 players -> bracket of 8
  const byes = size - players.length;

  const first = [];
  let idx = 0;
  for (let i = 0; i < size / 2; i++) {
    if (i < byes) {                               // this player skips round 1
      const m = newMatch(players[idx++], null);
      m.bye = true;
      m.winner = m.p1;
      first.push(m);
    } else {
      first.push(newMatch(players[idx++], players[idx++]));
    }
  }

  state.rounds = [first];
  let count = size / 4;
  while (count >= 1) {
    state.rounds.push(Array.from({ length: count }, () => newMatch()));
    count /= 2;
  }

  // Move bye winners into round 2
  first.forEach((m, i) => { if (m.bye) advance(0, i, m.winner); });
}

// Put the winner into the correct slot of the next round
function advance(r, m, winner) {
  const next = state.rounds[r + 1];
  if (!next) return;
  const target = next[Math.floor(m / 2)];
  if (m % 2 === 0) target.p1 = winner; else target.p2 = winner;
}

function saveSingle(r, m) {
  if (publicView) return;
  const a = $(`s1-${r}-${m}`).value;
  const b = $(`s2-${r}-${m}`).value;
  if (a === "" || b === "") return toast("Enter both scores.", "error");
  const s1 = Number(a), s2 = Number(b);
  if (s1 === s2) return toast("Knockout matches cannot end in a draw.", "error");

  const match = state.rounds[r][m];
  const winner = s1 > s2 ? match.p1 : match.p2;
  const nextMatch = state.rounds[r + 1] && state.rounds[r + 1][Math.floor(m / 2)];

  if (nextMatch && nextMatch.winner && match.winner !== winner) {
    return toast("The next match was already played, so this result is locked.", "error");
  }

  match.s1 = s1; match.s2 = s2; match.winner = winner;
  advance(r, m, winner);
  save();
  const stats = matchStats();
  if (stats.completed === stats.total) archiveTournament();
  render();
  toast(`${winner} advances!`);
}

function roundName(r, total) {
  const fromEnd = total - r;
  if (fromEnd === 1) return "Final";
  if (fromEnd === 2) return "Semi-finals";
  if (fromEnd === 3) return "Quarter-finals";
  return "Round " + (r + 1);
}

function scoreControl(id, value, compact = false) {
  return `
    <div class="score-control ${compact ? "compact" : ""}">
      <button type="button" aria-label="Decrease ${unitOf()}" onclick="changeScore('${id}', -1)">−</button>
      <input type="number" min="0" inputmode="numeric" id="${id}" value="${value ?? 0}" aria-label="${unitOf()}">
      <button type="button" aria-label="Increase ${unitOf()}" onclick="changeScore('${id}', 1)">+</button>
    </div>`;
}

function changeScore(id, delta) {
  if (publicView) return;
  const input = $(id);
  if (!input) return;
  input.value = Math.max(0, (Number(input.value) || 0) + delta);
}

function renderBracket() {
  const total = state.rounds.length;
  let html = '<div class="panel"><div class="bracket">';

  state.rounds.forEach((round, r) => {
    html += `<div class="round"><h3>${roundName(r, total)}</h3>`;
    round.forEach((m, i) => {
      const ready = m.p1 && m.p2 && !m.bye;
      const slot = (player, score, key) => `
        <div class="slot ${m.winner && m.winner === player ? "win" : ""} ${player ? "" : "tbd"}">
          <span class="slot-name">${player ? esc(player) : "TBD"}</span>
          ${ready && !publicView ? scoreControl(`${key}-${r}-${i}`, score, true)
                  : `<strong class="slot-score">${score ?? ""}</strong>`}
        </div>`;

      html += `<div class="match ${m.winner ? "done" : ""}">
        ${slot(m.p1, m.s1, "s1")}
        ${slot(m.p2, m.s2, "s2")}
        ${m.bye ? '<p class="bye">Bye - advances automatically</p>' : ""}
        ${ready && !publicView ? `<button class="btn small" onclick="saveSingle(${r},${i})">${m.winner ? "Update" : "Save"} result</button>` : ""}
      </div>`;
    });
    html += "</div>";
  });

  $("content").innerHTML = html + "</div></div>";

  const final = state.rounds[total - 1][0];
  showChampion(final.winner);
}

// ---------- Round robin ----------
function buildRoundRobin() {
  state.matches = [];
  for (let i = 0; i < state.players.length; i++) {
    for (let j = i + 1; j < state.players.length; j++) {
      state.matches.push({ p1: state.players[i], p2: state.players[j], s1: null, s2: null, done: false });
    }
  }
}

function saveRobin(i) {
  if (publicView) return;
  const a = $(`rs1-${i}`)?.value ?? state.matches[i].s1;
  const b = $(`rs2-${i}`)?.value ?? state.matches[i].s2;
  if (a === "" || b === "") return toast("Enter both scores.", "error");
  const m = state.matches[i];
  m.s1 = Number(a); m.s2 = Number(b); m.done = true;
  save();
  const stats = matchStats();
  if (stats.completed === stats.total) archiveTournament();
  render();
  toast("Result recorded");
}

function standings() {
  const table = {};
  state.players.forEach((p) => (table[p] = { name: p, p: 0, w: 0, d: 0, l: 0, pts: 0, diff: 0 }));
  state.matches.filter((m) => m.done).forEach((m) => {
    const A = table[m.p1], B = table[m.p2];
    A.p++; B.p++;
    A.diff += m.s1 - m.s2; B.diff += m.s2 - m.s1;
    if (m.s1 > m.s2) { A.w++; A.pts += 3; B.l++; }
    else if (m.s2 > m.s1) { B.w++; B.pts += 3; A.l++; }
    else { A.d++; B.d++; A.pts++; B.pts++; }
  });
  return Object.values(table).sort((x, y) => y.pts - x.pts || y.diff - x.diff || x.name.localeCompare(y.name));
}

function renderRobin() {
  const rows = standings().map((t, i) => `
    <tr><td>${i + 1}</td><td>${esc(t.name)}</td><td>${t.p}</td><td>${t.w}</td>
    <td>${t.d}</td><td>${t.l}</td><td>${t.diff}</td><td><strong>${t.pts}</strong></td></tr>`).join("");

  const matches = state.matches.map((m, i) => `
    <div class="match-live ${m.done ? "done" : ""}">
      <div class="live-player"><b>${esc(m.p1)}</b></div>
      <div class="live-score">
        ${publicView ? `<strong class="slot-score">${m.s1 ?? "—"}</strong>` : scoreControl(`rs1-${i}`, m.s1, true)}
        <i>:</i>
        ${publicView ? `<strong class="slot-score">${m.s2 ?? "—"}</strong>` : scoreControl(`rs2-${i}`, m.s2, true)}
      </div>
      <div class="live-player"><b>${esc(m.p2)}</b></div>
      <div class="live-match-actions">
        <span class="live-unit">${unitOf()}</span>
        ${publicView ? "" : `<button class="btn small" onclick="saveRobin(${i})">${m.done ? "Update score" : "Record result"}</button>`}
      </div>
    </div>`).join("");

  $("content").innerHTML = `
    <div class="grid">
      <div class="panel"><h2>Standings</h2>
        <table>
          <tr><th>#</th><th>Player</th><th>P</th><th>W</th><th>D</th><th>L</th><th>+/-</th><th>Pts</th></tr>
          ${rows}
        </table>
        <p class="muted" style="margin-top:10px">Win = 3 pts, Draw = 1 pt, Loss = 0</p>
      </div>
      <div class="panel"><h2>Matches</h2><div class="matches">${matches}</div></div>
    </div>`;

  if (state.matches.every((m) => m.done)) showChampion(standings()[0].name);
  else showChampion(null);
}

// ---------- Shared ----------
function showChampion(name) {
  const box = $("champion");
  if (name) {
    box.innerHTML = `<span class="trophy">🏆</span><div><small>CHAMPION</small><b>${esc(name)}</b></div>`;
    box.classList.remove("hidden");
    box.onclick = confetti;                       // click the banner to celebrate again
    if (state.champion !== name) {                // only celebrate once per winner
      state.champion = name;
      save();
      setTimeout(confetti, 250);
    }
  } else {
    box.classList.add("hidden");
    if (state.champion) { state.champion = null; save(); }
  }
}

function matchStats() {
  if (!state.started) return { total: 0, completed: 0 };
  if (state.format === "robin") {
    const total = state.matches.length;
    return { total, completed: state.matches.filter((m) => m.done).length };
  }
  const matches = state.rounds.flat();
  return { total: matches.length, completed: matches.filter((m) => m.winner).length };
}

function completedResults() {
  if (!state.started) return [];
  if (state.format === "robin") {
    return state.matches.filter((m) => m.done).map((m) =>
      ({ p1: m.p1, p2: m.p2, s1: m.s1, s2: m.s2 }));
  }
  return state.rounds.flat()
    .filter((m) => m.winner && !m.bye)
    .map((m) => ({ p1: m.p1, p2: m.p2, s1: m.s1, s2: m.s2 }));
}

function renderDashboard() {
  const stats = matchStats();
  setNum($("statPlayers"), state.players.length);
  setNum($("statMatches"), stats.total);
  setNum($("statCompleted"), stats.completed);
  $("statMatchesLabel").textContent = stats.total ? "Scheduled" : "Ready to create";
  $("statFormat").textContent = state.started
    ? (state.format === "single" ? "KNOCKOUT" : "ROUND ROBIN")
    : "—";
  $("statFormatLabel").textContent = state.started ? GAMES[state.game].name : "No event selected";

  $("dashboardEventName").textContent = state.started ? state.name : "No tournament yet";
  $("dashboardStatus").textContent = state.started ? "Active" : "Draft";
  $("dashboardIntro").textContent = state.started
    ? `${state.name} is live with ${state.players.length} contenders competing.`
    : "Create your next competition and bring every contender into the arena.";

  if (!state.started) {
    $("dashboardEventBody").className = "event-empty";
    $("dashboardEventBody").innerHTML = `
      <div class="empty-icon" aria-hidden="true">＋</div>
      <div><b>Start a new competition</b><p>Add players, choose a format, and begin the event.</p></div>`;
  } else {
    $("dashboardEventBody").className = "event-summary";
    $("dashboardEventBody").innerHTML = `
      <div><span>Contenders</span><strong>${state.players.length}</strong></div>
      <div><span>Matches</span><strong>${stats.completed}/${stats.total}</strong></div>
      <div><span>Status</span><strong>${stats.completed === stats.total ? "Complete" : "Live"}</strong></div>`;
  }

  let leaders = state.players.map((name) => ({ name, points: 0, wins: 0 }));
  if (state.started && state.format === "robin") {
    leaders = standings().map((t) => ({ name: t.name, points: t.pts, wins: t.w }));
  } else if (state.started) {
    leaders = state.players.map((name) => {
      const wins = state.rounds.flat().filter((m) => m.winner === name).length;
      return { name, points: wins, wins };
    }).sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));
  }
  $("leaderboardPreview").innerHTML = leaders.length
    ? leaders.slice(0, 5).map((item, i) => `
        <div class="leader-row">
          <span class="leader-rank">${String(i + 1).padStart(2, "0")}</span>
          <span>${esc(item.name)}</span>
          <strong>${item.points ?? item.wins} pts</strong>
        </div>`).join("")
    : '<div class="results-empty">Players will appear here</div>';
}

function renderPlayers() {
  $("playersHeading").textContent = state.players.length
    ? `${state.players.length} contenders`
    : "No players";
  $("playersCount").textContent = `${state.players.length} ${state.players.length === 1 ? "entrant" : "entrants"}`;
  $("playersGrid").innerHTML = state.players.length
    ? state.players.map((player, i) => `
        <article class="player-card">
          <span class="player-avatar">${esc(player.charAt(0).toUpperCase())}</span>
          <b>${esc(player)}</b>
          <span>${state.started ? "Tournament entrant" : "Ready to enter"} · #${i + 1}</span>
        </article>`).join("")
    : '<div class="empty-players"><div><b>No contenders yet</b><p>Add players in tournament setup.</p></div></div>';
}

function buildShareLink(type = "guest", competitor = "") {
  if (!state.started) return "";
  const url = new URL(location.href);
  url.search = "";  
  url.hash = "";
  url.searchParams.set("view", type);
  if (cloudConfigured && state.cloudId) {
    url.searchParams.set("id", state.cloudId);
  } else {
    url.searchParams.set("data", encodeSnapshot(state));
  }
  if (competitor) url.searchParams.set("competitor", competitor);
  return url.toString();
}

async function copyText(text) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const input = document.createElement("textarea");
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }
  toast("Link copied");
}

function renderAudience() {
  const guestLink = buildShareLink("guest");
  $("guestLinkInput").value = guestLink;
  $("shareLinkInput").value = guestLink;
  $("guestLinkTitle").textContent = state.started ? state.name : "Tournament not started";
  $("guestLinkText").textContent = state.started
    ? `${gameTitle()} · ${state.players.length} contenders`
    : "Create a tournament first to generate an access link.";

  $("competitorCount").textContent = `${state.players.length} contenders`;
  $("competitorPicker").innerHTML = state.players.length
    ? state.players.map((player, i) => `
        <button type="button" class="competitor-option" data-player="${esc(player)}">
          <span class="player-avatar">${esc(player.charAt(0).toUpperCase())}</span>
          <b>${esc(player)}</b>
          <span>#${i + 1}</span>
        </button>`).join("")
    : '<div class="empty-players"><p>No contenders available</p></div>';

  document.querySelectorAll(".competitor-option").forEach((option) => {
    option.onclick = () => selectCompetitor(option.dataset.player);
  });
}

function selectCompetitor(name) {
  document.querySelectorAll(".competitor-option").forEach((option) => {
    option.classList.toggle("active", option.dataset.player === name);
  });
  $("competitorTitle").textContent = name;
  let matches = [];
  if (state.format === "robin") {
    matches = state.matches.filter((m) => m.p1 === name || m.p2 === name);
  } else {
    matches = state.rounds.flat()
      .filter((m) => !m.bye && (m.p1 === name || m.p2 === name))
      .map((m) => ({ p1: m.p1, p2: m.p2, s1: m.s1, s2: m.s2, done: !!m.winner }));
  }
  $("competitorMatches").innerHTML = matches.length
    ? matches.map((m) => `
        <div class="competitor-match ${m.done ? "" : "pending"}">
          <span>${esc(m.p1)}</span>
          <strong>${m.done ? `${m.s1} — ${m.s2}` : "VS"}</strong>
          <span>${esc(m.p2)}</span>
        </div>`).join("")
    : '<div class="empty-players"><p>No matches scheduled yet</p></div>';
}

function renderResultsPage() {
  const stats = matchStats();
  const percent = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;
  const results = completedResults();
  $("resultsProgress").textContent = `${percent}% complete`;
  $("progressPercent").textContent = `${percent}%`;
  $("progressRing").style.setProperty("--progress", `${percent}%`);
  $("progressTitle").textContent = state.started ? state.name : "No active event";
  $("progressDetail").textContent = stats.total
    ? `${stats.completed} of ${stats.total} matches completed.`
    : "Start a tournament to see live progress.";

  $("resultsList").innerHTML = results.length
    ? results.slice().reverse().map((m) => `
        <div class="result-row">
          <span>${esc(m.p1)}</span>
          <span class="result-score">${m.s1} — ${m.s2}</span>
          <span>${esc(m.p2)}</span>
        </div>`).join("")
    : '<div class="results-empty"><div><b>No completed matches</b><p>Results will appear as scores are entered.</p></div></div>';
}

function archiveTournament() {
  if (!state.started || state.archived) return;
  const stats = matchStats();
  const id = state.historyId || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const entry = {
    id,
    name: state.name,
    game: state.game || "general",
    format: state.format,
    players: [...state.players],
    completed: stats.completed,
    total: stats.total,
    finished: stats.total > 0 && stats.completed === stats.total,
    date: new Date().toISOString(),
    snapshot: JSON.parse(JSON.stringify(state))
  };
  const existingIndex = tournamentHistory.findIndex((item) => item.id === id);
  if (existingIndex >= 0) tournamentHistory[existingIndex] = entry;
  else tournamentHistory.unshift(entry);
  state.historyId = id;
  state.archived = true;
  saveHistory();
  save();
}

function resumeTournament(id) {
  const entry = tournamentHistory.find((item) => item.id === id);
  if (!entry || entry.finished || !entry.snapshot) {
    toast("This in-progress tournament cannot be resumed.", "error");
    return;
  }
  state = Object.assign(freshState(), JSON.parse(JSON.stringify(entry.snapshot)), {
    archived: false,
    historyId: entry.id
  });
  save();
  showPage("tournament");
  render();
  toast(`Resumed ${state.name}`);
}

function showHistoryDetails(id) {
  const entry = tournamentHistory.find((item) => item.id === id);
  if (!entry) return;
  const saved = entry.snapshot || entry;
  const matches = !entry.snapshot ? [] : saved.format === "robin"
    ? (saved.matches || []).filter((match) => match.done)
    : (saved.rounds || []).flat().filter((match) => match.winner && !match.bye);
  $("historyDetailsTitle").textContent = saved.name || entry.name;
  $("historyDetailsSummary").textContent =
    `${gameTitleFor(saved)} · ${saved.format === "robin" ? "Round robin" : "Single elimination"} · ${entry.completed ?? matches.length}/${entry.total ?? matches.length} matches recorded`;
  $("historyDetailsChampion").textContent = saved.champion
    ? `Champion: ${saved.champion}`
    : entry.finished ? "Tournament completed" : "Tournament in progress";
  $("historyDetailsMatches").innerHTML = matches.length
    ? matches.map((match) => `
        <div class="result-row">
          <span>${esc(match.p1 || "TBD")}</span>
          <span class="result-score">${esc(match.s1 ?? "—")} — ${esc(match.s2 ?? "—")}</span>
          <span>${esc(match.p2 || "TBD")}</span>
        </div>`).join("")
    : entry.snapshot
      ? '<div class="results-empty">No match results have been recorded.</div>'
      : '<div class="results-empty"><div><b>Detailed scores were not saved</b><p>This event was archived before history snapshots were added. Its tournament summary is available, but past scores cannot be restored.</p></div></div>';
  $("historyDetailsDialog").showModal();
}

function gameTitleFor(saved) {
  return saved.title || (GAMES[saved.game] || GAMES.general).name;
}

function deleteHistoryEntry(id) {
  const entry = tournamentHistory.find((item) => item.id === id);
  if (!entry) return;
  if (!confirm(`Delete "${entry.name}" from tournament history? This cannot be undone.`)) return;
  tournamentHistory = tournamentHistory.filter((item) => item.id !== id);
  saveHistory();
  renderHistory();
  toast("Tournament removed from history.");
}

function renderHistory() {
  const query = ($("historySearch")?.value || "").trim().toLowerCase();
  const filter = $("historyFilter")?.value || "all";
  const archivedEntries = tournamentHistory.filter((item) => item.id !== state.historyId);
  const entries = [...(state.started && !state.archived ? [{
    id: "current",
    name: state.name,
    game: state.game || "general",
    format: state.format,
    players: state.players,
    completed: matchStats().completed,
    total: matchStats().total,
    finished: false,
    date: new Date().toISOString(),
    current: true,
    snapshot: state
  }] : []), ...archivedEntries].filter((item) => {
    const matchesQuery = item.name.toLowerCase().includes(query);
    const matchesFilter = filter === "all" || item.game === filter;
    return matchesQuery && matchesFilter;
  });

  $("historyList").innerHTML = entries.length
    ? entries.map((item) => {
        const g = GAMES[item.game] || GAMES.general;
        const date = new Date(item.date);
        const dateText = Number.isNaN(date.getTime())
          ? "Date unavailable"
          : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
        const status = item.current ? "Active now" : item.finished ? "Completed" : "In progress";
        const primaryAction = item.finished
          ? `<button type="button" class="btn small ghost" data-history-action="view" data-history-id="${escAttr(item.id)}">${item.snapshot ? "View results" : "View summary"}</button>`
          : item.current
            ? `<button type="button" class="btn small primary" data-history-action="resume" data-history-id="${escAttr(item.id)}">Open tournament</button>`
            : item.snapshot
              ? `<button type="button" class="btn small primary" data-history-action="resume" data-history-id="${escAttr(item.id)}">Resume</button>`
              : '<span class="muted">Resume unavailable</span>';
        const actions = item.current
          ? primaryAction
          : `${primaryAction}<button type="button" class="btn small ghost history-delete" data-history-action="delete" data-history-id="${escAttr(item.id)}">Delete</button>`;
        return `
          <article class="history-card g-${GAMES[item.game] ? item.game : "general"}">
            <div class="history-icon">${g.icon}</div>
            <div class="history-main">
              <h3>${esc(item.name)}</h3>
              <p>${g.name} · ${item.format === "robin" ? "Round robin" : "Single elimination"} · ${item.players.length} contenders</p>
            </div>
            <div class="history-meta">
              <strong>${status}</strong>
              <span>${item.completed}/${item.total} matches · ${dateText}</span>
              <div class="history-actions">${actions}</div>
            </div>
          </article>`;
      }).join("")
    : '<div class="empty-players"><div><b>No tournaments found</b><p>Active, finished, and set-aside tournaments will appear here.</p></div></div>';
}

function render() {
  applyTheme();
  syncGameUI();
  syncCoverUI();
  renderTournamentHeader();
  renderDashboard();
  renderPlayers();
  renderResultsPage();
  renderHistory();
  renderAudience();
  $("resetBtn").classList.toggle("hidden", !state.started);

  // Setup form (always kept in sync with the notebook)
  $("playerList").innerHTML = state.players
    .map((p, i) => `<li>${esc(p)} <button onclick="removePlayer(${i})" title="Remove">✕</button></li>`)
    .join("");
  $("setupCount").textContent =
    `${state.players.length} ${state.players.length === 1 ? "player" : "players"}`;
  if (document.activeElement !== $("tName")) $("tName").value = state.name || "";
  $("tFormat").value = state.format || "single";

  if (state.started) {
    const g = GAMES[state.game] || GAMES.general;
    $("tTitle").textContent = state.name;
    $("tSub").innerHTML =
      `${g.icon} ${gameTitle()} · ${state.format === "single" ? "Single Elimination" : "Round Robin"} · ${state.players.length} players`;
    const stats = matchStats();
    $("tProgress").style.width = (stats.total ? (stats.completed / stats.total) * 100 : 0) + "%";

    if (state.format === "single") renderBracket();
    else renderRobin();
  }
}

function setDrawerOpen(open) {
  const nav = $("mainNav");
  const toggle = $("menuToggle");
  const backdrop = $("drawerBackdrop");
  const isMobile = window.matchMedia("(max-width: 760px)").matches;
  const drawerOpen = isMobile && open;
  nav.classList.toggle("open", drawerOpen);
  nav.inert = isMobile && !drawerOpen;
  toggle.setAttribute("aria-expanded", String(drawerOpen));
  toggle.setAttribute("aria-label", drawerOpen ? "Close navigation menu" : "Open navigation menu");
  backdrop.classList.toggle("visible", drawerOpen);
  backdrop.tabIndex = drawerOpen ? 0 : -1;
  document.documentElement.classList.toggle("drawer-open", drawerOpen);
}

window.addEventListener("resize", () => setDrawerOpen(false));

function showPage(page) {
  setDrawerOpen(false);
  if (publicView) page = publicView.type === "competitor" ? "competitors" : "tournament";
  if (page === "tournament" && !state.started) page = "setup";
  activePage = page;
  const pages = {
    dashboard: "dashboardView",
    setup: "setupView",
    tournament: "tournamentView",
    players: "playersView",
    results: "resultsView",
    history: "historyView",
    guests: "guestsView",
    competitors: "competitorsView"
  };
  Object.entries(pages).forEach(([name, id]) => {
    $(id).classList.toggle("hidden", name !== page);
  });
  document.querySelectorAll(".nav-link").forEach((link) => {
    const linkPage = link.dataset.page;
    const isActive = linkPage === page || (page === "setup" && linkPage === "tournament");
    link.classList.toggle("active", isActive);
  });
  applyTheme();
  if (page === "setup") render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

 $("menuToggle").onclick = () => {
  setDrawerOpen($("menuToggle").getAttribute("aria-expanded") !== "true");
};
$("drawerBackdrop").onclick = () => setDrawerOpen(false);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && $("menuToggle").getAttribute("aria-expanded") === "true") {
    setDrawerOpen(false);
    $("menuToggle").focus();
  }
});

document.querySelectorAll(".nav-link").forEach((link) => {
  link.onclick = () => showPage(link.dataset.page);
});

$("dashboardCreateBtn").onclick = () => openSetup();
$("playersAddBtn").onclick = () => { if (state.started) showPage("setup"); else openSetup(); };
$("historyNewBtn").onclick = () => openSetup();

$("shareBtn").onclick = () => {
  if (!state.started) return toast("Start a tournament before sharing.", "error");
  prepareShareLink("guest")
    .then((link) => {
      $("shareLinkInput").value = link;
      $("shareDialog").showModal();
    })
    .catch((error) => {
      setCloudStatus(`Could not prepare a live link: ${error.message}`, true);
      toast("Could not prepare a live guest link.", "error");
    });
};
$("guestShareBtn").onclick = () => {
  prepareShareLink("guest")
    .then((link) => {
      $("shareLinkInput").value = link;
      $("shareDialog").showModal();
    })
    .catch((error) => {
      setCloudStatus(`Could not prepare a live link: ${error.message}`, true);
      toast("Could not prepare a live guest link.", "error");
    });
};
$("guestCopyLinkBtn").onclick = () => {
  prepareShareLink("guest")
    .then(copyText)
    .catch((error) => {
      setCloudStatus(`Could not prepare a live link: ${error.message}`, true);
      toast("Could not prepare a live guest link.", "error");
    });
};
$("copyGuestLink").onclick = () => {
  prepareShareLink("guest")
    .then(copyText)
    .catch((error) => {
      setCloudStatus(`Could not prepare a live link: ${error.message}`, true);
      toast("Could not prepare a live guest link.", "error");
    });
};
$("dialogCopyBtn").onclick = () => copyText($("shareLinkInput").value);
 $("coverInput").onchange = (event) => resizeCover(event.target.files[0]);
$("removeCover").onclick = () => {
  if (publicView) return;
  state.cover = "";
  $("coverInput").value = "";
  save();
  syncCoverUI();
  renderTournamentHeader();
  toast("Cover removed");
};

document.querySelectorAll(".audience-tab").forEach((tab) => {
  tab.onclick = () => {
    document.querySelectorAll(".audience-tab").forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    prepareShareLink(tab.dataset.view)
      .then((link) => { $("shareLinkInput").value = link; })
      .catch((error) => {
        setCloudStatus(`Could not prepare a live link: ${error.message}`, true);
        toast("Could not prepare a live guest link.", "error");
      });
  };
});

$("historySearch").addEventListener("input", renderHistory);
$("historyFilter").addEventListener("change", renderHistory);
$("historyList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-history-action]");
  if (!button) return;
  if (button.dataset.historyAction === "view") showHistoryDetails(button.dataset.historyId);
  if (button.dataset.historyAction === "delete") deleteHistoryEntry(button.dataset.historyId);
  if (button.dataset.historyAction === "resume") {
    if (button.dataset.historyId === "current") showPage("tournament");
    else resumeTournament(button.dataset.historyId);
  }
});
$("historyDetailsClose").onclick = () => $("historyDetailsDialog").close();

document.querySelector(".brand").onclick = (event) => {
  event.preventDefault();
  showPage("dashboard");
};

window.addEventListener("hashchange", () => {
  const page = location.hash.replace("#", "");
  if (["dashboard", "tournament", "players", "results", "history", "guests", "competitors", "setup"].includes(page)) showPage(page);
});

// ---------- Start ----------
buildGameSelector();
buildQuickGames();
if (publicView) {
  document.querySelectorAll(".host-only").forEach((element) => element.classList.add("hidden"));
  document.querySelectorAll(".main-nav").forEach((nav) => nav.style.display = "none");
  $("menuToggle").classList.add("hidden");
  $("drawerBackdrop").classList.add("hidden");
  showPage(publicView.type === "competitor" ? "competitors" : "tournament");
  if (!publicView.live && publicView.type === "competitor" && publicView.competitor) {
    setTimeout(() => selectCompetitor(publicView.competitor), 0);
  }
} else {
  showPage("dashboard");
}
render();
if (publicView?.live) subscribeToLiveTournament();
else if (!publicView && state.started && cloudConfigured) queueCloudSave();
else if (!publicView) initializeCloud();