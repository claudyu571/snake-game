const CELL_SIZE = 33;
const TICK_MS = 120;
const LEADERBOARD_KEY = "snake.leaderboard.v1";
const PLAYER_NAME_KEY = "snake.playerName.v1";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const boardFrame = document.getElementById("board-frame");
const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("best-score");
const statusEl = document.getElementById("status");
const playerDisplay = document.getElementById("player-display");
const pauseBtn = document.getElementById("pause-btn");
const restartBtn = document.getElementById("restart-btn");
const changePlayerBtn = document.getElementById("change-player-btn");
const leaderboardBody = document.getElementById("leaderboard-body");

const boardOverlayEl = document.getElementById("board-overlay");
const overlayTitleEl = document.getElementById("overlay-title");
const overlayMessageEl = document.getElementById("overlay-message");

const nameModal = document.getElementById("name-modal");
const nameInput = document.getElementById("player-name");
const nameError = document.getElementById("name-error");
const startBtn = document.getElementById("start-btn");

let gridCols = 20;
let gridRows = 20;
let state = null;
let intervalId = null;
let gameStarted = false;
let playerName = "";

const KEY_DIR = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  a: "left",
  s: "down",
  d: "right",
  W: "up",
  A: "left",
  S: "down",
  D: "right",
};

function sanitizeName(rawName) {
  return rawName.trim().slice(0, 20);
}

function isModalOpen() {
  return !nameModal.classList.contains("hidden");
}

function resizeBoard() {
  const frameRect = boardFrame.getBoundingClientRect();
  const availW = Math.max(CELL_SIZE, frameRect.width);
  const availH = Math.max(CELL_SIZE, frameRect.height);

  const newCols = Math.max(10, Math.floor(availW / CELL_SIZE));
  const newRows = Math.max(10, Math.floor(availH / CELL_SIZE));
  const dimsChanged = newCols !== gridCols || newRows !== gridRows;

  gridCols = newCols;
  gridRows = newRows;

  const boardW = gridCols * CELL_SIZE;
  const boardH = gridRows * CELL_SIZE;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(boardW * dpr);
  canvas.height = Math.floor(boardH * dpr);
  canvas.style.width = `${boardW}px`;
  canvas.style.height = `${boardH}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  return dimsChanged;
}

function setControlsEnabled(enabled) {
  pauseBtn.disabled = !enabled;
  restartBtn.disabled = !enabled;
}

function loadSavedPlayerName() {
  try {
    return sanitizeName(localStorage.getItem(PLAYER_NAME_KEY) || "");
  } catch (error) {
    return "";
  }
}

function savePlayerName(name) {
  try {
    localStorage.setItem(PLAYER_NAME_KEY, name);
  } catch (error) {
    // Ignore storage failures and continue with in-memory state.
  }
}

function loadLeaderboard() {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => ({
        name: sanitizeName(typeof entry?.name === "string" ? entry.name : ""),
        score:
          Number.isFinite(entry?.score) && entry.score >= 0 ? entry.score : 0,
        timestamp:
          Number.isFinite(entry?.timestamp) && entry.timestamp > 0
            ? entry.timestamp
            : Date.now(),
      }))
      .filter((entry) => entry.name)
      .sort(compareEntries)
      .slice(0, 5);
  } catch (error) {
    return [];
  }
}

function saveLeaderboard(entries) {
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
  } catch (error) {
    // Ignore storage failures and continue without persistence.
  }
}

function compareEntries(a, b) {
  if (b.score !== a.score) {
    return b.score - a.score;
  }

  return a.timestamp - b.timestamp;
}

function getBestScore(entries) {
  return entries.length > 0 ? entries[0].score : 0;
}

function renderLeaderboard(entries = loadLeaderboard()) {
  leaderboardBody.innerHTML = "";
  bestScoreEl.textContent = String(getBestScore(entries));

  if (entries.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.className = "empty";
    cell.textContent = "No scores yet.";
    row.appendChild(cell);
    leaderboardBody.appendChild(row);
    return;
  }

  entries.forEach((entry, index) => {
    const row = document.createElement("tr");
    const rankCell = document.createElement("td");
    const nameCell = document.createElement("td");
    const scoreCell = document.createElement("td");

    rankCell.textContent = String(index + 1);
    nameCell.textContent = entry.name;
    scoreCell.textContent = String(entry.score);

    row.appendChild(rankCell);
    row.appendChild(nameCell);
    row.appendChild(scoreCell);
    leaderboardBody.appendChild(row);
  });
}

function recordScore(score) {
  if (!playerName || score <= 0) {
    renderLeaderboard();
    return;
  }

  const entries = loadLeaderboard();
  entries.push({
    name: playerName,
    score,
    timestamp: Date.now(),
  });

  const trimmed = entries.sort(compareEntries).slice(0, 5);
  saveLeaderboard(trimmed);
  renderLeaderboard(trimmed);
}

function setPlayer(name) {
  playerName = name;
  playerDisplay.textContent = playerName || "-";
  nameInput.value = playerName;
}

function openNameModal() {
  if (state?.status === "playing") {
    state = SnakeLogic.togglePause(state);
  }

  startBtn.textContent = gameStarted ? "Save and Restart" : "Start";
  nameError.textContent = "";
  nameModal.classList.remove("hidden");
  nameInput.focus();
  nameInput.select();
  render();
}

function closeNameModal() {
  nameModal.classList.add("hidden");
}

function startGame() {
  const name = sanitizeName(nameInput.value);
  if (!name) {
    nameError.textContent = "Please enter your name.";
    nameInput.focus();
    return;
  }

  setPlayer(name);
  savePlayerName(name);
  closeNameModal();
  gameStarted = true;
  setControlsEnabled(true);
  resetGame();

  if (!intervalId) {
    intervalId = window.setInterval(tick, TICK_MS);
  }
}

function resetGame() {
  if (!gameStarted) {
    return;
  }

  state = SnakeLogic.createInitialState({ gridCols, gridRows });
  render();
}

function togglePause() {
  if (!gameStarted || !state || isModalOpen()) {
    return;
  }

  state = SnakeLogic.togglePause(state);
  render();
}

function tick() {
  if (!gameStarted || !state || isModalOpen()) {
    return;
  }

  const previousStatus = state.status;
  state = SnakeLogic.step(state);

  if (
    previousStatus === "playing" &&
    (state.status === "gameover" || state.status === "win")
  ) {
    recordScore(state.score);
  }

  render();
}

function getStatusText() {
  if (!gameStarted) {
    return "Waiting";
  }

  if (!state) {
    return "Ready";
  }

  if (state.status === "paused") {
    return "Paused";
  }

  if (state.status === "gameover") {
    return "Game Over";
  }

  if (state.status === "win") {
    return "Victory";
  }

  return "Running";
}

function updateOverlay() {
  if (!gameStarted || !state || isModalOpen()) {
    boardOverlayEl.classList.add("hidden");
    return;
  }

  if (state.status === "paused") {
    overlayTitleEl.textContent = "Paused";
    overlayMessageEl.textContent =
      "Press Space, P, or the Pause button to continue.";
    boardOverlayEl.classList.remove("hidden");
    return;
  }

  if (state.status === "gameover") {
    overlayTitleEl.textContent = "Game Over";
    overlayMessageEl.textContent =
      "Press R or use Restart to begin a new run.";
    boardOverlayEl.classList.remove("hidden");
    return;
  }

  if (state.status === "win") {
    overlayTitleEl.textContent = "Board Cleared";
    overlayMessageEl.textContent =
      "You filled the entire grid. Press R or use Restart to play again.";
    boardOverlayEl.classList.remove("hidden");
    return;
  }

  boardOverlayEl.classList.add("hidden");
}

function drawBackground() {
  const boardW = gridCols * CELL_SIZE;
  const boardH = gridRows * CELL_SIZE;

  ctx.fillStyle = "#09110e";
  ctx.fillRect(0, 0, boardW, boardH);

  ctx.strokeStyle = "rgba(144, 181, 147, 0.14)";
  ctx.lineWidth = 1;

  for (let index = 0; index <= gridCols; index += 1) {
    const x = index * CELL_SIZE + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, boardH);
    ctx.stroke();
  }

  for (let index = 0; index <= gridRows; index += 1) {
    const y = index * CELL_SIZE + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(boardW, y);
    ctx.stroke();
  }
}

function drawCell(x, y, color) {
  const padding = Math.max(1, Math.floor(CELL_SIZE * 0.1));
  const size = CELL_SIZE - padding * 2;

  ctx.fillStyle = color;
  ctx.fillRect(
    x * CELL_SIZE + padding,
    y * CELL_SIZE + padding,
    size,
    size
  );
}

function render() {
  scoreEl.textContent = state ? String(state.score) : "0";
  statusEl.textContent = getStatusText();
  pauseBtn.textContent = state?.status === "paused" ? "Resume" : "Pause";

  drawBackground();

  if (state) {
    if (state.food) {
      drawCell(state.food.x, state.food.y, "#ff7869");
    }

    state.snake.forEach((segment, index) => {
      drawCell(segment.x, segment.y, index === 0 ? "#7cf08d" : "#2da44e");
    });
  }

  updateOverlay();
}

pauseBtn.addEventListener("click", togglePause);
restartBtn.addEventListener("click", resetGame);
changePlayerBtn.addEventListener("click", openNameModal);
startBtn.addEventListener("click", startGame);

nameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    startGame();
  }
});

nameInput.addEventListener("input", () => {
  if (nameError.textContent) {
    nameError.textContent = "";
  }
});

window.addEventListener("keydown", (event) => {
  if (isModalOpen()) {
    return;
  }

  if (!gameStarted) {
    return;
  }

  const key = event.key;

  if (KEY_DIR[key]) {
    event.preventDefault();
    if (state && state.status === "playing") {
      state = SnakeLogic.queueDirection(state, KEY_DIR[key]);
    }
    return;
  }

  if (key === " " || key === "Spacebar" || key === "p" || key === "P") {
    event.preventDefault();
    togglePause();
    return;
  }

  if (key === "r" || key === "R") {
    event.preventDefault();
    resetGame();
  }
});

window.addEventListener("resize", () => {
  const dimsChanged = resizeBoard();
  if (dimsChanged) {
    resetGame();
  } else {
    render();
  }
});

if ("ResizeObserver" in window) {
  const boardObserver = new ResizeObserver(() => {
    const dimsChanged = resizeBoard();
    if (dimsChanged) {
      resetGame();
    } else {
      render();
    }
  });
  boardObserver.observe(boardFrame);
}

setPlayer(loadSavedPlayerName());
resizeBoard();
setControlsEnabled(false);
renderLeaderboard();
render();
openNameModal();
