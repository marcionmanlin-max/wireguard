/**
 * Home tab — large connect/disconnect button + connection info
 */
import React, { useState, useEffect, useRef } from 'react';

export default function Home({ showToast }) {
  const [connected, setConnected] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [wgMissing, setWgMissing] = useState(false);
  const [info,      setInfo]      = useState({ serverUrl: '', tunnelName: '' });
  const [uptime,    setUptime]    = useState(0);
  const uptimeRef = useRef(null);

  useEffect(() => {
    // Initial status check
    loadStatus();
    // Subscribe to main-process status pushes
    window.ionman.onStatus(({ connected: c }) => {
      setConnected(c);
      if (c && !uptimeRef.current) startUptimeClock();
      if (!c) stopUptimeClock();
    });
    // Load config info
    window.ionman.getAllStore().then(s => {
      setInfo({ serverUrl: s.serverUrl, tunnelName: s.tunnelName });
    });
    return () => {
      window.ionman.removeAllListeners('connection-status');
      stopUptimeClock();
    };
  }, []);

  async function loadStatus() {
    const s = await window.ionman.status();
    setWgMissing(!s.wgInstalled);
    setConnected(s.connected);
    if (s.connected) startUptimeClock();
  }

  function startUptimeClock() {
    stopUptimeClock();
    setUptime(0);
    uptimeRef.current = setInterval(() => setUptime(u => u + 1), 1000);
  }
  function stopUptimeClock() {
    clearInterval(uptimeRef.current);
    uptimeRef.current = null;
    setUptime(0);
  }

  async function toggle() {
    if (loading) return;
    setLoading(true);
    try {
      if (connected) {
        const r = await window.ionman.disconnect();
        if (r.ok) { setConnected(false); stopUptimeClock(); showToast('Disconnected', 'info'); }
        else showToast(r.error || 'Failed to disconnect', 'error');
      } else {
        const r = await window.ionman.connect();
        if (r.ok) { setConnected(true); startUptimeClock(); showToast('Connected!', 'success'); }
        else showToast(r.error || 'Failed to connect', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  function fmtUptime(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  return (
    <div>
      {wgMissing && (
        <div className="card" style={{ borderColor: '#f59e0b', marginBottom: 16 }}>
          <div style={{ color: '#f59e0b', fontWeight: 600, marginBottom: 6 }}>⚠ WireGuard not installed</div>
          <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>
            Download and install WireGuard for Windows to use the VPN.
          </div>
          <button
            className="btn btn-ghost"
            onClick={() => window.ionman.openExternal('https://www.wireguard.com/install/')}
          >
            Download WireGuard
          </button>
        </div>
      )}

      {/* Big connect button */}
      <button
        className={`connect-btn ${loading ? 'loading' : connected ? 'connected' : 'disconnected'}`}
        onClick={toggle}
        disabled={wgMissing}
        title={connected ? 'Click to disconnect' : 'Click to connect'}
        style={{ marginTop: 20 }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span style={{ fontSize: 12 }}>
          {loading ? 'Please wait…' : connected ? 'Connected' : 'Connect'}
        </span>
      </button>

      {/* Status card */}
      <div className="card">
        <div className="card-title">Status</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Row label="Connection">
            <span className={`badge badge-${connected ? 'green' : 'red'}`}>
              <span className="dot" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                background: connected ? '#22c55e' : '#ef4444', marginRight: 5 }} />
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </Row>
          <Row label="Tunnel">
            <span style={{ color: '#94a3b8', fontSize: 13 }}>{info.tunnelName || 'IonManDNS'}</span>
          </Row>
          <Row label="DNS">
            <span style={{ color: '#94a3b8', fontSize: 13 }}>Your IonMan Server</span>
          </Row>
          {connected && uptime > 0 && (
            <Row label="Uptime">
              <span style={{ color: '#22c55e', fontSize: 13 }}>{fmtUptime(uptime)}</span>
            </Row>
          )}
        </div>
      </div>

      {/* Dashboard shortcut */}
      {info.serverUrl && (
        <button className="btn btn-ghost" onClick={() => window.ionman.openDashboard()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>
          Open Web Dashboard
        </button>
      )}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: '#94a3b8', fontSize: 13 }}>{label}</span>
      {children}
    </div>
  );
}
