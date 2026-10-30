const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const livesEl = document.getElementById("lives");
const board = document.getElementById("board");
const feedbackEl = document.getElementById("feedback");
const overlay = document.getElementById("overlay");
const titleEl = document.getElementById("title");
const messageEl = document.getElementById("message");
const actionBtn = document.getElementById("action");

const START_LIVES = 3;
const MAX_GRID = 7;

let score = 0;
let lives = START_LIVES;
let best = Number(localStorage.getItem("odd-one-out-best") || 0);
let gridSize = 2;
let running = false;
let locked = false;

/* Builds a fresh grid with one tile a different shade. */
function newRound() {
  gridSize = Math.min(MAX_GRID, 2 + Math.floor(score / 3));
  const total = gridSize * gridSize;
  const hue = Math.floor(Math.random() * 360);
  const sat = 62 + Math.floor(Math.random() * 12);
  const light = 46 + Math.random() * 10;
  const delta = Math.max(6, 18 - score * 0.28);
  const lighter = Math.random() < 0.5;
  const oddLight = Math.min(80, Math.max(20, light + (lighter ? delta : -delta)));
  const baseColor = `hsl(${hue} ${sat}% ${light}%)`;
  const oddColor = `hsl(${hue} ${sat}% ${oddLight}%)`;
  const oddIndex = Math.floor(Math.random() * total);

  board.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
  board.innerHTML = "";

  for (let i = 0; i < total; i += 1) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "tile";
    tile.style.background = i === oddIndex ? oddColor : baseColor;
    tile.setAttribute("aria-label", "tile");
    if (i === oddIndex) tile.dataset.odd = "1";
    board.appendChild(tile);
  }

  locked = false;
}

/* Starts a fresh run. */
function startGame() {
  score = 0;
  lives = START_LIVES;
  running = true;
  locked = false;
  updateHud();
  newRound();
  overlay.classList.add("hidden");
  actionBtn.blur();
}

/* Ends the run and records the best score. */
function endGame() {
  running = false;

  if (score > best) {
    best = score;
    localStorage.setItem("odd-one-out-best", String(best));
  }

  updateHud();
  titleEl.textContent = "Out of Lives";
  messageEl.textContent =
    score > 0
      ? `You spotted ${score} ${score === 1 ? "shade" : "shades"}. Best: ${best}.`
      : "Three misses right away. Look closer.";
  actionBtn.textContent = "Play Again";
  overlay.classList.remove("hidden");
}

/* Refreshes the score, lives, and best labels. */
function updateHud() {
  scoreEl.textContent = String(score);
  bestEl.textContent = String(best);
  const dots = livesEl.children;
  for (let i = 0; i < dots.length; i += 1) {
    dots[i].classList.toggle("lost", i >= lives);
  }
}

/* Animates a short feedback label over the board. */
function showFeedback(text, type) {
  feedbackEl.textContent = text;
  feedbackEl.className = `feedback ${type}`;
  void feedbackEl.offsetWidth;
  feedbackEl.classList.add("show");
}

/* Handles a correct tile tap and advances the grid. */
function handleCorrect(tile) {
  locked = true;
  score += 1;
  updateHud();
  showFeedback("+1", "good");
  tile.classList.add("correct");

  window.setTimeout(() => {
    if (running) newRound();
  }, 160);
}

/* Handles a wrong tile tap, a lost life, and the reveal. */
function handleWrong() {
  locked = true;
  lives -= 1;
  updateHud();
  showFeedback("Miss", "bad");

  const odd = board.querySelector('[data-odd="1"]');
  if (odd) odd.classList.add("reveal");

  board.classList.remove("shake");
  void board.offsetWidth;
  board.classList.add("shake");

  if (lives <= 0) {
    window.setTimeout(() => {
      if (running) endGame();
    }, 450);
    return;
  }

  window.setTimeout(() => {
    if (running) newRound();
  }, 450);
}

board.addEventListener("click", (event) => {
  const tile = event.target.closest(".tile");
  if (!tile || !running || locked) return;

  if (tile.dataset.odd === "1") {
    handleCorrect(tile);
  } else {
    handleWrong();
  }
});

actionBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  startGame();
});

window.addEventListener("keydown", (event) => {
  if ((event.code === "Space" || event.code === "Enter") && !running) {
    event.preventDefault();
    if (event.repeat) return;
    startGame();
  }
});

updateHud();
