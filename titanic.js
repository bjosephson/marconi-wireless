// Dodge the Iceberg - Minimal Canvas Game
(function() {
  const STATE = {
    canvas: null,
    ctx: null,
    width: 800,
    height: 500,
    ship: { x: 380, y: 440, w: 40, h: 40, speed: 5 },
    icebergs: [],
    keys: { left: false, right: false },
    lastSpawn: 0,
    spawnIntervalMs: 900,
    lastFrameTime: 0,
    score: 0,
    gameOver: false,
    rafId: 0
  };

  function init() {
    STATE.canvas = document.getElementById('game');
    if (!STATE.canvas) return;
    STATE.ctx = STATE.canvas.getContext('2d');
    resizeToCanvas();
    attachEvents();
    STATE.lastFrameTime = performance.now();
    loop(STATE.lastFrameTime);
  }

  function attachEvents() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') STATE.keys.left = true;
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') STATE.keys.right = true;
      if (STATE.gameOver && (e.key === 'Enter' || e.key === ' ')) restart();
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') STATE.keys.left = false;
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') STATE.keys.right = false;
    });

    window.addEventListener('resize', resizeToCanvas);
  }

  function resizeToCanvas() {
    // Keep fixed game resolution but center the canvas via CSS
    STATE.canvas.width = STATE.width;
    STATE.canvas.height = STATE.height;
  }

  function spawnIceberg() {
    const w = 30 + Math.random() * 40;
    const h = 20 + Math.random() * 30;
    const x = Math.random() * (STATE.width - w);
    const speed = 2 + Math.random() * 2.5;
    STATE.icebergs.push({ x, y: -h, w, h, speed });
  }

  function update(dt) {
    if (STATE.gameOver) return;

    // Move ship
    if (STATE.keys.left) STATE.ship.x -= STATE.ship.speed;
    if (STATE.keys.right) STATE.ship.x += STATE.ship.speed;
    STATE.ship.x = Math.max(0, Math.min(STATE.width - STATE.ship.w, STATE.ship.x));

    // Spawn icebergs
    STATE.lastSpawn += dt;
    if (STATE.lastSpawn >= STATE.spawnIntervalMs) {
      STATE.lastSpawn = 0;
      spawnIceberg();
      // Gradually increase difficulty
      STATE.spawnIntervalMs = Math.max(300, STATE.spawnIntervalMs - 10);
    }

    // Move icebergs
    for (const berg of STATE.icebergs) {
      berg.y += berg.speed;
    }

    // Remove off-screen icebergs
    STATE.icebergs = STATE.icebergs.filter(b => b.y <= STATE.height + 50);

    // Collision detection
    for (const b of STATE.icebergs) {
      if (rectsOverlap(STATE.ship, b)) {
        STATE.gameOver = true;
        break;
      }
    }

    // Increase score over time
    STATE.score += dt * 0.01; // ~10 points per second
  }

  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function draw() {
    const ctx = STATE.ctx;
    ctx.clearRect(0, 0, STATE.width, STATE.height);

    // Background sea
    const gradient = ctx.createLinearGradient(0, 0, 0, STATE.height);
    gradient.addColorStop(0, '#0b1a3a');
    gradient.addColorStop(1, '#0a2a5e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, STATE.width, STATE.height);

    // Horizon line
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.moveTo(0, 80);
    ctx.lineTo(STATE.width, 80);
    ctx.stroke();

    // Ship (triangle on a hull)
    drawShip();

    // Icebergs
    for (const b of STATE.icebergs) {
      drawIceberg(b);
    }

    // HUD
    ctx.fillStyle = '#d4af37';
    ctx.font = 'bold 18px Courier New, monospace';
    ctx.fillText(`Score: ${Math.floor(STATE.score)}`, 16, 28);

    if (STATE.gameOver) drawGameOver();
  }

  function drawShip() {
    const ctx = STATE.ctx;
    const s = STATE.ship;

    // Hull
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(s.x, s.y + s.h - 10, s.w, 10);

    // Bow (triangle)
    ctx.fillStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.moveTo(s.x + s.w * 0.1, s.y + s.h - 10);
    ctx.lineTo(s.x + s.w * 0.9, s.y + s.h - 10);
    ctx.lineTo(s.x + s.w * 0.5, s.y);
    ctx.closePath();
    ctx.fill();
  }

  function drawIceberg(b) {
    const ctx = STATE.ctx;
    ctx.fillStyle = '#bfe9ff';
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.h);
    ctx.lineTo(b.x + b.w * 0.2, b.y + b.h * 0.2);
    ctx.lineTo(b.x + b.w * 0.6, b.y);
    ctx.lineTo(b.x + b.w, b.y + b.h * 0.3);
    ctx.lineTo(b.x + b.w * 0.8, b.y + b.h);
    ctx.closePath();
    ctx.fill();
  }

  function drawGameOver() {
    const ctx = STATE.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, STATE.width, STATE.height);

    ctx.fillStyle = '#ff4757';
    ctx.font = 'bold 36px Courier New, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('You hit an iceberg!', STATE.width / 2, STATE.height / 2 - 10);

    ctx.fillStyle = '#d4af37';
    ctx.font = 'bold 20px Courier New, monospace';
    ctx.fillText(`Final Score: ${Math.floor(STATE.score)}`, STATE.width / 2, STATE.height / 2 + 24);

    ctx.fillStyle = '#f0f0f0';
    ctx.font = '18px Courier New, monospace';
    ctx.fillText('Press Enter or Space to retry', STATE.width / 2, STATE.height / 2 + 56);
    ctx.textAlign = 'start';
  }

  function restart() {
    STATE.icebergs = [];
    STATE.spawnIntervalMs = 900;
    STATE.ship.x = (STATE.width - STATE.ship.w) / 2;
    STATE.score = 0;
    STATE.gameOver = false;
  }

  function loop(now) {
    const dt = now - STATE.lastFrameTime;
    STATE.lastFrameTime = now;

    update(dt);
    draw();

    STATE.rafId = requestAnimationFrame(loop);
  }

  // Auto-init when the page is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
