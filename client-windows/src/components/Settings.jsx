/**
 * Settings tab — server URL, auto-start, always-on VPN, config management
 */
import React, { useState, useEffect } from 'react';

export default function Settings({ showToast, onSetupDone }) {
  const [serverUrl,  setServerUrl]  = useState('');
  const [autoStart,  setAutoStart]  = useState(false);
  const [alwaysOn,   setAlwaysOn]   = useState(false);
  const [adminMode,  setAdminMode]  = useState(false);
  const [tunnelName, setTunnelName] = useState('IonManDNS');
  const [showConfig, setShowConfig] = useState(false);
  const [configText, setConfigText] = useState('');
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    window.ionman.getAllStore().then(s => {
      setServerUrl (s.serverUrl  || '');
      setAutoStart (!!s.autoStart);
      setAlwaysOn  (!!s.alwaysOnVPN);
      setAdminMode (!!s.adminMode);
      setTunnelName(s.tunnelName || 'IonManDNS');
    });
  }, []);

  async function saveSettings() {
    setSaving(true);
    try {
      await window.ionman.setStore('serverUrl',  serverUrl.trim());
      await window.ionman.setStore('alwaysOnVPN', alwaysOn);
      await window.ionman.setStore('adminMode',   adminMode);
      await window.ionman.setStore('tunnelName',  tunnelName.trim() || 'IonManDNS');
      await window.ionman.setAutoStart(autoStart);
      showToast('Settings saved', 'success');
    } catch (e) {
      showToast('Error saving: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveConfig() {
    if (!configText.includes('[Interface]')) {
      showToast('Invalid WireGuard config — must contain [Interface]', 'error');
      return;
    }
    setSaving(true);
    const r = await window.ionman.saveConfig(configText);
    setSaving(false);
    if (r.ok) {
      showToast('VPN config saved!', 'success');
      setShowConfig(false);
      setConfigText('');
    } else {
      showToast('Failed: ' + r.error, 'error');
    }
  }

  async function resetSetup() {
    if (!confirm('Reset will clear your VPN config and start setup again. Continue?')) return;
    await window.ionman.setStore('setupDone', false);
    onSetupDone(false);
  }

  return (
    <div>
      {/* Server URL */}
      <div className="card">
        <div className="card-title">Server</div>
        <div className="input-group">
          <label className="input-label">IonMan DNS Server URL</label>
          <input
            className="input"
            type="url"
            placeholder="https://your-server.com"
            value={serverUrl}
            onChange={e => setServerUrl(e.target.value)}
          />
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label className="input-label">Tunnel Name</label>
          <input
            className="input"
            type="text"
            placeholder="IonManDNS"
            value={tunnelName}
            onChange={e => setTunnelName(e.target.value)}
          />
        </div>
      </div>

      {/* Behaviour toggles */}
      <div className="card">
        <div className="card-title">Behaviour</div>
        <Toggle
          name="Launch at startup"
          desc="Start IonMan DNS when Windows starts"
          checked={autoStart}
          onChange={() => setAutoStart(v => !v)}
        />
        <Toggle
          name="Always-on VPN"
          desc="Auto-reconnect on startup and after sleep"
          checked={alwaysOn}
          onChange={() => setAlwaysOn(v => !v)}
        />
        <Toggle
          name="Admin mode"
          desc="Show admin quick-links in Home"
          checked={adminMode}
          onChange={() => setAdminMode(v => !v)}
        />
      </div>

      <button
        className="btn btn-primary"
        onClick={saveSettings}
        disabled={saving}
        style={{ marginBottom: 12 }}
      >
        {saving ? 'Saving…' : 'Save Settings'}
      </button>

      {/* VPN config */}
      <div className="card">
        <div className="card-title">VPN Configuration</div>
        <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>
          Paste a WireGuard peer config from your IonMan DNS dashboard.
        </div>
        {!showConfig ? (
          <button className="btn btn-ghost" onClick={() => setShowConfig(true)}>
            Update VPN Config
          </button>
        ) : (
          <>
            <textarea
              className="input"
              rows={8}
              placeholder={'[Interface]\nPrivateKey = ...\nAddress = ...\nDNS = ...\n\n[Peer]\nPublicKey = ...\nEndpoint = ...\nAllowedIPs = ...'}
              value={configText}
              onChange={e => setConfigText(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn btn-primary" onClick={saveConfig} disabled={saving || !configText}>
                {saving ? 'Saving…' : 'Save Config'}
              </button>
              <button className="btn btn-ghost" onClick={() => { setShowConfig(false); setConfigText(''); }}
                style={{ flex: '0 0 80px' }}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>

      {/* Danger zone */}
      <div className="card" style={{ borderColor: '#ef444440' }}>
        <div className="card-title" style={{ color: '#ef4444' }}>Danger Zone</div>
        <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>
          Reset configuration and run setup again.
        </div>
        <button className="btn btn-danger" onClick={resetSetup}>
          Reset &amp; Re-setup
        </button>
      </div>

      {/* WireGuard download */}
      <div style={{ textAlign: 'center', padding: '8px 0 4px', color: '#475569', fontSize: 12 }}>
        Need WireGuard?{' '}
        <span
          style={{ color: '#6366f1', cursor: 'pointer' }}
          onClick={() => window.ionman.openExternal('https://www.wireguard.com/install/')}
        >
          Download for Windows
        </span>
      </div>
    </div>
  );
}

function Toggle({ name, desc, checked, onChange }) {
  return (
    <div className="toggle-row">
      <div className="toggle-info">
        <span className="toggle-name">{name}</span>
        {desc && <span className="toggle-desc">{desc}</span>}
      </div>
      <label className="toggle">
        <input type="checkbox" checked={checked} onChange={onChange} />
        <span className="toggle-slider" />
      </label>
    </div>
  );
}
