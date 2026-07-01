(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');

  const W = canvas.width, H = canvas.height;
  const TILE = 48;
  const gravity = 0.75;
  const keys = new Set();
  let state = 'menu';
  let selectedHero = 'Leo';
  let cameraX = 0;
  let crystals = 0;
  let gameWon = false;

  const heroes = [
    { id:'Leo', type:'blue', title:'Leo', desc:'Coraggioso e pronto all’avventura.', speed:5.2, jump:15.5, color:'#2d72c9', cape:'#174ea6' },
    { id:'Finn', type:'red', title:'Finn', desc:'Agile, curioso e instancabile.', speed:5.8, jump:16.2, color:'#2f9a4a', cape:'#bb1e2d' },
    { id:'Nox', type:'mystic', title:'Nox', desc:'Uno strano esserino del cielo.', speed:5.0, jump:15.2, color:'#12586a', cape:'#3b166d' },
    { id:'Luna', type:'princess', title:'Luna', desc:'Principessa gentile e determinata.', speed:5.4, jump:17.0, color:'#f071b7', cape:'#b83385' }
  ];

  const heroById = id => heroes.find(h => h.id === id) || heroes[0];

  const player = {
    x: 120, y: 360, w: 34, h: 58, vx:0, vy:0, onGround:false,
    facing:1, health:3, energy:100, anim:0
  };

  const platforms = [];
  const pickups = [];
  const enemies = [];

  function resetLevel(){
    player.x=120; player.y=330; player.vx=0; player.vy=0; player.health=3; player.energy=100; player.onGround=false;
    cameraX=0; crystals=0; gameWon=false;
    platforms.length=0; pickups.length=0; enemies.length=0;
    addPlatform(0, 610, 900, 120, 'grass');
    addPlatform(1040, 535, 520, 120, 'grass');
    addPlatform(1700, 455, 560, 120, 'grass');
    addPlatform(2460, 560, 720, 120, 'grass');
    addPlatform(3350, 470, 680, 120, 'grass');
    addPlatform(4300, 610, 700, 120, 'finish');
    addPlatform(520, 455, 190, 38, 'wood');
    addPlatform(1220, 390, 220, 38, 'wood');
    addPlatform(1950, 320, 220, 38, 'wood');
    addPlatform(2810, 405, 230, 38, 'wood');
    addPlatform(3650, 330, 230, 38, 'wood');
    addPlatform(760, 555, 48, 55, 'stone');
    addPlatform(1500, 480, 48, 55, 'stone');
    addPlatform(2210, 400, 48, 55, 'stone');
    addPlatform(3120, 505, 48, 55, 'stone');
    for(let i=0;i<18;i++) pickups.push({x:360+i*240,y:300+Math.sin(i)*70,r:13,got:false});
    enemies.push({x:960,y:494,w:38,h:38,vx:1.3,min:930,max:1510});
    enemies.push({x:2520,y:519,w:38,h:38,vx:1.5,min:2480,max:3150});
    enemies.push({x:3480,y:429,w:38,h:38,vx:1.1,min:3380,max:4000});
  }

  function addPlatform(x,y,w,h,type){ platforms.push({x,y,w,h,type}); }

  function showMenu(){
    state = 'menu';
    overlay.innerHTML = `
      <div class="panel">
        <div class="logo">AND</div>
        <div class="subtitle">Tiny Kingdoms</div>
        <p class="small">Platform 2D fantasy - scegli il tuo eroe e recupera i Cristalli del Cielo.</p>
        <button class="btn" id="newGameBtn">Nuova partita</button>
        <button class="btn secondary" id="commandsBtn">Comandi</button>
      </div>`;
    document.getElementById('newGameBtn').onclick = showSelect;
    document.getElementById('commandsBtn').onclick = showCommands;
  }

  function showCommands(){
    overlay.innerHTML = `
      <div class="panel">
        <div class="logo">AND</div>
        <div class="subtitle">Comandi</div>
        <p><b>A / D</b> oppure <b>Frecce</b>: muovi il personaggio</p>
        <p><b>Spazio</b>: salta</p>
        <p><b>ESC</b>: torna al menu</p>
        <p><b>R</b>: ricomincia il livello</p>
        <button class="btn" id="backBtn">Indietro</button>
      </div>`;
    document.getElementById('backBtn').onclick = showMenu;
  }

  function showSelect(){
    state = 'select';
    overlay.innerHTML = `
      <div class="panel">
        <div class="logo">AND</div>
        <div class="subtitle">Scegli il tuo eroe</div>
        <div class="cards">
          ${heroes.map(h => `
            <div class="card ${selectedHero===h.id?'selected':''}" data-hero="${h.id}">
              <div class="portrait"><div class="avatar ${h.type}"><div class="cape"></div><div class="hair"></div><div class="head"></div><div class="body"></div><div class="legs"></div></div></div>
              <h3>${h.title}</h3><p>${h.desc}</p>
            </div>`).join('')}
        </div>
        <button class="btn" id="startBtn">Inizia avventura</button>
        <button class="btn secondary" id="menuBtn">Menu</button>
      </div>`;
    document.querySelectorAll('.card').forEach(card => {
      card.onclick = () => { selectedHero = card.dataset.hero; showSelect(); };
    });
    document.getElementById('startBtn').onclick = startGame;
    document.getElementById('menuBtn').onclick = showMenu;
  }

  function startGame(){
    resetLevel();
    state = 'play';
    overlay.innerHTML = `<div class="hud"><div class="hudbox" id="leftHud"></div><div class="hudbox" id="rightHud"></div></div>`;
  }

  function updateHud(){
    const left = document.getElementById('leftHud');
    const right = document.getElementById('rightHud');
    if(!left || !right) return;
    left.innerHTML = `❤️ ${'♥'.repeat(player.health)} &nbsp; ⚡ ${Math.max(0,Math.round(player.energy))}`;
    right.innerHTML = `💎 ${crystals}/18 &nbsp; 👤 ${selectedHero}`;
  }

  window.addEventListener('keydown', e => {
    keys.add(e.key.toLowerCase());
    if(e.key === 'Escape') showMenu();
    if(e.key.toLowerCase()==='r' && state==='play') resetLevel();
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

  function rects(a,b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }

  function update(){
    if(state !== 'play') return;
    const hero = heroById(selectedHero);
    let left = keys.has('a') || keys.has('arrowleft');
    let right = keys.has('d') || keys.has('arrowright');
    if(left){ player.vx = -hero.speed; player.facing=-1; }
    else if(right){ player.vx = hero.speed; player.facing=1; }
    else player.vx *= 0.80;
    if((keys.has(' ') || keys.has('arrowup') || keys.has('w')) && player.onGround){
      player.vy = -hero.jump; player.onGround=false;
    }
    player.vy += gravity;
    player.x += player.vx;
    for(const p of platforms){
      if(rects(player,p)){
        if(player.vx > 0) player.x = p.x - player.w;
        if(player.vx < 0) player.x = p.x + p.w;
        player.vx = 0;
      }
    }
    player.y += player.vy;
    player.onGround=false;
    for(const p of platforms){
      if(rects(player,p)){
        if(player.vy > 0){ player.y = p.y - player.h; player.onGround=true; }
        if(player.vy < 0) player.y = p.y + p.h;
        player.vy = 0;
      }
    }
    if(player.y > 900){ player.health--; player.x=Math.max(80,cameraX+80); player.y=260; player.vx=0; player.vy=0; if(player.health<=0) resetLevel(); }
    for(const c of pickups){
      if(!c.got){
        const dx = (player.x+player.w/2)-c.x, dy=(player.y+player.h/2)-c.y;
        if(Math.hypot(dx,dy)<42){ c.got=true; crystals++; }
      }
    }
    for(const e of enemies){
      e.x += e.vx;
      if(e.x < e.min || e.x > e.max) e.vx *= -1;
      if(rects(player,e)){
        if(player.vy > 2 && player.y + player.h < e.y + 22){ e.dead=true; player.vy=-11; }
        else { player.health--; player.x -= player.facing*90; player.vy=-8; if(player.health<=0) resetLevel(); }
      }
    }
    for(let i=enemies.length-1;i>=0;i--) if(enemies[i].dead) enemies.splice(i,1);
    cameraX += ((player.x - W*0.38) - cameraX) * 0.10;
    cameraX = Math.max(0, Math.min(cameraX, 3900));
    player.energy = Math.max(0, Math.min(100, player.energy + (player.onGround?0.035:-0.005)));
    player.anim += Math.abs(player.vx)*0.05 + 0.03;
    if(player.x > 4620 && crystals >= 10) gameWon = true;
    updateHud();
  }

  function drawSky(){
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#49a9ff'); g.addColorStop(.55,'#a8e6ff'); g.addColorStop(1,'#eaf8ff');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    drawSun(1060,110);
    for(let i=0;i<12;i++) drawCloud(((i*390 - cameraX*0.25)%1550)-120, 70+(i%5)*48, 1+(i%3)*0.25);
    for(let i=0;i<8;i++) drawIsland(((i*620 - cameraX*0.45)%1800)-200, 210+(i%3)*70, .6+(i%2)*.25);
  }
  function drawSun(x,y){ctx.fillStyle='#fff4a6';ctx.beginPath();ctx.arc(x,y,48,0,Math.PI*2);ctx.fill();}
  function drawCloud(x,y,s){ctx.fillStyle='rgba(255,255,255,.88)';for(const [dx,dy,r] of [[0,20,30],[35,10,38],[75,18,30],[42,32,46]]){ctx.beginPath();ctx.arc(x+dx*s,y+dy*s,r*s,0,Math.PI*2);ctx.fill();}}
  function drawIsland(x,y,s){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='rgba(56,130,78,.55)';ctx.fillRect(0,0,220,28);ctx.fillStyle='rgba(102,72,42,.55)';ctx.beginPath();ctx.moveTo(0,28);ctx.lineTo(220,28);ctx.lineTo(145,110);ctx.lineTo(60,95);ctx.closePath();ctx.fill();ctx.restore();}

  function drawPlatform(p){
    const x = Math.round(p.x - cameraX), y=p.y;
    if(x+p.w < -80 || x > W+80) return;
    const top = p.type==='wood' ? '#b9752b' : p.type==='stone' ? '#939aa5' : p.type==='finish' ? '#70c96b' : '#54b948';
    const side = p.type==='wood' ? '#744219' : p.type==='stone' ? '#606773' : '#8a5a2d';
    ctx.fillStyle=side; ctx.fillRect(x,y,p.w,p.h);
    ctx.fillStyle=top; ctx.fillRect(x,y,p.w,18);
    ctx.strokeStyle='rgba(0,0,0,.22)'; ctx.lineWidth=2;
    for(let tx=x; tx<x+p.w; tx+=TILE){
      ctx.strokeRect(tx,y,Math.min(TILE,x+p.w-tx),Math.min(TILE,p.h));
      if(p.type==='grass'){ctx.fillStyle='#7ee05d';ctx.fillRect(tx,y-5,Math.min(TILE,x+p.w-tx),8)}
    }
    if(p.type==='finish'){
      ctx.fillStyle='#ffd447'; ctx.fillRect(x+p.w-84,y-120,12,120);
      ctx.fillStyle='#ff5e70'; ctx.beginPath();ctx.moveTo(x+p.w-72,y-118);ctx.lineTo(x+p.w-10,y-92);ctx.lineTo(x+p.w-72,y-66);ctx.closePath();ctx.fill();
    }
  }

  function drawCrystal(c){
    if(c.got) return;
    const x = c.x-cameraX, y = c.y + Math.sin(Date.now()/260 + c.x)*5;
    if(x < -40 || x > W+40) return;
    ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.fillStyle='#21d6ff';ctx.fillRect(-12,-12,24,24);ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.strokeRect(-12,-12,24,24);ctx.restore();
  }

  function drawEnemy(e){
    const x=e.x-cameraX,y=e.y;if(x<-60||x>W+60)return;
    ctx.fillStyle='#8b5cf6';ctx.beginPath();ctx.arc(x+19,y+22,24,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fff';ctx.fillRect(x+8,y+12,8,8);ctx.fillRect(x+24,y+12,8,8);
    ctx.fillStyle='#111827';ctx.fillRect(x+11,y+14,4,4);ctx.fillRect(x+27,y+14,4,4);
  }

  function drawPlayer(){
    const hero = heroById(selectedHero);
    const x = Math.round(player.x-cameraX), y=Math.round(player.y);
    ctx.save();ctx.translate(x+player.w/2,y);ctx.scale(player.facing,1);ctx.translate(-player.w/2,0);
    const bob = player.onGround ? Math.sin(player.anim)*3 : 0;
    ctx.fillStyle=hero.cape;ctx.fillRect(-8,18+bob,16,38);
    ctx.fillStyle='#ffd0a0';ctx.fillRect(5,0+bob,24,24);
    ctx.fillStyle = hero.type==='princess' ? '#ffd44d' : hero.type==='mystic' ? '#101827' : '#6b3419';
    ctx.fillRect(2,-5+bob,30,13);
    ctx.fillStyle='#10243f';ctx.fillRect(11,9+bob,4,4);ctx.fillRect(23,9+bob,4,4);
    ctx.fillStyle=hero.color;ctx.fillRect(2,26+bob,30,27);
    ctx.fillStyle='#3b2414';ctx.fillRect(3,53+bob,10,19);ctx.fillRect(21,53-bob,10,19);
    ctx.fillStyle='#5b341c';ctx.fillRect(-3,72+bob,17,8);ctx.fillRect(20,72-bob,17,8);
    if(hero.type==='princess'){ctx.fillStyle='#ffeb70';ctx.fillRect(10,-15+bob,5,10);ctx.fillRect(18,-20+bob,5,15);ctx.fillRect(26,-15+bob,5,10)}
    if(hero.type==='mystic'){ctx.fillStyle='#8ef6ff';ctx.fillRect(12,8+bob,5,5);ctx.fillRect(23,8+bob,5,5)}
    ctx.restore();
  }

  function render(){
    drawSky();
    platforms.forEach(drawPlatform);
    pickups.forEach(drawCrystal);
    enemies.forEach(drawEnemy);
    drawPlayer();
    if(state !== 'play'){
      ctx.fillStyle='rgba(0,0,0,.08)'; ctx.fillRect(0,0,W,H);
    }
    if(gameWon){
      ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='bold 54px Arial';ctx.fillText('Isola completata!',W/2,H/2-20);
      ctx.font='bold 26px Arial';ctx.fillText('Premi R per rigiocare o ESC per tornare al menu',W/2,H/2+35);
    }
  }

  function loop(){ update(); render(); requestAnimationFrame(loop); }
  showMenu(); resetLevel(); loop();
})();
