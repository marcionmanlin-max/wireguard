/**
 * IonMan DNS Windows Client — Electron Main Process
 * Manages: tray icon, main window, WireGuard tunnel, IPC handlers
 */

const {
  app, BrowserWindow, Tray, Menu, ipcMain,
  nativeImage, shell, dialog, powerMonitor
} = require('electron');
const path   = require('path');
const fs     = require('fs');
const os     = require('os');
const { execSync, spawn, exec } = require('child_process');
const Store  = require('electron-store');

// ─── Config store (persists to %APPDATA%\ionman-dns-client\config.json) ───────
const store = new Store({
  defaults: {
    serverUrl:    '',
    adminMode:    false,
    autoStart:    false,
    alwaysOnVPN:  false,
    tunnelName:   'IonManDNS',
    configPath:   path.join(app.getPath('userData'), 'ionman.conf'),
    setupDone:    false,
  }
});

// ─── Paths ────────────────────────────────────────────────────────────────────
const WG_EXE    = 'C:\\Program Files\\WireGuard\\wireguard.exe';
const WG_UTIL   = 'C:\\Program Files\\WireGuard\\wg.exe';
const IS_DEV    = process.argv.includes('--dev');
const ICON_DIR  = IS_DEV
  ? path.join(__dirname, 'assets', 'icons')
  : path.join(process.resourcesPath, 'icons');

let tray        = null;
let mainWindow  = null;
let isConnected = false;
let statusPoll  = null;

// ─── App singleton ────────────────────────────────────────────────────────────
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}
app.on('second-instance', () => {
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
});

// ─── App ready ───────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  createTray();
  createMainWindow();
  startStatusPoll();

  // Auto-connect if always-on VPN is enabled
  if (store.get('alwaysOnVPN') && store.get('setupDone')) {
    await tunnelConnect();
  }

  // Resume VPN after sleep
  powerMonitor.on('resume', async () => {
    if (store.get('alwaysOnVPN') && store.get('setupDone')) {
      await tunnelConnect();
    }
  });
});

app.on('window-all-closed', () => {
  // Keep running in tray on Windows
});

app.on('before-quit', async () => {
  clearInterval(statusPoll);
  if (!store.get('alwaysOnVPN')) {
    await tunnelDisconnect();
  }
});

// ─── Main Window ─────────────────────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width:           420,
    height:          600,
    resizable:       false,
    frame:           false,
    transparent:     false,
    skipTaskbar:     true,
    show:            false,
    alwaysOnTop:     false,
    icon:            iconPath('icon.ico'),
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      webSecurity:      true,
    }
  });

  const url = IS_DEV
    ? 'http://localhost:5174'
    : `file://${path.join(__dirname, 'renderer', 'index.html')}`;

  mainWindow.loadURL(url);

  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('blur', () => {
    if (!IS_DEV) mainWindow.hide();
  });
}

function showWindow() {
  if (!mainWindow) return;
  const { screen } = require('electron');
  const display    = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  const winBounds  = mainWindow.getBounds();
  mainWindow.setPosition(
    width  - winBounds.width  - 16,
    height - winBounds.height - 16
  );
  mainWindow.show();
  mainWindow.focus();
}

// ─── Tray ─────────────────────────────────────────────────────────────────────
function createTray() {
  const icon = nativeImage.createFromPath(iconPath('tray-disconnected.png'));
  tray = new Tray(icon);
  tray.setToolTip('IonMan DNS — Disconnected');
  updateTrayMenu();

  tray.on('click', () => {
    mainWindow && mainWindow.isVisible() ? mainWindow.hide() : showWindow();
  });
}

function updateTrayMenu() {
  const connected = isConnected;
  const menu = Menu.buildFromTemplate([
    { label: 'IonMan DNS',      enabled: false },
    { type:  'separator' },
    {
      label: connected ? '● Connected' : '○ Disconnected',
      enabled: false,
    },
    {
      label:   connected ? 'Disconnect' : 'Connect',
      click:   () => connected ? tunnelDisconnect() : tunnelConnect(),
    },
    { type: 'separator' },
    {
      label: 'Open Dashboard',
      click: () => {
        const url = store.get('serverUrl');
        if (url) shell.openExternal(url);
        else dialog.showMessageBox({ message: 'Set your server URL in Settings first.' });
      }
    },
    { label: 'Settings',  click: () => { showWindow(); mainWindow.webContents.send('navigate', '/settings'); } },
    { type: 'separator' },
    { label: 'Quit IonMan DNS', click: () => { app.isQuiting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
}

function setTrayConnected(connected) {
  isConnected = connected;
  const iconFile = connected ? 'tray-connected.png' : 'tray-disconnected.png';
  const icon = nativeImage.createFromPath(iconPath(iconFile));
  tray.setImage(icon);
  tray.setToolTip(`IonMan DNS — ${connected ? 'Connected' : 'Disconnected'}`);
  updateTrayMenu();
  mainWindow?.webContents.send('connection-status', { connected });
}

// ─── WireGuard tunnel control ─────────────────────────────────────────────────
function isWireGuardInstalled() {
  return fs.existsSync(WG_EXE);
}

// Derive WireGuard tunnel name from config filename (WG uses filename as service name)
function tunnelNameFromPath(configPath) {
  return path.basename(configPath, '.conf');
}

async function tunnelConnect() {
  const configPath = store.get('configPath');

  if (!isWireGuardInstalled()) {
    return { ok: false, error: 'WireGuard not installed. Download from wireguard.com' };
  }
  if (!configPath || !fs.existsSync(configPath)) {
    return { ok: false, error: 'No VPN config found. Go to Settings → Update VPN Config and log in first.' };
  }

  const wgName = tunnelNameFromPath(configPath); // e.g. 'ionman'

  // Always uninstall existing tunnel first so fresh config is loaded
  await new Promise(r => exec(`"${WG_EXE}" /uninstalltunnelservice "${wgName}"`, () => r()));
  await new Promise(r => setTimeout(r, 800));

  return new Promise((resolve) => {
    exec(`"${WG_EXE}" /installtunnelservice "${configPath}"`, (err, stdout, stderr) => {
      const combined = (stderr || stdout || err?.message || '').toLowerCase();
      if (err) {
        const isAdmin = combined.includes('access') || combined.includes('denied') || combined.includes('privilege') || combined.includes('elevation');
        resolve({
          ok: false,
          error: isAdmin
            ? 'Access denied — right-click IonMan DNS.exe → Run as administrator, then try again.'
            : (stderr || stdout || err.message).trim(),
        });
        return;
      }
      // Wait for service to start, then verify with retries
      const check = (attempts) => {
        setTimeout(() => {
          const status = getTunnelStatus(wgName);
          setTrayConnected(status);
          if (status) {
            resolve({ ok: true });
          } else if (attempts > 1) {
            check(attempts - 1);
          } else {
            resolve({ ok: false, error: 'Tunnel installed but server not responding. Make sure WireGuard is configured on the server for your account.' });
          }
        }, 2000);
      };
      check(3); // try up to 3 times × 2s = 6s total
    });
  });
}

async function tunnelDisconnect() {
  const configPath = store.get('configPath');
  const tunnelName = configPath ? tunnelNameFromPath(configPath) : store.get('tunnelName');
  return new Promise((resolve) => {
    exec(`"${WG_EXE}" /uninstalltunnelservice "${tunnelName}"`, (err) => {
      setTrayConnected(false);
      resolve({ ok: !err });
    });
  });
}

function getTunnelStatus(tunnelNameOrPath) {
  try {
    if (!isWireGuardInstalled()) return false;
    // Accept either a name or a full path — derive name from path if needed
    const name = tunnelNameOrPath.endsWith('.conf') ? tunnelNameFromPath(tunnelNameOrPath) : tunnelNameOrPath;
    const output = execSync(`"${WG_EXE}" show "${name}" 2>&1`, {
      timeout: 3000, encoding: 'utf8'
    });
    return output.includes('interface:') || output.includes('public key:');
  } catch {
    return false;
  }
}

// ─── Status polling ───────────────────────────────────────────────────────────
function startStatusPoll() {
  statusPoll = setInterval(() => {
    const configPath = store.get('configPath');
    const tunnelName = configPath ? tunnelNameFromPath(configPath) : store.get('tunnelName');
    const connected  = getTunnelStatus(tunnelName);
    if (connected !== isConnected) setTrayConnected(connected);
  }, 5000);
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────
ipcMain.handle('get-store', (_, key)        => store.get(key));
ipcMain.handle('set-store', (_, key, value) => { store.set(key, value); return true; });
ipcMain.handle('get-all-store', ()          => store.store);

ipcMain.handle('tunnel-connect',     () => tunnelConnect());
ipcMain.handle('tunnel-disconnect',  () => tunnelDisconnect());
ipcMain.handle('tunnel-status',      () => ({
  connected: isConnected,
  wgInstalled: isWireGuardInstalled(),
}));

ipcMain.handle('save-wg-config', async (_, configText) => {
  try {
    const nameMatch = configText.match(/\[Interface\]/i);
    if (!nameMatch) return { ok: false, error: 'Invalid WireGuard config' };

    // Extract tunnel name from config comment if present
    const nameHint = configText.match(/^#\s*Name\s*=\s*(.+)$/im);
    const tunnelName = (nameHint?.[1]?.trim()) || store.get('tunnelName') || 'IonManDNS';
    store.set('tunnelName', tunnelName);

    const configPath = store.get('configPath');
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, configText, { encoding: 'utf8', mode: 0o600 });

    store.set('setupDone', true);
    return { ok: true, path: configPath, tunnelName };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Open native file picker for .conf files
ipcMain.handle('open-conf-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title:       'Import WireGuard Config',
    buttonLabel: 'Import',
    filters:     [{ name: 'WireGuard Config', extensions: ['conf', 'txt'] }],
    properties:  ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return { ok: false };
  try {
    const text = fs.readFileSync(result.filePaths[0], 'utf8');
    return { ok: true, text, filename: path.basename(result.filePaths[0]) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Open native file picker for QR image, return base64 data URL
ipcMain.handle('open-qr-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title:       'Open WireGuard QR Code Image',
    buttonLabel: 'Open',
    filters:     [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp'] }],
    properties:  ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return { ok: false };
  try {
    const buf  = fs.readFileSync(result.filePaths[0]);
    const ext  = path.extname(result.filePaths[0]).slice(1).toLowerCase();
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    return { ok: true, dataUrl: `data:${mime};base64,${buf.toString('base64')}` };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Subscriber credential login — posts to the IonMan server, returns WireGuard config
ipcMain.handle('subscriber-login', async (_, { serverUrl, email, password }) => {
  const https = require('https');
  const http  = require('http');
  const url   = require('url');

  const base   = serverUrl.replace(/\/+$/, '');
  const parsed = url.parse(base);
  const lib    = parsed.protocol === 'https:' ? https : http;
  // Strip trailing /dns if present in pathname so we can append /api/... cleanly
  const apiBase = (parsed.pathname || '').replace(/\/+$/, '');

  const postData = JSON.stringify({ email, password });

  return new Promise((resolve) => {
    const req = lib.request({
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     apiBase + '/api/subscribe/login',
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'X-IonMan-Client': 'windows-app',
      },
      rejectUnauthorized: false,
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.wg_config) {
            // Save subscriber token for stats API access
            if (data.token) store.set('subToken', data.token);
            resolve({ ok: true, config: data.wg_config, name: data.name || email });
          } else if (data.active === false) {
            // Logged in but subscription expired
            resolve({ ok: false, error: 'Subscription expired. Please renew via GCash: ' + (data.gcash?.number || '09626616298') });
          } else if (data.error) {
            resolve({ ok: false, error: data.error });
          } else {
            resolve({ ok: false, error: 'No WireGuard config in response. Contact admin.' });
          }
        } catch {
          resolve({ ok: false, error: 'Server returned invalid response' });
        }
      });
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.setTimeout(10000, () => { req.destroy(); resolve({ ok: false, error: 'Connection timed out' }); });
    req.write(postData);
    req.end();
  });
});

ipcMain.handle('open-dashboard', () => {
  const url = store.get('serverUrl');
  if (url) shell.openExternal(url);
});

ipcMain.handle('open-external', (_, url) => shell.openExternal(url));

ipcMain.handle('set-auto-start', (_, enable) => {
  app.setLoginItemSettings({ openAtLogin: enable, openAsHidden: true });
  store.set('autoStart', enable);
  return true;
});

ipcMain.handle('check-wg-installed', () => isWireGuardInstalled());

ipcMain.handle('close-window',    () => mainWindow?.hide());
ipcMain.handle('minimize-window', () => mainWindow?.minimize());

ipcMain.handle('wg-tunnel-stats', () => {
  try {
    const configPath = store.get('configPath');
    const tunnelName = configPath ? tunnelNameFromPath(configPath) : store.get('tunnelName');
    const output = execSync(`"${WG_UTIL}" show "${tunnelName}" 2>&1`, {
      timeout: 3000, encoding: 'utf8'
    });
    return { ok: true, raw: output };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function iconPath(file) {
  const full = path.join(ICON_DIR, file);
  return fs.existsSync(full) ? full : path.join(__dirname, 'assets', 'icons', file);
}
