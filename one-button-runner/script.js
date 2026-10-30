const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const overlay = document.getElementById("overlay");
const titleEl = document.getElementById("title");
const messageEl = document.getElementById("message");
const actionBtn = document.getElementById("action");

const W = 360;
const H = 560;
const GROUND = H - 34;
const PLAYER_X = 82;
const PLAYER_SIZE = 26;

const GRAVITY = 1350;
const THRUST = 3000;
const MAX_UP = -440;
const MAX_DOWN = 560;

const OB_WIDTH = 38;
const BASE_GAP = 160;
const BASE_SPEED = 165;
const MAX_SPEED = 360;

let player = { y: H * 0.42, vy: 0 };
let obstacles = [];
let particles = [];
let stars = [];
let state = "ready";
let holding = false;
let score = 0;
let best = Number(localStorage.getItem("one-button-runner-best") || 0);
let distance = 0;
let elapsed = 0;
let speed = BASE_SPEED;
let spawnTimer = 1;
let trailTimer = 0;
let shake = 0;
let lastTime = performance.now();
let canRestartAt = 0;

/* Sets up the fixed logical canvas resolution scaled for the display. */
function setupCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* Builds a static star field for the parallax background. */
function createStars() {
  stars = Array.from({ length: 54 }, () => ({
    x: Math.random() * W,
    y: Math.random() * (GROUND - 40),
    r: Math.random() * 1.6 + 0.4,
    a: Math.random() * 0.5 + 0.15,
  }));
}

/* Resets the run to its starting state. */
function resetGame() {
  player = { y: H * 0.42, vy: 0 };
  obstacles = [];
  particles = [];
  distance = 0;
  elapsed = 0;
  speed = BASE_SPEED;
  spawnTimer = 1;
  trailTimer = 0;
  shake = 0;
  score = 0;
  updateHud();
}

/* Starts a new run. */
function startGame() {
  resetGame();
  player.vy = -240;
  state = "playing";
  holding = false;
  overlay.classList.add("hidden");
  actionBtn.blur();
  lastTime = performance.now();
}

/* Ends the run and records the best distance. */
function endGame() {
  state = "over";
  holding = false;
  shake = 16;
  canRestartAt = performance.now() + 450;

  if (score > best) {
    best = score;
    localStorage.setItem("one-button-runner-best", String(best));
  }

  updateHud();
  titleEl.textContent = "Crashed";
  messageEl.textContent =
    score > 0
      ? `You travelled ${score} m. Best: ${best} m.`
      : "Straight into the wall. Try again.";
  actionBtn.textContent = "Play Again";
  overlay.classList.remove("hidden");
}

/* Refreshes the distance and best labels. */
function updateHud() {
  scoreEl.textContent = String(score);
  bestEl.textContent = String(best);
}

/* Spawns a new pair of bars with a random gap. */
function spawnObstacle() {
  const gapH = Math.max(122, BASE_GAP - elapsed * 0.6);
  const minY = 60;
  const maxY = GROUND - gapH - 60;
  const gapY = minY + Math.random() * Math.max(0, maxY - minY);
  obstacles.push({ x: W + 30, gapY, gapH, passed: false });
}

/* Advances physics, obstacles, and effects. */
function update(dt) {
  if (state !== "playing") {
    shake = Math.max(0, shake - dt * 60);
    return;
  }

  elapsed += dt;
  speed = Math.min(MAX_SPEED, BASE_SPEED + elapsed * 9);

  const accel = holding ? GRAVITY - THRUST : GRAVITY;
  player.vy = Math.max(MAX_UP, Math.min(MAX_DOWN, player.vy + accel * dt));
  player.y += player.vy * dt;

  if (player.y < 0) {
    player.y = 0;
    player.vy = 0;
  }

  if (player.y + PLAYER_SIZE >= GROUND) {
    player.y = GROUND - PLAYER_SIZE;
    endGame();
    return;
  }

  distance += speed * dt;
  const nextScore = Math.floor(distance / 10);
  if (nextScore !== score) {
    score = nextScore;
    updateHud();
  }

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnObstacle();
    spawnTimer = Math.max(0.78, 1.5 - elapsed * 0.01);
  }

  for (let i = obstacles.length - 1; i >= 0; i -= 1) {
    const o = obstacles[i];
    o.x -= speed * dt;
    if (o.x + OB_WIDTH < 0) {
      obstacles.splice(i, 1);
      continue;
    }
    if (!o.passed && o.x + OB_WIDTH < PLAYER_X) {
      o.passed = true;
    }
    if (collides(o)) {
      endGame();
      return;
    }
  }

  for (const star of stars) {
    star.x -= speed * 0.12 * dt;
    if (star.x < 0) {
      star.x += W;
      star.y = Math.random() * (GROUND - 40);
    }
  }

  if (holding) {
    trailTimer -= dt;
    if (trailTimer <= 0) {
      trailTimer = 0.025;
      particles.push({
        x: PLAYER_X + 4,
        y: player.y + PLAYER_SIZE * 0.7,
        vx: -speed * 0.5 + (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 60,
        life: 0.4,
        maxLife: 0.4,
        size: Math.random() * 3 + 1.5,
      });
    }
  }

  updateParticles(dt);
  shake = Math.max(0, shake - dt * 60);
}

/* Checks whether the player overlaps an obstacle's bars. */
function collides(o) {
  const px = PLAYER_X;
  const py = player.y;
  const size = PLAYER_SIZE;
  const inX = px + size > o.x && px < o.x + OB_WIDTH;
  if (!inX) return false;
  return py < o.gapY || py + size > o.gapY + o.gapH;
}

/* Advances trail particles. */
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
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

/* Draws the sky, stars, and ambient glow. */
function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#1a1220");
  sky.addColorStop(0.5, "#0b0d17");
  sky.addColorStop(1, "#05060a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  for (const star of stars) {
    ctx.globalAlpha = star.a;
    ctx.fillStyle = "#ffd9c2";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const glow = ctx.createRadialGradient(W * 0.7, GROUND, 10, W * 0.7, GROUND, 300);
  glow.addColorStop(0, "rgba(251, 146, 60, 0.16)");
  glow.addColorStop(1, "rgba(251, 146, 60, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, GROUND - 300, W, 300);
}

/* Draws the ground with moving speed dashes. */
function drawGround() {
  const fill = ctx.createLinearGradient(0, GROUND, 0, H);
  fill.addColorStop(0, "#241a1c");
  fill.addColorStop(1, "#0c090c");
  ctx.fillStyle = fill;
  ctx.fillRect(0, GROUND, W, H - GROUND);

  ctx.strokeStyle = "rgba(251, 146, 60, 0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  ctx.lineTo(W, GROUND);
  ctx.stroke();

  const offset = distance % 44;
  ctx.strokeStyle = "rgba(251, 146, 60, 0.22)";
  ctx.lineWidth = 2;
  for (let x = -offset; x < W; x += 44) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND + 12);
    ctx.lineTo(x + 20, GROUND + 12);
    ctx.stroke();
  }
}

/* Draws a pair of obstacle bars. */
function drawObstacle(o) {
  const grad = ctx.createLinearGradient(o.x, 0, o.x + OB_WIDTH, 0);
  grad.addColorStop(0, "#ff5f6d");
  grad.addColorStop(0.5, "#ff8a4d");
  grad.addColorStop(1, "#d9465f");

  ctx.fillStyle = grad;
  ctx.shadowColor = "rgba(255, 95, 109, 0.5)";
  ctx.shadowBlur = 14;

  roundRect(o.x, 0, OB_WIDTH, o.gapY, 6);
  ctx.fill();
  roundRect(o.x, o.gapY + o.gapH, OB_WIDTH, GROUND - (o.gapY + o.gapH), 6);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  ctx.fillRect(o.x + 4, o.gapY - 3, OB_WIDTH - 8, 3);
  ctx.fillRect(o.x + 4, o.gapY + o.gapH, OB_WIDTH - 8, 3);
}

/* Draws the player ship and its thruster flame. */
function drawPlayer() {
  const x = PLAYER_X;
  const y = player.y;

  if (state === "playing" && holding) {
    const flame = 10 + Math.random() * 10;
    const flameGrad = ctx.createLinearGradient(x, y, x, y + PLAYER_SIZE + flame);
    flameGrad.addColorStop(0, "rgba(255, 214, 120, 0.95)");
    flameGrad.addColorStop(1, "rgba(251, 146, 60, 0)");
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + PLAYER_SIZE - 4);
    ctx.lineTo(x + PLAYER_SIZE - 6, y + PLAYER_SIZE - 4);
    ctx.lineTo(x + PLAYER_SIZE / 2, y + PLAYER_SIZE + flame);
    ctx.closePath();
    ctx.fill();
  }

  const body = ctx.createLinearGradient(x, y, x + PLAYER_SIZE, y + PLAYER_SIZE);
  body.addColorStop(0, "#a5f3fc");
  body.addColorStop(1, "#22d3ee");

  ctx.shadowColor = "rgba(34, 211, 238, 0.8)";
  ctx.shadowBlur = 20;
  ctx.fillStyle = body;
  roundRect(x, y, PLAYER_SIZE, PLAYER_SIZE, 8);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "rgba(4, 18, 26, 0.85)";
  roundRect(x + PLAYER_SIZE - 11, y + 7, 5, 7, 2);
  ctx.fill();
}

/* Draws the trail particles. */
function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = "#fdba74";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
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
  drawGround();
  for (const o of obstacles) {
    drawObstacle(o);
  }
  drawParticles();
  drawPlayer();
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

/* Handles a fresh press, either thrusting or starting. */
function press() {
  if (state === "playing") {
    holding = true;
    return;
  }
  if (performance.now() < canRestartAt) return;
  startGame();
  holding = true;
}

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  press();
});

actionBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  startGame();
});

window.addEventListener("pointerup", () => {
  holding = false;
});

window.addEventListener("pointercancel", () => {
  holding = false;
});

window.addEventListener("blur", () => {
  holding = false;
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "ArrowUp" || event.code === "Enter") {
    event.preventDefault();
    if (event.repeat) return;
    press();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "Space" || event.code === "ArrowUp" || event.code === "Enter") {
    holding = false;
  }
});

setupCanvas();
createStars();
resetGame();
requestAnimationFrame(frame);
