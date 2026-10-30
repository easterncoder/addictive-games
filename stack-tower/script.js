const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const stage = document.getElementById("stage");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const overlay = document.getElementById("overlay");
const titleEl = document.getElementById("title");
const messageEl = document.getElementById("message");
const actionBtn = document.getElementById("action");

const W = 360;
const H = 560;
const BLOCK_H = 30;
const GROUND_Y = H - 40;
const TARGET_Y = 120;
const PERFECT_TOLERANCE = 5;
const BASE_WIDTH = 180;
const MIN_WIDTH = 6;

let blocks = [];
let moving = null;
let camOffset = 0;
let state = "ready";
let score = 0;
let best = Number(localStorage.getItem("stack-tower-best") || 0);
let lastTime = performance.now();
let shake = 0;
let particles = [];
let stars = [];

/* Sets up the fixed logical canvas resolution scaled for the display. */
function setupCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* Builds a static star field for the background. */
function createStars() {
  stars = Array.from({ length: 46 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() * 1.6 + 0.4,
    a: Math.random() * 0.5 + 0.15,
  }));
}

/* Resets the tower to a single base block. */
function resetGame() {
  blocks = [
    {
      x: (W - BASE_WIDTH) / 2,
      y: 0,
      width: BASE_WIDTH,
      hue: 188,
    },
  ];
  score = 0;
  camOffset = 0;
  shake = 0;
  particles = [];
  spawnMoving();
  updateHud();
}

/* Creates the next moving block above the tower. */
function spawnMoving() {
  const prev = blocks[blocks.length - 1];
  const dir = blocks.length % 2 === 0 ? 1 : -1;
  const speed = Math.min(150 + blocks.length * 7, 520);

  moving = {
    x: dir === 1 ? 0 : W - prev.width,
    width: prev.width,
    dir,
    speed,
    hue: (blocks.length * 16 + 188) % 360,
  };
}

/* Advances the moving block and transient effects. */
function update(dt) {
  if (state !== "playing") return;

  if (moving) {
    moving.x += moving.dir * moving.speed * dt;
    if (moving.x <= 0) {
      moving.x = 0;
      moving.dir = 1;
    } else if (moving.x + moving.width >= W) {
      moving.x = W - moving.width;
      moving.dir = -1;
    }
  }

  shake = Math.max(0, shake - dt * 60);
  updateParticles(dt);
}

/* Drops the moving block and resolves overlap with the tower. */
function drop() {
  if (state !== "playing" || !moving) return;

  const prev = blocks[blocks.length - 1];
  const left = Math.max(moving.x, prev.x);
  const right = Math.min(moving.x + moving.width, prev.x + prev.width);
  const overlap = right - left;
  const perfect = Math.abs(moving.x - prev.x) <= PERFECT_TOLERANCE;

  if (overlap < MIN_WIDTH) {
    endGame();
    return;
  }

  const newBlock = {
    x: perfect ? prev.x : left,
    y: -blocks.length * BLOCK_H,
    width: perfect ? prev.width : overlap,
    hue: moving.hue,
  };

  blocks.push(newBlock);
  score += perfect ? 2 : 1;
  camOffset = Math.max(0, TARGET_Y - (newBlock.y + GROUND_Y));

  if (perfect) {
    addParticles(prev.x + prev.width / 2, newBlock.y, moving.hue);
  }

  updateHud();
  spawnMoving();
}

/* Ends the run and records the best score. */
function endGame() {
  state = "over";
  shake = 14;

  if (score > best) {
    best = score;
    localStorage.setItem("stack-tower-best", String(best));
  }

  updateHud();
  titleEl.textContent = "Tower Toppled";
  messageEl.textContent =
    score > 0
      ? `You scored ${score}. Best: ${best}.`
      : "The first block missed. Try again.";
  actionBtn.textContent = "Play Again";
  overlay.classList.remove("hidden");
}

/* Starts a fresh run. */
function startGame() {
  resetGame();
  state = "playing";
  overlay.classList.add("hidden");
  actionBtn.blur();
  lastTime = performance.now();
}

/* Updates the score and best labels. */
function updateHud() {
  scoreEl.textContent = String(score);
  bestEl.textContent = String(best);
}

/* Spawns a burst of particles at a world position. */
function addParticles(x, y, hue) {
  for (let i = 0; i < 10; i += 1) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 180,
      vy: (Math.random() - 0.9) * 140,
      life: 0.55,
      maxLife: 0.55,
      hue,
    });
  }
}

/* Advances particle physics. */
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 260 * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

/* Draws a rounded rectangle path. */
function roundRect(x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/* Draws the background gradient, stars, and horizon glow. */
function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#0a1424");
  sky.addColorStop(0.55, "#070b13");
  sky.addColorStop(1, "#04060a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  for (const s of stars) {
    ctx.globalAlpha = s.a;
    ctx.fillStyle = "#cfe6ff";
    ctx.beginPath();
    ctx.arc(s.x, (s.y + camOffset * 0.25) % H, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const glow = ctx.createRadialGradient(W / 2, H + 40, 10, W / 2, H + 40, 260);
  glow.addColorStop(0, "rgba(94, 234, 212, 0.22)");
  glow.addColorStop(1, "rgba(94, 234, 212, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, H - 260, W, 260);
}

/* Draws one tower block at a given screen position. */
function drawBlock(block, screenY, isMoving) {
  const hue = block.hue;
  const radius = Math.min(6, block.width / 3, BLOCK_H / 2);
  const fill = ctx.createLinearGradient(block.x, screenY, block.x, screenY + BLOCK_H);
  fill.addColorStop(0, `hsl(${hue} 88% 70%)`);
  fill.addColorStop(1, `hsl(${hue} 72% 44%)`);

  if (isMoving) {
    ctx.shadowColor = `hsla(${hue}, 90%, 62%, 0.8)`;
    ctx.shadowBlur = 20;
  }

  ctx.fillStyle = fill;
  roundRect(block.x, screenY, block.width, BLOCK_H, radius);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
  roundRect(block.x, screenY, block.width, 5, radius);
  ctx.fill();
}

/* Draws the particles in world space offset by the camera. */
function drawParticles() {
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `hsl(${p.hue} 90% 68%)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y + GROUND_Y + camOffset, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* Renders the current frame. */
function draw() {
  ctx.save();
  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }

  drawBackground();

  for (const block of blocks) {
    drawBlock(block, block.y + GROUND_Y + camOffset, false);
  }

  if (moving && state !== "over") {
    const screenY = -blocks.length * BLOCK_H + GROUND_Y + camOffset;
    drawBlock(moving, screenY, true);
  }

  drawParticles();
  ctx.restore();
}

/* Main animation loop. */
function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

/* Routes tap, click, or key input to drop or start. */
function handleAction() {
  if (state === "playing") {
    drop();
  } else {
    startGame();
  }
}

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  handleAction();
});

actionBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  startGame();
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "Enter" || event.code === "ArrowDown") {
    event.preventDefault();
    if (event.repeat) return;
    handleAction();
  }
});

setupCanvas();
createStars();
resetGame();
requestAnimationFrame(frame);
