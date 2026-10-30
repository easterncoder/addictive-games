const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const livesEl = document.getElementById("lives");
const boardEl = document.getElementById("board");
const cashBtn = document.getElementById("cash");
const feedbackEl = document.getElementById("feedback");
const overlay = document.getElementById("overlay");
const titleEl = document.getElementById("title");
const messageEl = document.getElementById("message");
const actionBtn = document.getElementById("action");

const SIZE = 5;
const START_LIVES = 3;
const START_MINES = 4;
const MAX_MINES = 8;
const TILE_POINTS = 10;
const NEIGHBORS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

let score = 0;
let best = Number(localStorage.getItem("mine-vault-best") || 0);
let hearts = START_LIVES;
let mineCount = START_MINES;
let bank = 0;
let running = false;
let locked = false;
let firstClick = false;
let mines = [];
let revealed = [];
let cellEls = [];
let revealedCount = 0;

/* Shuffles an array in place. */
function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/* Starts a fresh run. */
function startGame() {
  score = 0;
  hearts = START_LIVES;
  mineCount = START_MINES;
  running = true;
  locked = false;
  updateHud();
  newBoard();
  overlay.classList.add("hidden");
  actionBtn.blur();
}

/* Builds a fresh board with the current mine count. */
function newBoard() {
  bank = 0;
  firstClick = true;
  revealedCount = 0;
  mines = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  revealed = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  placeMines();
  renderBoard();
  updateCash();
}

/* Places the current number of mines in random cells. */
function placeMines() {
  const spots = shuffle(Array.from({ length: SIZE * SIZE }, (_, index) => index));
  for (let i = 0; i < mineCount; i += 1) {
    const index = spots[i];
    mines[Math.floor(index / SIZE)][index % SIZE] = true;
  }
}

/* Renders the board cells. */
function renderBoard() {
  boardEl.innerHTML = "";
  cellEls = [];
  const fragment = document.createDocumentFragment();

  for (let r = 0; r < SIZE; r += 1) {
    const row = [];
    for (let c = 0; c < SIZE; c += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);
      cell.setAttribute("aria-label", `row ${r + 1} column ${c + 1}`);
      fragment.appendChild(cell);
      row.push(cell);
    }
    cellEls.push(row);
  }

  boardEl.appendChild(fragment);
}

/* Refreshes the score, hearts, and best labels. */
function updateHud() {
  scoreEl.textContent = String(score);
  bestEl.textContent = String(best);
  const dots = livesEl.children;
  for (let i = 0; i < dots.length; i += 1) {
    dots[i].classList.toggle("lost", i >= hearts);
  }
}

/* Refreshes the cash out button and its bank total. */
function updateCash() {
  cashBtn.textContent = bank > 0 ? `Cash Out +${bank}` : "Cash Out";
  cashBtn.disabled = !running || locked || bank <= 0;
}

/* Shows a short feedback label over the board. */
function showFeedback(text, type) {
  feedbackEl.textContent = text;
  feedbackEl.className = `feedback ${type}`;
  void feedbackEl.offsetWidth;
  feedbackEl.classList.add("show");
}

/* Moves a mine away from the guaranteed-safe first click. */
function relocateMine(r, c) {
  const candidates = [];
  for (let rr = 0; rr < SIZE; rr += 1) {
    for (let cc = 0; cc < SIZE; cc += 1) {
      if (!mines[rr][cc] && !(rr === r && cc === c)) candidates.push([rr, cc]);
    }
  }
  if (candidates.length === 0) return;

  const [nr, nc] = candidates[Math.floor(Math.random() * candidates.length)];
  mines[r][c] = false;
  mines[nr][nc] = true;
}

/* Counts the mines adjacent to a cell. */
function countAdjacent(r, c) {
  let total = 0;
  for (const [dr, dc] of NEIGHBORS) {
    const rr = r + dr;
    const cc = c + dc;
    if (rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE && mines[rr][cc]) total += 1;
  }
  return total;
}

/* Reveals a safe cell and floods through empty neighbors. */
function revealCell(r, c) {
  if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return 0;
  if (revealed[r][c] || mines[r][c]) return 0;

  revealed[r][c] = true;
  revealedCount += 1;

  const cell = cellEls[r][c];
  const adjacent = countAdjacent(r, c);
  cell.classList.add("open", "pop");

  if (adjacent > 0) {
    cell.textContent = String(adjacent);
    cell.dataset.n = String(adjacent);
  } else {
    cell.textContent = "";
  }

  window.setTimeout(() => cell.classList.remove("pop"), 240);

  let total = 1;
  if (adjacent === 0) {
    for (const [dr, dc] of NEIGHBORS) {
      total += revealCell(r + dr, c + dc);
    }
  }
  return total;
}

/* Reveals a safe cell, adds its loot, and checks for a clear. */
function revealSafe(r, c) {
  const count = revealCell(r, c);
  if (count <= 0) return;

  bank += count * TILE_POINTS;
  updateCash();
  showFeedback(`+${count * TILE_POINTS}`, "good");

  if (revealedCount >= SIZE * SIZE - mineCount) {
    locked = true;
    updateCash();
    window.setTimeout(() => {
      if (!running) return;
      locked = false;
      cashOut(true);
    }, 500);
  }
}

/* Handles a mine hit, a lost heart, and the reveal. */
function hitMine(r, c) {
  locked = true;
  hearts -= 1;
  bank = 0;
  updateHud();
  updateCash();

  for (let rr = 0; rr < SIZE; rr += 1) {
    for (let cc = 0; cc < SIZE; cc += 1) {
      if (!mines[rr][cc]) continue;
      const cell = cellEls[rr][cc];
      cell.classList.add("mine");
      cell.textContent = "✹";
    }
  }

  cellEls[r][c].classList.add("boom");
  boardEl.classList.remove("shake");
  void boardEl.offsetWidth;
  boardEl.classList.add("shake");
  showFeedback("Boom", "bad");

  window.setTimeout(() => {
    if (!running) return;
    if (hearts <= 0) {
      endGame();
      return;
    }
    newBoard();
    locked = false;
    updateCash();
  }, 1100);
}

/* Banks the current loot and advances the board. */
function cashOut(cleared) {
  if (!running || locked || bank <= 0) return;

  const amount = bank;
  score += amount;
  bank = 0;
  updateHud();
  updateCash();
  showFeedback(cleared ? `Cleared +${amount}` : `+${amount}`, "good");
  mineCount = Math.min(MAX_MINES, mineCount + 1);
  newBoard();
}

/* Ends the run and records the best score. */
function endGame() {
  running = false;
  locked = true;

  if (score > best) {
    best = score;
    localStorage.setItem("mine-vault-best", String(best));
  }

  updateHud();
  updateCash();
  titleEl.textContent = "Vault Blown";
  messageEl.textContent =
    score > 0
      ? `You banked ${score} points. Best: ${best}.`
      : `No loot banked. Best: ${best}.`;
  actionBtn.textContent = "Play Again";
  overlay.classList.remove("hidden");
}

boardEl.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell || !running || locked) return;

  const r = Number(cell.dataset.row);
  const c = Number(cell.dataset.col);
  if (revealed[r][c]) return;

  if (firstClick) {
    firstClick = false;
    if (mines[r][c]) relocateMine(r, c);
  }

  if (mines[r][c]) {
    hitMine(r, c);
  } else {
    revealSafe(r, c);
  }
});

cashBtn.addEventListener("click", () => {
  cashOut(false);
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

newBoard();
updateHud();
