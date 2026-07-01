const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const TILE = 32;
const WORLD_W = 95;
const WORLD_H = 28;
const GRAVITY = 0.75;
const FRICTION = 0.82;
const keys = new Set();
const mouse = { x: 0, y: 0 };
let gameState = 'menu';
let selected = 'wood';

const blocks = {
  grass: { color: '#4caf50', solid: true, drop: 'dirt' },
  dirt: { color: '#8b5a2b', solid: true, drop: 'dirt' },
  stone: { color: '#7b8794', solid: true, drop: 'stone' },
  wood: { color: '#9b5b24', solid: true, drop: 'wood' },
  leaves: { color: '#2e9d55', solid: true, drop: 'wood' }
};

const inventory = { wood: 12, stone: 6, dirt: 0 };

const player = {
  x: 220, y: 120, w: 24, h: 42,
  vx: 0, vy: 0, speed: 0.75, jump: 14,
  grounded: false, facing: 1
};

const camera = { x: 0, y: 0 };
let world = [];

function makeWorld(){
  world = Array.from({length: WORLD_H}, () => Array(WORLD_W).fill(null));
  const islands = [
    {x: 3, y: 16, w: 22}, {x: 31, y: 13, w: 18}, {x: 56, y: 17, w: 24}, {x: 18, y: 23, w: 16}, {x: 73, y: 10, w: 12}
  ];
  for(const isl of islands){
    for(let x=isl.x; x<isl.x+isl.w; x++){
      const wave = Math.sin(x*.7)*1.5|0;
      const top = isl.y + wave;
      setBlock(x, top, 'grass');
      setBlock(x, top+1, 'dirt');
      setBlock(x, top+2, 'dirt');
      if(x%4===0) setBlock(x, top+3, 'stone');
    }
    growTree(isl.x+4, isl.y-1);
    growTree(isl.x+Math.floor(isl.w*.65), isl.y-2);
  }
}

function growTree(x,y){
  for(let i=0;i<4;i++) setBlock(x,y-i,'wood');
  for(let yy=y-5; yy<=y-3; yy++) for(let xx=x-2; xx<=x+2; xx++) if(Math.abs(xx-x)+Math.abs(yy-(y-4))<4) setBlock(xx,yy,'leaves');
}

function setBlock(x,y,type){ if(x>=0&&x<WORLD_W&&y>=0&&y<WORLD_H) world[y][x]=type; }
function getBlock(x,y){ if(x<0||x>=WORLD_W||y<0||y>=WORLD_H) return null; return world[y][x]; }
function solidAtPx(px,py){ const b=getBlock(Math.floor(px/TILE),Math.floor(py/TILE)); return b && blocks[b].solid; }

function update(){
  if(gameState !== 'play') return;
  if(keys.has('a')||keys.has('arrowleft')) { player.vx -= player.speed; player.facing=-1; }
  if(keys.has('d')||keys.has('arrowright')) { player.vx += player.speed; player.facing=1; }
  if((keys.has(' ')||keys.has('w')||keys.has('arrowup')) && player.grounded){ player.vy = -player.jump; player.grounded=false; }
  player.vx *= FRICTION; player.vx = Math.max(-6, Math.min(6, player.vx));
  player.vy += GRAVITY; player.vy = Math.min(18, player.vy);
  move(player.vx,0); move(0,player.vy);
  camera.x += (player.x + player.w/2 - canvas.width/2 - camera.x)*0.10;
  camera.y += (player.y + player.h/2 - canvas.height/2 - camera.y)*0.10;
  camera.x = Math.max(0, Math.min(WORLD_W*TILE-canvas.width, camera.x));
  camera.y = Math.max(0, Math.min(WORLD_H*TILE-canvas.height, camera.y));
  updateHud();
}

function move(dx,dy){
  player.x += dx;
  if(collides(player)){ player.x -= dx; player.vx = 0; }
  player.y += dy;
  player.grounded = false;
  if(collides(player)){
    player.y -= dy;
    if(dy>0) player.grounded = true;
    player.vy = 0;
  }
  if(player.y > WORLD_H*TILE + 300) resetPlayer();
}

function collides(p){
  return solidAtPx(p.x,p.y)||solidAtPx(p.x+p.w,p.y)||solidAtPx(p.x,p.y+p.h)||solidAtPx(p.x+p.w,p.y+p.h);
}

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawSky();
  ctx.save(); ctx.translate(-camera.x,-camera.y);
  drawWorld(); drawPlayer();
  ctx.restore();
  requestAnimationFrame(loop);
}
function loop(){ update(); draw(); }

function drawSky(){
  const g=ctx.createLinearGradient(0,0,0,canvas.height); g.addColorStop(0,'#72c6ff'); g.addColorStop(1,'#dff7ff'); ctx.fillStyle=g; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='rgba(255,255,255,.72)';
  for(let i=0;i<8;i++){ const x=(i*170 - camera.x*.18)%1100-80; const y=60+(i%4)*65; cloud(x,y); }
}
function cloud(x,y){ ctx.beginPath(); ctx.arc(x,y,20,0,7); ctx.arc(x+22,y-8,26,0,7); ctx.arc(x+52,y,20,0,7); ctx.fillRect(x,y-3,60,23); ctx.fill(); }
function drawWorld(){
  for(let y=0;y<WORLD_H;y++) for(let x=0;x<WORLD_W;x++){ const type=world[y][x]; if(!type) continue; ctx.fillStyle=blocks[type].color; ctx.fillRect(x*TILE,y*TILE,TILE,TILE); ctx.strokeStyle='rgba(0,0,0,.12)'; ctx.strokeRect(x*TILE,y*TILE,TILE,TILE); if(type==='grass'){ctx.fillStyle='#7ed957';ctx.fillRect(x*TILE,y*TILE, TILE, 7);} }
}
function drawPlayer(){
  ctx.fillStyle='#1f4d7a'; ctx.fillRect(player.x+4,player.y+16,player.w-8,player.h-16);
  ctx.fillStyle='#ffd29d'; ctx.fillRect(player.x+3,player.y,player.w-6,20);
  ctx.fillStyle='#5a3b1e'; ctx.fillRect(player.x+2,player.y-3,player.w-4,8);
  ctx.fillStyle='#111'; ctx.fillRect(player.x+(player.facing>0?16:7),player.y+8,3,3);
  ctx.fillStyle='#654321'; ctx.fillRect(player.x+3,player.y+player.h-8,8,8); ctx.fillRect(player.x+player.w-11,player.y+player.h-8,8,8);
}

function targetTile(){ return { x: Math.floor((mouse.x+camera.x)/TILE), y: Math.floor((mouse.y+camera.y)/TILE) }; }
function mine(){
  if(gameState!=='play') return; const t=targetTile(); const type=getBlock(t.x,t.y); if(!type) return;
  const dist=Math.hypot(t.x*TILE-player.x,t.y*TILE-player.y); if(dist>170) return;
  world[t.y][t.x]=null; const drop=blocks[type].drop; inventory[drop]=(inventory[drop]||0)+1;
}
function place(){
  if(gameState!=='play') return; const t=targetTile(); if(getBlock(t.x,t.y)) return; if((inventory[selected]||0)<=0) return;
  const px=t.x*TILE, py=t.y*TILE;
  if(px < player.x+player.w && px+TILE > player.x && py < player.y+player.h && py+TILE > player.y) return;
  setBlock(t.x,t.y,selected); inventory[selected]--;
}
function updateHud(){
  document.getElementById('wood-count').textContent=inventory.wood||0;
  document.getElementById('stone-count').textContent=inventory.stone||0;
  document.getElementById('selected-block').textContent=selected==='wood'?'Legno':selected==='stone'?'Pietra':'Terra';
}
function resetPlayer(){ player.x=220; player.y=120; player.vx=0; player.vy=0; }

window.addEventListener('keydown',e=>{ keys.add(e.key.toLowerCase()); if(e.key==='Escape'){ gameState=gameState==='pause'?'play':'pause'; document.getElementById('pause').classList.toggle('active',gameState==='pause'); } if(e.key==='1') selected='wood'; if(e.key==='2') selected='stone'; if(e.key==='3') selected='dirt'; if(e.key.toLowerCase()==='r'){ makeWorld(); resetPlayer(); }});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
canvas.addEventListener('mousemove',e=>{ const r=canvas.getBoundingClientRect(); mouse.x=(e.clientX-r.left)*(canvas.width/r.width); mouse.y=(e.clientY-r.top)*(canvas.height/r.height); });
canvas.addEventListener('mousedown',e=>{ if(e.button===0) mine(); if(e.button===2) place(); });
canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.getElementById('play-btn').addEventListener('click',()=>{ gameState='play'; document.getElementById('menu').classList.remove('active'); });

makeWorld(); updateHud(); loop();
