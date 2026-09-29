(() => {
  'use strict';

  // ===== 基础配置 =====
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const COLS = 20;
  const ROWS = 20;
  const CELL = canvas.width / COLS;

  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayText = document.getElementById('overlay-text');
  const btnStart = document.getElementById('btn-start');
  const btnPause = document.getElementById('btn-pause');
  const btnReset = document.getElementById('btn-reset');

  const BEST_KEY = 'snake_best_score';

  // ===== 游戏状态 =====
  let snake, dir, nextDir, food, score, best, speed;
  let timer = null;
  let running = false;
  let paused = false;

  best = Number(localStorage.getItem(BEST_KEY) || 0);
  bestEl.textContent = best;

  // ===== 工具 =====
  const isOpposite = (a, b) => a.x + b.x === 0 && a.y + b.y === 0;

  function randomFood() {
    const occupied = new Set(snake.map(s => s.x + ',' + s.y));
    const empty = [];
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        if (!occupied.has(x + ',' + y)) empty.push({ x, y });
      }
    }
    if (!empty.length) return null;
    return empty[(Math.random() * empty.length) | 0];
  }

  // ===== 初始化 =====
  function reset() {
    stopLoop();
    snake = [
      { x: 10, y: 10 },
      { x: 9,  y: 10 },
      { x: 8,  y: 10 },
    ];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    score = 0;
    speed = 140;
    food = randomFood();
    running = false;
    paused = false;

    scoreEl.textContent = 0;
    btnPause.disabled = true;
    btnPause.textContent = '暂停';

    showOverlay('贪吃蛇', '方向键 / WASD / 屏幕按钮控制', '开始游戏');
    draw();
  }

  // ===== 覆盖层 =====
  function showOverlay(title, text, btn) {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    btnStart.textContent = btn;
    overlay.classList.remove('hide');
  }

  function hideOverlay() {
    overlay.classList.add('hide');
  }

  // ===== 循环 =====
  function startLoop() {
    stopLoop();
    timer = setInterval(step, speed);
  }

  function stopLoop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function step() {
    dir = nextDir;

    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      return gameOver();
    }

    for (let i = 0; i < snake.length - 1; i++) {
      if (snake[i].x === head.x && snake[i].y === head.y) {
        return gameOver();
      }
    }

    snake.unshift(head);

    if (food && head.x === food.x && head.y === food.y) {
      score += 10;
      scoreEl.textContent = score;

      if (score > best) {
        best = score;
        bestEl.textContent = best;
        localStorage.setItem(BEST_KEY, best);
      }

      food = randomFood();

      if (!food) {
        stopLoop();
        running = false;
        btnPause.disabled = true;
        showOverlay('通关！', `最终得分 ${score}`, '再来一局');
        draw();
        return;
      }

      if (score % 50 === 0 && speed > 60) {
        speed -= 10;
        startLoop();
      }
    } else {
      snake.pop();
    }

    draw();
  }

  function gameOver() {
    stopLoop();
    running = false;
    btnPause.disabled = true;
    showOverlay('游戏结束', `得分 ${score}　最高 ${best}`, '再来一局');
    draw();
  }

  // ===== 绘制 =====
  function draw() {
    ctx.fillStyle = '#1a1d28';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    for (let i = 1; i < COLS; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL, 0);
      ctx.lineTo(i * CELL, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL);
      ctx.lineTo(canvas.width, i * CELL);
      ctx.stroke();
    }

    if (food) {
      const cx = food.x * CELL + CELL / 2;
      const cy = food.y * CELL + CELL / 2;
      ctx.fillStyle = '#f87171';
      ctx.beginPath();
      ctx.arc(cx, cy, CELL * 0.32, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(cx - CELL * 0.1, cy - CELL * 0.1, CELL * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }

    snake.forEach((seg, i) => {
      const x = seg.x * CELL;
      const y = seg.y * CELL;
      const pad = 1.5;

      if (i === 0) {
        ctx.fillStyle = '#4ade80';
      } else {
        const t = i / snake.length;
        const g = Math.round(200 - t * 80);
        ctx.fillStyle = `rgb(74, ${g}, 128)`;
      }

      roundRect(x + pad, y + pad, CELL - pad * 2, CELL - pad * 2, 5);
      ctx.fill();
    });

    if (snake.length) {
      const h = snake[0];
      const cx = h.x * CELL + CELL / 2;
      const cy = h.y * CELL + CELL / 2;
      const off = CELL * 0.18;
      const eyeR = CELL * 0.09;

      let ex1, ey1, ex2, ey2;
      if (dir.x === 1)       { ex1 = cx + off; ey1 = cy - off; ex2 = cx + off; ey2 = cy + off; }
      else if (dir.x === -1) { ex1 = cx - off; ey1 = cy - off; ex2 = cx - off; ey2 = cy + off; }
      else if (dir.y === -1) { ex1 = cx - off; ey1 = cy - off; ex2 = cx + off; ey2 = cy - off; }
      else                   { ex1 = cx - off; ey1 = cy + off; ex2 = cx + off; ey2 = cy + off; }

      ctx.fillStyle = '#12141c';
      ctx.beginPath(); ctx.arc(ex1, ey1, eyeR, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex2, ey2, eyeR, 0, Math.PI * 2); ctx.fill();
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ===== 转向（按钮 + 键盘 + 滑动 共用）=====
  function turn(nx, ny) {
    if (paused) return;                 // 暂停时不能转向
    const nd = { x: nx, y: ny };
    if (isOpposite(nd, nextDir)) return; // 不能 180° 掉头
    nextDir = nd;
  }

  // ===== 键盘 =====
  const keyMap = {
    ArrowUp:    [0, -1], w: [0, -1], W: [0, -1],
    ArrowDown:  [0,  1], s: [0,  1], S: [0,  1],
    ArrowLeft:  [-1, 0], a: [-1, 0], A: [-1, 0],
    ArrowRight: [1,  0], d: [1,  0], D: [1,  0],
  };

  document.addEventListener('keydown', (e) => {
    const k = keyMap[e.key];
    if (k) {
      e.preventDefault();
      turn(k[0], k[1]);
    }
    if (e.code === 'Space') {
      e.preventDefault();
      togglePause();
    }
  });

  // ===== 屏幕方向键按钮 =====
  const dirMap = {
    up:    [0, -1],
    down:  [0,  1],
    left:  [-1, 0],
    right: [1,  0],
  };

  document.querySelectorAll('.dpad-btn').forEach((btn) => {
    const handler = (e) => {
      e.preventDefault();
      const d = dirMap[btn.dataset.dir];
      if (d) turn(d[0], d[1]);
    };
    btn.addEventListener('click', handler);
    btn.addEventListener('touchstart', handler, { passive: false });
  });

  // ===== 滑动（保留，且和按钮不冲突）=====
  let touchStart = null;

  canvas.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });

  canvas.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    const TH = 24;
    touchStart = null;

    if (Math.abs(dx) < TH && Math.abs(dy) < TH) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      turn(dx > 0 ? 1 : -1, 0);
    } else {
      turn(0, dy > 0 ? 1 : -1);
    }
  }, { passive: true });

  // ===== 按钮逻辑 =====
  function startGame() {
    if (running) return;
    hideOverlay();
    running = true;
    paused = false;
    btnPause.disabled = false;
    btnPause.textContent = '暂停';
    dir = { ...nextDir };
    startLoop();
  }

  function togglePause() {
    if (!running) return;
    paused = !paused;
    if (paused) {
      stopLoop();
      btnPause.textContent = '继续';
      showOverlay('已暂停', '点继续或按空格恢复', '继续游戏');
    } else {
      hideOverlay();
      btnPause.textContent = '暂停';
      startLoop();
    }
  }

  btnStart.addEventListener('click', () => {
    if (paused) {
      togglePause();
      return;
    }
    if (!running) {
      const needReset =
        overlayTitle.textContent === '游戏结束' ||
        overlayTitle.textContent === '通关！';
      if (needReset) reset();
      startGame();
    }
  });

  btnPause.addEventListener('click', togglePause);

  btnReset.addEventListener('click', () => {
    reset();
  });

  // ===== 启动 =====
  reset();
})();