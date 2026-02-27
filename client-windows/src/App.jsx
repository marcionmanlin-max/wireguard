import React, { useState, useEffect, useCallback } from 'react';
import Home     from './components/Home.jsx';
import Stats    from './components/Stats.jsx';
import Settings from './components/Settings.jsx';
import Setup    from './components/Setup.jsx';

// Nav icon components
const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);
const StatsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);
const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
    <path d="M12 2v2m0 16v2M2 12h2m16 0h2"/>
  </svg>
);

export default function App() {
  const [tab,       setTab]       = useState('home');
  const [setupDone, setSetupDone] = useState(null);
  const [toast,     setToast]     = useState(null);

  // Check setup status on mount
  useEffect(() => {
    window.ionman.getStore('setupDone').then(done => setSetupDone(!!done));
    // Listen for main-process navigate events
    window.ionman.onNavigate(path => {
      if (path === '/settings') setTab('settings');
    });
    return () => window.ionman.removeAllListeners('navigate');
  }, []);

  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const onSetupComplete = useCallback(() => {
    setSetupDone(true);
    setTab('home');
  }, []);

  if (setupDone === null) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '600px' }}>
      {/* Title bar */}
      <div className="titlebar">
        <div className="titlebar-title">
          <span>🛡️</span>
          <span>IonMan DNS</span>
        </div>
        <div className="titlebar-controls">
          <button className="titlebar-btn" onClick={() => window.ionman.minimize()} title="Minimize">─</button>
          <button className="titlebar-btn close" onClick={() => window.ionman.close()} title="Hide to tray">✕</button>
        </div>
      </div>

      {/* Main content */}
      <div className="content">
        {!setupDone ? (
          <Setup onComplete={onSetupComplete} showToast={showToast} />
        ) : (
          <>
            {tab === 'home'     && <Home     showToast={showToast} />}
            {tab === 'stats'    && <Stats    showToast={showToast} />}
            {tab === 'settings' && <Settings showToast={showToast} onSetupDone={setSetupDone} />}
          </>
        )}
      </div>

      {/* Bottom nav (only after setup) */}
      {setupDone && (
        <nav className="navbar">
          <button className={`nav-btn ${tab === 'home'     ? 'active' : ''}`} onClick={() => setTab('home')}>
            <HomeIcon /> Home
          </button>
          <button className={`nav-btn ${tab === 'stats'    ? 'active' : ''}`} onClick={() => setTab('stats')}>
            <StatsIcon /> Stats
          </button>
          <button className={`nav-btn ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
            <SettingsIcon /> Settings
          </button>
        </nav>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  );
}
