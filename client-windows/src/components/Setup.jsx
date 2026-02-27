/**
 * Setup screen — shown on first launch.
 * Steps: 1) Server URL  2) Paste WireGuard config  3) Done
 */
import React, { useState } from 'react';

export default function Setup({ onComplete, showToast }) {
  const [step,       setStep]       = useState(1);
  const [serverUrl,  setServerUrl]  = useState('');
  const [configText, setConfigText] = useState('');
  const [saving,     setSaving]     = useState(false);
  const [wgInstalled, setWgInstalled] = useState(null);

  async function checkWG() {
    const ok = await window.ionman.checkWG();
    setWgInstalled(ok);
  }

  async function step1Next() {
    if (!serverUrl.trim()) { showToast('Enter your server URL', 'error'); return; }
    await window.ionman.setStore('serverUrl', serverUrl.trim());
    await checkWG();
    setStep(2);
  }

  async function step2Next() {
    if (!configText.includes('[Interface]')) {
      showToast('Paste a valid WireGuard config', 'error');
      return;
    }
    setSaving(true);
    const r = await window.ionman.saveConfig(configText);
    setSaving(false);
    if (!r.ok) { showToast('Failed to save config: ' + r.error, 'error'); return; }
    setStep(3);
  }

  async function finish() {
    await window.ionman.setStore('setupDone', true);
    onComplete();
  }

  return (
    <div className="setup-screen">
      {step === 1 && (
        <>
          <div className="setup-logo">🛡️</div>
          <h2 style={{ marginBottom: 6 }}>Welcome to IonMan DNS</h2>
          <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 28, maxWidth: 320 }}>
            Privacy-first DNS blocker + WireGuard VPN.
            Let's get you connected in 2 steps.
          </p>

          <div style={{ width: '100%', maxWidth: 340 }}>
            <div className="input-group">
              <label className="input-label">IonMan Server URL</label>
              <input
                className="input"
                type="url"
                placeholder="https://your-server.com"
                value={serverUrl}
                onChange={e => setServerUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && step1Next()}
                autoFocus
              />
            </div>
            <button className="btn btn-primary" onClick={step1Next}>
              Next →
            </button>
            <p style={{ color: '#475569', fontSize: 11, marginTop: 12 }}>
              Don't have a server?{' '}
              <span
                style={{ color: '#6366f1', cursor: 'pointer' }}
                onClick={() => window.ionman.openExternal('https://github.com/marcionmanlin-max/wireguard')}
              >
                See installation guide
              </span>
            </p>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="setup-logo">🔑</div>
          <h2 style={{ marginBottom: 6 }}>Import VPN Config</h2>
          <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16, maxWidth: 320 }}>
            Go to your IonMan dashboard → WireGuard → your peer → Download Config.
            Paste it below.
          </p>

          {wgInstalled === false && (
            <div style={{
              background: 'rgba(245,158,11,0.1)', border: '1px solid #f59e0b',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              fontSize: 13, color: '#f59e0b', width: '100%', maxWidth: 340
            }}>
              ⚠ WireGuard is not installed.{' '}
              <span
                style={{ textDecoration: 'underline', cursor: 'pointer' }}
                onClick={() => window.ionman.openExternal('https://www.wireguard.com/install/')}
              >
                Install now
              </span>{' '}
              then come back.
            </div>
          )}

          <div style={{ width: '100%', maxWidth: 340 }}>
            <textarea
              className="input"
              rows={8}
              placeholder={'[Interface]\nPrivateKey = ...\nAddress = 10.8.0.x/32\nDNS = YOUR_SERVER_IP\n\n[Peer]\nPublicKey = ...\nEndpoint = your-server:51820\nAllowedIPs = 0.0.0.0/0'}
              value={configText}
              onChange={e => setConfigText(e.target.value)}
              style={{ marginBottom: 12, fontFamily: 'monospace', fontSize: 11 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" style={{ flex: '0 0 80px' }} onClick={() => setStep(1)}>
                ← Back
              </button>
              <button className="btn btn-primary" onClick={step2Next} disabled={saving || !configText}>
                {saving ? 'Saving…' : 'Save Config →'}
              </button>
            </div>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="setup-logo" style={{ background: '#22c55e' }}>✓</div>
          <h2 style={{ marginBottom: 6 }}>You're all set!</h2>
          <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 28, maxWidth: 320 }}>
            Your VPN config is saved. Click Connect on the home screen to start
            routing DNS through IonMan.
          </p>
          <button className="btn btn-primary" style={{ maxWidth: 200 }} onClick={finish}>
            Go to App →
          </button>
        </>
      )}

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 8, marginTop: 28 }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: s === step ? '#6366f1' : s < step ? '#22c55e' : '#2a3050',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>
    </div>
  );
}
