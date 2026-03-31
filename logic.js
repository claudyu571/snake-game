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

  const GEM_LIFETIME_TICKS = 67;   // ~8 seconds at 120ms per tick
  const GEM_SPAWN_CHANCE = 0.45;   // 45% chance to spawn a gem after eating food
  const MAX_GEMS = 2;
  const BONUS_GEM_POINTS = 5;
  const SHRINK_AMOUNT = 3;
  const MIN_SNAKE_LENGTH = 3;
  const EFFECT_DURATION_TICKS = 42; // ~5 seconds at 120ms per tick
  const MULTIPLIER_FOOD_COUNT = 5;
  const GEM_TYPES = ["bonus", "shrink", "speed", "slow", "multiplier"];

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

    const enableGems = options.enableGems === true;

    return {
      gridCols,
      gridRows,
      snake,
      direction: "right",
      queuedDirection: null,
      food: placeFood(gridCols, gridRows, snake, rng),
      gems: [],
      activeEffects: [],
      scoreMultiplier: 1,
      multiplierFoodLeft: 0,
      enableGems,
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

    // Wall collision
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

    // Body collision (exclude tail when not eating, as it will have moved)
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

    // Tick down active effects and remove expired ones
    let activeEffects = state.activeEffects
      .map((e) => ({ ...e, ticksLeft: e.ticksLeft - 1 }))
      .filter((e) => e.ticksLeft > 0);

    // Build new snake
    let snake;
    let food = state.food;
    let score = state.score;
    let status = state.status;
    let scoreMultiplier = state.scoreMultiplier;
    let multiplierFoodLeft = state.multiplierFoodLeft;

    if (hitFood) {
      snake = [newHead, ...state.snake];
      score += scoreMultiplier;

      if (scoreMultiplier > 1) {
        multiplierFoodLeft -= 1;
        if (multiplierFoodLeft <= 0) {
          scoreMultiplier = 1;
          multiplierFoodLeft = 0;
        }
      }

      if (snake.length === gridCols * gridRows) {
        status = "win";
        food = null;
      } else {
        food = placeFood(gridCols, gridRows, snake, rng);
      }
    } else {
      snake = [newHead, ...state.snake.slice(0, -1)];
    }

    // Gem collision — check after new snake is built
    const hitGemIndex = state.gems.findIndex(
      (g) => g.x === newHead.x && g.y === newHead.y
    );
    const hitGem = hitGemIndex >= 0 ? state.gems[hitGemIndex] : null;

    // Remove the collected gem
    let gems = state.gems.filter((_, i) => i !== hitGemIndex);

    if (hitGem) {
      if (hitGem.type === "bonus") {
        score += BONUS_GEM_POINTS;
      } else if (hitGem.type === "shrink") {
        snake = snake.slice(0, Math.max(MIN_SNAKE_LENGTH, snake.length - SHRINK_AMOUNT));
      } else if (hitGem.type === "speed" || hitGem.type === "slow") {
        // Replace any existing speed/slow effect
        activeEffects = activeEffects.filter(
          (e) => e.type !== "speed" && e.type !== "slow"
        );
        activeEffects = [
          ...activeEffects,
          { type: hitGem.type, ticksLeft: EFFECT_DURATION_TICKS },
        ];
      } else if (hitGem.type === "multiplier") {
        scoreMultiplier = 2;
        multiplierFoodLeft = MULTIPLIER_FOOD_COUNT;
      }
    }

    // Tick down gem timers and remove expired ones
    gems = gems
      .map((g) => ({ ...g, ticksLeft: g.ticksLeft - 1 }))
      .filter((g) => g.ticksLeft > 0);

    // Try to spawn a gem when food was just eaten (Advanced mode only)
    if (hitFood && status === "playing" && state.enableGems) {
      gems = trySpawnGem(gridCols, gridRows, snake, food, gems, rng);
    }

    return {
      ...state,
      snake,
      direction,
      queuedDirection: null,
      food,
      gems,
      activeEffects,
      scoreMultiplier,
      multiplierFoodLeft,
      score,
      status,
    };
  }

  function trySpawnGem(gridCols, gridRows, snake, food, gems, rng) {
    if (gems.length >= MAX_GEMS) {
      return gems;
    }

    if (rng() > GEM_SPAWN_CHANCE) {
      return gems;
    }

    const pos = placeGem(gridCols, gridRows, snake, food, gems, rng);
    if (!pos) {
      return gems;
    }

    const type = GEM_TYPES[Math.floor(rng() * GEM_TYPES.length)];
    return [...gems, { ...pos, type, ticksLeft: GEM_LIFETIME_TICKS }];
  }

  function placeGem(gridCols, gridRows, snake, food, gems, rng) {
    const occupied = new Set(snake.map((s) => `${s.x},${s.y}`));
    if (food) {
      occupied.add(`${food.x},${food.y}`);
    }
    gems.forEach((g) => occupied.add(`${g.x},${g.y}`));

    const totalCells = gridCols * gridRows;
    const available = totalCells - occupied.size;

    if (available <= 0) {
      return null;
    }

    const targetIndex = Math.floor(rng() * available);
    let count = 0;

    for (let y = 0; y < gridRows; y += 1) {
      for (let x = 0; x < gridCols; x += 1) {
        if (occupied.has(`${x},${y}`)) {
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
