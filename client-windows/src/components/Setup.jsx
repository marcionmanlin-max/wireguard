/**
 * Setup screen — shown on first launch.
 * Methods: QR code scan | .conf file import | Subscriber credentials
 */
import React, { useState } from 'react';

// ── helpers ─────────────────────────────────────────────────────────────────

function parseWGConfig(text) {
  return {
    name:     text.match(/^#\s*Name\s*=\s*(.+)$/im)?.[1]?.trim() || 'ionman',
    address:  text.match(/^Address\s*=\s*(.+)$/im)?.[1]?.trim()  || '—',
    dns:      text.match(/^DNS\s*=\s*(.+)$/im)?.[1]?.trim()       || '—',
    endpoint: text.match(/^Endpoint\s*=\s*(.+)$/im)?.[1]?.trim()  || '—',
  };
}

async function decodeQRFromDataUrl(dataUrl) {
  const jsQR = (await import('jsqr')).default;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code) resolve(code.data);
      else reject(new Error('No QR code detected in image'));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

// ── sub-components ───────────────────────────────────────────────────────────

function MethodCard({ icon, label, desc, onClick }) {
  return (
    <button onClick={onClick} className="method-card">
      <span className="method-card-icon">{icon}</span>
      <span className="method-card-label">{label}</span>
      <span className="method-card-desc">{desc}</span>
    </button>
  );
}

function ConfigPreview({ parsed }) {
  const rows = [
    { label: 'Tunnel',   value: parsed.name },
    { label: 'Address',  value: parsed.address },
    { label: 'DNS',      value: parsed.dns },
    { label: 'Endpoint', value: parsed.endpoint },
  ];
  return (
    <div className="config-preview">
      {rows.map(r => (
        <div key={r.label} className="config-preview-row">
          <span className="config-preview-key">{r.label}</span>
          <span className="config-preview-val">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── main component ───────────────────────────────────────────────────────────

export default function Setup({ onComplete, showToast }) {
  // screens: 'welcome' | 'method' | 'qr' | 'file' | 'creds' | 'preview' | 'done'
  const [screen, setScreen] = useState('welcome');

  const [serverUrl,  setServerUrl]  = useState('https://dns.makoyot.xyz/dns');
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [configText, setConfigText] = useState('');
  const [parsed,     setParsed]     = useState(null);
  const [filename,   setFilename]   = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  // ── navigation helpers ───────────────────────────────────────────────────

  function goMethod() { setError(''); setScreen('method'); }

  function selectMethod(m) {
    setError('');
    setConfigText('');
    setParsed(null);
    setFilename('');
    setScreen(m);
  }

  function toPreview(text, fname = '') {
    const p = parseWGConfig(text);
    if (!text.includes('[Interface]')) {
      setError('No valid WireGuard [Interface] block found.');
      return;
    }
    setConfigText(text);
    setParsed(p);
    if (fname) setFilename(fname);
    setError('');
    setScreen('preview');
  }

  async function confirmSave() {
    setLoading(true);
    try {
      if (serverUrl.trim()) {
        await window.ionman.setStore('serverUrl', serverUrl.trim());
      }
      const r = await window.ionman.saveConfig(configText);
      if (!r.ok) throw new Error(r.error || 'Save failed');
      await window.ionman.setStore('setupDone', true);
      setScreen('done');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── QR handler ────────────────────────────────────────────────────────────

  async function handleQRBrowse() {
    setError('');
    setLoading(true);
    try {
      const r = await window.ionman.openQrDialog();
      if (!r.ok) return;
      const text = await decodeQRFromDataUrl(r.dataUrl);
      if (!text.includes('[Interface]')) {
        setError('QR code does not contain a WireGuard config.');
        return;
      }
      toPreview(text, 'qr-import.conf');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── File handler ─────────────────────────────────────────────────────────

  async function handleFileBrowse() {
    setError('');
    setLoading(true);
    try {
      const r = await window.ionman.openConfDialog();
      if (!r.ok) return;
      if (!r.text.includes('[Interface]')) {
        setError('File does not contain a valid WireGuard config.');
        return;
      }
      toPreview(r.text, r.filename);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Credential handler ────────────────────────────────────────────────────

  async function handleCredLogin() {
    if (!serverUrl.trim()) { setError('Enter your server URL first.'); return; }
    if (!email.trim())     { setError('Enter your email.');            return; }
    if (!password)         { setError('Enter your password.');          return; }
    setError('');
    setLoading(true);
    try {
      const r = await window.ionman.subscriberLogin({
        serverUrl: serverUrl.trim(),
        email: email.trim(),
        password,
      });
      if (!r.ok) throw new Error(r.error || 'Login failed');
      toPreview(r.config, `${r.name || 'ionman'}.conf`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="setup-screen">

      {/* ── WELCOME ── */}
      {screen === 'welcome' && (
        <div className="setup-panel">
          <div className="setup-logo">🛡️</div>
          <h2 className="setup-title">IonMan DNS</h2>
          <p className="setup-sub">Privacy-first DNS blocker + WireGuard VPN client</p>

          <div className="setup-url-group">
            <label className="setup-label">
              Server URL{' '}
              <span style={{ color: '#64748b', fontWeight: 400 }}>(optional for file/QR)</span>
            </label>
            <input
              className="setup-input"
              type="url"
              placeholder="https://your-server.com/dns"
              value={serverUrl}
              onChange={e => setServerUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && goMethod()}
              autoFocus
            />
          </div>

          <button className="btn-primary btn-full" onClick={goMethod}>
            Get Started →
          </button>
        </div>
      )}

      {/* ── METHOD PICKER ── */}
      {screen === 'method' && (
        <div className="setup-panel">
          <button className="setup-back" onClick={() => setScreen('welcome')}>← Back</button>
          <h2 className="setup-title">Import Config</h2>
          <p className="setup-sub">Choose how to add your VPN tunnel</p>

          <div className="method-cards">
            <MethodCard
              icon="📷"
              label="Scan QR"
              desc="Browse a QR image"
              onClick={() => selectMethod('qr')}
            />
            <MethodCard
              icon="📁"
              label="Import File"
              desc="Open a .conf file"
              onClick={() => selectMethod('file')}
            />
            <MethodCard
              icon="🔐"
              label="Login"
              desc="Use your account"
              onClick={() => selectMethod('creds')}
            />
          </div>
        </div>
      )}

      {/* ── QR SCREEN ── */}
      {screen === 'qr' && (
        <div className="setup-panel">
          <button className="setup-back" onClick={goMethod}>← Back</button>
          <h2 className="setup-title">Scan QR Code</h2>
          <p className="setup-sub">Browse a QR image exported from the IonMan portal</p>

          <div
            className="drop-zone"
            onClick={!loading ? handleQRBrowse : undefined}
            style={{ cursor: loading ? 'wait' : 'pointer' }}
          >
            <span style={{ fontSize: 38 }}>📷</span>
            <p className="drop-zone-label">
              {loading ? 'Decoding QR…' : 'Browse for QR image'}
            </p>
            <p className="drop-zone-hint">PNG · JPG · BMP · GIF</p>
          </div>

          {error && <p className="setup-error">{error}</p>}
        </div>
      )}

      {/* ── FILE SCREEN ── */}
      {screen === 'file' && (
        <div className="setup-panel">
          <button className="setup-back" onClick={goMethod}>← Back</button>
          <h2 className="setup-title">Import .conf File</h2>
          <p className="setup-sub">Select a WireGuard configuration file</p>

          <div
            className="drop-zone"
            onClick={!loading ? handleFileBrowse : undefined}
            style={{ cursor: loading ? 'wait' : 'pointer' }}
          >
            <span style={{ fontSize: 38 }}>📁</span>
            <p className="drop-zone-label">
              {loading ? 'Reading file…' : 'Browse for .conf file'}
            </p>
            <p className="drop-zone-hint">.conf · .txt</p>
          </div>

          {error && <p className="setup-error">{error}</p>}
        </div>
      )}

      {/* ── CREDENTIALS SCREEN ── */}
      {screen === 'creds' && (
        <div className="setup-panel">
          <button className="setup-back" onClick={goMethod}>← Back</button>
          <h2 className="setup-title">Subscriber Login</h2>
          <p className="setup-sub">Your config will be downloaded automatically</p>

          <div className="setup-form">
            <label className="setup-label">Server URL</label>
            <input
              className="setup-input"
              type="url"
              placeholder="https://your-server.com/dns"
              value={serverUrl}
              onChange={e => setServerUrl(e.target.value)}
            />

            <label className="setup-label" style={{ marginTop: 14 }}>Email</label>
            <input
              className="setup-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="username"
            />

            <label className="setup-label" style={{ marginTop: 14 }}>Password</label>
            <input
              className="setup-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              onKeyDown={e => e.key === 'Enter' && handleCredLogin()}
            />
          </div>

          {error && <p className="setup-error">{error}</p>}

          <button
            className="btn-primary btn-full"
            onClick={handleCredLogin}
            disabled={loading}
            style={{ marginTop: 20 }}
          >
            {loading ? 'Logging in…' : 'Login & Download Config'}
          </button>
        </div>
      )}

      {/* ── PREVIEW / CONFIRM ── */}
      {screen === 'preview' && parsed && (
        <div className="setup-panel">
          <button className="setup-back" onClick={() => setScreen('method')}>← Back</button>
          <h2 className="setup-title">Review Config</h2>
          <p className="setup-sub">{filename || 'wireguard.conf'}</p>

          <ConfigPreview parsed={parsed} />

          {error && <p className="setup-error">{error}</p>}

          <button
            className="btn-primary btn-full"
            onClick={confirmSave}
            disabled={loading}
            style={{ marginTop: 20 }}
          >
            {loading ? 'Saving…' : 'Confirm & Save Tunnel'}
          </button>
        </div>
      )}

      {/* ── DONE ── */}
      {screen === 'done' && (
        <div className="setup-panel" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 54, marginBottom: 14 }}>✅</div>
          <h2 className="setup-title">Tunnel Saved!</h2>
          <p className="setup-sub">
            <strong style={{ color: '#e2e8f0' }}>{parsed?.name || 'ionman'}</strong> is ready to use.
          </p>

          <button
            className="btn-primary btn-full"
            onClick={async () => { await window.ionman.connect(); onComplete(); }}
            style={{ marginBottom: 10 }}
          >
            Connect Now
          </button>
          <button className="btn-secondary btn-full" onClick={onComplete}>
            Go to App
          </button>
        </div>
      )}
    </div>
  );
}
