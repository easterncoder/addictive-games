const scoreEl = document.getElementById("score");
const timeEl = document.getElementById("time");
const bestEl = document.getElementById("best");
const gridEl = document.getElementById("grid");
const wordListEl = document.getElementById("word-list");
const wordCountEl = document.getElementById("word-count");
const feedbackEl = document.getElementById("feedback");
const overlay = document.getElementById("overlay");
const titleEl = document.getElementById("title");
const messageEl = document.getElementById("message");
const actionBtn = document.getElementById("action");

const SIZE = 10;
const START_TIME = 90;
const WORDS = [
  "APPLE",
  "RIVER",
  "STONE",
  "CLOUD",
  "TIGER",
  "MUSIC",
  "PLANT",
  "GHOST",
  "SWEET",
  "BRAVE",
  "LIGHT",
  "DREAM",
  "SMILE",
  "OCEAN",
  "FROST",
  "HONEY",
  "SPARK",
  "TRAIL",
];
const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, -1],
  [-1, 1],
];

let score = 0;
let best = Number(localStorage.getItem("word-hunt-best") || 0);
let timeLeft = START_TIME;
let running = false;
let locked = false;
let timerId = null;
let chosenWords = [];
let foundWords = new Set();
let cells = [];
let dragStart = null;
let dragCells = [];
let dragging = false;
let tapStart = null;
let firstStart = true;

/* Shuffles an array in place. */
function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/* Returns a random uppercase letter. */
function randomLetter() {
  return "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
}

/* Picks a valid start index for a word of the given length and direction. */
function startIndex(delta, length) {
  const span = SIZE - length + 1;
  if (delta === 0) return Math.floor(Math.random() * SIZE);
  if (delta > 0) return Math.floor(Math.random() * span);
  return length - 1 + Math.floor(Math.random() * span);
}

/* Attempts to place one word into the letter grid. */
function placeWord(letters, word) {
  const length = word.length;
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const [dr, dc] = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    const r0 = startIndex(dr, length);
    const c0 = startIndex(dc, length);
    let fits = true;

    for (let i = 0; i < length; i += 1) {
      const existing = letters[r0 + dr * i][c0 + dc * i];
      if (existing && existing !== word[i]) {
        fits = false;
        break;
      }
    }

    if (!fits) continue;

    for (let i = 0; i < length; i += 1) {
      letters[r0 + dr * i][c0 + dc * i] = word[i];
    }
    return true;
  }
  return false;
}

/* Builds a board with placed words and filler letters. */
function generateBoard() {
  let fallback = null;

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const letters = Array.from({ length: SIZE }, () => Array(SIZE).fill(""));
    const pool = shuffle(WORDS.slice());
    const placed = [];

    for (const word of pool) {
      if (placed.length >= 6) break;
      if (placeWord(letters, word)) placed.push(word);
    }

    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        if (!letters[r][c]) letters[r][c] = randomLetter();
      }
    }

    const result = { letters, words: placed };
    if (placed.length >= 6) return result;
    fallback = result;
  }

  return fallback;
}

/* Renders the letter grid. */
function renderGrid(letters) {
  gridEl.innerHTML = "";
  cells = [];
  const fragment = document.createDocumentFragment();

  for (let r = 0; r < SIZE; r += 1) {
    const row = [];
    for (let c = 0; c < SIZE; c += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.textContent = letters[r][c];
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);
      cell.setAttribute("aria-label", `row ${r + 1} column ${c + 1}`);
      fragment.appendChild(cell);
      row.push(cell);
    }
    cells.push(row);
  }

  gridEl.appendChild(fragment);
}

/* Renders the word chips for the current board. */
function renderWords() {
  wordListEl.innerHTML = "";
  for (const word of chosenWords) {
    const chip = document.createElement("span");
    chip.className = "word-chip";
    chip.textContent = word;
    chip.dataset.word = word;
    wordListEl.appendChild(chip);
  }
  wordCountEl.textContent = `0 / ${chosenWords.length}`;
}

/* Refreshes score, time, best, and word count labels. */
function updateHud() {
  scoreEl.textContent = String(score);
  bestEl.textContent = String(best);
  timeEl.textContent = String(Math.ceil(timeLeft));
  wordCountEl.textContent = `${foundWords.size} / ${chosenWords.length}`;
}

/* Updates only the timer label. */
function updateTime() {
  timeEl.textContent = String(Math.ceil(timeLeft));
}

/* Starts a fresh run. */
function startGame() {
  score = 0;
  timeLeft = START_TIME;
  foundWords = new Set();
  running = true;
  locked = false;
  dragStart = null;
  dragCells = [];
  dragging = false;
  tapStart = null;

  if (firstStart) {
    firstStart = false;
  } else {
    const board = generateBoard();
    chosenWords = board.words;
    renderGrid(board.letters);
    renderWords();
  }

  updateHud();
  overlay.classList.add("hidden");
  actionBtn.blur();
  window.clearInterval(timerId);
  timerId = window.setInterval(tick, 100);
}

/* Ends the run and records the best score. */
function endGame(cleared) {
  if (!running) return;

  running = false;
  locked = true;
  window.clearInterval(timerId);
  timerId = null;

  if (cleared) score += Math.ceil(timeLeft) * 10;

  if (score > best) {
    best = score;
    localStorage.setItem("word-hunt-best", String(best));
  }

  updateHud();
  titleEl.textContent = cleared ? "Board Cleared" : "Time Up";

  if (cleared) {
    messageEl.textContent = `All ${chosenWords.length} words found with ${Math.ceil(timeLeft)} seconds left. Score: ${score}.`;
  } else if (foundWords.size > 0) {
    messageEl.textContent = `You found ${foundWords.size} of ${chosenWords.length} words. Score: ${score}. Best: ${best}.`;
  } else {
    messageEl.textContent = `No words found. Best: ${best}.`;
  }

  actionBtn.textContent = "Play Again";
  overlay.classList.remove("hidden");
  locked = false;
  dragCells = [];
  tapStart = null;
  paintSelection();
}

/* Runs the countdown while the game is active. */
function tick() {
  if (!running) return;
  timeLeft = Math.max(0, timeLeft - 0.1);
  updateTime();
  if (timeLeft <= 0) endGame(false);
}

/* Builds a straight line of cells between two cells. */
function buildLine(start, end) {
  const r1 = Number(start.dataset.row);
  const c1 = Number(start.dataset.col);
  const r2 = Number(end.dataset.row);
  const c2 = Number(end.dataset.col);
  const dr = r2 - r1;
  const dc = c2 - c1;

  if (dr === 0 && dc === 0) return [start];
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;

  const steps = Math.max(Math.abs(dr), Math.abs(dc));
  const stepR = Math.sign(dr);
  const stepC = Math.sign(dc);
  const line = [];

  for (let i = 0; i <= steps; i += 1) {
    line.push(cells[r1 + stepR * i][c1 + stepC * i]);
  }

  return line;
}

/* Repaints the current drag and pending selection. */
function paintSelection() {
  const selected = new Set(dragCells);
  for (const row of cells) {
    for (const cell of row) {
      cell.classList.toggle("selected", selected.has(cell));
      cell.classList.toggle("pending", cell === tapStart && !selected.has(cell));
    }
  }
}

/* Shows a short feedback label over the board. */
function showFeedback(text, type) {
  feedbackEl.textContent = text;
  feedbackEl.className = `feedback ${type}`;
  void feedbackEl.offsetWidth;
  feedbackEl.classList.add("show");
}

/* Commits a selected line and checks it against the word list. */
function commitSelection(line) {
  if (!running || locked || line.length < 2) return;

  const text = line.map((cell) => cell.textContent).join("");
  const reversed = text.split("").reverse().join("");
  let match = null;

  for (const word of chosenWords) {
    if (foundWords.has(word)) continue;
    if (word === text || word === reversed) {
      match = word;
      break;
    }
  }

  if (!match) {
    for (const cell of line) {
      if (!cell.classList.contains("found")) cell.classList.add("miss");
    }
    gridEl.classList.remove("shake");
    void gridEl.offsetWidth;
    gridEl.classList.add("shake");
    showFeedback("No word", "bad");
    window.setTimeout(() => {
      for (const cell of line) cell.classList.remove("miss");
    }, 350);
    return;
  }

  foundWords.add(match);
  score += 100;

  for (const cell of line) {
    cell.classList.add("found");
    cell.classList.remove("selected");
  }

  const chip = wordListEl.querySelector(`[data-word="${match}"]`);
  if (chip) chip.classList.add("found");

  updateHud();
  showFeedback("+100", "good");

  if (foundWords.size >= chosenWords.length) {
    locked = true;
    window.clearInterval(timerId);
    timerId = null;
    window.setTimeout(() => {
      if (running) endGame(true);
    }, 450);
  }
}

/* Handles a tap when the player is selecting by first and last letter. */
function handleTap(cell) {
  if (!running || locked) return;

  if (!tapStart) {
    tapStart = cell;
    paintSelection();
    return;
  }

  if (tapStart === cell) {
    tapStart = null;
    paintSelection();
    return;
  }

  const line = buildLine(tapStart, cell);
  if (line) {
    commitSelection(line);
    tapStart = null;
    dragCells = [];
    paintSelection();
  } else {
    tapStart = cell;
    paintSelection();
  }
}

gridEl.addEventListener("pointerdown", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell || !running || locked) return;

  event.preventDefault();
  dragging = true;
  dragStart = cell;
  dragCells = [cell];
  try {
    gridEl.setPointerCapture(event.pointerId);
  } catch (error) {
    dragging = true;
  }
  paintSelection();
});

gridEl.addEventListener("pointermove", (event) => {
  if (!dragging) return;

  const target = document.elementFromPoint(event.clientX, event.clientY);
  const cell = target ? target.closest(".cell") : null;
  if (!cell) return;

  const line = buildLine(dragStart, cell);
  if (!line) return;

  if (line.length > 1) tapStart = null;
  dragCells = line;
  paintSelection();
});

gridEl.addEventListener("pointerup", (event) => {
  if (!dragging) return;

  dragging = false;
  try {
    gridEl.releasePointerCapture(event.pointerId);
  } catch (error) {
    dragging = false;
  }

  if (dragCells.length > 1) {
    const line = dragCells;
    dragCells = [];
    tapStart = null;
    commitSelection(line);
    paintSelection();
  } else {
    const cell = dragStart;
    dragCells = [];
    handleTap(cell);
  }

  dragStart = null;
});

gridEl.addEventListener("pointercancel", () => {
  dragging = false;
  dragStart = null;
  dragCells = [];
  paintSelection();
});

gridEl.addEventListener("contextmenu", (event) => {
  event.preventDefault();
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

const initial = generateBoard();
chosenWords = initial.words;
renderGrid(initial.letters);
renderWords();
updateHud();
