/**
 * Stats tab — polls the IonMan API for query stats, blocked counts, etc.
 */
import React, { useState, useEffect } from 'react';

export default function Stats({ showToast }) {
  const [stats,    setStats]    = useState(null);
  const [tunnel,   setTunnel]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [serverUrl, setServerUrl] = useState('');

  useEffect(() => {
    window.ionman.getStore('serverUrl').then(url => {
      setServerUrl(url || '');
      if (url) fetchStats(url);
    });
    loadTunnelStats();
  }, []);

  async function fetchStats(url) {
    try {
      const base = url.replace(/\/$/, '');
      const r    = await fetch(`${base}/api/stats.php`, {
        headers: { 'X-IonMan-Client': 'windows-app' }
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      setStats(data);
    } catch (e) {
      showToast('Could not load stats: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadTunnelStats() {
    const r = await window.ionman.tunnelStats();
    if (r.ok) parseTunnelStats(r.raw);
  }

  function parseTunnelStats(raw) {
    const rx = raw.match(/transfer:\s*([\d.]+\s*\w+)\s+received,\s*([\d.]+\s*\w+)\s+sent/i);
    const ep = raw.match(/endpoint:\s*(.+)/i);
    const lh = raw.match(/latest handshake:\s*(.+)/i);
    setTunnel({
      rx:       rx?.[1] || '—',
      tx:       rx?.[2] || '—',
      endpoint: ep?.[1]?.trim() || '—',
      handshake: lh?.[1]?.trim() || 'never',
    });
  }

  if (!serverUrl) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📡</div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>No server configured</div>
        <div style={{ fontSize: 13 }}>Set your server URL in Settings to see stats.</div>
      </div>
    );
  }

  return (
    <div>
      {/* WireGuard tunnel stats */}
      {tunnel && (
        <div className="card">
          <div className="card-title">WireGuard Tunnel</div>
          <div className="stats-grid">
            <StatBox label="Data In"  value={tunnel.rx} />
            <StatBox label="Data Out" value={tunnel.tx} />
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Row label="Endpoint"      val={tunnel.endpoint} />
            <Row label="Last Handshake" val={tunnel.handshake} />
          </div>
        </div>
      )}

      {/* API stats */}
      <div className="card">
        <div className="card-title">DNS Stats (Today)</div>
        {loading ? (
          <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
            Loading…
          </div>
        ) : stats ? (
          <>
            <div className="stats-grid">
              <StatBox label="Total Queries" value={fmt(stats.total_queries ?? stats.queries_today)} color="#6366f1" />
              <StatBox label="Blocked"       value={fmt(stats.blocked ?? stats.blocked_today)}       color="#ef4444" />
              <StatBox label="Cache Hits"    value={fmt(stats.cache_hits)}   color="#22c55e" />
              <StatBox label="Block Rate"    value={pct(stats.blocked ?? stats.blocked_today, stats.total_queries ?? stats.queries_today) + '%'} color="#f59e0b" />
            </div>
            <button
              className="btn btn-ghost"
              style={{ marginTop: 12 }}
              onClick={() => fetchStats(serverUrl)}
            >
              Refresh
            </button>
          </>
        ) : (
          <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
            Could not load stats.{' '}
            <span
              style={{ color: '#6366f1', cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => { setLoading(true); fetchStats(serverUrl); }}
            >
              Retry
            </span>
          </div>
        )}
      </div>

      <button className="btn btn-ghost" onClick={() => window.ionman.openDashboard()}>
        View Full Dashboard →
      </button>
    </div>
  );
}

function StatBox({ label, value, color = '#f1f5f9' }) {
  return (
    <div className="stat-box">
      <div className="stat-value" style={{ color }}>{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function Row({ label, val }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span>{label}:</span>
      <span style={{ color: '#f1f5f9' }}>{val}</span>
    </div>
  );
}

function fmt(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function pct(a, b) {
  if (!a || !b || b === 0) return '0';
  return ((a / b) * 100).toFixed(1);
}
