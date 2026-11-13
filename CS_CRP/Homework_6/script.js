// --- Canvas Setup ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

// --- Colour Palette Constants ---
const PRUSSIAN_BLUE = "#0b2852";
const INDIGO_VELVET = "#533a7b";
const PERIWINKLE = "#aeadf0";
const PINK_ORCHID = "#dda9cb";
const BUBBLEGUM_PINK = "#f7567c";

// --- Audio ---
let audioCtx = null;
let isMuted = false;

// --- LocalStorage Keys & Helpers ---
const STORAGE_PREFIX = "starSeeker_";
const KEY_HIGH_SCORE = STORAGE_PREFIX + "highScore";
const KEY_MUTED = STORAGE_PREFIX + "isMuted";

function loadStorage(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    if (val === null) return fallback;
    const parsed = JSON.parse(val);
    return parsed;
  } catch (e) {
    return fallback;
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Graceful fallback if storage disabled/quota exceeded
  }
}

function removeStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    // Graceful fallback
  }
}

// Initialise saved preferences safely
const savedMuted = loadStorage(KEY_MUTED, false);
isMuted = typeof savedMuted === "boolean" ? savedMuted : false;

let highScore = 0;
const loadedHighScore = loadStorage(KEY_HIGH_SCORE, 0);
if (typeof loadedHighScore === "number" && Number.isFinite(loadedHighScore) && loadedHighScore >= 0) {
  highScore = Math.floor(loadedHighScore);
}

function setMuteState(muted) {
  isMuted = !!muted;
  saveStorage(KEY_MUTED, isMuted);
}

function resetAllSavedData() {
  removeStorage(KEY_HIGH_SCORE);
  removeStorage(KEY_MUTED);
  highScore = 0;
  isMuted = false;
}

// --- Visual Effects ---
let visualEffects = [];
let eternityFlashTimer = 0;
let shakeTimer = 0;
let shakeIntensity = 0;
let gameOverFadeTimer = 0;
const GAME_OVER_FADE_DURATION = 0.5;

// --- Reduced Motion ---
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// --- Background Buffer ---
let backgroundCanvas = null;
let backgroundCtx = null;

// --- Game State Variables ---
let gameState = "start"; // "start" | "playing" | "paused" | "gameover"
let score = 0;
const MAX_LIVES = 7;
let lives = MAX_LIVES;
let fallingObjects = [];

let spawnTimer = 0;
let spawnInterval = 1.0; // seconds between spawns
let difficultyTimer = 0;
const DIFFICULTY_INTERVAL = 30; // seconds

const keys = {};
let lastTime = 0;
let animationId = null;

// Confirmation states
let restartConfirmActive = false;
let resetDataConfirmActive = false;
let resetDataConfirmTimer = 0;
let isNewHighScoreAchieved = false;

// Control button regions for hit detection
const UI_BUTTONS = {
  mute: { x: CANVAS_WIDTH - 45, y: 12, w: 24, h: 24 },
  pause: { x: CANVAS_WIDTH - 80, y: 12, w: 24, h: 24 },
  restartHUD: { x: CANVAS_WIDTH - 115, y: 12, w: 24, h: 24 },
  pauseResume: { x: CANVAS_WIDTH / 2 - 120, y: CANVAS_HEIGHT / 2 - 20, w: 240, h: 36 },
  pauseRestart: { x: CANVAS_WIDTH / 2 - 140, y: CANVAS_HEIGHT / 2 + 25, w: 280, h: 36 },
  pauseMenu: { x: CANVAS_WIDTH / 2 - 120, y: CANVAS_HEIGHT / 2 + 70, w: 240, h: 36 },
  resetDataStart: { x: CANVAS_WIDTH / 2 - 150, y: CANVAS_HEIGHT - 45, w: 300, h: 30 }
};

// --- Planet Object ---
const planet = {
  width: 60,
  height: 20,
  x: (CANVAS_WIDTH - 60) / 2,
  y: 560,
  speed: 400, // pixels per second
  dx: 0
};

// Pointer / Touch-and-Drag state
let isDraggingPlanet = false;
let dragPointerId = null;
let dragTargetX = null;

function pauseGame() {
  if (gameState === "playing") {
    gameState = "paused";
    restartConfirmActive = false;
    isDraggingPlanet = false;
    dragPointerId = null;
    dragTargetX = null;
    for (const k in keys) {
      delete keys[k];
    }
  }
}

function resumeGame() {
  if (gameState === "paused") {
    gameState = "playing";
    restartConfirmActive = false;
    isDraggingPlanet = false;
    dragPointerId = null;
    dragTargetX = null;
    lastTime = 0; // Prevent delta spike
    for (const k in keys) {
      delete keys[k];
    }
  }
}

function returnToMenu() {
  resetGameState();
  gameState = "start";
  restartConfirmActive = false;
  resetDataConfirmActive = false;
  isDraggingPlanet = false;
  dragPointerId = null;
  dragTargetX = null;
}

// Window visibility change & blur -> auto-pause during gameplay
document.addEventListener("visibilitychange", () => {
  if (document.hidden && gameState === "playing") {
    pauseGame();
  }
});

window.addEventListener("blur", () => {
  if (gameState === "playing") {
    pauseGame();
  }
});

// --- Input Handlers ---
window.addEventListener("keydown", (e) => {
  // Prevent page scrolling on arrow keys and space
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
    e.preventDefault();
  }

  // Mute toggle shortcut (works anywhere)
  if (e.key === "m" || e.key === "M") {
    setMuteState(!isMuted);
    e.preventDefault();
    return;
  }

  // Pause / Resume toggle via Esc or P
  if (e.key === "Escape" || e.key === "p" || e.key === "P") {
    if (gameState === "playing") {
      pauseGame();
      e.preventDefault();
      return;
    } else if (gameState === "paused") {
      resumeGame();
      e.preventDefault();
      return;
    }
  }

  if (gameState === "start") {
    if (!e.repeat) {
      resetDataConfirmActive = false;
      startGame();
    }
    return;
  }

  if (gameState === "gameover") {
    if (!e.repeat) {
      restartGame();
    }
    return;
  }

  if (gameState === "paused") {
    // While paused, ignore movement and other keys
    return;
  }

  keys[e.key] = true;
});

window.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});

function isInside(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

function getCanvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = CANVAS_WIDTH / rect.width;
  const scaleY = CANVAS_HEIGHT / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

// Pointer Events for Touch-and-Drag / Mouse-and-Drag of Planet
canvas.addEventListener("pointerdown", (e) => {
  if (gameState !== "playing") return;

  const pt = getCanvasPoint(e);

  // Check if click/touch is on any active HUD button (Mute, Pause, Restart)
  if (isInside(pt, UI_BUTTONS.mute) ||
      isInside(pt, UI_BUTTONS.pause) ||
      isInside(pt, UI_BUTTONS.restartHUD)) {
    return; // Don't initiate planet drag when tapping HUD buttons
  }

  // Hit area for planet drag initiation:
  // Allow initiating drag by touching near the planet or anywhere across the lower play area
  const touchPadding = 40;
  const planetHitBox = {
    x: planet.x - touchPadding,
    y: planet.y - touchPadding,
    w: planet.width + touchPadding * 2,
    h: planet.height + touchPadding * 2
  };
  const isLowerPlayArea = pt.y >= CANVAS_HEIGHT - 120;

  if (isInside(pt, planetHitBox) || isLowerPlayArea) {
    isDraggingPlanet = true;
    dragPointerId = e.pointerId;
    dragTargetX = pt.x - planet.width / 2;
    // Clamp immediately
    if (dragTargetX < 0) dragTargetX = 0;
    if (dragTargetX + planet.width > CANVAS_WIDTH) {
      dragTargetX = CANVAS_WIDTH - planet.width;
    }
    planet.x = dragTargetX;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {}
  }
});

canvas.addEventListener("pointermove", (e) => {
  if (!isDraggingPlanet || gameState !== "playing") return;
  if (dragPointerId !== null && e.pointerId !== dragPointerId) return;

  const pt = getCanvasPoint(e);
  dragTargetX = pt.x - planet.width / 2;

  // Clamp to canvas bounds
  if (dragTargetX < 0) {
    dragTargetX = 0;
  }
  if (dragTargetX + planet.width > CANVAS_WIDTH) {
    dragTargetX = CANVAS_WIDTH - planet.width;
  }
  planet.x = dragTargetX;
});

function endPlanetDrag(e) {
  if (dragPointerId !== null && e && e.pointerId !== undefined && e.pointerId !== dragPointerId) {
    return;
  }
  isDraggingPlanet = false;
  dragPointerId = null;
  dragTargetX = null;
}

canvas.addEventListener("pointerup", endPlanetDrag);
canvas.addEventListener("pointercancel", endPlanetDrag);
window.addEventListener("pointerup", endPlanetDrag);
window.addEventListener("pointercancel", endPlanetDrag);

// Canvas click handler
canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = CANVAS_WIDTH / rect.width;
  const scaleY = CANVAS_HEIGHT / rect.height;
  const click = {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };

  // Mute button click (always clickable in all states)
  if (isInside(click, UI_BUTTONS.mute)) {
    setMuteState(!isMuted);
    return;
  }

  // State: START SCREEN
  if (gameState === "start") {
    if (isInside(click, UI_BUTTONS.resetDataStart)) {
      if (!resetDataConfirmActive) {
        resetDataConfirmActive = true;
        resetDataConfirmTimer = performance.now();
      } else {
        resetAllSavedData();
        resetDataConfirmActive = false;
        resetDataConfirmTimer = 0;
      }
      return;
    }

    resetDataConfirmActive = false;
    resetDataConfirmTimer = 0;
    startGame();
    return;
  }

  // State: PLAYING
  if (gameState === "playing") {
    if (isInside(click, UI_BUTTONS.pause)) {
      pauseGame();
      return;
    }
    if (isInside(click, UI_BUTTONS.restartHUD)) {
      pauseGame();
      restartConfirmActive = true;
      return;
    }
    return;
  }

  // State: PAUSED
  if (gameState === "paused") {
    // Resume button
    if (isInside(click, UI_BUTTONS.pauseResume)) {
      resumeGame();
      return;
    }

    // Restart button with confirmation
    if (isInside(click, UI_BUTTONS.pauseRestart)) {
      if (!restartConfirmActive) {
        restartConfirmActive = true;
      } else {
        restartGame();
      }
      return;
    }

    // Return to menu button
    if (isInside(click, UI_BUTTONS.pauseMenu)) {
      returnToMenu();
      return;
    }
    return;
  }

  // State: GAMEOVER
  if (gameState === "gameover") {
    restartGame();
  }
});

// --- Game Control Functions ---
function resetGameState() {
  score = 0;
  lives = MAX_LIVES;
  fallingObjects = [];
  visualEffects = [];
  eternityFlashTimer = 0;
  shakeTimer = 0;
  shakeIntensity = 0;
  gameOverFadeTimer = 0;
  spawnTimer = 0;
  spawnInterval = 1.0;
  difficultyTimer = 0;

  planet.x = (CANVAS_WIDTH - planet.width) / 2;
  planet.dx = 0;
  isDraggingPlanet = false;
  dragPointerId = null;
  dragTargetX = null;
  isNewHighScoreAchieved = false;

  // Clear stuck keys
  for (const k in keys) {
    delete keys[k];
  }
}

function startGame() {
  initAudio();
  resetGameState();
  restartConfirmActive = false;
  resetDataConfirmActive = false;
  lastTime = 0;
  gameState = "playing";
}

function restartGame() {
  initAudio();
  resetGameState();
  restartConfirmActive = false;
  resetDataConfirmActive = false;
  lastTime = 0;
  gameState = "playing";
}

// --- Audio System (Web Audio API) ---
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function playSoundStarCollected() {
  if (isMuted || !audioCtx) return;

  const now = audioCtx.currentTime;

  // Note 1 — short high ping (A5)
  const osc1 = audioCtx.createOscillator();
  const gain1 = audioCtx.createGain();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(880, now);
  gain1.gain.setValueAtTime(0.15, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc1.connect(gain1).connect(audioCtx.destination);
  osc1.start(now);
  osc1.stop(now + 0.12);

  // Note 2 — slightly higher, slightly delayed (D6)
  const osc2 = audioCtx.createOscillator();
  const gain2 = audioCtx.createGain();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(1174.66, now + 0.06);
  gain2.gain.setValueAtTime(0.0001, now);
  gain2.gain.setValueAtTime(0.12, now + 0.06);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc2.connect(gain2).connect(audioCtx.destination);
  osc2.start(now + 0.06);
  osc2.stop(now + 0.2);
}

function playSoundStarMissed() {
  if (isMuted || !audioCtx) return;

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(440, now); // A4
  osc.frequency.exponentialRampToValueAtTime(330, now + 0.15); // Slide down to E4
  gain.gain.setValueAtTime(0.08, now); // Quiet
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.15);
}

function playSoundAsteroidHit() {
  if (isMuted || !audioCtx) return;

  const now = audioCtx.currentTime;

  // Low thump oscillator
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.2);

  // Noise burst (80ms buffer)
  const bufferSize = Math.floor(audioCtx.sampleRate * 0.08);
  const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.3;
  }
  const noise = audioCtx.createBufferSource();
  const noiseGain = audioCtx.createGain();
  noise.buffer = noiseBuffer;
  noiseGain.gain.setValueAtTime(0.12, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  noise.connect(noiseGain).connect(audioCtx.destination);
  noise.start(now);
  noise.stop(now + 0.08);
}

function playSoundGameOver() {
  if (isMuted || !audioCtx) return;

  const now = audioCtx.currentTime;
  const notes = [523.25, 392.00, 261.63]; // C5, G4, C4 descending
  const delays = [0, 0.12, 0.24];

  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + delays[i]);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.setValueAtTime(0.12, now + delays[i]);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delays[i] + 0.35);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now + delays[i]);
    osc.stop(now + delays[i] + 0.35);
  });
}

// --- Visual Effect System ---
function updateEffects(deltaTime) {
  for (let i = 0; i < visualEffects.length; i++) {
    visualEffects[i].age += deltaTime;
  }
  visualEffects = visualEffects.filter((e) => e.age < e.lifetime);
}

function renderEffects(ctx) {
  for (let i = 0; i < visualEffects.length; i++) {
    const effect = visualEffects[i];
    switch (effect.type) {
      case "sparkle":
        renderSparkleEffect(ctx, effect);
        break;
      case "floatText":
        renderFloatTextEffect(ctx, effect);
        break;
      case "impact":
        renderImpactEffect(ctx, effect);
        break;
    }
  }
}

function renderSparkleEffect(ctx, e) {
  const progress = e.age / e.lifetime;
  const opacity = 1 - progress;
  const currentX = e.x + e.vx * e.age;
  const currentY = e.y + e.vy * e.age;
  const currentRadius = e.radius * (1 - progress * 0.5);

  ctx.save();
  ctx.globalAlpha = Math.max(0, opacity);
  ctx.fillStyle = e.color;
  ctx.beginPath();
  ctx.arc(currentX, currentY, currentRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function renderFloatTextEffect(ctx, e) {
  const progress = e.age / e.lifetime;
  const opacity = 1 - progress;
  const currentY = e.y + e.floatSpeed * e.age;

  ctx.save();
  ctx.globalAlpha = Math.max(0, opacity);
  ctx.fillStyle = e.color;
  ctx.font = "bold 16px 'Courier New', 'Lucida Console', 'Consolas', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(e.text, e.x, currentY);
  ctx.restore();
}

function renderImpactEffect(ctx, e) {
  const progress = e.age / e.lifetime;
  const radius = e.maxRadius * progress;
  const opacity = 1 - progress;

  ctx.save();
  ctx.globalAlpha = Math.max(0, opacity * 0.6);
  ctx.strokeStyle = BUBBLEGUM_PINK;
  ctx.lineWidth = 2.5 * (1 - progress);
  ctx.beginPath();
  ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function spawnFloatText(x, y, text, color) {
  visualEffects.push({
    type: "floatText",
    x: x,
    y: y,
    text: text,
    color: color,
    age: 0,
    lifetime: 0.7,
    floatSpeed: -40
  });
}

function spawnStarCollectedEffect(x, y) {
  if (prefersReducedMotion) {
    spawnFloatText(x, y - 10, "+10", PERIWINKLE);
    return;
  }

  const numParticles = 7;
  for (let i = 0; i < numParticles; i++) {
    const angle = (i / numParticles) * 2 * Math.PI + (Math.random() * 0.3);
    const speed = 60 + Math.random() * 40;
    visualEffects.push({
      type: "sparkle",
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      lifetime: 0.35,
      radius: 1.5 + Math.random() * 1.5,
      color: (Math.random() > 0.5) ? PERIWINKLE : PINK_ORCHID
    });
  }

  spawnFloatText(x, y - 10, "+10", PERIWINKLE);
}

function spawnStarMissedEffect(x) {
  spawnFloatText(x, CANVAS_HEIGHT - 30, "−5", BUBBLEGUM_PINK);
}

function triggerEternityFlash() {
  eternityFlashTimer = 0.5;
}

function triggerScreenShake(duration, intensity) {
  if (prefersReducedMotion) return;
  shakeTimer = duration;
  shakeIntensity = intensity;
}

function spawnAsteroidHitEffect(x, y) {
  triggerEternityFlash();

  if (prefersReducedMotion) {
    return;
  }

  visualEffects.push({
    type: "impact",
    x: x,
    y: y,
    age: 0,
    lifetime: 0.4,
    maxRadius: 35
  });

  triggerScreenShake(0.2, 4);
}

// --- Mute Button Renderer ---
function drawMuteButton(ctx) {
  const bx = UI_BUTTONS.mute.x;
  const by = UI_BUTTONS.mute.y;

  ctx.save();
  ctx.strokeStyle = PERIWINKLE;
  ctx.fillStyle = PERIWINKLE;
  ctx.lineWidth = 1.5;

  // Speaker body — small rectangle
  ctx.fillRect(bx + 2, by + 6, 5, 8);

  // Speaker cone — triangle
  ctx.beginPath();
  ctx.moveTo(bx + 7, by + 6);
  ctx.lineTo(bx + 13, by + 2);
  ctx.lineTo(bx + 13, by + 18);
  ctx.lineTo(bx + 7, by + 14);
  ctx.closePath();
  ctx.fill();

  if (!isMuted) {
    // Sound waves — two arcs
    ctx.beginPath();
    ctx.arc(bx + 13, by + 10, 5, -Math.PI / 4, Math.PI / 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(bx + 13, by + 10, 9, -Math.PI / 4, Math.PI / 4);
    ctx.stroke();
  } else {
    // Mute slash — diagonal line in Bubblegum Pink
    ctx.strokeStyle = BUBBLEGUM_PINK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx + 1, by + 1);
    ctx.lineTo(bx + 19, by + 19);
    ctx.stroke();
  }

  ctx.restore();
}

// --- HUD Controls: Mute, Pause & Restart ---
function drawHUDControls(ctx) {
  // 1. Mute Button at (CANVAS_WIDTH - 45, 12)
  drawMuteButton(ctx);

  // 2. Pause Button at (CANVAS_WIDTH - 80, 12)
  const px = UI_BUTTONS.pause.x;
  const py = UI_BUTTONS.pause.y;
  ctx.save();
  ctx.strokeStyle = PERIWINKLE;
  ctx.fillStyle = PERIWINKLE;
  ctx.lineWidth = 1.5;

  // Outline box for clean touch/click target
  ctx.strokeRect(px, py, 24, 24);

  // Two vertical bars
  ctx.fillRect(px + 6, py + 5, 4, 14);
  ctx.fillRect(px + 14, py + 5, 4, 14);
  ctx.restore();

  // 3. Restart Button at (CANVAS_WIDTH - 115, 12)
  const rx = UI_BUTTONS.restartHUD.x;
  const ry = UI_BUTTONS.restartHUD.y;
  ctx.save();
  ctx.strokeStyle = PINK_ORCHID;
  ctx.fillStyle = PINK_ORCHID;
  ctx.lineWidth = 1.5;

  // Outline box
  ctx.strokeRect(rx, ry, 24, 24);

  // Restart circular arrow icon
  ctx.beginPath();
  ctx.arc(rx + 12, ry + 12, 6.5, -Math.PI / 4, 1.3 * Math.PI);
  ctx.stroke();

  // Arrow tip
  ctx.beginPath();
  ctx.moveTo(rx + 15, ry + 6);
  ctx.lineTo(rx + 18, ry + 9);
  ctx.lineTo(rx + 13, ry + 10);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// --- Pause Screen Renderer ---
function renderPauseScreen() {
  // 1. Draw frozen current gameplay state
  renderGame();

  // 2. Semi-transparent backdrop overlay
  ctx.save();
  ctx.fillStyle = "rgba(11, 40, 82, 0.75)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 3. Glowing PAUSED title
  ctx.save();
  ctx.shadowColor = PINK_ORCHID;
  ctx.shadowBlur = 15;
  ctx.fillStyle = PERIWINKLE;
  ctx.font = "bold 42px 'Courier New', 'Lucida Console', 'Consolas', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("GAME PAUSED", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 90);
  ctx.restore();

  // 4. Buttons box helper
  function drawPauseButton(rect, label, isWarning, isConfirm) {
    ctx.save();
    ctx.fillStyle = isWarning ? "rgba(247, 86, 124, 0.2)" : "rgba(83, 58, 123, 0.4)";
    ctx.strokeStyle = isWarning ? BUBBLEGUM_PINK : PERIWINKLE;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    ctx.fillStyle = isWarning ? BUBBLEGUM_PINK : (isConfirm ? PINK_ORCHID : PERIWINKLE);
    ctx.font = "bold 16px 'Courier New', 'Lucida Console', 'Consolas', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.restore();
  }

  // Resume button
  drawPauseButton(UI_BUTTONS.pauseResume, "▶ RESUME (Esc / P)", false, false);

  // Restart button (with confirmation status)
  if (restartConfirmActive) {
    drawPauseButton(UI_BUTTONS.pauseRestart, "CONFIRM RESTART? (CLICK)", true, true);
  } else {
    drawPauseButton(UI_BUTTONS.pauseRestart, "↺ RESTART GAME", false, false);
  }

  // Return to Menu button
  drawPauseButton(UI_BUTTONS.pauseMenu, "✦ MAIN MENU", false, false);

  // Subtitle hint
  ctx.fillStyle = PINK_ORCHID;
  ctx.font = "13px 'Courier New', 'Lucida Console', 'Consolas', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Press ESC or P to resume at any time", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 130);

  ctx.restore();

  // HUD controls remain accessible (mute toggle)
  drawHUDControls(ctx);
}

// --- Spawning Logic ---
function spawnFallingObject() {
  // 65% stars, 35% asteroids
  const isAsteroid = Math.random() < 0.35;
  const width = 20;
  const height = 20;
  const x = Math.random() * (CANVAS_WIDTH - width);
  const y = -height;

  let speed;
  let type;

  if (isAsteroid) {
    type = "asteroid";
    speed = 200 + Math.random() * 100; // 200 - 300 px/sec
  } else {
    type = "star";
    speed = 150 + Math.random() * 100; // 150 - 250 px/sec
  }

  const obj = {
    type: type,
    x: x,
    y: y,
    width: width,
    height: height,
    speed: speed,
    counted: false
  };

  if (type === "asteroid") {
    obj.vertices = generateAsteroidVertices(7);
  }

  fallingObjects.push(obj);
}

// --- Collision Detection ---
function isColliding(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// --- Update Functions ---
function updatePlanet(deltaTime) {
  planet.dx = 0;

  if (keys["ArrowLeft"] || keys["a"] || keys["A"]) {
    planet.dx -= planet.speed;
  }
  if (keys["ArrowRight"] || keys["d"] || keys["D"]) {
    planet.dx += planet.speed;
  }

  // If keyboard keys are actively pressed, override drag
  if (planet.dx !== 0) {
    planet.x += planet.dx * deltaTime;
  } else if (isDraggingPlanet && dragTargetX !== null) {
    planet.x = dragTargetX;
  }

  // Clamp to canvas bounds
  if (planet.x < 0) {
    planet.x = 0;
  }
  if (planet.x + planet.width > CANVAS_WIDTH) {
    planet.x = CANVAS_WIDTH - planet.width;
  }
}

function updateGame(deltaTime) {
  // 1. Update planet
  updatePlanet(deltaTime);

  // 2. Update falling objects position
  for (let i = 0; i < fallingObjects.length; i++) {
    const obj = fallingObjects[i];
    obj.y += obj.speed * deltaTime;
  }

  // 3. Collision detection loop
  for (let i = 0; i < fallingObjects.length; i++) {
    const obj = fallingObjects[i];
    if (obj.counted) continue;

    if (isColliding(planet, obj)) {
      obj.counted = true;
      const collisionX = obj.x + obj.width / 2;
      const collisionY = obj.y + obj.height / 2;
      if (obj.type === "star") {
        score += 10;
        playSoundStarCollected();
        spawnStarCollectedEffect(collisionX, collisionY);
      } else if (obj.type === "asteroid") {
        lives -= 1;
        playSoundAsteroidHit();
        spawnAsteroidHitEffect(collisionX, collisionY);
        if (lives <= 0) {
          gameState = "gameover";
          gameOverFadeTimer = 0;
          playSoundGameOver();
          if (score > highScore) {
            highScore = score;
            isNewHighScoreAchieved = true;
            saveStorage(KEY_HIGH_SCORE, highScore);
          }
          break; // Stop further collision processing once game over
        }
      }
    }
  }

  // 4. Removal pass & miss handling
  fallingObjects = fallingObjects.filter((obj) => {
    // Remove if caught via collision
    if (obj.counted && isColliding(planet, obj)) {
      return false;
    }

    // Passed bottom of canvas
    if (obj.y > CANVAS_HEIGHT) {
      if (obj.type === "star" && !obj.counted) {
        // If already in gameover, do not deduct score or trigger duplicate sounds
        if (gameState !== "gameover") {
          score -= 5;
          playSoundStarMissed();
          spawnStarMissedEffect(obj.x + obj.width / 2);
          if (score < 0) {
            gameState = "gameover";
            gameOverFadeTimer = 0;
            playSoundGameOver();
            if (score > highScore) {
              highScore = score;
              isNewHighScoreAchieved = true;
              saveStorage(KEY_HIGH_SCORE, highScore);
            }
          }
        }
      }
      return false; // Remove regardless of type
    }

    return true; // Keep
  });

  // 5. Update visual feedback timers and effects
  if (eternityFlashTimer > 0) {
    eternityFlashTimer -= deltaTime;
  }
  if (shakeTimer > 0) {
    shakeTimer -= deltaTime;
  }
  updateEffects(deltaTime);

  // If already game over, stop further game state updates
  if (gameState === "gameover") {
    return;
  }

  // 5. Spawning logic
  spawnTimer += deltaTime;
  if (spawnTimer >= spawnInterval) {
    spawnTimer -= spawnInterval;
    spawnFallingObject();
  }

  // 6. Difficulty ramping
  difficultyTimer += deltaTime;
  if (difficultyTimer >= DIFFICULTY_INTERVAL) {
    difficultyTimer -= DIFFICULTY_INTERVAL;
    if (spawnInterval > 0.4) {
      spawnInterval = Math.max(0.4, spawnInterval - 0.1);
    }
  }
}

// --- Visual Helpers & Generation ---
function generateAsteroidVertices(numVertices) {
  const vertices = [];
  for (let i = 0; i < numVertices; i++) {
    const angle = (i / numVertices) * 2 * Math.PI + (Math.random() * 0.3 - 0.15);
    const radius = 12 + (Math.random() * 6 - 3);
    vertices.push({ angle, radius });
  }
  vertices.sort((a, b) => a.angle - b.angle);
  return vertices;
}

function drawStarShape(targetContext, cx, cy, outerR, innerR, points) {
  targetContext.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const radius = (i % 2 === 0) ? outerR : innerR;
    const angle = (i * Math.PI / points) - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) {
      targetContext.moveTo(x, y);
    } else {
      targetContext.lineTo(x, y);
    }
  }
  targetContext.closePath();
}

function generateBackground() {
  backgroundCanvas = document.createElement("canvas");
  backgroundCanvas.width = CANVAS_WIDTH;
  backgroundCanvas.height = CANVAS_HEIGHT;
  backgroundCtx = backgroundCanvas.getContext("2d");

  // Layer 1 — Deep Space Base
  const baseGrad = backgroundCtx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  baseGrad.addColorStop(0, PRUSSIAN_BLUE);
  baseGrad.addColorStop(1, "rgba(83, 58, 123, 0.4)");
  backgroundCtx.fillStyle = PRUSSIAN_BLUE;
  backgroundCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  backgroundCtx.fillStyle = baseGrad;
  backgroundCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Layer 2 — Nebula Clouds (3-4 clouds) with screen blending
  backgroundCtx.save();
  backgroundCtx.globalCompositeOperation = "screen";

  const clouds = [
    { x: 180, y: 140, r: 240, color: "rgba(83, 58, 123, 0.28)" },
    { x: 620, y: 280, r: 200, color: "rgba(221, 169, 203, 0.18)" },
    { x: 200, y: 460, r: 180, color: "rgba(174, 173, 240, 0.15)" },
    { x: 680, y: 100, r: 150, color: "rgba(83, 58, 123, 0.20)" }
  ];

  clouds.forEach(c => {
    const radGrad = backgroundCtx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
    radGrad.addColorStop(0, c.color);
    radGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    backgroundCtx.fillStyle = radGrad;
    backgroundCtx.beginPath();
    backgroundCtx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    backgroundCtx.fill();
  });
  backgroundCtx.restore();

  // Layer 3 — Distant Small Stars (80-120 stars)
  const numDistantStars = 100;
  for (let i = 0; i < numDistantStars; i++) {
    const sx = Math.random() * CANVAS_WIDTH;
    const sy = Math.random() * CANVAS_HEIGHT;
    const radius = 0.5 + Math.random() * 1.3;
    const opacity = 0.3 + Math.random() * 0.6;
    const isPink = Math.random() < 0.2;
    const baseColor = isPink ? "221, 169, 203" : "174, 173, 240";

    if (opacity > 0.7) {
      backgroundCtx.fillStyle = `rgba(${baseColor}, ${opacity * 0.15})`;
      backgroundCtx.beginPath();
      backgroundCtx.arc(sx, sy, radius * 3, 0, Math.PI * 2);
      backgroundCtx.fill();
    }

    backgroundCtx.fillStyle = `rgba(${baseColor}, ${opacity})`;
    backgroundCtx.beginPath();
    backgroundCtx.arc(sx, sy, radius, 0, Math.PI * 2);
    backgroundCtx.fill();
  }

  // Layer 4 — Medium Accent Stars (8-12 stars)
  const numMediumStars = 10;
  for (let i = 0; i < numMediumStars; i++) {
    const sx = Math.random() * CANVAS_WIDTH;
    const sy = Math.random() * CANVAS_HEIGHT;
    const radius = 2.0 + Math.random() * 1.5;
    const opacity = 0.5 + Math.random() * 0.35;

    const halo = backgroundCtx.createRadialGradient(sx, sy, 0, sx, sy, radius * 4);
    halo.addColorStop(0, `rgba(174, 173, 240, ${opacity * 0.4})`);
    halo.addColorStop(1, "rgba(174, 173, 240, 0)");
    backgroundCtx.fillStyle = halo;
    backgroundCtx.beginPath();
    backgroundCtx.arc(sx, sy, radius * 4, 0, Math.PI * 2);
    backgroundCtx.fill();

    backgroundCtx.fillStyle = `rgba(174, 173, 240, ${opacity})`;
    backgroundCtx.beginPath();
    backgroundCtx.arc(sx, sy, radius, 0, Math.PI * 2);
    backgroundCtx.fill();
  }

  // Layer 5 — Large Feature Stars (2-3 stars placed away from centre)
  const featureStars = [
    { x: 90, y: 70 },
    { x: 720, y: 80 },
    { x: 740, y: 500 }
  ];
  featureStars.forEach(fs => {
    // Halo
    const halo = backgroundCtx.createRadialGradient(fs.x, fs.y, 0, fs.x, fs.y, 16);
    halo.addColorStop(0, "rgba(174, 173, 240, 0.25)");
    halo.addColorStop(1, "rgba(174, 173, 240, 0)");
    backgroundCtx.fillStyle = halo;
    backgroundCtx.beginPath();
    backgroundCtx.arc(fs.x, fs.y, 16, 0, Math.PI * 2);
    backgroundCtx.fill();

    // Cross sparkles
    backgroundCtx.strokeStyle = "rgba(174, 173, 240, 0.35)";
    backgroundCtx.lineWidth = 1.5;
    backgroundCtx.beginPath();
    backgroundCtx.moveTo(fs.x - 10, fs.y);
    backgroundCtx.lineTo(fs.x + 10, fs.y);
    backgroundCtx.moveTo(fs.x, fs.y - 10);
    backgroundCtx.lineTo(fs.x, fs.y + 10);
    backgroundCtx.stroke();

    // Core
    backgroundCtx.fillStyle = PERIWINKLE;
    backgroundCtx.beginPath();
    backgroundCtx.arc(fs.x, fs.y, 3, 0, Math.PI * 2);
    backgroundCtx.fill();
  });

  // Layer 6 — Decorative Orbit Ring
  backgroundCtx.save();
  backgroundCtx.beginPath();
  backgroundCtx.ellipse(680, 480, 60, 20, Math.PI / 6, 0, Math.PI * 2);
  backgroundCtx.strokeStyle = "rgba(174, 173, 240, 0.12)";
  backgroundCtx.lineWidth = 1;
  backgroundCtx.stroke();
  backgroundCtx.restore();
}

function drawPlanet(targetCtx, p) {
  const cx = p.x + p.width / 2;
  const cy = p.y + p.height / 2;

  // 1. Outer Atmospheric Glow
  const outerGlow = targetCtx.createRadialGradient(cx, cy, 14, cx, cy, 26);
  outerGlow.addColorStop(0, "rgba(221, 169, 203, 0.3)");
  outerGlow.addColorStop(1, "rgba(221, 169, 203, 0)");
  targetCtx.fillStyle = outerGlow;
  targetCtx.beginPath();
  targetCtx.arc(cx, cy, 26, 0, Math.PI * 2);
  targetCtx.fill();

  // 2. Planet Body with directional lighting
  const bodyGrad = targetCtx.createRadialGradient(cx - 5, cy - 5, 2, cx, cy, 18);
  bodyGrad.addColorStop(0, PERIWINKLE);
  bodyGrad.addColorStop(0.5, PINK_ORCHID);
  bodyGrad.addColorStop(1, INDIGO_VELVET);
  targetCtx.fillStyle = bodyGrad;
  targetCtx.beginPath();
  targetCtx.arc(cx, cy, 18, 0, Math.PI * 2);
  targetCtx.fill();

  // 3. Rim Highlight (sunlit crescent on top-left)
  targetCtx.save();
  targetCtx.beginPath();
  targetCtx.arc(cx, cy, 17.5, Math.PI * 0.9, Math.PI * 1.6);
  targetCtx.strokeStyle = "rgba(221, 169, 203, 0.7)";
  targetCtx.lineWidth = 2;
  targetCtx.stroke();
  targetCtx.restore();

  // 4. Orbit Ring
  targetCtx.save();
  targetCtx.beginPath();
  targetCtx.ellipse(cx, cy, 26, 7, -Math.PI / 12, 0, Math.PI * 2);
  targetCtx.strokeStyle = "rgba(174, 173, 240, 0.5)";
  targetCtx.lineWidth = 1.5;
  targetCtx.stroke();
  targetCtx.restore();
}

function drawCollectibleStar(targetCtx, obj) {
  const cx = obj.x + obj.width / 2;
  const cy = obj.y + obj.height / 2;

  // Outer Glow
  const glow = targetCtx.createRadialGradient(cx, cy, 4, cx, cy, 16);
  glow.addColorStop(0, "rgba(174, 173, 240, 0.5)");
  glow.addColorStop(1, "rgba(174, 173, 240, 0)");
  targetCtx.fillStyle = glow;
  targetCtx.beginPath();
  targetCtx.arc(cx, cy, 16, 0, Math.PI * 2);
  targetCtx.fill();

  // 5-pointed Star Shape
  drawStarShape(targetCtx, cx, cy, 11, 5, 5);
  const starGrad = targetCtx.createLinearGradient(cx, cy - 11, cx, cy + 11);
  starGrad.addColorStop(0, PERIWINKLE);
  starGrad.addColorStop(1, PINK_ORCHID);
  targetCtx.fillStyle = starGrad;
  targetCtx.fill();

  // Bright Centre Core
  targetCtx.fillStyle = "rgba(255, 255, 255, 0.9)";
  targetCtx.beginPath();
  targetCtx.arc(cx, cy, 2, 0, Math.PI * 2);
  targetCtx.fill();
}

function drawAsteroid(targetCtx, obj) {
  const cx = obj.x + obj.width / 2;
  const cy = obj.y + obj.height / 2;

  // Danger Glow
  const glow = targetCtx.createRadialGradient(cx, cy, 8, cx, cy, 18);
  glow.addColorStop(0, "rgba(247, 86, 124, 0.25)");
  glow.addColorStop(1, "rgba(247, 86, 124, 0)");
  targetCtx.fillStyle = glow;
  targetCtx.beginPath();
  targetCtx.arc(cx, cy, 18, 0, Math.PI * 2);
  targetCtx.fill();

  // Rocky Polygon Body
  if (!obj.vertices) {
    obj.vertices = generateAsteroidVertices(7);
  }

  targetCtx.beginPath();
  for (let i = 0; i < obj.vertices.length; i++) {
    const v = obj.vertices[i];
    const vx = cx + Math.cos(v.angle) * v.radius;
    const vy = cy + Math.sin(v.angle) * v.radius;
    if (i === 0) {
      targetCtx.moveTo(vx, vy);
    } else {
      targetCtx.lineTo(vx, vy);
    }
  }
  targetCtx.closePath();

  const bodyGrad = targetCtx.createRadialGradient(cx - 2, cy - 2, 2, cx, cy, 14);
  bodyGrad.addColorStop(0, INDIGO_VELVET);
  bodyGrad.addColorStop(1, PRUSSIAN_BLUE);
  targetCtx.fillStyle = bodyGrad;
  targetCtx.fill();

  targetCtx.strokeStyle = BUBBLEGUM_PINK;
  targetCtx.lineWidth = 1.5;
  targetCtx.stroke();

  // Subtle Craters
  targetCtx.fillStyle = "rgba(11, 40, 82, 0.6)";
  targetCtx.beginPath();
  targetCtx.arc(cx - 3, cy - 2, 2, 0, Math.PI * 2);
  targetCtx.arc(cx + 2, cy + 3, 1.5, 0, Math.PI * 2);
  targetCtx.fill();
}

function drawHUD() {
  const targetFont = "bold 18px 'Courier New', 'Lucida Console', 'Consolas', monospace";
  ctx.font = targetFont;
  ctx.textBaseline = "top";
  ctx.lineWidth = 3;
  ctx.strokeStyle = PRUSSIAN_BLUE;

  // Score HUD (top-left)
  ctx.textAlign = "left";
  const scoreText = "SCORE: " + score;
  ctx.strokeText(scoreText, 15, 15);
  ctx.fillStyle = PERIWINKLE;
  ctx.fillText(scoreText, 15, 15);

  // Eternities HUD (top-right, placed to left of HUD controls at CANVAS_WIDTH - 125)
  ctx.textAlign = "right";
  const eternitiesText = "ETERNITIES: " + lives;
  ctx.strokeText(eternitiesText, CANVAS_WIDTH - 125, 15);
  if (eternityFlashTimer > 0) {
    const flashPhase = Math.floor(eternityFlashTimer * 10) % 2;
    ctx.fillStyle = (flashPhase === 0) ? BUBBLEGUM_PINK : PINK_ORCHID;
  } else {
    ctx.fillStyle = PINK_ORCHID;
  }
  ctx.fillText(eternitiesText, CANVAS_WIDTH - 125, 15);
}

// --- Render Functions ---
function renderStartScreen() {
  if (backgroundCanvas) {
    ctx.drawImage(backgroundCanvas, 0, 0);
  } else {
    ctx.fillStyle = PRUSSIAN_BLUE;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // Title glow
  ctx.save();
  ctx.shadowColor = PINK_ORCHID;
  ctx.shadowBlur = 15;
  ctx.fillStyle = PERIWINKLE;
  ctx.font = "bold 44px 'Courier New', 'Lucida Console', 'Consolas', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("STAR SEEKER", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 95);
  ctx.restore();

  // Tagline
  ctx.fillStyle = PINK_ORCHID;
  ctx.font = "14px 'Courier New', 'Lucida Console', 'Consolas', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("CHASE THE LIGHT. DODGE THE DARK.", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 50);

  // High score display
  ctx.fillStyle = PERIWINKLE;
  ctx.font = "bold 16px 'Courier New', 'Lucida Console', 'Consolas', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("HIGH SCORE: " + highScore, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 15);

  // Pulsing prompt
  const opacity = 0.7 + 0.3 * Math.sin(performance.now() / 500);
  ctx.save();
  ctx.globalAlpha = Math.max(0.2, Math.min(1.0, opacity));
  ctx.fillStyle = PERIWINKLE;
  ctx.font = "18px 'Courier New', 'Lucida Console', 'Consolas', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PRESS ANY KEY TO START", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 35);
  ctx.restore();

  // Auto-revert reset confirmation after 3 seconds
  if (resetDataConfirmActive && performance.now() - resetDataConfirmTimer > 3000) {
    resetDataConfirmActive = false;
    resetDataConfirmTimer = 0;
  }

  // Reset Saved Data control button on Start screen
  const rBtn = UI_BUTTONS.resetDataStart;
  ctx.save();
  ctx.fillStyle = resetDataConfirmActive ? "rgba(247, 86, 124, 0.25)" : "rgba(83, 58, 123, 0.35)";
  ctx.strokeStyle = resetDataConfirmActive ? BUBBLEGUM_PINK : INDIGO_VELVET;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(rBtn.x, rBtn.y, rBtn.w, rBtn.h);
  ctx.fillRect(rBtn.x, rBtn.y, rBtn.w, rBtn.h);

  ctx.fillStyle = resetDataConfirmActive ? BUBBLEGUM_PINK : PINK_ORCHID;
  ctx.font = "bold 12px 'Courier New', 'Lucida Console', 'Consolas', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const resetLabel = resetDataConfirmActive ? "⚠ CONFIRM RESET ALL SAVED DATA?" : "[RESET SAVED DATA]";
  ctx.fillText(resetLabel, rBtn.x + rBtn.w / 2, rBtn.y + rBtn.h / 2);
  ctx.restore();

  // Draw mute button
  drawMuteButton(ctx);
}

function renderGameOverScreen(deltaTime) {
  // 1. Draw cosmic background
  if (backgroundCanvas) {
    ctx.drawImage(backgroundCanvas, 0, 0);
  } else {
    ctx.fillStyle = PRUSSIAN_BLUE;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // 2. Draw frozen game objects and planet beneath the overlay
  for (let i = 0; i < fallingObjects.length; i++) {
    const obj = fallingObjects[i];
    if (obj.type === "star") {
      drawCollectibleStar(ctx, obj);
    } else {
      drawAsteroid(ctx, obj);
    }
  }
  drawPlanet(ctx, planet);

  // 3. Draw fade overlay
  if (deltaTime) {
    gameOverFadeTimer += deltaTime;
  }
  const fadeProgress = prefersReducedMotion ? 1.0 : Math.min(1, gameOverFadeTimer / GAME_OVER_FADE_DURATION);
  const overlayOpacity = 0.7 * fadeProgress;
  ctx.fillStyle = `rgba(11, 40, 82, ${overlayOpacity})`;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 4. Draw text elements with fade
  ctx.save();
  ctx.globalAlpha = fadeProgress;

  // "GAME OVER" with glow
  ctx.save();
  ctx.shadowColor = BUBBLEGUM_PINK;
  ctx.shadowBlur = 20;
  ctx.fillStyle = BUBBLEGUM_PINK;
  ctx.font = "bold 46px 'Courier New', 'Lucida Console', 'Consolas', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("GAME OVER", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 75);
  ctx.restore();

  // Final score
  ctx.fillStyle = PERIWINKLE;
  ctx.font = "22px 'Courier New', 'Lucida Console', 'Consolas', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("FINAL SCORE: " + score, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 15);

  // High score
  ctx.fillStyle = PINK_ORCHID;
  ctx.font = "bold 18px 'Courier New', 'Lucida Console', 'Consolas', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const highText = (isNewHighScoreAchieved ? "★ NEW BEST: " : "BEST SCORE: ") + highScore;
  ctx.fillText(highText, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);

  // Restart prompt
  ctx.fillStyle = PERIWINKLE;
  ctx.font = "16px 'Courier New', 'Lucida Console', 'Consolas', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PRESS ANY KEY OR CLICK TO RESTART", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 65);

  ctx.restore();

  // Draw mute button
  drawMuteButton(ctx);
}

function renderGame() {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.save();

  // Screen shake offset
  if (shakeTimer > 0 && !prefersReducedMotion) {
    const progress = shakeTimer / 0.2;
    const currentIntensity = shakeIntensity * progress;
    const offsetX = (Math.random() * 2 - 1) * currentIntensity;
    const offsetY = (Math.random() * 2 - 1) * currentIntensity;
    ctx.translate(offsetX, offsetY);
  }

  // 1. Draw pre-rendered cosmic background
  if (backgroundCanvas) {
    ctx.drawImage(backgroundCanvas, 0, 0);
  }

  // 2. Draw falling objects
  for (let i = 0; i < fallingObjects.length; i++) {
    const obj = fallingObjects[i];
    if (obj.type === "star") {
      drawCollectibleStar(ctx, obj);
    } else {
      drawAsteroid(ctx, obj);
    }
  }

  // 3. Draw player planet (drawn after objects so it renders in foreground)
  drawPlanet(ctx, planet);

  // 4. Draw HUD with outlines
  drawHUD();

  // 5. Draw active visual effects
  renderEffects(ctx);

  ctx.restore();

  // 6. Draw HUD controls (mute, pause, restart) on top (not shaken)
  drawHUDControls(ctx);
}

// --- Main Game Loop ---
function gameLoop(timestamp) {
  if (!lastTime) {
    lastTime = timestamp;
  }

  // Compute delta time in seconds, clamped to max 50ms (0.05s)
  let deltaTime = (timestamp - lastTime) / 1000;
  if (deltaTime > 0.05) {
    deltaTime = 0.05;
  }
  lastTime = timestamp;

  if (gameState === "playing") {
    updateGame(deltaTime);
    renderGame();
  } else if (gameState === "paused") {
    renderPauseScreen();
  } else if (gameState === "start") {
    renderStartScreen();
  } else if (gameState === "gameover") {
    renderGameOverScreen(deltaTime);
  }

  animationId = requestAnimationFrame(gameLoop);
}

// Pre-render cosmic background and start loop
generateBackground();
animationId = requestAnimationFrame(gameLoop);
