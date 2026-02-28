<?php
// Pass token from URL into the page (used by JS to call the API)
$token = htmlspecialchars($_GET['token'] ?? '', ENT_QUOTES, 'UTF-8');
?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>IonMan DNS — My Dashboard</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0f1117; --surface: #1a1d27; --surface2: #242736;
    --border: #2e3347; --accent: #6366f1; --green: #22c55e;
    --red: #ef4444; --yellow: #f59e0b; --text: #f1f5f9;
    --muted: #94a3b8; --radius: 12px;
  }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--bg); color: var(--text); min-height: 100vh; }

  header { background: var(--surface); border-bottom: 1px solid var(--border);
    padding: 14px 24px; display: flex; align-items: center; gap: 12px; }
  header img { width: 32px; height: 32px; }
  header h1 { font-size: 18px; font-weight: 700; }
  header span { font-size: 13px; color: var(--muted); margin-left: auto; }

  .container { max-width: 960px; margin: 0 auto; padding: 24px 16px; }

  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
  @media (max-width: 640px) {
    .grid2 { grid-template-columns: 1fr; }
    .grid4 { grid-template-columns: repeat(2, 1fr); }
    header { flex-wrap: wrap; }
  }

  .card { background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 20px; }
  .card-title { font-size: 11px; font-weight: 700; letter-spacing: 1px;
    color: var(--muted); text-transform: uppercase; margin-bottom: 16px; }

  .stat-card { background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 16px; text-align: center; }
  .stat-value { font-size: 28px; font-weight: 800; margin-bottom: 4px; }
  .stat-label { font-size: 12px; color: var(--muted); }

  .badge { display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .badge-green { background: rgba(34,197,94,.15); color: var(--green); }
  .badge-red   { background: rgba(239,68,68,.15);  color: var(--red); }
  .badge-yellow{ background: rgba(245,158,11,.15); color: var(--yellow); }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

  .info-row { display: flex; justify-content: space-between; align-items: center;
    padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
  .info-row:last-child { border-bottom: none; }
  .info-row .label { color: var(--muted); }

  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 8px 10px; color: var(--muted);
    font-size: 11px; letter-spacing: .5px; border-bottom: 1px solid var(--border); }
  td { padding: 9px 10px; border-bottom: 1px solid var(--border)18; }
  tr:last-child td { border-bottom: none; }
  .allow { color: var(--green); } .block { color: var(--red); }

  .bar-wrap { display: flex; gap: 2px; align-items: flex-end; height: 60px; margin-top: 8px; }
  .bar-col  { flex: 1; display: flex; flex-direction: column; gap: 1px; justify-content: flex-end; }
  .bar-seg  { border-radius: 2px 2px 0 0; min-height: 1px; }

  #login-screen { display: flex; flex-direction: column; align-items: center;
    justify-content: center; min-height: 80vh; gap: 16px; }
  #login-screen h2 { font-size: 20px; }
  #login-screen p  { color: var(--muted); font-size: 14px; }
  .input { background: var(--surface2); border: 1px solid var(--border); border-radius: 8px;
    padding: 10px 14px; color: var(--text); font-size: 14px; width: 100%; max-width: 320px; }
  .btn { padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;
    cursor: pointer; border: none; }
  .btn-primary { background: var(--accent); color: #fff; }
  .btn-primary:disabled { opacity: .5; cursor: not-allowed; }
  .btn-ghost { background: var(--surface2); color: var(--text); border: 1px solid var(--border); }

  #error-msg { color: var(--red); font-size: 13px; }
  #dash { display: none; }

  .progress-bar { height: 6px; background: var(--surface2); border-radius: 4px; overflow: hidden; margin-top: 8px; }
  .progress-fill { height: 100%; border-radius: 4px; background: var(--accent); transition: width .4s; }

  .spinner { width: 36px; height: 36px; border: 3px solid var(--border);
    border-top-color: var(--accent); border-radius: 50%;
    animation: spin .7s linear infinite; margin: 60px auto; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>

<header>
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="1.5">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
  <h1>IonMan DNS</h1>
  <span id="header-name"></span>
</header>

<div class="container">
  <!-- Login screen (shown when no token) -->
  <div id="login-screen" style="display:none">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="1.5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
    <h2>Client Dashboard</h2>
    <p>Enter your email and password to view your dashboard.</p>
    <input class="input" type="email" id="l-email" placeholder="Email" />
    <input class="input" type="password" id="l-password" placeholder="Password" />
    <p id="error-msg"></p>
    <button class="btn btn-primary" id="login-btn" onclick="doLogin()">Login</button>
    <p style="font-size:12px;color:var(--muted)">Or open this page from the IonMan DNS app (Settings → Login)</p>
  </div>

  <!-- Loading spinner -->
  <div id="loading"><div class="spinner"></div></div>

  <!-- Dashboard (shown after auth) -->
  <div id="dash">
    <!-- Subscription info -->
    <div class="grid2">
      <div class="card">
        <div class="card-title">My Subscription</div>
        <div class="info-row"><span class="label">Name</span><span id="d-name">—</span></div>
        <div class="info-row"><span class="label">Status</span><span id="d-status">—</span></div>
        <div class="info-row"><span class="label">Plan</span><span id="d-plan">—</span></div>
        <div class="info-row"><span class="label">Expires</span><span id="d-expires">—</span></div>
        <div class="info-row" style="border:none;padding-bottom:0">
          <span class="label">Days left</span><span id="d-days">—</span>
        </div>
        <div class="progress-bar" style="margin-top:12px">
          <div class="progress-fill" id="d-progress" style="width:0%"></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Connection</div>
        <div class="info-row"><span class="label">VPN IP</span><span id="d-ip">—</span></div>
        <div class="info-row"><span class="label">DNS Server</span><span style="color:var(--accent)">10.0.0.1</span></div>
        <div class="info-row" style="border:none;padding-bottom:0"><span class="label">Server</span>
          <span style="color:var(--muted);font-size:12px">dns.makoyot.xyz</span></div>
      </div>
    </div>

    <!-- Stats cards -->
    <div class="grid4" id="stats-cards">
      <div class="stat-card"><div class="stat-value" id="s-total">—</div><div class="stat-label">Queries Today</div></div>
      <div class="stat-card"><div class="stat-value" id="s-blocked" style="color:var(--red)">—</div><div class="stat-label">Blocked</div></div>
      <div class="stat-card"><div class="stat-value" id="s-allowed" style="color:var(--green)">—</div><div class="stat-label">Allowed</div></div>
      <div class="stat-card"><div class="stat-value" id="s-rate" style="color:var(--yellow)">—</div><div class="stat-label">Block Rate</div></div>
    </div>

    <!-- Hourly chart + top blocked -->
    <div class="grid2" style="margin-bottom:16px">
      <div class="card">
        <div class="card-title">Activity (last 24h)</div>
        <div class="bar-wrap" id="bar-chart"></div>
        <div style="display:flex;gap:16px;margin-top:12px;font-size:12px">
          <span><span style="display:inline-block;width:10px;height:10px;background:var(--green);border-radius:2px;margin-right:4px"></span>Allowed</span>
          <span><span style="display:inline-block;width:10px;height:10px;background:var(--red);border-radius:2px;margin-right:4px"></span>Blocked</span>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Top Blocked Domains</div>
        <div id="top-blocked" style="font-size:13px"></div>
      </div>
    </div>

    <!-- Recent queries -->
    <div class="card">
      <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Recent DNS Queries</span>
        <button class="btn btn-ghost" style="padding:4px 12px;font-size:12px" onclick="loadQueries()">Refresh</button>
      </div>
      <div style="overflow-x:auto">
        <table>
          <thead><tr><th>Domain</th><th>Action</th><th>Time</th></tr></thead>
          <tbody id="q-body"></tbody>
        </table>
      </div>
    </div>
  </div><!-- /#dash -->
</div>

<script>
const API = '/dns/api/client';
let TOKEN = '<?= $token ?>';

function fmt(n) {
  if (n == null) return '—';
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
  return String(n);
}

async function apiGet(path) {
  const r = await fetch(API + path, {
    headers: TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Error ' + r.status); }
  return r.json();
}

async function doLogin() {
  const email    = document.getElementById('l-email').value.trim();
  const password = document.getElementById('l-password').value;
  const btn      = document.getElementById('login-btn');
  const err      = document.getElementById('error-msg');
  if (!email || !password) { err.textContent = 'Enter email and password'; return; }
  btn.disabled = true; btn.textContent = 'Logging in…'; err.textContent = '';
  try {
    const r = await fetch('/dns/api/subscribe/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    TOKEN = data.token;
    // Update URL without reload so refresh works
    history.replaceState(null, '', '?token=' + encodeURIComponent(TOKEN));
    showDash();
  } catch (e) {
    err.textContent = e.message;
    btn.disabled = false; btn.textContent = 'Login';
  }
}

// Allow Enter key on password field
document.addEventListener('DOMContentLoaded', () => {
  const pw = document.getElementById('l-password');
  if (pw) pw.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
});

async function showDash() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('loading').style.display = 'block';
  document.getElementById('dash').style.display = 'none';
  try {
    const [me, stats] = await Promise.all([apiGet('/me'), apiGet('/stats')]);
    renderMe(me);
    renderStats(stats);
    await loadQueries();
    document.getElementById('loading').style.display = 'none';
    document.getElementById('dash').style.display = 'block';
  } catch (e) {
    document.getElementById('loading').innerHTML =
      '<p style="color:var(--red);text-align:center;padding:40px">' + e.message +
      '<br><br><a href="/dns/client/" style="color:var(--accent)">Login again</a></p>';
  }
}

function renderMe(me) {
  document.getElementById('header-name').textContent = me.name + ' (' + me.email + ')';
  document.getElementById('d-name').textContent = me.name;
  document.getElementById('d-plan').textContent = (me.plan || 'client').charAt(0).toUpperCase() + me.plan.slice(1);
  document.getElementById('d-ip').textContent   = me.peer_ip || 'Not assigned';

  const statusEl = document.getElementById('d-status');
  const cls = me.active ? 'badge-green' : 'badge-red';
  const label = me.active ? (me.status === 'trial' ? 'Trial' : 'Active') : 'Expired';
  statusEl.innerHTML = `<span class="badge ${cls}"><span class="dot"></span>${label}</span>`;

  document.getElementById('d-expires').textContent = me.expires_at
    ? new Date(me.expires_at).toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' })
    : 'N/A';

  const days = me.days_left || 0;
  document.getElementById('d-days').textContent = days + (days === 1 ? ' day' : ' days');
  // Progress bar: plan roughly 30 days
  const pct = Math.min(100, Math.round(days / 30 * 100));
  const fill = document.getElementById('d-progress');
  fill.style.width = pct + '%';
  fill.style.background = days <= 3 ? 'var(--red)' : days <= 7 ? 'var(--yellow)' : 'var(--accent)';
}

function renderStats(s) {
  document.getElementById('s-total').textContent   = fmt(s.total);
  document.getElementById('s-blocked').textContent = fmt(s.blocked);
  document.getElementById('s-allowed').textContent = fmt(s.allowed);
  document.getElementById('s-rate').textContent    = s.block_rate + '%';

  // Bar chart
  const chart = document.getElementById('bar-chart');
  chart.innerHTML = '';
  if (s.hourly && s.hourly.length) {
    const maxVal = Math.max(...s.hourly.map(h => (+h.allowed) + (+h.blocked)), 1);
    s.hourly.forEach(h => {
      const total = (+h.allowed) + (+h.blocked);
      const hPct  = total / maxVal;
      const bPct  = total ? (+h.blocked) / total : 0;
      const col   = document.createElement('div');
      col.className = 'bar-col';
      col.title     = h.hour + ': ' + h.blocked + ' blocked, ' + h.allowed + ' allowed';
      const bHeight = Math.round(hPct * 60 * bPct);
      const aHeight = Math.round(hPct * 60 * (1 - bPct));
      if (bHeight) col.innerHTML += `<div class="bar-seg" style="height:${bHeight}px;background:var(--red)"></div>`;
      if (aHeight) col.innerHTML += `<div class="bar-seg" style="height:${aHeight}px;background:var(--green)"></div>`;
      chart.appendChild(col);
    });
  } else {
    chart.innerHTML = '<p style="color:var(--muted);font-size:13px;align-self:center">No data yet</p>';
  }

  // Top blocked
  const tb = document.getElementById('top-blocked');
  if (s.top_blocked && s.top_blocked.length) {
    const max = s.top_blocked[0].count;
    tb.innerHTML = s.top_blocked.map(d => `
      <div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%">${d.domain}</span>
          <span style="color:var(--red)">${d.count}</span>
        </div>
        <div class="progress-bar" style="margin-top:0;height:4px">
          <div class="progress-fill" style="width:${Math.round(d.count/max*100)}%;background:var(--red)"></div>
        </div>
      </div>`).join('');
  } else {
    tb.innerHTML = '<p style="color:var(--muted);font-size:13px">No blocked domains today 🎉</p>';
  }
}

async function loadQueries() {
  try {
    const data = await apiGet('/queries?limit=60');
    const tbody = document.getElementById('q-body');
    if (!data.queries.length) {
      tbody.innerHTML = '<tr><td colspan="3" style="color:var(--muted);text-align:center;padding:20px">No queries yet</td></tr>';
      return;
    }
    tbody.innerHTML = data.queries.map(q => {
      const cls  = q.action === 'blocked' ? 'block' : 'allow';
      const time = new Date(q.logged_at).toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
      return `<tr>
        <td style="font-family:monospace;max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${q.domain}</td>
        <td class="${cls}" style="font-weight:600;text-transform:capitalize">${q.action}</td>
        <td style="color:var(--muted);white-space:nowrap">${time}</td>
      </tr>`;
    }).join('');
  } catch (e) {
    console.warn('Queries error:', e.message);
  }
}

// Init
(function init() {
  document.getElementById('loading').style.display = 'none';
  if (TOKEN) {
    showDash();
  } else {
    document.getElementById('login-screen').style.display = 'flex';
  }
})();
</script>
</body>
</html>
