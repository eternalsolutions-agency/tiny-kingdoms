(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const startScreen = document.getElementById('startScreen');
  const helpScreen = document.getElementById('helpScreen');
  const hud = document.getElementById('hud');
  const inventoryEl = document.getElementById('inventory');
  const messageEl = document.getElementById('message');
  const lifeBar = document.getElementById('lifeBar');
  const energyBar = document.getElementById('energyBar');

  const TILE = 32;
  const WORLD_W = 120;
  const WORLD_H = 42;
  const SAVE_KEY = 'tiny_kingdoms_v020_save';

  const BLOCKS = {
    0: { name: 'Aria', solid: false },
    1: { name: 'Erba', color: '#64c56b', top: '#7fe082', solid: true, item: 'dirt' },
    2: { name: 'Terra', color: '#9b6a3e', top: '#b98552', solid: true, item: 'dirt' },
    3: { name: 'Pietra', color: '#8e99a5', top: '#aeb7c1', solid: true, item: 'stone' },
    4: { name: 'Legno', color: '#8a5a2b', top: '#a86b32', solid: true, item: 'wood' },
    5: { name: 'Foglie', color: '#49a95a', top: '#65c76f', solid: true, item: 'wood' },
    6: { name: 'Cristallo', color: '#7ce7ff', top: '#c6f7ff', solid: true, item: 'crystal' }
  };

  const ITEMS = {
    dirt: { label: 'Terra', block: 2, icon: '🟫' },
    wood: { label: 'Legno', block: 4, icon: '🪵' },
    stone: { label: 'Pietra', block: 3, icon: '🪨' }
  };

  let state = 'menu';
  let paused = false;
  let world = [];
  let keys = {};
  let selected = 'dirt';
  let inventory = { dirt: 20, wood: 0, stone: 0 };
  let camera = { x: 0, y: 0 };
  let dayTime = 0;
  let last = performance.now();
  let messageTimer = 0;

  const player = {
    x: 8 * TILE, y: 10 * TILE, w: 22, h: 30,
    vx: 0, vy: 0, speed: 3.3, jump: 10.8,
    grounded: false, facing: 1, life: 100, energy: 100
  };

  function emptyWorld() {
    return Array.from({ length: WORLD_H }, () => Array(WORLD_W).fill(0));
  }

  function generateWorld() {
    world = emptyWorld();
    const islands = [
      { x: 2, y: 24, w: 30, h: 5 },
      { x: 38, y: 19, w: 22, h: 5 },
      { x: 68, y: 25, w: 28, h: 5 },
      { x: 98, y: 17, w: 18, h: 5 }
    ];
    islands.forEach((island, idx) => makeIsland(island.x, island.y, island.w, island.h, idx));
    plantTree(8, 23); plantTree(17, 23); plantTree(43, 18); plantTree(75, 24); plantTree(106, 16);
    setBlock(54, 17, 6); setBlock(84, 23, 6);
    player.x = 7 * TILE; player.y = 18 * TILE; player.vx = 0; player.vy = 0;
    saveGame(false);
  }

  function makeIsland(x, y, w, h, seed) {
    for (let tx = x; tx < x + w; tx++) {
      const curve = Math.round(Math.sin((tx + seed) * 0.6) * 1.5);
      for (let ty = y + curve; ty < y + h + Math.abs(curve); ty++) {
        if (ty < 0 || ty >= WORLD_H || tx < 0 || tx >= WORLD_W) continue;
        if (ty === y + curve) setBlock(tx, ty, 1);
        else if (ty < y + curve + 3) setBlock(tx, ty, 2);
        else setBlock(tx, ty, 3);
      }
    }
  }

  function plantTree(x, groundY) {
    for (let i = 0; i < 4; i++) setBlock(x, groundY - i, 4);
    for (let dx = -2; dx <= 2; dx++) for (let dy = -6; dy <= -3; dy++) {
      if (Math.abs(dx) + Math.abs(dy + 4) <= 4) setBlock(x + dx, groundY + dy, 5);
    }
  }

  function setBlock(x, y, id) {
    if (x >= 0 && x < WORLD_W && y >= 0 && y < WORLD_H) world[y][x] = id;
  }

  function getBlock(x, y) {
    if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return 0;
    return world[y][x];
  }

  function isSolidAtPixel(px, py) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    return BLOCKS[getBlock(tx, ty)]?.solid;
  }

  function rectCollides(x, y, w, h) {
    return isSolidAtPixel(x, y) || isSolidAtPixel(x + w, y) || isSolidAtPixel(x, y + h) || isSolidAtPixel(x + w, y + h);
  }

  function updatePlayer() {
    if (keys.a || keys.ArrowLeft) { player.vx = -player.speed; player.facing = -1; }
    else if (keys.d || keys.ArrowRight) { player.vx = player.speed; player.facing = 1; }
    else player.vx *= 0.75;

    if ((keys[' '] || keys.w || keys.ArrowUp) && player.grounded) {
      player.vy = -player.jump;
      player.grounded = false;
      player.energy = Math.max(0, player.energy - 2);
    }

    player.vy += 0.48;
    player.vy = Math.min(player.vy, 14);

    moveAxis('x', player.vx);
    player.grounded = false;
    moveAxis('y', player.vy);

    if (player.y > WORLD_H * TILE + 200) {
      player.life = Math.max(0, player.life - 20);
      player.x = 7 * TILE; player.y = 18 * TILE; player.vx = 0; player.vy = 0;
      showMessage('Attento alle nuvole! Sei tornato all\'isola iniziale.' );
    }

    player.energy = Math.min(100, player.energy + 0.035);
  }

  function moveAxis(axis, amount) {
    const step = Math.sign(amount);
    let remaining = Math.abs(amount);
    while (remaining > 0) {
      const move = Math.min(1, remaining) * step;
      if (axis === 'x') {
        if (!rectCollides(player.x + move, player.y, player.w, player.h)) player.x += move;
        else { player.vx = 0; break; }
      } else {
        if (!rectCollides(player.x, player.y + move, player.w, player.h)) player.y += move;
        else { if (move > 0) player.grounded = true; player.vy = 0; break; }
      }
      remaining -= 1;
    }
  }

  function updateCamera() {
    const targetX = player.x + player.w / 2 - canvas.width / 2;
    const targetY = player.y + player.h / 2 - canvas.height / 2;
    camera.x += (targetX - camera.x) * 0.08;
    camera.y += (targetY - camera.y) * 0.08;
    camera.x = Math.max(0, Math.min(camera.x, WORLD_W * TILE - canvas.width));
    camera.y = Math.max(0, Math.min(camera.y, WORLD_H * TILE - canvas.height));
  }

  function mineOrPlace(e, place = false) {
    if (state !== 'play' || paused) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX + camera.x;
    const my = (e.clientY - rect.top) * scaleY + camera.y;
    const tx = Math.floor(mx / TILE), ty = Math.floor(my / TILE);
    const dist = Math.hypot((player.x + player.w/2) - (tx*TILE+16), (player.y + player.h/2) - (ty*TILE+16));
    if (dist > 160) { showMessage('Troppo lontano. Avvicinati al blocco.'); return; }

    if (place) {
      if (getBlock(tx, ty) !== 0) return;
      if ((inventory[selected] || 0) <= 0) { showMessage(`Non hai ${ITEMS[selected].label.toLowerCase()} da piazzare.`); return; }
      const block = ITEMS[selected].block;
      setBlock(tx, ty, block);
      inventory[selected]--;
      showMessage(`${ITEMS[selected].label} piazzata.`);
    } else {
      const id = getBlock(tx, ty);
      if (id === 0) return;
      const item = BLOCKS[id].item;
      if (item && inventory[item] !== undefined) inventory[item]++;
      setBlock(tx, ty, 0);
      player.energy = Math.max(0, player.energy - 1.2);
      showMessage(`${BLOCKS[id].name} raccolta.`);
    }
    updateHUD();
  }

  function drawSky() {
    const t = (Math.sin(dayTime) + 1) / 2;
    const night = 1 - t;
    const g = ctx.createLinearGradient(0,0,0,canvas.height);
    g.addColorStop(0, `rgb(${Math.round(78+20*t)},${Math.round(150+70*t)},${Math.round(220+25*t)})`);
    g.addColorStop(1, `rgb(${Math.round(170+60*t)},${Math.round(222+25*t)},255)`);
    ctx.fillStyle = g; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.globalAlpha = 0.2 + 0.35 * night;
    ctx.fillStyle = '#13264a'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.globalAlpha = 1;

    drawCloud(140 - camera.x * .15, 90, 1.1);
    drawCloud(470 - camera.x * .12, 150, .8);
    drawCloud(790 - camera.x * .18, 70, 1.25);
  }

  function drawCloud(x,y,s) {
    ctx.fillStyle = 'rgba(255,255,255,.72)';
    for (const c of [[0,0,30],[28,-10,36],[62,0,28],[32,10,42]]) {
      ctx.beginPath(); ctx.arc(x+c[0]*s, y+c[1]*s, c[2]*s, 0, Math.PI*2); ctx.fill();
    }
  }

  function drawWorld() {
    const startX = Math.floor(camera.x / TILE) - 1;
    const endX = Math.ceil((camera.x + canvas.width) / TILE) + 1;
    const startY = Math.floor(camera.y / TILE) - 1;
    const endY = Math.ceil((camera.y + canvas.height) / TILE) + 1;
    for (let y = startY; y <= endY; y++) for (let x = startX; x <= endX; x++) {
      const id = getBlock(x,y); if (!id) continue;
      const b = BLOCKS[id];
      const px = x*TILE - camera.x, py = y*TILE - camera.y;
      ctx.fillStyle = b.color; roundRect(px+1,py+1,TILE-2,TILE-2,6,true);
      ctx.fillStyle = b.top; ctx.fillRect(px+3,py+3,TILE-6,6);
      ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.strokeRect(px+.5,py+.5,TILE-1,TILE-1);
      if (id === 6) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(px+10,py+8,6,12); }
    }
  }

  function drawPlayer() {
    const x = Math.round(player.x - camera.x), y = Math.round(player.y - camera.y);
    ctx.save();
    ctx.translate(x + player.w/2, y);
    ctx.scale(player.facing,1);
    ctx.fillStyle = '#2f6fed'; roundRect(-10,10,20,20,5,true);
    ctx.fillStyle = '#ffd3a3'; roundRect(-9,0,18,15,6,true);
    ctx.fillStyle = '#5b3b24'; ctx.fillRect(-10,-2,20,6);
    ctx.fillStyle = '#17324d'; ctx.fillRect(3,6,3,3); ctx.fillRect(-6,6,3,3);
    ctx.fillStyle = '#2e3a59'; ctx.fillRect(-9,29,7,10); ctx.fillRect(2,29,7,10);
    ctx.restore();
  }

  function roundRect(x,y,w,h,r,fill){ctx.beginPath();ctx.roundRect(x,y,w,h,r); if(fill)ctx.fill(); else ctx.stroke();}

  function draw() {
    drawSky();
    ctx.save();
    drawWorld();
    drawPlayer();
    ctx.restore();
    if (paused && state === 'play') {
      ctx.fillStyle = 'rgba(23,50,77,.55)'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = '#fff'; ctx.font = '900 48px Arial'; ctx.textAlign = 'center'; ctx.fillText('PAUSA', canvas.width/2, canvas.height/2);
      ctx.font = '700 18px Arial'; ctx.fillText('Premi P per continuare', canvas.width/2, canvas.height/2 + 38);
    }
  }

  function updateHUD() {
    inventoryEl.innerHTML = '';
    Object.keys(ITEMS).forEach((key, idx) => {
      const div = document.createElement('div');
      div.className = 'slot' + (selected === key ? ' active' : '');
      div.innerHTML = `${idx+1} ${ITEMS[key].icon}<br>${ITEMS[key].label}<br>x${inventory[key] || 0}`;
      div.onclick = () => { selected = key; updateHUD(); };
      inventoryEl.appendChild(div);
    });
    lifeBar.style.width = `${player.life}%`;
    energyBar.style.width = `${player.energy}%`;
  }

  function showMessage(text) {
    messageEl.textContent = text;
    messageEl.classList.add('show');
    messageTimer = 1500;
  }

  function saveGame(withMsg = true) {
    const data = { world, player: { x: player.x, y: player.y, life: player.life, energy: player.energy }, inventory, selected };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    if (withMsg) showMessage('Partita salvata.');
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) { generateWorld(); return; }
      const data = JSON.parse(raw);
      world = data.world || emptyWorld();
      Object.assign(player, data.player || {});
      inventory = Object.assign({ dirt: 20, wood: 0, stone: 0 }, data.inventory || {});
      selected = data.selected || 'dirt';
    } catch { generateWorld(); }
  }

  function loop(now) {
    const dt = now - last; last = now;
    if (state === 'play' && !paused) {
      updatePlayer(); updateCamera(); dayTime += 0.00035 * dt;
      if (messageTimer > 0) { messageTimer -= dt; if (messageTimer <= 0) messageEl.classList.remove('show'); }
      updateHUD();
    }
    draw();
    requestAnimationFrame(loop);
  }

  function startGame() {
    loadGame();
    state = 'play'; paused = false;
    startScreen.classList.add('hidden'); helpScreen.classList.add('hidden'); hud.classList.remove('hidden');
    updateHUD(); showMessage('Benvenuto nelle Sky Islands!');
  }

  document.getElementById('startBtn').addEventListener('click', startGame);
  document.getElementById('howBtn').addEventListener('click', () => { startScreen.classList.add('hidden'); helpScreen.classList.remove('hidden'); });
  document.getElementById('backBtn').addEventListener('click', () => { helpScreen.classList.add('hidden'); startScreen.classList.remove('hidden'); });

  window.addEventListener('keydown', e => {
    keys[e.key] = true;
    if (e.key === '1') selected = 'dirt';
    if (e.key === '2') selected = 'wood';
    if (e.key === '3') selected = 'stone';
    if (e.key.toLowerCase() === 'p' && state === 'play') paused = !paused;
    if (e.key.toLowerCase() === 's' && state === 'play') saveGame();
    if (e.key.toLowerCase() === 'r' && state === 'play') { localStorage.removeItem(SAVE_KEY); inventory = { dirt:20, wood:0, stone:0 }; player.life=100; player.energy=100; generateWorld(); showMessage('Mondo resettato.'); }
    updateHUD();
  });
  window.addEventListener('keyup', e => { keys[e.key] = false; });
  canvas.addEventListener('mousedown', e => mineOrPlace(e, e.button === 2));
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('beforeunload', () => { if (state === 'play') saveGame(false); });

  generateWorld();
  requestAnimationFrame(loop);
})();
