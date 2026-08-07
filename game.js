// =============================================================
//  Axolotl Avalanche — main game logic
// =============================================================

import { submitScore, getTopScores, getMode } from "./leaderboard.js";

/* ----------------------------- CONFIG ----------------------------- */

const IMAGE_SOURCES = {
  lilypad: "assets/lilypad.png",
  cute: "assets/axolotl-cute.png",
  photo: "assets/axolotl-photo.png",
  reading: "assets/axolotl-reading.png",
  blizzard: "assets/blizzard-spirit.png",
};

const AXOLOTL_TYPES = [
  { key: "cute", weight: 6, points: 10 },
  { key: "photo", weight: 3, points: 10 },
  { key: "reading", weight: 1, points: 25 }, // rare bonus catch
  { key: "blizzard", weight: 2, points: 15 }, // rare blue axolotl
];

const HAZARD_TYPES = [
  { kind: "emoji", char: "🪨", weight: 3 },
  { kind: "emoji", char: "❄️", weight: 3 },
  { kind: "emoji", char: "🧊", weight: 2 },
  { kind: "emoji", char: "⛄️", weight: 1 },
  { kind: "emoji", char: "⚡️", weight: 1 },
];

const EMOJI_FONT_STACK =
  "'Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol','Noto Color Emoji',sans-serif";

// Some browsers (notably Safari in Private Browsing, which restricts canvas
// font access to reduce fingerprinting) refuse to draw color emoji glyphs
// via ctx.fillText and silently fall back to an outline-only font instead.
// To sidestep that, emoji are rendered once into an offscreen SVG image
// (using the browser's normal text renderer, which isn't restricted) and
// then blitted onto the canvas with drawImage, which works everywhere.
const EMOJI_IMG_BASE = 128;
const emojiImageCache = new Map();
function getEmojiImage(text, aspectRatio = 1) {
  let img = emojiImageCache.get(text);
  if (img) return img;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const h = EMOJI_IMG_BASE * dpr;
  const w = Math.round(h * aspectRatio);
  const fontSize = Math.round(h * 0.82);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" ` +
    `font-size="${fontSize}" font-family="${EMOJI_FONT_STACK}">${text}</text></svg>`;
  img = new Image();
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  emojiImageCache.set(text, img);
  return img;
}


// Eight timed stretches up the mountain, each faster & denser than the last.
const LEVELS = [
  {
    name: "Stretch 1: Base Camp",
    duration: 45,
    baseSpeed: 145,
    spawnInterval: 1000,
    hazardChance: 0.14,
    ramp: 3,
    bg: "day",
  },
  {
    name: "Stretch 2: Pine Trail",
    duration: 45,
    baseSpeed: 175,
    spawnInterval: 900,
    hazardChance: 0.17,
    ramp: 3.5,
    bg: "day",
  },
  {
    name: "Stretch 3: Frozen Ridge",
    duration: 45,
    baseSpeed: 205,
    spawnInterval: 800,
    hazardChance: 0.2,
    ramp: 4,
    bg: "dusk",
  },
  {
    name: "Stretch 4: Icy Pass",
    duration: 45,
    baseSpeed: 235,
    spawnInterval: 720,
    hazardChance: 0.23,
    ramp: 4.5,
    bg: "dusk",
  },
  {
    name: "Stretch 5: Windswept Slope",
    duration: 45,
    baseSpeed: 265,
    spawnInterval: 650,
    hazardChance: 0.26,
    ramp: 5,
    bg: "dusk",
  },
  {
    name: "Stretch 6: Glacier Field",
    duration: 45,
    baseSpeed: 285,
    spawnInterval: 580,
    hazardChance: 0.28,
    ramp: 5.5,
    bg: "storm",
  },
  {
    name: "Stretch 7: Blizzard Climb",
    duration: 45,
    baseSpeed: 305,
    spawnInterval: 520,
    hazardChance: 0.3,
    ramp: 6,
    bg: "storm",
  },
  {
    name: "Final Stretch: Summit Blizzard",
    duration: 30,
    baseSpeed: 325,
    spawnInterval: 460,
    hazardChance: 0.33,
    ramp: 6.5,
    bg: "storm",
  },
];

const TOTAL_DURATION = LEVELS.reduce((s, l) => s + l.duration, 0);
const STARTING_LIVES = 3;
const INVULN_MS = 1000;

/* ----------------------------- STATE ----------------------------- */

const images = {};
let canvas, ctx, wrap;
let dpr = 1;
let W = 0, H = 0; // logical (CSS) pixel size

let state = "start"; // start | countdown | playing | transition | gameover | win | leaderboard
let previousScreenForLeaderboard = "start";

let player, items, popups;
let score = 0;
let lives = STARTING_LIVES;
let levelIndex = 0;
let levelElapsed = 0;
let spawnTimer = 0;
let shakeUntil = 0;
let lastTs = 0;
let snowBits = [];

/* ----------------------------- DOM ----------------------------- */

const el = {
  screens: {
    start: document.getElementById("screen-start"),
    game: document.getElementById("screen-game"),
    gameover: document.getElementById("screen-gameover"),
    win: document.getElementById("screen-win"),
    leaderboard: document.getElementById("screen-leaderboard"),
  },
  playerName: document.getElementById("player-name"),
  btnStart: document.getElementById("btn-start"),
  btnShowLeaderboard: document.getElementById("btn-show-leaderboard"),
  btnCloseLeaderboard: document.getElementById("btn-close-leaderboard"),
  btnRetry: document.getElementById("btn-retry"),
  btnGameoverLeaderboard: document.getElementById("btn-gameover-leaderboard"),
  btnPlayAgain: document.getElementById("btn-play-again"),
  btnWinLeaderboard: document.getElementById("btn-win-leaderboard"),
  btnSubmitGameover: document.getElementById("btn-submit-gameover"),
  btnSkipGameover: document.getElementById("btn-skip-gameover"),
  btnSubmitWin: document.getElementById("btn-submit-win"),
  btnSkipWin: document.getElementById("btn-skip-win"),
  firebaseStatus: document.getElementById("firebase-status"),
  lives: document.getElementById("lives"),
  scoreEl: document.getElementById("score"),
  levelBanner: document.getElementById("level-banner"),
  progressFill: document.getElementById("mountain-progress-fill"),
  floatingBanner: document.getElementById("floating-banner"),
  countdownOverlay: document.getElementById("countdown-overlay"),
  finalScore: document.getElementById("finalScore"),
  finalLevel: document.getElementById("finalLevel"),
  submitStatus: document.getElementById("submit-status"),
  winScore: document.getElementById("winScore"),
  winLives: document.getElementById("winLives"),
  winSubmitStatus: document.getElementById("win-submit-status"),
  leaderboardList: document.getElementById("leaderboard-list"),
  leaderboardSource: document.getElementById("leaderboard-source"),
};

function showScreen(name) {
  Object.entries(el.screens).forEach(([key, node]) => {
    node.classList.toggle("hidden", key !== name);
  });
}

/* ----------------------------- UTIL ----------------------------- */

function weightedPick(list) {
  const total = list.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * total;
  for (const o of list) {
    if (r < o.weight) return o;
    r -= o.weight;
  }
  return list[list.length - 1];
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function loadAllImages() {
  const entries = Object.entries(IMAGE_SOURCES);
  const loaded = await Promise.all(entries.map(([, src]) => loadImage(src)));
  entries.forEach(([key], i) => (images[key] = loaded[i]));
  await warmEmojiImages();
}

function warmEmojiImages() {
  const requests = [
    ...HAZARD_TYPES.map((h) => [h.char, 1]),
    ["🏝️ 🌴 🏝️", 3.3],
  ];
  return Promise.all(
    requests.map(
      ([text, aspectRatio]) =>
        new Promise((resolve) => {
          const img = getEmojiImage(text, aspectRatio);
          if (img.complete) resolve();
          else {
            img.onload = resolve;
            img.onerror = resolve;
          }
        })
    )
  );
}

function formatTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/* ----------------------------- CANVAS SETUP ----------------------------- */

function setupCanvas() {
  canvas = document.getElementById("game-canvas");
  ctx = canvas.getContext("2d");
  wrap = document.getElementById("canvas-wrap");
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
}

function resizeCanvas() {
  dpr = window.devicePixelRatio || 1;
  const rect = wrap.getBoundingClientRect();
  W = Math.max(1, Math.floor(rect.width));
  H = Math.max(1, Math.floor(rect.height));
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (player) {
    player.w = clamp(W * 0.22, 70, 150);
    player.h = player.w * 0.62;
    player.y = H - player.h - 18;
    player.x = clamp(player.x, player.w / 2, W - player.w / 2);
    player.targetX = player.x;
  }
}

/* ----------------------------- INPUT ----------------------------- */

const keys = { left: false, right: false };
const KEY_SPEED = 560; // px/sec when using keyboard

function bindInput() {
  window.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "a", "A"].includes(e.key)) keys.left = true;
    if (["ArrowRight", "d", "D"].includes(e.key)) keys.right = true;
  });
  window.addEventListener("keyup", (e) => {
    if (["ArrowLeft", "a", "A"].includes(e.key)) keys.left = false;
    if (["ArrowRight", "d", "D"].includes(e.key)) keys.right = false;
  });

  function pointerToX(clientX) {
    const rect = canvas.getBoundingClientRect();
    return clamp(clientX - rect.left, 0, rect.width);
  }

  canvas.addEventListener("mousemove", (e) => {
    if (!player) return;
    player.targetX = pointerToX(e.clientX);
    player.usingPointer = true;
  });

  canvas.addEventListener(
    "touchmove",
    (e) => {
      if (!player) return;
      const t = e.touches[0];
      if (t) {
        player.targetX = pointerToX(t.clientX);
        player.usingPointer = true;
      }
      e.preventDefault();
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchstart",
    (e) => {
      if (!player) return;
      const t = e.touches[0];
      if (t) {
        player.targetX = pointerToX(t.clientX);
        player.usingPointer = true;
      }
    },
    { passive: false }
  );
}

/* ----------------------------- ENTITIES ----------------------------- */

function resetGame() {
  score = 0;
  lives = STARTING_LIVES;
  levelIndex = 0;
  levelElapsed = 0;
  spawnTimer = 300;
  shakeUntil = 0;
  items = [];
  popups = [];
  player = {
    x: W / 2,
    targetX: W / 2,
    w: clamp(W * 0.22, 70, 150),
    h: 0,
    y: 0,
    invulnUntil: 0,
    tilt: 0,
  };
  player.h = player.w * 0.62;
  player.y = H - player.h - 18;

  snowBits = Array.from({ length: 40 }, () => spawnSnowBit(true));

  updateLivesHud();
  updateScoreHud();
  updateLevelHud(true);
}

function spawnSnowBit(randomY) {
  return {
    x: Math.random() * W,
    y: randomY ? Math.random() * H : -10,
    r: 1.5 + Math.random() * 2.5,
    speed: 20 + Math.random() * 30,
    drift: (Math.random() - 0.5) * 20,
  };
}

function currentLevel() {
  return LEVELS[levelIndex];
}

function currentFallSpeed() {
  const lvl = currentLevel();
  return lvl.baseSpeed + levelElapsed * lvl.ramp;
}

function spawnItem() {
  const lvl = currentLevel();
  const isHazard = Math.random() < lvl.hazardChance;
  const size = clamp(W * 0.1, 40, 78);
  const speed = currentFallSpeed() + (Math.random() * 40 - 20);
  const x = clamp(Math.random() * W, size, W - size);

  if (isHazard) {
    const h = weightedPick(HAZARD_TYPES);
    items.push({
      type: "hazard",
      kind: h.kind,
      char: h.char,
      imgKey: h.key,
      x,
      y: -size,
      size,
      speed,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 2.4,
    });
  } else {
    const a = weightedPick(AXOLOTL_TYPES);
    items.push({
      type: "axolotl",
      imgKey: a.key,
      points: a.points,
      x,
      y: -size,
      size,
      speed,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 1.4,
    });
  }
}

function addPopup(x, y, text, color) {
  popups.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
}

function showFloatingBanner(text, ms = 1700) {
  el.floatingBanner.textContent = text;
  el.floatingBanner.classList.remove("hidden");
  // restart animation
  el.floatingBanner.style.animation = "none";
  void el.floatingBanner.offsetWidth;
  el.floatingBanner.style.animation = "";
  clearTimeout(showFloatingBanner._t);
  showFloatingBanner._t = setTimeout(() => {
    el.floatingBanner.classList.add("hidden");
  }, ms);
}

/* ----------------------------- HUD ----------------------------- */

function updateLivesHud() {
  el.lives.textContent = "❤️".repeat(lives) + "🤍".repeat(STARTING_LIVES - lives);
}

function updateScoreHud() {
  el.scoreEl.textContent = `Score: ${score}`;
}

function updateLevelHud(force) {
  const lvl = currentLevel();
  const remaining = lvl.duration - levelElapsed;
  el.levelBanner.textContent = `${lvl.name} — ${formatTime(remaining)}`;

  const completedDuration = LEVELS.slice(0, levelIndex).reduce((s, l) => s + l.duration, 0);
  const pct = clamp(((completedDuration + levelElapsed) / TOTAL_DURATION) * 100, 0, 100);
  el.progressFill.style.width = pct.toFixed(1) + "%";
}

/* ----------------------------- GAME FLOW ----------------------------- */

function startCountdown() {
  showScreen("game");
  resizeCanvas();
  resetGame();
  state = "countdown";
  const steps = ["3", "2", "1", "GO! 🐾"];
  let i = 0;
  el.countdownOverlay.classList.remove("hidden");
  el.countdownOverlay.textContent = steps[i];
  const iv = setInterval(() => {
    i++;
    if (i >= steps.length) {
      clearInterval(iv);
      el.countdownOverlay.classList.add("hidden");
      state = "playing";
      showFloatingBanner(`${currentLevel().name}!`);
      lastTs = performance.now();
      return;
    }
    el.countdownOverlay.textContent = steps[i];
  }, 600);
}

function endLevelOrAdvance() {
  if (levelIndex < LEVELS.length - 1) {
    state = "transition";
    items = [];
    const nextName = LEVELS[levelIndex + 1].name;
    showFloatingBanner(
      levelIndex === LEVELS.length - 2 ? `❗ ${nextName} ❗` : `${nextName}!`,
      1600
    );
    setTimeout(() => {
      levelIndex++;
      levelElapsed = 0;
      spawnTimer = 200;
      state = "playing";
      updateLevelHud();
    }, 1500);
  } else {
    winGame();
  }
}

function hitHazard() {
  const now = performance.now();
  if (now < player.invulnUntil) return;
  lives--;
  player.invulnUntil = now + INVULN_MS;
  shakeUntil = now + 260;
  updateLivesHud();
  if (lives <= 0) {
    loseGame();
  }
}

function catchAxolotl(item) {
  score += item.points;
  updateScoreHud();
  addPopup(item.x, player.y, `+${item.points}`, item.points > 10 ? "#ffb703" : "#12c2c2");
}

function loseGame() {
  state = "gameover";
  el.finalScore.textContent = score;
  el.finalLevel.textContent = `${levelIndex + 1} / ${LEVELS.length}`;
  showScreen("gameover");
  resetLeaderboardChoice(el.btnSubmitGameover, el.btnSkipGameover, el.submitStatus);
}

function winGame() {
  state = "win";
  el.winScore.textContent = score;
  el.winLives.textContent = lives;
  showScreen("win");
  resetLeaderboardChoice(el.btnSubmitWin, el.btnSkipWin, el.winSubmitStatus);
}

function resetLeaderboardChoice(submitBtn, skipBtn, statusEl) {
  submitBtn.disabled = false;
  skipBtn.disabled = false;
  statusEl.textContent = "Add your score to the global leaderboard?";
}

async function submitCurrentScore(submitBtn, skipBtn, statusEl, levelReached) {
  submitBtn.disabled = true;
  skipBtn.disabled = true;
  statusEl.textContent = "Saving your score…";
  const name = getSavedName();
  const result = await submitScore(name, score, levelReached);
  statusEl.textContent =
    result.mode === "online"
      ? "🌐 Score saved to the online leaderboard!"
      : "💾 Score saved to your local leaderboard.";
}

function skipCurrentScore(submitBtn, skipBtn, statusEl) {
  submitBtn.disabled = true;
  skipBtn.disabled = true;
  statusEl.textContent = "Kept private — your score was not added to the leaderboard.";
}

function getSavedName() {
  const val = (el.playerName.value || "").trim();
  if (val) localStorage.setItem("axolotl-avalanche-name", val);
  return val || "Axolotl Fan";
}

/* ----------------------------- UPDATE / RENDER ----------------------------- */

function update(dt) {
  // player movement
  if (keys.left) player.targetX -= KEY_SPEED * dt;
  if (keys.right) player.targetX += KEY_SPEED * dt;
  player.targetX = clamp(player.targetX, player.w / 2, W - player.w / 2);
  const dx = player.targetX - player.x;
  player.x += dx * Math.min(1, dt * 12);
  player.tilt = clamp(dx * 0.02, -0.35, 0.35);

  if (state !== "playing") {
    updateAmbient(dt);
    return;
  }

  // level timer
  levelElapsed += dt;
  updateLevelHud();
  if (levelElapsed >= currentLevel().duration) {
    endLevelOrAdvance();
  }

  // spawning
  spawnTimer -= dt * 1000;
  if (spawnTimer <= 0) {
    spawnItem();
    const lvl = currentLevel();
    spawnTimer = lvl.spawnInterval * (0.7 + Math.random() * 0.6);
  }

  // items
  const playerTop = player.y;
  const playerLeft = player.x - player.w / 2;
  const playerRight = player.x + player.w / 2;

  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    it.y += it.speed * dt;
    it.rot += it.rotSpeed * dt;

    const reachedCatchLine = it.y + it.size / 2 >= playerTop;
    if (reachedCatchLine) {
      const withinX = it.x + it.size * 0.32 >= playerLeft && it.x - it.size * 0.32 <= playerRight;
      const pastBottom = it.y - it.size / 2 > player.y + player.h;

      if (withinX && !pastBottom) {
        if (it.type === "axolotl") {
          catchAxolotl(it);
        } else {
          hitHazard();
        }
        items.splice(i, 1);
        continue;
      }
      if (it.y - it.size / 2 > H) {
        items.splice(i, 1);
        continue;
      }
    }
  }

  // popups
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.life -= dt;
    p.y -= 40 * dt;
    if (p.life <= 0) popups.splice(i, 1);
  }

  updateAmbient(dt);
}

function updateAmbient(dt) {
  for (const s of snowBits) {
    s.y += s.speed * dt;
    s.x += s.drift * dt;
    if (s.y > H + 10) Object.assign(s, spawnSnowBit(false), { x: Math.random() * W });
    if (s.x < -10) s.x = W + 10;
    if (s.x > W + 10) s.x = -10;
  }
}

const BG_THEMES = {
  day: { sky: ["#ffd9f0", "#ffe9a8", "#bdeeff"], mountainBack: "#a685e2", mountainFront: "#6a4c93" },
  dusk: { sky: ["#ff9de2", "#8fd0ff", "#5aa9ff"], mountainBack: "#5c4a8f", mountainFront: "#3c2f66" },
  storm: { sky: ["#7b6cd9", "#4f6fc9", "#274a9e"], mountainBack: "#463a72", mountainFront: "#2a2350" },
};

function drawBackground() {
  const lvl = currentLevel();
  const theme = BG_THEMES[lvl.bg] || BG_THEMES.day;

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, theme.sky[0]);
  grad.addColorStop(0.5, theme.sky[1]);
  grad.addColorStop(1, theme.sky[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // sun/moon glow
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#fff3b0";
  ctx.beginPath();
  ctx.arc(W * 0.78, H * 0.16, Math.max(20, W * 0.08), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // archipelago glimpse near the top during the final stretch
  if (lvl.bg === "storm") {
    ctx.save();
    ctx.globalAlpha = 0.5;
    const bannerImg = getEmojiImage("🏝️ 🌴 🏝️", 3.3);
    if (bannerImg.complete && bannerImg.naturalWidth) {
      const bh = Math.max(16, W * 0.05) * 1.3;
      const bw = bh * 3.3;
      ctx.drawImage(bannerImg, W / 2 - bw / 2, H * 0.1 - bh / 2, bw, bh);
    }
    ctx.restore();
  }

  drawMountainLayer(theme.mountainBack, 0.55, 0.18, 6);
  drawMountainLayer(theme.mountainFront, 0.78, 0.12, 5);

  // ambient falling snow (cosmetic only)
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (const s of snowBits) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawMountainLayer(color, heightFrac, jag, peaks) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  const baseY = H;
  const peakY = H * (1 - heightFrac);
  ctx.moveTo(0, baseY);
  const step = W / peaks;
  for (let i = 0; i <= peaks; i++) {
    const x = i * step;
    const variance = Math.sin(i * 12.9) * H * jag * 0.5;
    const y = i % 2 === 0 ? peakY + variance * 0.3 : peakY - Math.abs(variance);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, baseY);
  ctx.closePath();
  ctx.fill();

  // snow caps
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (let i = 0; i <= peaks; i += 2) {
    const x = i * step;
    const variance = Math.sin(i * 12.9) * H * jag * 0.5;
    const y = i % 2 === 0 ? peakY + variance * 0.3 : peakY - Math.abs(variance);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - step * 0.22, y + step * 0.28);
    ctx.lineTo(x + step * 0.22, y + step * 0.28);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawItem(it) {
  ctx.save();
  ctx.translate(it.x, it.y);
  ctx.rotate(it.rot);
  const s = it.size;
  if (it.type === "axolotl" || it.kind === "image") {
    const img = images[it.imgKey];
    if (img) {
      const ratio = img.width / img.height;
      let dw = s, dh = s;
      if (ratio > 1) dh = s / ratio;
      else dw = s * ratio;
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    }
  } else {
    const img = getEmojiImage(it.char);
    if (img.complete && img.naturalWidth) {
      const size = s * 1.05;
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    }
  }
  ctx.restore();
}

function drawPlayer() {
  const flashing = performance.now() < player.invulnUntil;
  ctx.save();
  ctx.translate(player.x, player.y + player.h / 2);
  ctx.rotate(player.tilt);
  if (flashing && Math.floor(performance.now() / 100) % 2 === 0) {
    ctx.globalAlpha = 0.45;
  }
  const img = images.lilypad;
  if (img) {
    ctx.drawImage(img, -player.w / 2, -player.h / 2, player.w, player.h);
  }
  ctx.restore();
}

function drawPopups() {
  ctx.save();
  ctx.textAlign = "center";
  for (const p of popups) {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.restore();
}

function render() {
  ctx.save();
  const now = performance.now();
  if (now < shakeUntil) {
    const mag = 6;
    ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
  }
  drawBackground();
  for (const it of items) drawItem(it);
  drawPlayer();
  drawPopups();
  ctx.restore();
}

/* ----------------------------- MAIN LOOP ----------------------------- */

function loop(ts) {
  requestAnimationFrame(loop);
  const dt = Math.min((ts - lastTs) / 1000, 0.05);
  lastTs = ts;
  if (state === "playing" || state === "transition" || state === "countdown") {
    update(dt);
  }
  if (
    state === "playing" ||
    state === "transition" ||
    state === "countdown" ||
    state === "gameover" ||
    state === "win"
  ) {
    render();
  }
}

/* ----------------------------- LEADERBOARD UI ----------------------------- */

async function openLeaderboard(fromScreen) {
  previousScreenForLeaderboard = fromScreen;
  showScreen("leaderboard");
  el.leaderboardList.innerHTML = '<li class="leaderboard-empty">Loading…</li>';
  const mode = await getMode();
  el.leaderboardSource.textContent =
    mode === "online" ? "🌐 Online leaderboard" : "💾 Local leaderboard (this browser only)";
  const scores = await getTopScores(10);
  if (!scores.length) {
    el.leaderboardList.innerHTML = '<li class="leaderboard-empty">No scores yet — be the first! 🦎</li>';
    return;
  }
  el.leaderboardList.innerHTML = scores
    .map(
      (s) =>
        `<li><span class="lb-name">${escapeHtml(s.name || "Axolotl Fan")}</span><span class="lb-score">${s.score}</span></li>`
    )
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ----------------------------- WIRE UP UI ----------------------------- */

function bindUi() {
  const savedName = localStorage.getItem("axolotl-avalanche-name");
  if (savedName) el.playerName.value = savedName;

  el.btnStart.addEventListener("click", () => {
    getSavedName();
    startCountdown();
  });
  el.btnShowLeaderboard.addEventListener("click", () => openLeaderboard("start"));
  el.btnCloseLeaderboard.addEventListener("click", () => showScreen(previousScreenForLeaderboard));
  el.btnRetry.addEventListener("click", () => startCountdown());
  el.btnPlayAgain.addEventListener("click", () => startCountdown());
  el.btnGameoverLeaderboard.addEventListener("click", () => openLeaderboard("gameover"));
  el.btnWinLeaderboard.addEventListener("click", () => openLeaderboard("win"));
  el.btnSubmitGameover.addEventListener("click", () =>
    submitCurrentScore(el.btnSubmitGameover, el.btnSkipGameover, el.submitStatus, levelIndex + 1)
  );
  el.btnSkipGameover.addEventListener("click", () =>
    skipCurrentScore(el.btnSubmitGameover, el.btnSkipGameover, el.submitStatus)
  );
  el.btnSubmitWin.addEventListener("click", () =>
    submitCurrentScore(el.btnSubmitWin, el.btnSkipWin, el.winSubmitStatus, LEVELS.length)
  );
  el.btnSkipWin.addEventListener("click", () =>
    skipCurrentScore(el.btnSubmitWin, el.btnSkipWin, el.winSubmitStatus)
  );

  getMode().then((mode) => {
    el.firebaseStatus.textContent =
      mode === "online"
        ? "🌐 Online leaderboard connected"
        : "💾 Playing with a local leaderboard — see firebase-config.js to go online";
  });
}

/* ----------------------------- INIT ----------------------------- */

async function init() {
  setupCanvas();
  bindInput();
  bindUi();
  try {
    await loadAllImages();
  } catch (err) {
    console.error("[Axolotl Avalanche] Failed to load images", err);
  }
  showScreen("start");
  requestAnimationFrame((ts) => {
    lastTs = ts;
    requestAnimationFrame(loop);
  });
}

init();
