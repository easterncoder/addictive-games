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
const CX = W / 2;
const CY = 236;
const R = 72;
const THROW_SPEED = 1250;
const START_TIP_Y = H - 66;
const IMPACT_Y = CY + R;
const TAU = Math.PI * 2;
const HIT_TOLERANCE = 0.21;

let log = { angle: 0, speed: 0.85, dir: 1 };
let stuck = [];
let flying = null;
let particles = [];
let trailTimer = 0;
let score = 0;
let best = Number(localStorage.getItem("knife-hit-best") || 0);
let state = "ready";
let shake = 0;
let lastTime = performance.now();

/* Sets up the fixed logical canvas resolution scaled for the display. */
function setupCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* Resets the log, knives, and score for a new run. */
function resetGame() {
  log = { angle: 0, speed: 0.85, dir: 1 };
  stuck = [];
  flying = null;
  particles = [];
  trailTimer = 0;
  score = 0;
  shake = 0;
  updateHud();
}

/* Starts a fresh run. */
function startGame() {
  resetGame();
  state = "playing";
  overlay.classList.add("hidden");
  actionBtn.blur();
  lastTime = performance.now();
}

/* Ends the run and records the best score. */
function endGame() {
  state = "over";
  flying = null;
  shake = 16;

  if (score > best) {
    best = score;
    localStorage.setItem("knife-hit-best", String(best));
  }

  updateHud();
  titleEl.textContent = "Clang!";
  messageEl.textContent =
    score > 0
      ? `You planted ${score} ${score === 1 ? "knife" : "knives"}. Best: ${best}.`
      : "You hit the first knife. Time it better.";
  actionBtn.textContent = "Play Again";
  overlay.classList.remove("hidden");
}

/* Updates the score and best labels. */
function updateHud() {
  scoreEl.textContent = String(score);
  bestEl.textContent = String(best);
}

/* Normalizes an angle into the 0 to 2 PI range. */
function normalize(angle) {
  return ((angle % TAU) + TAU) % TAU;
}

/* Returns the shortest angular distance between two angles. */
function angularDistance(a, b) {
  const diff = Math.abs(normalize(a) - normalize(b));
  return Math.min(diff, TAU - diff);
}

/* Launches a knife toward the log. */
function throwKnife() {
  if (state !== "playing" || flying) return;
  flying = { y: START_TIP_Y };
}

/* Resolves the knife hitting the log or an existing knife. */
function impact() {
  const impactAngle = normalize(Math.PI / 2 - log.angle);
  const blocked = stuck.some((angle) => angularDistance(angle, impactAngle) < HIT_TOLERANCE);

  if (blocked) {
    spawnBurst(CX, IMPACT_Y, "#ff4d5a", 16);
    endGame();
    return;
  }

  stuck.push(impactAngle);
  score += 1;
  log.speed = Math.min(3.2, log.speed + 0.1);

  if (score % 6 === 0) {
    log.dir *= -1;
    log.speed = Math.min(3.2, log.speed + 0.18);
  }

  spawnBurst(CX, IMPACT_Y, "#fde68a", 10);
  updateHud();
  flying = null;
}

/* Spawns a burst of particles at a point. */
function spawnBurst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 260,
      vy: (Math.random() - 0.7) * 260,
      life: 0.5,
      maxLife: 0.5,
      size: Math.random() * 3 + 1.5,
      color,
    });
  }
}

/* Advances rotation, the flying knife, and effects. */
function update(dt) {
  if (state !== "playing") {
    shake = Math.max(0, shake - dt * 60);
    return;
  }

  log.angle = normalize(log.angle + log.speed * log.dir * dt);

  if (flying) {
    flying.y -= THROW_SPEED * dt;
    trailTimer -= dt;
    if (trailTimer <= 0) {
      trailTimer = 0.02;
      particles.push({
        x: CX + (Math.random() - 0.5) * 6,
        y: flying.y + 34,
        vx: (Math.random() - 0.5) * 40,
        vy: 80,
        life: 0.3,
        maxLife: 0.3,
        size: Math.random() * 2 + 1,
        color: "#fdba74",
      });
    }
    if (flying.y <= IMPACT_Y) {
      impact();
    }
  }

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 320 * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  shake = Math.max(0, shake - dt * 60);
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

/* Draws the background and thrower platform. */
function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#241709");
  sky.addColorStop(0.55, "#0c0d12");
  sky.addColorStop(1, "#060608");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(CX, CY, 20, CX, CY, 260);
  glow.addColorStop(0, "rgba(251, 146, 60, 0.16)");
  glow.addColorStop(1, "rgba(251, 146, 60, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
  roundRect(CX - 48, H - 58, 96, 14, 7);
  ctx.fill();
}

/* Draws the rotating log with wood grain. */
function drawLog() {
  ctx.save();
  ctx.translate(CX, CY);

  const body = ctx.createRadialGradient(-R * 0.35, -R * 0.35, R * 0.1, 0, 0, R);
  body.addColorStop(0, "#d09a63");
  body.addColorStop(1, "#6b3f22");
  ctx.fillStyle = body;
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = 26;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = "rgba(255, 214, 170, 0.45)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, R - 2, 0, TAU);
  ctx.stroke();

  ctx.rotate(log.angle);
  ctx.strokeStyle = "rgba(60, 30, 10, 0.22)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 8; i += 1) {
    ctx.rotate(TAU / 8);
    ctx.beginPath();
    ctx.moveTo(R * 0.3, 0);
    ctx.lineTo(R * 0.86, 0);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(60, 30, 10, 0.3)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.56, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.26, 0, TAU);
  ctx.stroke();

  ctx.fillStyle = "rgba(60, 30, 10, 0.5)";
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, TAU);
  ctx.fill();

  ctx.restore();
}

/* Draws a knife planted into the log at a relative angle. */
function drawStuckKnife(relativeAngle) {
  ctx.save();
  ctx.translate(CX, CY);
  ctx.rotate(relativeAngle + log.angle);

  ctx.fillStyle = "#cbd5e1";
  ctx.beginPath();
  ctx.moveTo(R - 16, 0);
  ctx.lineTo(R + 2, -5);
  ctx.lineTo(R + 2, 5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#f59e0b";
  ctx.fillRect(R, -7, 3, 14);
  ctx.fillStyle = "#8b5a2b";
  ctx.fillRect(R + 3, -4, 19, 8);

  ctx.restore();
}

/* Draws the knife currently in flight. */
function drawFlyingKnife() {
  const x = CX;
  const tipY = flying.y;

  ctx.save();
  ctx.shadowColor = "rgba(253, 186, 116, 0.8)";
  ctx.shadowBlur = 16;

  const blade = ctx.createLinearGradient(x - 6, 0, x + 6, 0);
  blade.addColorStop(0, "#f8fafc");
  blade.addColorStop(1, "#94a3b8");
  ctx.fillStyle = blade;
  ctx.beginPath();
  ctx.moveTo(x, tipY);
  ctx.lineTo(x - 6, tipY + 20);
  ctx.lineTo(x + 6, tipY + 20);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#f59e0b";
  ctx.fillRect(x - 9, tipY + 20, 18, 3);
  ctx.fillStyle = "#8b5a2b";
  ctx.fillRect(x - 4, tipY + 23, 8, 22);
  ctx.restore();
}

/* Draws the impact and trail particles. */
function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, TAU);
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
  drawLog();

  for (const angle of stuck) {
    drawStuckKnife(angle);
  }

  if (flying && state === "playing") {
    drawFlyingKnife();
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

/* Routes input to a throw or a new run. */
function handleAction() {
  if (state === "playing") {
    throwKnife();
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
  if (event.code === "Space" || event.code === "Enter") {
    event.preventDefault();
    if (event.repeat) return;
    handleAction();
  }
});

setupCanvas();
resetGame();
requestAnimationFrame(frame);
