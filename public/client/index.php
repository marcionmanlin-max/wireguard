<?php
$token   = htmlspecialchars($_GET['token']   ?? '', ENT_QUOTES, 'UTF-8');
$peer_ip = htmlspecialchars($_GET['peer_ip'] ?? '', ENT_QUOTES, 'UTF-8');
?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title id="page-title">IonMan DNS &mdash; Dashboard</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0f1117;--surface:#1a1d27;--surface2:#242736;--surface3:#2e324a;
  --border:#2e3347;--accent:#6366f1;--accent2:#818cf8;
  --green:#22c55e;--red:#ef4444;--yellow:#f59e0b;--blue:#3b82f6;
  --text:#f1f5f9;--muted:#94a3b8;--radius:12px;
}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  background:var(--bg);color:var(--text);min-height:100vh;}
header{background:var(--surface);border-bottom:1px solid var(--border);
  padding:12px 20px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10;}
.header-logo{display:flex;align-items:center;gap:10px;}
.header-title{font-size:17px;font-weight:700;}
.header-sub{font-size:12px;color:var(--muted);margin-left:4px;font-weight:400;}
#header-peer{font-size:13px;color:var(--accent2);background:rgba(99,102,241,.12);
  padding:3px 10px;border-radius:20px;border:1px solid rgba(99,102,241,.25);}
.header-right{margin-left:auto;display:flex;align-items:center;gap:10px;}
.btn-sm{padding:5px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:none;transition:all .15s;}
.btn-ghost{background:var(--surface2);color:var(--text);border:1px solid var(--border);}
.btn-ghost:hover{border-color:var(--accent);color:var(--accent2);}
.btn-accent{background:rgba(99,102,241,.15);color:var(--accent2);border:1px solid rgba(99,102,241,.3);}
.btn-accent:hover{background:rgba(99,102,241,.25);}
.page{max-width:1100px;margin:0 auto;padding:20px 16px 40px;}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}
@media(max-width:768px){.grid2,.grid3{grid-template-columns:1fr;}}
@media(max-width:640px){.grid4{grid-template-columns:repeat(2,1fr);}}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px;}
.card-title{font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted);text-transform:uppercase;margin-bottom:14px;}
.info-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;}
.info-row:last-child{border-bottom:none;}
.info-row .lbl{color:var(--muted);}
.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:15px;text-align:center;}
.stat-val{font-size:26px;font-weight:800;margin-bottom:3px;}
.stat-lbl{font-size:11px;color:var(--muted);}
.badge{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:20px;font-size:12px;font-weight:600;}
.badge-green{background:rgba(34,197,94,.15);color:var(--green);}
.badge-red{background:rgba(239,68,68,.15);color:var(--red);}
.badge-yellow{background:rgba(245,158,11,.15);color:var(--yellow);}
.badge-accent{background:rgba(99,102,241,.15);color:var(--accent2);}
.speed-big{font-size:20px;font-weight:800;text-align:center;}
.speed-unit{font-size:11px;color:var(--muted);text-align:center;}
.bar-wrap{display:flex;gap:3px;align-items:flex-end;height:70px;margin-top:10px;}
.bar-col{flex:1;display:flex;flex-direction:column;gap:1px;justify-content:flex-end;cursor:default;}
.bar-seg{border-radius:2px 2px 0 0;min-height:1px;transition:opacity .15s;}
.bar-col:hover .bar-seg{opacity:.75;}
.chart-legend{display:flex;gap:14px;margin-top:10px;font-size:12px;color:var(--muted);}
.legend-dot{width:8px;height:8px;border-radius:2px;display:inline-block;margin-right:4px;}
.filter-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px;}
.filter-tabs{display:flex;background:var(--surface2);border-radius:8px;border:1px solid var(--border);overflow:hidden;}
.filter-tab{padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;border:none;background:none;color:var(--muted);transition:all .15s;white-space:nowrap;}
.filter-tab.active{background:rgba(99,102,241,.2);color:var(--accent2);}
.filter-tab:hover:not(.active){color:var(--text);}
.search-box{flex:1;min-width:140px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:6px 12px;color:var(--text);font-size:13px;}
.search-box:focus{outline:none;border-color:var(--accent);}
.date-input{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:6px 10px;color:var(--text);font-size:12px;cursor:pointer;}
.date-input:focus{outline:none;border-color:var(--accent);}
.view-toggle{display:flex;background:var(--surface2);border-radius:8px;border:1px solid var(--border);overflow:hidden;}
.view-btn{padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;border:none;background:none;color:var(--muted);transition:all .15s;}
.view-btn.active{background:rgba(99,102,241,.2);color:var(--accent2);}
.table-wrap{overflow-x:auto;}
table{width:100%;border-collapse:collapse;font-size:13px;}
th{text-align:left;padding:8px 10px;color:var(--muted);font-size:10px;letter-spacing:.5px;border-bottom:1px solid var(--border);white-space:nowrap;}
td{padding:8px 10px;border-bottom:1px solid rgba(46,51,71,.5);}
tr:last-child td{border-bottom:none;}
tr:hover td{background:rgba(255,255,255,.02);}
.allow{color:var(--green);font-weight:600;}
.block{color:var(--red);font-weight:600;}
.domain{font-family:monospace;font-size:12px;color:var(--text);}
.cnt-bar{height:4px;border-radius:2px;background:var(--accent);margin-top:3px;}
.cnt-bar-red{background:var(--red);}
.prog-wrap{height:5px;background:var(--surface2);border-radius:4px;overflow:hidden;margin-top:8px;}
.prog-fill{height:100%;border-radius:4px;background:var(--accent);transition:width .4s;}
#login-screen{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;gap:14px;padding:20px;}
#login-screen h2{font-size:20px;font-weight:700;}
.input{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--text);font-size:14px;width:100%;max-width:320px;}
.input:focus{outline:none;border-color:var(--accent);}
.btn-login{background:var(--accent);color:#fff;border:none;border-radius:8px;padding:11px 28px;font-size:14px;font-weight:600;cursor:pointer;width:100%;max-width:320px;}
.btn-login:disabled{opacity:.5;cursor:not-allowed;}
#err-msg{color:var(--red);font-size:13px;}
#loading{text-align:center;padding:60px;}
.spinner{width:36px;height:36px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .7s linear infinite;margin:0 auto;}
@keyframes spin{to{transform:rotate(360deg)}}
#dash{display:none;}
.section-gap{margin-bottom:14px;}
.refresh-row{display:flex;justify-content:space-between;align-items:center;}
.tb-row{display:flex;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid rgba(46,51,71,.4);font-size:12px;}
.tb-row:last-child{border-bottom:none;}
.tb-domain{flex:1;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.tb-cnt{color:var(--red);font-weight:700;white-space:nowrap;}
.tb-bar{width:60px;height:4px;background:rgba(239,68,68,.15);border-radius:2px;flex-shrink:0;}
.tb-fill{height:100%;background:var(--red);border-radius:2px;}
.empty{text-align:center;padding:30px;color:var(--muted);font-size:13px;}
.text-accent{color:var(--accent2);}
.text-muted{color:var(--muted);}
</style>
</head>
<body>
<header>
  <div class="header-logo">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="1.5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
    <span class="header-title">IonMan <span class="header-sub">DNS</span></span>
  </div>
  <span id="header-peer" style="display:none"></span>
  <div class="header-right">
    <span id="header-badge" style="display:none"></span>
    <button class="btn-sm btn-accent" onclick="refresh()">&#8635; Refresh</button>
  </div>
</header>

<div id="login-screen" style="display:none">
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="1.5">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
  <h2>Client Dashboard</h2>
  <p style="color:var(--muted);font-size:14px;text-align:center">Sign in to view your DNS dashboard</p>
  <input class="input" type="email" id="l-email" placeholder="Email address"/>
  <input class="input" type="password" id="l-password" placeholder="Password"
         onkeydown="if(event.key==='Enter') doLogin()"/>
  <p id="err-msg"></p>
  <button class="btn-login" id="login-btn" onclick="doLogin()">Sign In</button>
  <p style="font-size:12px;color:var(--muted);text-align:center;max-width:280px">
    Or open from the IonMan DNS app &mdash; it signs in automatically
  </p>
</div>

<div id="loading"><div class="spinner"></div></div>

<div id="dash">
<div class="page">

  <div class="grid3 section-gap">
    <div class="card">
      <div class="card-title">Profile</div>
      <div class="info-row"><span class="lbl">Name</span><span id="d-name">&#8212;</span></div>
      <div class="info-row" id="row-email" style="display:none"><span class="lbl">Email</span><span id="d-email">&#8212;</span></div>
      <div class="info-row" id="row-status"><span class="lbl">Status</span><span id="d-status">&#8212;</span></div>
      <div class="info-row" id="row-plan" style="display:none"><span class="lbl">Plan</span><span id="d-plan">&#8212;</span></div>
      <div class="info-row" id="row-expires" style="display:none"><span class="lbl">Expires</span><span id="d-expires">&#8212;</span></div>
      <div class="info-row" id="row-days" style="display:none;border:none"><span class="lbl">Days left</span><span id="d-days">&#8212;</span></div>
      <div class="prog-wrap" id="row-progress" style="display:none;margin-top:12px">
        <div class="prog-fill" id="d-progress" style="width:0%"></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Connection</div>
      <div class="info-row"><span class="lbl">VPN IP</span><span id="d-ip" class="text-accent">&#8212;</span></div>
      <div class="info-row"><span class="lbl">Peer Name</span><span id="d-peername" class="text-muted">&#8212;</span></div>
      <div class="info-row"><span class="lbl">DNS Server</span><span class="text-accent">10.0.0.1</span></div>
      <div class="info-row" style="border:none;"><span class="lbl">Gateway</span>
        <span style="color:var(--muted);font-size:12px">dns.makoyot.xyz</span></div>
    </div>
    <div class="card" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
      <div class="card-title" style="margin-bottom:10px">Speed Limit</div>
      <div id="speed-display">
        <div class="speed-big text-muted">&#8734;</div>
        <div class="speed-unit">Unlimited</div>
      </div>
    </div>
  </div>

  <div class="grid4 section-gap">
    <div class="stat-card"><div class="stat-val" id="s-total">&#8212;</div><div class="stat-lbl">Queries Today</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--red)" id="s-blocked">&#8212;</div><div class="stat-lbl">Blocked</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--green)" id="s-allowed">&#8212;</div><div class="stat-lbl">Allowed</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--yellow)" id="s-rate">&#8212;%</div><div class="stat-lbl">Block Rate</div></div>
  </div>

  <div class="grid2 section-gap">
    <div class="card">
      <div class="refresh-row">
        <div class="card-title" style="margin-bottom:0">Activity &middot; Last 24h</div>
        <span id="stats-date" style="font-size:11px;color:var(--muted)"></span>
      </div>
      <div class="bar-wrap" id="bar-chart"></div>
      <div class="chart-legend">
        <span><span class="legend-dot" style="background:var(--green)"></span>Allowed</span>
        <span><span class="legend-dot" style="background:var(--red)"></span>Blocked</span>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Top Blocked &middot; 24h</div>
      <div id="top-blocked"><div class="empty">No blocked domains</div></div>
    </div>
  </div>

  <div class="card">
    <div class="refresh-row" style="margin-bottom:12px">
      <div class="card-title" style="margin-bottom:0">DNS Query Log</div>
      <span id="q-count" style="font-size:11px;color:var(--muted)"></span>
    </div>
    <div class="filter-bar">
      <div class="filter-tabs">
        <button class="filter-tab active" data-f="all"     onclick="setFilter('all')">All</button>
        <button class="filter-tab"        data-f="allowed" onclick="setFilter('allowed')">&check; Allowed</button>
        <button class="filter-tab"        data-f="blocked" onclick="setFilter('blocked')">&times; Blocked</button>
      </div>
      <input class="search-box" type="text" id="q-search" placeholder="Search domain&hellip;" oninput="schedSearch()"/>
      <input class="date-input" type="date"   id="q-date"   onchange="applyFilters()"/>
      <div class="view-toggle">
        <button class="view-btn active" data-v="list"    onclick="setView('list')">&#8801; List</button>
        <button class="view-btn"        data-v="grouped" onclick="setView('grouped')">&#10753; Grouped</button>
      </div>
    </div>
    <div id="view-list">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Domain</th><th>Action</th><th>IP</th><th>Time</th></tr></thead>
          <tbody id="q-body"></tbody>
        </table>
      </div>
    </div>
    <div id="view-grouped" style="display:none">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Domain</th><th>Total</th><th>Blocked</th><th>Allowed</th><th>% Blocked</th><th>Last Seen</th></tr></thead>
          <tbody id="g-body"></tbody>
        </table>
      </div>
    </div>
  </div>

</div>
</div>

<script>
const API     = '/dns/api/client';
let TOKEN     = '<?= $token ?>';
const PEER_IP = '<?= $peer_ip ?>';
const today   = new Date().toISOString().slice(0,10);
let fAction='all', fSearch='', fView='list', searchTimer=null;

window.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('q-date').value = today;
  if(PEER_IP||TOKEN){ showLoading(); init(); } else { showLogin(); }
});

function showLoading(){ set('login-screen','none'); set('loading','block'); set('dash','none'); }
function showLogin()  { set('login-screen','flex'); set('loading','none');  set('dash','none'); }
function showDash()   { set('login-screen','none'); set('loading','none');  set('dash','block'); }
function set(id,v){ document.getElementById(id).style.display=v; }

function authParam(){
  if(PEER_IP) return 'peer_ip='+encodeURIComponent(PEER_IP);
  return 'token='+encodeURIComponent(TOKEN);
}
async function apiGet(path){
  const sep=path.includes('?')?'&':'?';
  const r=await fetch(API+'/'+path+sep+authParam());
  const d=await r.json();
  if(!r.ok) throw new Error(d.error||'API error');
  return d;
}

async function doLogin(){
  const email=document.getElementById('l-email').value.trim();
  const pw=document.getElementById('l-password').value;
  const btn=document.getElementById('login-btn');
  const err=document.getElementById('err-msg');
  if(!email||!pw) return;
  btn.disabled=true; btn.textContent='Signing in\u2026'; err.textContent='';
  try{
    const r=await fetch('/dns/api/subscribe/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pw})});
    const d=await r.json();
    if(!r.ok||d.error) throw new Error(d.error||'Login failed');
    TOKEN=d.token;
    history.replaceState(null,'','?token='+encodeURIComponent(TOKEN));
    showLoading(); init();
  }catch(e){ err.textContent=e.message; btn.disabled=false; btn.textContent='Sign In'; }
}

async function init(){
  try{
    const me=await apiGet('me');
    renderMe(me);
    await Promise.all([loadStats(),loadLog()]);
    showDash();
  }catch(e){
    if(e.message.includes('expired')||e.message.includes('Invalid')){
      TOKEN=''; showLogin(); document.getElementById('err-msg').textContent=e.message;
    } else {
      document.getElementById('loading').innerHTML=
        '<p style="color:var(--red);padding:40px;text-align:center">'+e.message+'<br><br>'+
        '<button class="btn-sm btn-ghost" onclick="location.reload()">Retry</button></p>';
    }
  }
}

function renderMe(me){
  const peerName=me.peer_name||(PEER_IP?'Peer '+PEER_IP:'Dashboard');
  document.getElementById('page-title').textContent='IonMan DNS \u2014 '+peerName;
  const hp=document.getElementById('header-peer');
  hp.textContent=peerName; hp.style.display='inline';

  if(me.mode==='peer'){
    el('d-name').textContent=peerName;
    el('row-status').style.display='none';
  } else {
    el('d-name').textContent=me.name||'';
    el('d-email').textContent=me.email||''; el('row-email').style.display='flex';
    el('d-plan').textContent=uc(me.plan||''); el('row-plan').style.display='flex';
    el('d-status').innerHTML=sBadge(me.status,me.active);
    if(me.expires_at){
      el('d-expires').textContent=fmtDate(me.expires_at); el('row-expires').style.display='flex';
      el('d-days').textContent=me.days_left+' days'; el('row-days').style.display='flex';
      el('d-progress').style.width=Math.min(100,Math.max(3,(me.days_left/30)*100))+'%';
      el('row-progress').style.display='block';
    }
    const hb=el('header-badge');
    hb.innerHTML=sBadge(me.status,me.active); hb.style.display='inline';
  }
  el('d-ip').textContent=me.peer_ip||'\u2014';
  el('d-peername').textContent=me.peer_name||'\u2014';
  if(me.speed_kbps){
    const p=me.speed_limit.split(' ');
    el('speed-display').innerHTML='<div class="speed-big" style="color:var(--accent2)">'+p[0]+'</div>'+
      '<div class="speed-unit">'+p[1]+'</div>';
  }
}

async function loadStats(){
  const date=el('q-date').value||today;
  const d=await apiGet('stats?date='+date);
  el('s-total').textContent=fmt(d.total);
  el('s-blocked').textContent=fmt(d.blocked);
  el('s-allowed').textContent=fmt(d.allowed);
  el('s-rate').textContent=d.block_rate+'%';
  el('stats-date').textContent=d.date;
  renderChart(d.hourly);
  renderTopBlocked(d.top_blocked);
}

function renderChart(hourly){
  const c=el('bar-chart');
  if(!hourly||!hourly.length){c.innerHTML='<div class="empty" style="padding:20px 0">No data</div>';return;}
  const maxV=Math.max(...hourly.map(h=>(+h.allowed)+(+h.blocked)),1);
  c.innerHTML=hourly.map(h=>{
    const aH=Math.round((+h.allowed/maxV)*60);
    const bH=Math.round((+h.blocked/maxV)*60);
    return '<div class="bar-col" title="'+h.hour+': '+h.allowed+' allowed, '+h.blocked+' blocked">'+
      (aH?'<div class="bar-seg" style="height:'+aH+'px;background:var(--green)"></div>':'')+
      (bH?'<div class="bar-seg" style="height:'+bH+'px;background:var(--red)"></div>':'')+
    '</div>';
  }).join('');
}

function renderTopBlocked(list){
  const c=el('top-blocked');
  if(!list||!list.length){c.innerHTML='<div class="empty">No blocked domains today</div>';return;}
  const max=list[0].count;
  c.innerHTML=list.map(r=>
    '<div class="tb-row"><span class="tb-domain" title="'+esc(r.domain)+'">'+esc(r.domain)+'</span>'+
    '<span class="tb-cnt">'+fmt(r.count)+'</span>'+
    '<div class="tb-bar"><div class="tb-fill" style="width:'+Math.round(r.count/max*100)+'%"></div></div></div>'
  ).join('');
}

async function loadLog(){
  const date=el('q-date').value||today;
  const params='filter='+fAction+'&search='+encodeURIComponent(fSearch)+'&date='+date+'&limit=200';
  if(fView==='list'){
    const d=await apiGet('queries?'+params);
    renderList(d.queries||[]);
    el('q-count').textContent=d.count+' records';
  } else {
    const d=await apiGet('grouped?'+params);
    renderGrouped(d.grouped||[]);
    el('q-count').textContent=d.count+' domains';
  }
}

function renderList(rows){
  const tb=el('q-body');
  if(!rows.length){tb.innerHTML='<tr><td colspan="4" class="empty">No queries found</td></tr>';return;}
  tb.innerHTML=rows.map(r=>'<tr>'+
    '<td class="domain">'+esc(r.domain)+'</td>'+
    '<td><span class="'+(r.action==='allowed'?'allow':'block')+'">'+r.action+'</span></td>'+
    '<td style="color:var(--muted);font-size:12px">'+esc(r.client_ip||'')+'</td>'+
    '<td style="color:var(--muted);font-size:12px;white-space:nowrap">'+fmtTime(r.logged_at)+'</td>'+
  '</tr>').join('');
}

function renderGrouped(rows){
  const tb=el('g-body');
  if(!rows.length){tb.innerHTML='<tr><td colspan="6" class="empty">No queries found</td></tr>';return;}
  const maxT=+rows[0].total||1;
  tb.innerHTML=rows.map(r=>{
    const pct=r.total>0?Math.round(r.blocked/r.total*100):0;
    return '<tr>'+
      '<td><div class="domain">'+esc(r.domain)+'</div>'+
      '<div class="cnt-bar'+(pct>50?' cnt-bar-red':'')+'" style="width:'+Math.round(+r.total/maxT*100)+'%"></div></td>'+
      '<td style="font-weight:700">'+fmt(+r.total)+'</td>'+
      '<td class="block">'+fmt(+r.blocked)+'</td>'+
      '<td class="allow">'+fmt(+r.allowed)+'</td>'+
      '<td style="color:'+(pct>50?'var(--red)':'var(--muted)')+'">'+pct+'%</td>'+
      '<td style="color:var(--muted);font-size:12px;white-space:nowrap">'+fmtTime(r.last_seen)+'</td>'+
    '</tr>';
  }).join('');
}

function setFilter(f){
  fAction=f;
  document.querySelectorAll('.filter-tab').forEach(b=>b.classList.toggle('active',b.dataset.f===f));
  applyFilters();
}
function setView(v){
  fView=v;
  document.querySelectorAll('.view-btn').forEach(b=>b.classList.toggle('active',b.dataset.v===v));
  el('view-list').style.display=v==='list'?'':'none';
  el('view-grouped').style.display=v==='grouped'?'':'none';
  loadLog();
}
function schedSearch(){
  clearTimeout(searchTimer);
  searchTimer=setTimeout(()=>{fSearch=el('q-search').value.trim();applyFilters();},350);
}
function applyFilters(){ fSearch=el('q-search').value.trim(); loadStats(); loadLog(); }
function refresh(){ loadStats(); loadLog(); }

function el(id){return document.getElementById(id);}
function fmt(n){if(n==null)return'\u2014';if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1e3)return(n/1e3).toFixed(1)+'K';return String(n);}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function fmtDate(s){if(!s)return'\u2014';return new Date(s).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'});}
function fmtTime(s){if(!s)return'\u2014';return new Date(s).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit',second:'2-digit'});}
function uc(s){return s?s.charAt(0).toUpperCase()+s.slice(1):'';}
function sBadge(status,active){
  const m={trial:['badge-yellow','\u25cf Trial'],active:['badge-green','\u25cf Active'],expired:['badge-red','\u25cf Expired'],suspended:['badge-red','\u25cf Suspended']};
  const[cls,label]=m[status]||['badge-accent','\u25cf '+uc(status)];
  return '<span class="badge '+cls+'">'+label+'</span>';
}
</script>
</body>
</html>