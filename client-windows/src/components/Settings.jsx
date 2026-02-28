/**
 * Settings tab — server URL, auto-start, always-on VPN, config management
 */
import React, { useState, useEffect } from 'react';

const DEFAULT_SERVER = 'https://dns.makoyot.xyz/dns';

export default function Settings({ showToast, onSetupDone }) {
  const [serverUrl,  setServerUrl]  = useState(DEFAULT_SERVER);
  const [autoStart,  setAutoStart]  = useState(false);
  const [alwaysOn,   setAlwaysOn]   = useState(false);
  const [adminMode,  setAdminMode]  = useState(false);
  const [tunnelName, setTunnelName] = useState('IonManDNS');
  const [saving,     setSaving]     = useState(false);
  const [wgOk,       setWgOk]       = useState(true);

  // Re-import config state
  const [subMode,    setSubMode]    = useState(null); // null | 'login' | 'file' | 'qr'
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [subLoading, setSubLoading] = useState(false);
  const [subError,   setSubError]   = useState('');

  useEffect(() => {
    window.ionman.getAllStore().then(s => {
      setServerUrl (s.serverUrl  || DEFAULT_SERVER);
      setAutoStart (!!s.autoStart);
      setAlwaysOn  (!!s.alwaysOnVPN);
      setAdminMode (!!s.adminMode);
      setTunnelName(s.tunnelName || 'IonManDNS');
    });
    window.ionman.checkWG().then(ok => setWgOk(ok));
  }, []);

  async function saveSettings() {
    setSaving(true);
    try {
      await window.ionman.setStore('serverUrl',   serverUrl.trim());
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

  async function doFileImport() {
    setSubError('');
    setSubLoading(true);
    try {
      const r = await window.ionman.openConfDialog();
      if (!r.ok) return;
      if (!r.text.includes('[Interface]')) { setSubError('Not a valid WireGuard config.'); return; }
      const s = await window.ionman.saveConfig(r.text);
      if (!s.ok) throw new Error(s.error);
      showToast('Config updated!', 'success');
      setSubMode(null);
    } catch (e) {
      setSubError(e.message);
    } finally {
      setSubLoading(false);
    }
  }

  async function doQRImport() {
    setSubError('');
    setSubLoading(true);
    try {
      const r = await window.ionman.openQrDialog();
      if (!r.ok) return;
      const jsQR = (await import('jsqr')).default;
      const text = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = img.width; c.height = img.height;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const id = ctx.getImageData(0, 0, c.width, c.height);
          const code = jsQR(id.data, id.width, id.height);
          if (code) resolve(code.data);
          else reject(new Error('No QR code found in image'));
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = r.dataUrl;
      });
      if (!text.includes('[Interface]')) { setSubError('QR does not contain a WireGuard config.'); return; }
      const s = await window.ionman.saveConfig(text);
      if (!s.ok) throw new Error(s.error);
      showToast('Config updated!', 'success');
      setSubMode(null);
    } catch (e) {
      setSubError(e.message);
    } finally {
      setSubLoading(false);
    }
  }

  async function doCredLogin() {
    if (!serverUrl.trim()) { setSubError('Enter server URL above first.'); return; }
    if (!email.trim())     { setSubError('Enter your email.');             return; }
    if (!password)         { setSubError('Enter your password.');           return; }
    setSubError('');
    setSubLoading(true);
    try {
      const r = await window.ionman.subscriberLogin({
        serverUrl: serverUrl.trim(), email: email.trim(), password,
      });
      if (!r.ok) throw new Error(r.error || 'Login failed');
      const s = await window.ionman.saveConfig(r.config);
      if (!s.ok) throw new Error(s.error);
      await window.ionman.setStore('serverUrl', serverUrl.trim());
      showToast('Config re-imported!', 'success');
      setSubMode(null);
      setEmail(''); setPassword('');
    } catch (e) {
      setSubError(e.message);
    } finally {
      setSubLoading(false);
    }
  }

  async function resetSetup() {
    if (!confirm('Reset will clear your VPN config and run setup again. Continue?')) return;
    await window.ionman.setStore('setupDone', false);
    onSetupDone(false);
  }

  return (
    <div>
      {/* WireGuard missing warning */}
      {!wgOk && (
        <div style={{
          background: 'rgba(245,158,11,0.1)', border: '1px solid #f59e0b',
          borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#f59e0b',
        }}>
          ⚠ WireGuard is not installed — Connect will not work.{' '}
          <span
            style={{ textDecoration: 'underline', cursor: 'pointer' }}
            onClick={() => window.ionman.openExternal('https://www.wireguard.com/install/')}
          >
            Download WireGuard
          </span>
        </div>
      )}

      {/* Server URL */}
      <div className="card">
        <div className="card-title">Server</div>
        <div className="input-group">
          <label className="input-label">IonMan Server URL</label>
          <input
            className="input"
            type="url"
            placeholder="https://dns.makoyot.xyz/dns"
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

      <button className="btn btn-primary" onClick={saveSettings} disabled={saving} style={{ marginBottom: 12 }}>
        {saving ? 'Saving…' : 'Save Settings'}
      </button>

      {/* Re-import VPN config */}
      <div className="card">
        <div className="card-title">Update VPN Config</div>

        {subMode === null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => { setSubMode('login'); setSubError(''); }}>
              🔐 Login with account
            </button>
            <button className="btn btn-ghost" onClick={() => { setSubMode('file'); setSubError(''); doFileImport(); }}>
              📁 Import .conf file
            </button>
            <button className="btn btn-ghost" onClick={() => { setSubMode('qr'); setSubError(''); doQRImport(); }}>
              📷 Scan QR code image
            </button>
          </div>
        )}

        {subMode === 'login' && (
          <div>
            <div className="input-group">
              <label className="input-label">Email</label>
              <input className="input" type="email" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" />
            </div>
            <div className="input-group">
              <label className="input-label">Password</label>
              <input className="input" type="password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                onKeyDown={e => e.key === 'Enter' && doCredLogin()} />
            </div>
            {subError && <p style={{ color: '#ef4444', fontSize: 13, margin: '4px 0 8px' }}>{subError}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="btn btn-primary" onClick={doCredLogin} disabled={subLoading}>
                {subLoading ? 'Logging in…' : 'Login & Download Config'}
              </button>
              <button className="btn btn-ghost" style={{ flex: '0 0 70px' }} onClick={() => { setSubMode(null); setSubError(''); }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {(subMode === 'file' || subMode === 'qr') && subLoading && (
          <p style={{ color: '#94a3b8', fontSize: 13 }}>
            {subMode === 'file' ? 'Opening file picker…' : 'Opening image picker…'}
          </p>
        )}
        {(subMode === 'file' || subMode === 'qr') && subError && (
          <div>
            <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 8 }}>{subError}</p>
            <button className="btn btn-ghost" onClick={() => { setSubMode(null); setSubError(''); }}>Back</button>
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="card" style={{ borderColor: '#ef444440' }}>
        <div className="card-title" style={{ color: '#ef4444' }}>Danger Zone</div>
        <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>
          Reset configuration and run the import wizard again.
        </p>
        <button className="btn btn-danger" onClick={resetSetup}>
          Reset &amp; Re-setup
        </button>
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
