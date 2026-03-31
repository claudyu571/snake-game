(() => {
  const DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  const OPPOSITE = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
  };

  function createInitialState(options = {}) {
    const gridCols = Number.isFinite(options.gridCols)
      ? options.gridCols
      : Number.isFinite(options.gridSize)
        ? options.gridSize
        : 20;
    const gridRows = Number.isFinite(options.gridRows)
      ? options.gridRows
      : Number.isFinite(options.gridSize)
        ? options.gridSize
        : 20;
    const rng = typeof options.rng === "function" ? options.rng : Math.random;
    const midX = Math.floor(gridCols / 2);
    const midY = Math.floor(gridRows / 2);

    const snake = [
      { x: midX, y: midY },
      { x: midX - 1, y: midY },
      { x: midX - 2, y: midY },
    ];

    return {
      gridCols,
      gridRows,
      snake,
      direction: "right",
      queuedDirection: null,
      food: placeFood(gridCols, gridRows, snake, rng),
      score: 0,
      status: "playing",
    };
  }

  function queueDirection(state, nextDirection) {
    if (!DIRS[nextDirection]) {
      return state;
    }

    const current = state.queuedDirection || state.direction;

    if (nextDirection === current) {
      return state;
    }

    if (OPPOSITE[nextDirection] === current) {
      return state;
    }

    return {
      ...state,
      queuedDirection: nextDirection,
    };
  }

  function togglePause(state) {
    if (state.status === "playing") {
      return { ...state, status: "paused" };
    }

    if (state.status === "paused") {
      return { ...state, status: "playing" };
    }

    return state;
  }

  function step(state, rng = Math.random) {
    if (state.status !== "playing") {
      return state;
    }

    const direction = state.queuedDirection || state.direction;
    const delta = DIRS[direction];
    const head = state.snake[0];
    const newHead = { x: head.x + delta.x, y: head.y + delta.y };
    const { gridCols, gridRows } = state;

    if (
      newHead.x < 0 ||
      newHead.y < 0 ||
      newHead.x >= gridCols ||
      newHead.y >= gridRows
    ) {
      return {
        ...state,
        direction,
        queuedDirection: null,
        status: "gameover",
      };
    }

    const hitFood =
      state.food &&
      newHead.x === state.food.x &&
      newHead.y === state.food.y;

    const bodyToCheck = hitFood
      ? state.snake
      : state.snake.slice(0, -1);

    if (bodyToCheck.some((segment) => isSame(segment, newHead))) {
      return {
        ...state,
        direction,
        queuedDirection: null,
        status: "gameover",
      };
    }

    let snake;
    let food = state.food;
    let score = state.score;
    let status = state.status;

    if (hitFood) {
      snake = [newHead, ...state.snake];
      score = state.score + 1;

      if (snake.length === gridCols * gridRows) {
        status = "win";
        food = null;
      } else {
        food = placeFood(gridCols, gridRows, snake, rng);
      }
    } else {
      snake = [newHead, ...state.snake.slice(0, -1)];
    }

    return {
      ...state,
      snake,
      direction,
      queuedDirection: null,
      food,
      score,
      status,
    };
  }

  function placeFood(gridCols, gridRows, snake, rng = Math.random) {
    const totalCells = gridCols * gridRows;
    const occupied = new Set(snake.map((seg) => `${seg.x},${seg.y}`));
    const available = totalCells - occupied.size;

    if (available <= 0) {
      return null;
    }

    const targetIndex = Math.floor(rng() * available);
    let count = 0;

    for (let y = 0; y < gridRows; y += 1) {
      for (let x = 0; x < gridCols; x += 1) {
        const key = `${x},${y}`;
        if (occupied.has(key)) {
          continue;
        }
        if (count === targetIndex) {
          return { x, y };
        }
        count += 1;
      }
    }

    return null;
  }

  function isSame(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  window.SnakeLogic = {
    createInitialState,
    queueDirection,
    step,
    placeFood,
    togglePause,
  };
})();
