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
const LEFT = 22;
const RIGHT = 338;
const TOP = 86;
const FLOOR = H - 36;
const DROP_Y = 54;
const GRAVITY = 1600;
const REST = 0.12;
const MAX_LEVEL = 7;
const NEXT_DELAY = 0.32;
const TAU = Math.PI * 2;
const HUES = [188, 160, 45, 22, 330, 272, 215];

let orbs = [];
let particles = [];
let score = 0;
let best = Number(localStorage.getItem("merge-drop-best") || 0);
let nextLevel = 1;
let aimX = W / 2;
let cooldown = 0;
let overflow = 0;
let shake = 0;
let state = "ready";
let lastTime = performance.now();

/* Sets up the fixed logical canvas resolution scaled for the display. */
function setupCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* Returns the pixel radius for a merge level. */
function radiusFor(level) {
  return 14 + (level - 1) * 5;
}

/* Returns the displayed value for a merge level. */
function valueFor(level) {
  return 2 ** level;
}

/* Picks a weighted starting orb level. */
function randomLevel() {
  const roll = Math.random();
  if (roll < 0.6) return 1;
  if (roll < 0.9) return 2;
  return 3;
}

/* Keeps the aim inside the container for a given radius. */
function clampAim(x, r) {
  return Math.max(LEFT + r, Math.min(RIGHT - r, x));
}

/* Resets the container, score, and held orb. */
function resetGame() {
  orbs = [];
  particles = [];
  score = 0;
  nextLevel = randomLevel();
  aimX = W / 2;
  cooldown = 0;
  overflow = 0;
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
  shake = 14;

  if (score > best) {
    best = score;
    localStorage.setItem("merge-drop-best", String(best));
  }

  updateHud();
  titleEl.textContent = "Container Full";
  messageEl.textContent =
    score > 0
      ? `You merged for ${score} points. Best: ${best}.`
      : "The pile topped out fast. Try smaller drops.";
  actionBtn.textContent = "Play Again";
  overlay.classList.remove("hidden");
}

/* Updates the score and best labels. */
function updateHud() {
  scoreEl.textContent = String(score);
  bestEl.textContent = String(best);
}

/* Drops the held orb into the container. */
function dropOrb() {
  if (state !== "playing" || cooldown > 0) return;

  const level = nextLevel;
  const r = radiusFor(level);
  const x = clampAim(aimX, r);

  orbs.push({ x, y: DROP_Y, vx: 0, vy: 0, r, level, age: 0, dead: false });
  nextLevel = randomLevel();
  cooldown = NEXT_DELAY;
}

/* Resolves collisions between one pair of orbs. */
function resolvePair(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const minD = a.r + b.r;
  const d2 = dx * dx + dy * dy;

  if (d2 >= minD * minD || d2 < 0.0001) return;

  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  const overlap = minD - d;
  const ma = a.r * a.r;
  const mb = b.r * b.r;
  const total = ma + mb;

  a.x -= nx * overlap * (mb / total);
  a.y -= ny * overlap * (mb / total);
  b.x += nx * overlap * (ma / total);
  b.y += ny * overlap * (ma / total);

  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const vn = rvx * nx + rvy * ny;

  if (vn < 0) {
    const impulse = (-(1 + REST) * vn) / (1 / ma + 1 / mb);
    a.vx -= (impulse * nx) / ma;
    a.vy -= (impulse * ny) / ma;
    b.vx += (impulse * nx) / mb;
    b.vy += (impulse * ny) / mb;
  }
}

/* Advances the orb physics by one substep. */
function physics(step) {
  for (const o of orbs) {
    o.vy += GRAVITY * step;
    o.x += o.vx * step;
    o.y += o.vy * step;
    o.vx *= 0.999;
    o.vx = Math.max(-1200, Math.min(1200, o.vx));
    o.vy = Math.max(-1600, Math.min(1600, o.vy));

    if (o.x - o.r < LEFT) {
      o.x = LEFT + o.r;
      if (o.vx < 0) o.vx = -o.vx * 0.25;
    }
    if (o.x + o.r > RIGHT) {
      o.x = RIGHT - o.r;
      if (o.vx > 0) o.vx = -o.vx * 0.25;
    }
    if (o.y + o.r > FLOOR) {
      o.y = FLOOR - o.r;
      if (o.vy > 0) o.vy = -o.vy * 0.18;
      o.vx *= 0.94;
    }
  }

  for (let iter = 0; iter < 2; iter += 1) {
    for (let i = 0; i < orbs.length; i += 1) {
      for (let j = i + 1; j < orbs.length; j += 1) {
        resolvePair(orbs[i], orbs[j]);
      }
    }
  }

  for (const o of orbs) {
    if (o.x - o.r < LEFT) o.x = LEFT + o.r;
    if (o.x + o.r > RIGHT) o.x = RIGHT - o.r;
    if (o.y + o.r > FLOOR) o.y = FLOOR - o.r;
  }
}

/* Merges touching orbs of the same level. */
function resolveMerges() {
  const created = [];
  let merged = false;

  for (let i = 0; i < orbs.length; i += 1) {
    const a = orbs[i];
    if (a.dead || a.level >= MAX_LEVEL) continue;

    for (let j = i + 1; j < orbs.length; j += 1) {
      const b = orbs[j];
      if (b.dead || a.level !== b.level) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > a.r + b.r + 0.6) continue;

      a.dead = true;
      b.dead = true;
      merged = true;

      const level = a.level + 1;
      created.push({
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        vx: (a.vx + b.vx) / 2,
        vy: (a.vy + b.vy) / 2,
        r: radiusFor(level),
        level,
        age: 1,
        dead: false,
      });

      score += valueFor(level);
      spawnBurst((a.x + b.x) / 2, (a.y + b.y) / 2, HUES[(level - 1) % HUES.length], 14);
      break;
    }
  }

  if (merged) {
    orbs = orbs.filter((o) => !o.dead).concat(created);
    updateHud();
  }
}

/* Spawns a burst of merge particles. */
function spawnBurst(x, y, hue, count) {
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 240,
      vy: (Math.random() - 0.7) * 240,
      life: 0.5,
      maxLife: 0.5,
      size: Math.random() * 3 + 1.5,
      hue,
    });
  }
}

/* Advances particles. */
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 500 * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

/* Ends the run when settled orbs stay above the danger line. */
function checkOverflow(dt) {
  let over = false;

  for (const o of orbs) {
    if (o.age < 1.2) continue;
    if (o.y - o.r < TOP + 4) {
      over = true;
      break;
    }
  }

  overflow = over ? overflow + dt : Math.max(0, overflow - dt * 2);

  if (overflow > 1.3) {
    endGame();
  }
}

/* Advances physics, merges, and effects. */
function update(dt) {
  if (state !== "playing") {
    shake = Math.max(0, shake - dt * 60);
    return;
  }

  for (const o of orbs) o.age += dt;
  cooldown = Math.max(0, cooldown - dt);

  const clamped = Math.min(dt, 0.033);
  const step = clamped / 4;
  for (let i = 0; i < 4; i += 1) {
    physics(step);
  }

  resolveMerges();
  updateParticles(dt);
  checkOverflow(dt);
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

/* Draws the background and container. */
function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#0c1a19");
  sky.addColorStop(0.55, "#080d12");
  sky.addColorStop(1, "#050708");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, FLOOR, 20, W / 2, FLOOR, 300);
  glow.addColorStop(0, "rgba(52, 211, 153, 0.12)");
  glow.addColorStop(1, "rgba(52, 211, 153, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, FLOOR - 300, W, 300);

  ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
  roundRect(LEFT - 8, TOP - 8, RIGHT - LEFT + 16, FLOOR - TOP + 16, 20);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = "rgba(52, 211, 153, 0.4)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(LEFT, FLOOR);
  ctx.lineTo(RIGHT, FLOOR);
  ctx.stroke();

  if (overflow > 0.05) {
    const alpha = Math.min(0.9, 0.2 + overflow);
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = `rgba(255, 77, 90, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(LEFT, TOP + 4);
    ctx.lineTo(RIGHT, TOP + 4);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/* Draws the aiming guide. */
function drawAim() {
  if (state !== "playing") return;

  const r = radiusFor(nextLevel);
  const x = clampAim(aimX, r);

  ctx.setLineDash([6, 8]);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, DROP_Y + r + 8);
  ctx.lineTo(x, FLOOR - 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

/* Draws one orb with a highlight and value label. */
function drawOrb(o, alpha) {
  const hue = HUES[(o.level - 1) % HUES.length];
  ctx.globalAlpha = alpha;

  const fill = ctx.createRadialGradient(
    o.x - o.r * 0.35,
    o.y - o.r * 0.4,
    o.r * 0.12,
    o.x,
    o.y,
    o.r
  );
  fill.addColorStop(0, `hsl(${hue} 92% 74%)`);
  fill.addColorStop(0.7, `hsl(${hue} 78% 54%)`);
  fill.addColorStop(1, `hsl(${hue} 72% 42%)`);

  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(o.x, o.y, o.r, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = `hsla(${hue}, 95%, 85%, 0.55)`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.32)";
  ctx.beginPath();
  ctx.ellipse(o.x - o.r * 0.32, o.y - o.r * 0.36, o.r * 0.22, o.r * 0.14, -0.6, 0, TAU);
  ctx.fill();

  ctx.fillStyle = "rgba(8, 16, 22, 0.72)";
  ctx.font = `800 ${Math.max(10, o.r * 0.58)}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(valueFor(o.level)), o.x, o.y + 1);
  ctx.globalAlpha = 1;
}

/* Draws merge particles. */
function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = `hsl(${p.hue} 90% 66%)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* Draws the held orb above the container. */
function drawHeldOrb() {
  const r = radiusFor(nextLevel);
  const x = clampAim(aimX, r);
  const bob = Math.sin(performance.now() / 260) * 2;
  drawOrb({ x, y: DROP_Y + bob, r, level: nextLevel }, 0.96);
}

/* Renders the current frame. */
function draw() {
  ctx.save();
  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }

  drawBackground();
  drawAim();

  for (const o of orbs) {
    drawOrb(o, 1);
  }

  drawHeldOrb();
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

/* Converts a pointer event into logical canvas coordinates. */
function pointerX(event) {
  const rect = canvas.getBoundingClientRect();
  return ((event.clientX - rect.left) / rect.width) * W;
}

canvas.addEventListener("pointermove", (event) => {
  if (state !== "playing") return;
  aimX = pointerX(event);
});

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  aimX = pointerX(event);

  if (state === "playing") {
    dropOrb();
  } else {
    startGame();
  }
});

actionBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  startGame();
});

window.addEventListener("keydown", (event) => {
  if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
    if (state !== "playing") return;
    event.preventDefault();
    const r = radiusFor(nextLevel);
    aimX = clampAim(aimX + (event.code === "ArrowLeft" ? -18 : 18), r);
    return;
  }

  if (event.code === "Space" || event.code === "Enter") {
    event.preventDefault();
    if (event.repeat) return;
    if (state === "playing") {
      dropOrb();
    } else {
      startGame();
    }
  }
});

setupCanvas();
resetGame();
requestAnimationFrame(frame);
