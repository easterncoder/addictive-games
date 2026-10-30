const COLORS = [
  { name: "Red", hex: "#ff4d5a" },
  { name: "Green", hex: "#34d399" },
  { name: "Blue", hex: "#4d9dff" },
  { name: "Yellow", hex: "#ffd24d" },
];

const TOTAL_TIME = 60;
const PENALTY = 3;

const scoreEl = document.getElementById("score");
const comboEl = document.getElementById("combo");
const bestEl = document.getElementById("best");
const timerBar = document.getElementById("timerBar");
const board = document.getElementById("board");
const wordEl = document.getElementById("word");
const feedbackEl = document.getElementById("feedback");
const buttonsEl = document.getElementById("buttons");
const overlay = document.getElementById("overlay");
const titleEl = document.getElementById("title");
const messageEl = document.getElementById("message");
const actionBtn = document.getElementById("action");

let score = 0;
let combo = 0;
let bestCombo = 0;
let best = Number(localStorage.getItem("color-match-best") || 0);
let timeLeft = TOTAL_TIME;
let target = 0;
let running = false;
let lastTs = performance.now();

/* Builds the four answer buttons once at load. */
function buildButtons() {
  COLORS.forEach((color, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "color-btn";
    button.style.setProperty("--color", color.hex);
    button.dataset.index = String(index);
    button.innerHTML = `<span class="key">${index + 1}</span><span>${color.name}</span>`;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      choose(index);
    });
    buttonsEl.appendChild(button);
  });
}

/* Chooses a word and an ink color that disagree. */
function newRound() {
  const wordIndex = Math.floor(Math.random() * COLORS.length);
  let inkIndex = Math.floor(Math.random() * COLORS.length);
  while (inkIndex === wordIndex) {
    inkIndex = Math.floor(Math.random() * COLORS.length);
  }

  target = inkIndex;
  const ink = COLORS[inkIndex];
  wordEl.textContent = COLORS[wordIndex].name.toUpperCase();
  wordEl.style.color = ink.hex;
  wordEl.style.textShadow = `0 0 38px ${ink.hex}66`;

  wordEl.classList.remove("pop");
  void wordEl.offsetWidth;
  wordEl.classList.add("pop");
}

/* Handles an answer and updates score, combo, and time. */
function choose(index) {
  if (!running) return;

  if (index === target) {
    combo += 1;
    bestCombo = Math.max(bestCombo, combo);
    score += 1 + Math.floor(combo / 5);
    showFeedback(combo >= 5 ? `Combo x${1 + Math.floor(combo / 5)}` : "+1", "good");
    newRound();
  } else {
    combo = 0;
    timeLeft = Math.max(0, timeLeft - PENALTY);
    showFeedback(`-${PENALTY}s`, "bad");
    board.classList.remove("shake");
    void board.offsetWidth;
    board.classList.add("shake");
    newRound();
  }

  updateHud();
}

/* Animates a small feedback label under the word. */
function showFeedback(text, type) {
  feedbackEl.textContent = text;
  feedbackEl.className = `feedback ${type}`;
  void feedbackEl.offsetWidth;
  feedbackEl.classList.add("show");
}

/* Refreshes the score, combo, and best labels. */
function updateHud() {
  scoreEl.textContent = String(score);
  comboEl.textContent = String(combo);
  bestEl.textContent = String(best);
}

/* Starts a new 60 second round. */
function startGame() {
  score = 0;
  combo = 0;
  bestCombo = 0;
  timeLeft = TOTAL_TIME;
  running = true;
  lastTs = performance.now();
  updateHud();
  newRound();
  overlay.classList.add("hidden");
  actionBtn.blur();
  timerBar.style.width = "100%";
  timerBar.classList.remove("low");
}

/* Ends the round and records the best score. */
function endGame() {
  running = false;
  if (score > best) {
    best = score;
    localStorage.setItem("color-match-best", String(best));
  }
  updateHud();
  titleEl.textContent = "Time!";
  messageEl.textContent =
    score > 0
      ? `You scored ${score} with a best combo streak of ${bestCombo}.`
      : "No points this time. Trust the ink, not the word.";
  actionBtn.textContent = "Play Again";
  overlay.classList.remove("hidden");
}

/* Runs the countdown timer. */
function loop(now) {
  const dt = Math.min((now - lastTs) / 1000, 0.1);
  lastTs = now;

  if (running) {
    timeLeft = Math.max(0, timeLeft - dt);
    timerBar.style.width = `${(timeLeft / TOTAL_TIME) * 100}%`;
    timerBar.classList.toggle("low", timeLeft <= 10);
    if (timeLeft <= 0) {
      endGame();
    }
  }

  requestAnimationFrame(loop);
}

actionBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  startGame();
});

window.addEventListener("keydown", (event) => {
  if (event.key >= "1" && event.key <= "4") {
    event.preventDefault();
    choose(Number(event.key) - 1);
  } else if (event.code === "Space" || event.code === "Enter") {
    event.preventDefault();
    if (event.repeat) return;
    if (!running) startGame();
  }
});

buildButtons();
updateHud();
requestAnimationFrame(loop);
