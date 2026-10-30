const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const soundBtn = document.getElementById("sound");
const padsEl = document.getElementById("pads");
const overlay = document.getElementById("overlay");
const titleEl = document.getElementById("title");
const messageEl = document.getElementById("message");
const actionBtn = document.getElementById("action");
const statusEl = document.getElementById("status");

const PAD_TONES = [329.63, 261.63, 392.0, 196.0];
const FLASH_DURATION = 160;
const flashTokens = [0, 0, 0, 0];

let score = 0;
let best = Number(localStorage.getItem("echo-best") || 0);
let running = false;
let accepting = false;
let sequence = [];
let inputIndex = 0;
let runId = 0;
let soundOn = localStorage.getItem("echo-sound") !== "0";
let audioCtx = null;

/* Returns a promise that resolves after the given delay. */
function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/* Creates or resumes the audio context after a user gesture. */
function ensureAudio() {
  if (!soundOn) return null;

  if (!audioCtx) {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      audioCtx = new AudioContextClass();
    } catch (error) {
      return null;
    }
  }

  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

/* Plays a short tone for one pad. */
function playTone(index, duration) {
  if (!soundOn) return;

  const ctx = ensureAudio();
  if (!ctx) return;

  try {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    oscillator.type = "triangle";
    oscillator.frequency.value = PAD_TONES[index];
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration / 1000);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + duration / 1000 + 0.05);
  } catch (error) {
    return;
  }
}

/* Lights a pad and plays its tone. */
function flashPad(index, duration) {
  const pad = padsEl.querySelector(`[data-pad="${index}"]`);
  if (!pad) return;

  flashTokens[index] += 1;
  const token = flashTokens[index];
  pad.classList.add("lit");
  playTone(index, duration);

  window.setTimeout(() => {
    if (token === flashTokens[index]) pad.classList.remove("lit");
  }, duration);
}

/* Refreshes the score and best labels. */
function updateHud() {
  scoreEl.textContent = String(score);
  bestEl.textContent = String(best);
}

/* Refreshes the sound toggle label. */
function updateSound() {
  soundBtn.textContent = soundOn ? "On" : "Off";
  soundBtn.setAttribute("aria-pressed", soundOn ? "true" : "false");
}

/* Starts a fresh run. */
function startGame() {
  score = 0;
  sequence = [];
  inputIndex = 0;
  running = true;
  accepting = false;
  runId += 1;
  const token = runId;

  updateHud();
  statusEl.textContent = "Watch closely...";
  overlay.classList.add("hidden");
  actionBtn.blur();
  ensureAudio();

  window.setTimeout(() => {
    if (running && token === runId) nextRound();
  }, 500);
}

/* Adds one step to the sequence and plays it back. */
function nextRound() {
  sequence.push(Math.floor(Math.random() * 4));
  inputIndex = 0;
  accepting = false;
  statusEl.textContent = `Round ${sequence.length}`;
  playSequence();
}

/* Plays the current sequence back to the player. */
async function playSequence() {
  const token = runId;
  accepting = false;
  await sleep(300);
  if (!running || token !== runId) return;

  const onTime = Math.max(220, 520 - sequence.length * 22);
  const gap = Math.max(90, 220 - sequence.length * 10);

  for (const index of sequence) {
    if (!running || token !== runId) return;
    flashPad(index, onTime);
    await sleep(onTime + gap);
  }

  if (!running || token !== runId) return;
  accepting = true;
  statusEl.textContent = "Your turn";
}

/* Handles a pad tap from the player. */
function handlePadTap(index) {
  if (!running || !accepting) return;

  flashPad(index, FLASH_DURATION);

  if (sequence[inputIndex] !== index) {
    accepting = false;
    wrongPad(index);
    return;
  }

  inputIndex += 1;

  if (inputIndex >= sequence.length) {
    accepting = false;
    score = sequence.length;
    updateHud();
    statusEl.textContent = "Nice";
    const token = runId;

    window.setTimeout(() => {
      if (running && token === runId) nextRound();
    }, 650);
  }
}

/* Shows the wrong pad, shakes the board, and ends the run. */
function wrongPad(index) {
  const pad = padsEl.querySelector(`[data-pad="${index}"]`);
  if (pad) pad.classList.add("wrong");

  padsEl.classList.remove("shake");
  void padsEl.offsetWidth;
  padsEl.classList.add("shake");
  statusEl.textContent = "Wrong pad";

  window.setTimeout(() => {
    if (pad) pad.classList.remove("wrong");
    endGame();
  }, 500);
}

/* Ends the run and records the best score. */
function endGame() {
  if (!running) return;

  running = false;
  accepting = false;
  runId += 1;

  if (score > best) {
    best = score;
    localStorage.setItem("echo-best", String(best));
  }

  updateHud();
  titleEl.textContent = "Sequence Broken";
  messageEl.textContent =
    score > 0
      ? `You repeated ${score} ${score === 1 ? "step" : "steps"}. Best: ${best}.`
      : `Wrong pad on the first step. Best: ${best}.`;
  actionBtn.textContent = "Play Again";
  overlay.classList.remove("hidden");
  statusEl.textContent = "Press play to try again.";
}

padsEl.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  const pad = event.target.closest(".pad");
  if (!pad) return;

  event.preventDefault();
  handlePadTap(Number(pad.dataset.pad));
});

soundBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  soundOn = !soundOn;
  localStorage.setItem("echo-sound", soundOn ? "1" : "0");
  updateSound();

  if (soundOn) {
    ensureAudio();
    playTone(0, 120);
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
updateSound();
