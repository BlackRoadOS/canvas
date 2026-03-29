// Copyright (c) 2025-2026 BlackRoad OS, Inc. All Rights Reserved.
// Proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.
// BlackRoad OS, Inc. — Delaware C-Corp — blackroad.io

// Security headers for all responses
function addSecurityHeaders(response) {
  const h = new Headers(response.headers);
  h.set('X-Content-Type-Options', 'nosniff');
  
  h.set('X-XSS-Protection', '1; mode=block');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.delete('X-Frame-Options');
  h.set('Content-Security-Policy', "frame-ancestors 'self' https://blackroad.io https://*.blackroad.io");  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return new Response(response.body, { status: response.status, headers: h });
}

// RoadCanvas — Collaborative Pixel Canvas
// BlackRoad OS | canvas.blackroad.io
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    try {
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS canvas_pixels (
        x INTEGER NOT NULL, y INTEGER NOT NULL, color TEXT NOT NULL, placed_by TEXT DEFAULT 'anon',
        placed_at TEXT DEFAULT (datetime('now')), PRIMARY KEY (x, y)
      )`).run();
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS canvas_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT, x INTEGER, y INTEGER, color TEXT, placed_by TEXT,
        placed_at TEXT DEFAULT (datetime('now'))
      )`).run();
    } catch(e) {}

    if (path === '/api/health' || path === '/health') return json({ status: 'ok', service: 'roadcanvas', ts: Date.now() }, cors);
    if (path === '/api/info') return json({ name: 'RoadCanvas', description: 'Collaborative pixel canvas', version: '1.0.0', endpoints: ['/health', '/api/info'] }, cors);

    if (path === '/api/canvas') {
      const pixels = await env.DB.prepare('SELECT x, y, color FROM canvas_pixels').all();
      const grid = {};
      for (const p of pixels.results) grid[p.x + ',' + p.y] = p.color;
      const stats = await env.DB.prepare('SELECT COUNT(*) as total FROM canvas_history').first();
      return json({ grid, size: 64, totalPlacements: stats.total || 0 }, cors);
    }

    if ((path === '/api/place' || path === '/api/draw') && request.method === 'POST') {
      const body = await request.json();
      const { x, y, color, user } = body;
      if (x < 0 || x >= 64 || y < 0 || y >= 64) return json({ error: 'Out of bounds (0-63)' }, cors, 400);
      const validColors = ['#FF1D6C', '#F5A623', '#2979FF', '#9C27B0', '#00E676', '#FFFFFF', '#000000', '#333333', '#666666', '#999999'];
      if (!validColors.includes(color)) return json({ error: 'Invalid color', validColors }, cors, 400);
      const who = (user || 'anon').slice(0, 32);
      await env.DB.prepare('INSERT OR REPLACE INTO canvas_pixels (x, y, color, placed_by) VALUES (?, ?, ?, ?)').bind(x, y, color, who).run();
      await env.DB.prepare('INSERT INTO canvas_history (x, y, color, placed_by) VALUES (?, ?, ?, ?)').bind(x, y, color, who).run();
      return json({ ok: true, x, y, color, placed_by: who }, cors);
    }

    if (path === '/api/history') {
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
      const rows = await env.DB.prepare('SELECT x, y, color, placed_by, placed_at FROM canvas_history ORDER BY placed_at DESC LIMIT ?').bind(limit).all();
      return json({ history: rows.results }, cors);
    }

    if (path.startsWith('/api/')) return json({ error: 'Not found', path }, cors, 404);

    return new Response(HTML_CANVAS, { headers: { 'Content-Type': 'text/html', 'Content-Security-Policy': "frame-ancestors 'self' https://blackroad.io https://*.blackroad.io", ...cors } });
  }
};

function json(data, cors, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors } }); }

const HTML_CANVAS = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%230a0a0a'/><circle cx='10' cy='16' r='5' fill='%23FF2255'/><rect x='18' y='11' width='10' height='10' rx='2' fill='%238844FF'/></svg>" type="image/svg+xml">
<title>RoadCanvas -- Collaborative Pixel Art | BlackRoad OS</title>
<meta name="description" content="RoadCanvas: real-time collaborative pixel art canvas. Draw together with the BlackRoad fleet.">
<meta property="og:title" content="RoadCanvas -- Collaborative Pixel Art">
<meta property="og:description" content="Real-time collaborative pixel art canvas by BlackRoad OS.">
<meta property="og:url" content="https://canvas.blackroad.io">
<meta property="og:type" content="website">
<meta property="og:image" content="https://images.blackroad.io/pixel-art/road-logo.png">
<meta name="twitter:card" content="summary">
<link rel="canonical" href="https://canvas.blackroad.io/">
<meta name="robots" content="index, follow">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"RoadCanvas","url":"https://canvas.blackroad.io","applicationCategory":"DesignApplication","operatingSystem":"Web","description":"Real-time collaborative pixel art canvas","author":{"@type":"Organization","name":"BlackRoad OS, Inc."}}</script>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Inter:wght@400;500&family=JetBrains+Mono&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0a;color:#e5e5e5;font-family:'Inter',sans-serif;min-height:100vh;overflow-x:hidden}
h1,h2,h3{font-family:'Space Grotesk',sans-serif;color:#e5e5e5}
code{font-family:'JetBrains Mono',monospace}
.container{max-width:1100px;margin:0 auto;padding:24px}
.header{display:flex;align-items:center;gap:16px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #1a1a1a}
.logo{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;gap:4px}
.logo span{display:block;border-radius:50%}
.subtitle{color:#525252;font-size:14px}
.tabs{display:flex;gap:2px;margin-bottom:20px;background:#111;border-radius:10px;padding:3px;border:1px solid #1a1a1a}
.tab-btn{flex:1;padding:10px 16px;border:none;background:transparent;color:#525252;font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:600;border-radius:8px;cursor:pointer;transition:all .15s}
.tab-btn:hover{color:#a3a3a3}
.tab-btn.active{background:#1a1a1a;color:#e5e5e5}
.tab-panel{display:none}.tab-panel.active{display:block}
.canvas-wrap{display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start}
.canvas-panel{flex:1;min-width:320px;position:relative}
.canvas-outer{position:relative;overflow:hidden;border:1px solid #1a1a1a;border-radius:8px;background:#0a0a0a}
canvas{cursor:crosshair;image-rendering:pixelated;display:block;width:100%}
.tools{width:220px;flex-shrink:0}
.palette{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:16px}
.swatch{width:100%;aspect-ratio:1;border-radius:8px;cursor:pointer;border:3px solid transparent;transition:all .15s}
.swatch:hover{transform:scale(1.08)}.swatch.active{border-color:#e5e5e5;box-shadow:0 0 12px rgba(255,255,255,.2)}
.tool-section{background:#111;border:1px solid #1a1a1a;border-radius:10px;padding:14px;margin-bottom:12px}
.tool-label{color:#525252;font-size:11px;font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
.tool-val{color:#e5e5e5;font-family:'Space Grotesk',sans-serif;font-size:16px;font-weight:600}
.tool-row{display:flex;gap:6px;flex-wrap:wrap}
.tool-btn{padding:8px 14px;border:1px solid #1a1a1a;border-radius:8px;background:#111;color:#a3a3a3;font-family:'JetBrains Mono',monospace;font-size:12px;cursor:pointer;transition:all .15s}
.tool-btn:hover{border-color:#333;color:#e5e5e5}
.tool-btn.active{border-color:#e5e5e5;color:#e5e5e5;background:#1a1a1a}
.tool-btn.eraser{position:relative}
.tool-btn.eraser.active{border-color:#e5e5e5}
.coord{font-family:'JetBrains Mono',monospace;color:#525252;font-size:12px;margin-top:8px;height:20px}
.zoom-bar{display:flex;gap:6px;margin-top:8px;align-items:center}
.zoom-bar button{width:32px;height:32px;border-radius:8px;border:1px solid #1a1a1a;background:#111;color:#a3a3a3;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s}
.zoom-bar button:hover{border-color:#333;color:#e5e5e5}
.zoom-bar span{color:#525252;font-family:'JetBrains Mono',monospace;font-size:12px;min-width:40px;text-align:center}
.feed{max-height:260px;overflow-y:auto;background:#111;border:1px solid #1a1a1a;border-radius:10px}
.feed-item{padding:8px 12px;border-bottom:1px solid #141414;font-size:12px;display:flex;align-items:center;gap:8px}
.feed-dot{width:10px;height:10px;border-radius:3px;flex-shrink:0}
.feed-text{color:#525252;font-family:'JetBrains Mono',monospace;font-size:11px}
.feed-text strong{color:#a3a3a3}
.feed-time{color:#333;margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:10px}
.stats-row{display:flex;gap:10px;margin-bottom:20px}
.stat-box{background:#111;border:1px solid #1a1a1a;border-radius:10px;padding:14px;flex:1;text-align:center}
.stat-num{font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:700;color:#e5e5e5}
.stat-lbl{font-size:11px;color:#525252;font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.5px;margin-top:2px}
.user-input{background:#111;border:1px solid #1a1a1a;border-radius:8px;padding:10px 12px;color:#e5e5e5;font-family:'JetBrains Mono',monospace;font-size:13px;width:100%;margin-bottom:12px;outline:none;transition:border-color .15s}
.user-input:focus{border-color:#333}
.gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.gallery-item{background:#111;border:1px solid #1a1a1a;border-radius:10px;padding:12px;transition:border-color .15s}
.gallery-item:hover{border-color:#333}
.gallery-meta{display:flex;justify-content:space-between;margin-top:8px}
.gallery-meta span{font-family:'JetBrains Mono',monospace;font-size:11px;color:#525252}
.gallery-meta strong{color:#a3a3a3}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#1a1a1a;border-radius:4px}
</style></head><body>
<style id="br-nav-style">#br-nav{position:fixed;top:0;left:0;right:0;z-index:9999;background:rgba(10,10,10,0.92);backdrop-filter:blur(12px);border-bottom:1px solid #1a1a1a;font-family:'Space Grotesk',-apple-system,sans-serif}#br-nav .ni{max-width:1200px;margin:0 auto;padding:0 20px;height:48px;display:flex;align-items:center;justify-content:space-between}#br-nav .nl{display:flex;align-items:center;gap:12px}#br-nav .nb{color:#525252;font-size:12px;padding:6px 8px;border-radius:6px;display:flex;align-items:center;cursor:pointer;border:none;background:none;transition:color .15s}#br-nav .nb:hover{color:#e5e5e5}#br-nav .nh{text-decoration:none;display:flex;align-items:center;gap:8px}#br-nav .nm{display:flex;gap:2px}#br-nav .nm span{width:6px;height:6px;border-radius:50%}#br-nav .nt{color:#e5e5e5;font-weight:600;font-size:14px}#br-nav .ns{color:#333;font-size:14px}#br-nav .np{color:#a3a3a3;font-size:13px}#br-nav .nk{display:flex;align-items:center;gap:4px;overflow-x:auto;scrollbar-width:none}#br-nav .nk::-webkit-scrollbar{display:none}#br-nav .nk a{color:#525252;text-decoration:none;font-size:12px;padding:6px 10px;border-radius:6px;white-space:nowrap;transition:color .15s,background .15s}#br-nav .nk a:hover{color:#e5e5e5;background:#111}#br-nav .nk a.ac{color:#e5e5e5;background:#1a1a1a}#br-nav .mm{display:none;background:none;border:none;color:#525252;font-size:20px;cursor:pointer;padding:6px}#br-dd{display:none;position:fixed;top:48px;left:0;right:0;background:rgba(10,10,10,0.96);backdrop-filter:blur(12px);border-bottom:1px solid #1a1a1a;z-index:9998;padding:12px 20px}#br-dd.open{display:flex;flex-wrap:wrap;gap:4px}#br-dd a{color:#525252;text-decoration:none;font-size:13px;padding:8px 14px;border-radius:6px;transition:color .15s,background .15s}#br-dd a:hover,#br-dd a.ac{color:#e5e5e5;background:#111}body{padding-top:48px!important}@media(max-width:768px){#br-nav .nk{display:none}#br-nav .mm{display:block}}</style>
<nav id="br-nav"><div class="ni"><div class="nl"><button class="nb" onclick="history.length>1?history.back():location.href='https://blackroad.io'" title="Back">&larr;</button><a href="https://blackroad.io" class="nh"><div class="nm"><span style="background:#FF6B2B"></span><span style="background:#FF2255"></span><span style="background:#CC00AA"></span><span style="background:#8844FF"></span><span style="background:#4488FF"></span><span style="background:#00D4FF"></span></div><span class="nt">BlackRoad</span></a><span class="ns">/</span><span class="np">Canvas</span></div><div class="nk"><a href="https://blackroad.io">Home</a><a href="https://chat.blackroad.io">Chat</a><a href="https://search.blackroad.io">Search</a><a href="https://tutor.blackroad.io">Tutor</a><a href="https://pay.blackroad.io">Pay</a><a href="https://canvas.blackroad.io" class="ac">Canvas</a><a href="https://cadence.blackroad.io">Cadence</a><a href="https://video.blackroad.io">Video</a><a href="https://radio.blackroad.io">Radio</a><a href="https://game.blackroad.io">Game</a><a href="https://roadtrip.blackroad.io">Agents</a><a href="https://roadcode.blackroad.io">RoadCode</a><a href="https://hq.blackroad.io">HQ</a><a href="https://app.blackroad.io">Dashboard</a></div><button class="mm" onclick="document.getElementById('br-dd').classList.toggle('open')">&#9776;</button></div></nav><div id="br-dd"><a href="https://blackroad.io">Home</a><a href="https://chat.blackroad.io">Chat</a><a href="https://search.blackroad.io">Search</a><a href="https://tutor.blackroad.io">Tutor</a><a href="https://pay.blackroad.io">Pay</a><a href="https://canvas.blackroad.io" class="ac">Canvas</a><a href="https://cadence.blackroad.io">Cadence</a><a href="https://video.blackroad.io">Video</a><a href="https://radio.blackroad.io">Radio</a><a href="https://game.blackroad.io">Game</a><a href="https://roadtrip.blackroad.io">Agents</a><a href="https://roadcode.blackroad.io">RoadCode</a><a href="https://hq.blackroad.io">HQ</a><a href="https://app.blackroad.io">Dashboard</a></div>
<script>document.addEventListener('click',function(e){var d=document.getElementById('br-dd');if(d&&d.classList.contains('open')&&!e.target.closest('#br-nav')&&!e.target.closest('#br-dd'))d.classList.remove('open')});</script>

<div class="container">
<div class="header">
  <div class="logo"><span style="width:14px;height:14px;background:#FF1D6C"></span><span style="width:14px;height:14px;background:#9C27B0"></span></div>
  <div><h1>RoadCanvas</h1><div class="subtitle">64x64 collaborative pixel canvas -- place a pixel, make your mark</div></div>
</div>

<div class="tabs">
  <button class="tab-btn active" onclick="switchTab('canvas',this)">Canvas</button>
  <button class="tab-btn" onclick="switchTab('gallery',this)">Gallery</button>
</div>

<div id="tab-canvas" class="tab-panel active">
<div class="stats-row">
  <div class="stat-box"><div class="stat-num" id="totalPixels">0</div><div class="stat-lbl">Total Placed</div></div>
  <div class="stat-box"><div class="stat-num" id="filledPixels">0</div><div class="stat-lbl">Unique Cells</div></div>
  <div class="stat-box"><div class="stat-num" id="uniqueUsers">0</div><div class="stat-lbl">Artists</div></div>
  <div class="stat-box"><div class="stat-num" id="coverage">0%</div><div class="stat-lbl">Coverage</div></div>
</div>

<div class="canvas-wrap">
<div class="canvas-panel">
  <div class="canvas-outer" id="canvasOuter">
    <canvas id="grid" width="64" height="64"></canvas>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
    <div class="coord" id="coord">Hover over the canvas</div>
    <div class="zoom-bar">
      <button onclick="zoomOut()" title="Zoom out">-</button>
      <span id="zoomLevel">8x</span>
      <button onclick="zoomIn()" title="Zoom in">+</button>
    </div>
  </div>
</div>

<div class="tools">
  <div class="tool-section">
    <div class="tool-label">Name</div>
    <input class="user-input" id="username" placeholder="anon" maxlength="32">
  </div>

  <div class="tool-section">
    <div class="tool-label">Palette</div>
    <div class="palette" id="palette"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
      <div><span style="color:#525252;font-size:11px;font-family:'JetBrains Mono',monospace">Selected:</span> <span class="tool-val" id="selColor" style="font-size:13px">#FF1D6C</span></div>
    </div>
  </div>

  <div class="tool-section">
    <div class="tool-label">Tools</div>
    <div class="tool-row" style="margin-bottom:10px">
      <button class="tool-btn active" id="btnDraw" onclick="setTool('draw')">Draw</button>
      <button class="tool-btn eraser" id="btnEraser" onclick="setTool('eraser')">Eraser</button>
      <button class="tool-btn" id="btnUndo" onclick="doUndo()">Undo</button>
    </div>
    <div class="tool-label" style="margin-top:8px">Brush Size</div>
    <div class="tool-row">
      <button class="tool-btn active" id="bs1" onclick="setBrush(1)">1px</button>
      <button class="tool-btn" id="bs2" onclick="setBrush(2)">2px</button>
      <button class="tool-btn" id="bs3" onclick="setBrush(3)">3px</button>
    </div>
  </div>

  <div class="tool-section">
    <div class="tool-label">Display</div>
    <div class="tool-row">
      <button class="tool-btn" id="btnGrid" onclick="toggleGridOverlay()">Grid</button>
      <button class="tool-btn" id="btnExport" onclick="exportPNG()">Export PNG</button>
    </div>
  </div>

  <div class="tool-section">
    <div class="tool-label">Recent Activity</div>
    <div class="feed" id="feed"></div>
  </div>
</div>
</div>
</div>

<div id="tab-gallery" class="tab-panel">
  <div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
    <h2 style="font-size:18px">Placement History</h2>
    <span style="color:#525252;font-family:'JetBrains Mono',monospace;font-size:12px" id="galleryCount">Loading...</span>
  </div>
  <div class="gallery-grid" id="galleryGrid"></div>
</div>
</div>

<script>
const COLORS=['#FF1D6C','#F5A623','#2979FF','#9C27B0','#00E676','#FFFFFF','#000000','#333333','#666666','#999999'];
let selectedColor=COLORS[0], gridData={}, placerData={}, currentTool='draw', brushSize=1, showGrid=false, zoomScale=8;
let undoStack=[];
const canvas=document.getElementById('grid'), ctx=canvas.getContext('2d');
ctx.imageSmoothingEnabled=false;

function switchTab(tab,btn){
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-'+tab).classList.add('active');
  if(tab==='gallery')loadGallery();
}

function setTool(t){
  currentTool=t;
  document.getElementById('btnDraw').classList.toggle('active',t==='draw');
  document.getElementById('btnEraser').classList.toggle('active',t==='eraser');
}

function setBrush(s){
  brushSize=s;
  document.getElementById('bs1').classList.toggle('active',s===1);
  document.getElementById('bs2').classList.toggle('active',s===2);
  document.getElementById('bs3').classList.toggle('active',s===3);
}

function toggleGridOverlay(){
  showGrid=!showGrid;
  document.getElementById('btnGrid').classList.toggle('active',showGrid);
  drawGrid();
}

function zoomIn(){if(zoomScale<16){zoomScale+=2;applyZoom()}}
function zoomOut(){if(zoomScale>4){zoomScale-=2;applyZoom()}}
function applyZoom(){
  const c=document.getElementById('grid');
  c.style.width=(64*zoomScale)+'px';
  c.style.height=(64*zoomScale)+'px';
  document.getElementById('zoomLevel').textContent=zoomScale+'x';
}

function initPalette(){
  const p=document.getElementById('palette');
  COLORS.forEach((c,i)=>{
    const d=document.createElement('div');d.className='swatch'+(i===0?' active':'');d.style.background=c;
    if(c==='#000000')d.style.border='3px solid #333';
    d.onclick=()=>{
      document.querySelectorAll('.swatch').forEach(x=>x.classList.remove('active'));
      d.classList.add('active');selectedColor=c;
      document.getElementById('selColor').textContent=c;
      setTool('draw');
    };
    p.appendChild(d);
  });
}

function drawGrid(){
  ctx.fillStyle='#0a0a0a';ctx.fillRect(0,0,64,64);
  for(const key in gridData){const[x,y]=key.split(',').map(Number);ctx.fillStyle=gridData[key];ctx.fillRect(x,y,1,1)}
  if(showGrid){
    ctx.strokeStyle='rgba(255,255,255,0.06)';ctx.lineWidth=0.02;
    for(let i=0;i<=64;i++){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,64);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(64,i);ctx.stroke()}
  }
}

function getCanvasCoord(e){
  const rect=canvas.getBoundingClientRect();
  const scaleX=64/rect.width, scaleY=64/rect.height;
  return {x:Math.floor((e.clientX-rect.left)*scaleX), y:Math.floor((e.clientY-rect.top)*scaleY)};
}

canvas.addEventListener('mousemove',e=>{
  const{x,y}=getCanvasCoord(e);
  if(x>=0&&x<64&&y>=0&&y<64){
    const key=x+','+y;
    const placer=placerData[key]||'';
    const color=gridData[key]||'empty';
    document.getElementById('coord').textContent='('+x+', '+y+') '+color+(placer?' by '+placer:'');
    canvas.title=placer?'Placed by '+placer:'Empty';
  }
});

let isDrawing=false;
canvas.addEventListener('mousedown',e=>{isDrawing=true;placeAtEvent(e)});
canvas.addEventListener('mousemove',e=>{if(isDrawing)placeAtEvent(e)});
canvas.addEventListener('mouseup',()=>{isDrawing=false});
canvas.addEventListener('mouseleave',()=>{isDrawing=false});

async function placeAtEvent(e){
  const{x,y}=getCanvasCoord(e);
  if(x<0||x>=64||y<0||y>=64)return;
  const user=document.getElementById('username').value||'anon';
  const color=currentTool==='eraser'?'#000000':selectedColor;
  const coords=[];
  for(let dx=0;dx<brushSize;dx++){for(let dy=0;dy<brushSize;dy++){
    const px=x+dx,py=y+dy;
    if(px<64&&py<64)coords.push({x:px,y:py});
  }}
  for(const c of coords){
    const key=c.x+','+c.y;
    const prev={x:c.x,y:c.y,color:gridData[key]||null,user:placerData[key]||null};
    undoStack.push(prev);
    if(undoStack.length>20)undoStack.shift();
    gridData[key]=color;placerData[key]=user;
    ctx.fillStyle=color;ctx.fillRect(c.x,c.y,1,1);
    fetch('/api/place',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({x:c.x,y:c.y,color,user})});
  }
  updateStats();
}

async function doUndo(){
  if(undoStack.length===0)return;
  const prev=undoStack.pop();
  const user=document.getElementById('username').value||'anon';
  if(prev.color){
    gridData[prev.x+','+prev.y]=prev.color;
    ctx.fillStyle=prev.color;ctx.fillRect(prev.x,prev.y,1,1);
    fetch('/api/place',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({x:prev.x,y:prev.y,color:prev.color,user})});
  } else {
    gridData[prev.x+','+prev.y]='#000000';
    ctx.fillStyle='#0a0a0a';ctx.fillRect(prev.x,prev.y,1,1);
    fetch('/api/place',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({x:prev.x,y:prev.y,color:'#000000',user})});
  }
  updateStats();
}

function exportPNG(){
  const exp=document.createElement('canvas');exp.width=64;exp.height=64;
  const ectx=exp.getContext('2d');ectx.fillStyle='#0a0a0a';ectx.fillRect(0,0,64,64);
  for(const key in gridData){const[x,y]=key.split(',').map(Number);ectx.fillStyle=gridData[key];ectx.fillRect(x,y,1,1)}
  const link=document.createElement('a');link.download='roadcanvas-'+Date.now()+'.png';
  link.href=exp.toDataURL('image/png');link.click();
}

function updateStats(){
  const filled=Object.keys(gridData).filter(k=>gridData[k]!=='#000000').length;
  document.getElementById('filledPixels').textContent=filled;
  document.getElementById('coverage').textContent=Math.round(filled/4096*100)+'%';
}

async function loadCanvas(){
  const r=await fetch('/api/canvas');const d=await r.json();gridData=d.grid;drawGrid();
  document.getElementById('totalPixels').textContent=d.totalPlacements;
  updateStats();
}

async function loadFeed(){
  const r=await fetch('/api/history?limit=50');const d=await r.json();
  const el=document.getElementById('feed');
  const users=new Set();
  d.history.forEach(h=>{
    placerData[h.x+','+h.y]=h.placed_by;
    users.add(h.placed_by);
  });
  document.getElementById('uniqueUsers').textContent=users.size;
  el.innerHTML=d.history.slice(0,30).map(h=>
    '<div class="feed-item"><div class="feed-dot" style="background:'+h.color+'"></div><div class="feed-text"><strong>'+h.placed_by+'</strong> ('+h.x+','+h.y+')</div><div class="feed-time">'+(h.placed_at?h.placed_at.split(' ')[1]:'')+'</div></div>'
  ).join('')||'<div style="padding:12px;color:#525252">No activity yet</div>';
}

async function loadGallery(){
  const r=await fetch('/api/history?limit=200');const d=await r.json();
  const el=document.getElementById('galleryGrid');
  document.getElementById('galleryCount').textContent=d.history.length+' placements';
  el.innerHTML=d.history.map(h=>
    '<div class="gallery-item"><div style="display:flex;align-items:center;gap:10px"><div style="width:24px;height:24px;border-radius:4px;background:'+h.color+';flex-shrink:0"></div><div><div style="color:#a3a3a3;font-size:13px;font-family:Space Grotesk,sans-serif">'+h.placed_by+'</div><div style="color:#525252;font-size:11px;font-family:JetBrains Mono,monospace">('+h.x+', '+h.y+') '+h.color+'</div></div></div><div class="gallery-meta"><span>'+(h.placed_at||'')+'</span></div></div>'
  ).join('')||'<div style="padding:20px;color:#525252;text-align:center">No history yet</div>';
}

initPalette();applyZoom();loadCanvas();loadFeed();
setInterval(()=>{loadCanvas();loadFeed()},5000);
</script></body></html>`;
