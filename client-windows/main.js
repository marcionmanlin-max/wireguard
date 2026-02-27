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

async function tunnelConnect() {
  const configPath  = store.get('configPath');
  const tunnelName  = store.get('tunnelName');

  if (!isWireGuardInstalled()) {
    mainWindow?.webContents.send('wg-error', 'WireGuard is not installed. Please install it from wireguard.com');
    return { ok: false, error: 'WireGuard not installed' };
  }
  if (!fs.existsSync(configPath)) {
    mainWindow?.webContents.send('wg-error', 'No VPN config found. Please import your peer config in Settings.');
    return { ok: false, error: 'No config' };
  }

  return new Promise((resolve) => {
    // Install tunnel as Windows service (requires admin — app runs as admin)
    exec(`"${WG_EXE}" /installtunnelservice "${configPath}"`, (err, stdout, stderr) => {
      if (err && !err.message.includes('already installed')) {
        resolve({ ok: false, error: err.message });
        return;
      }
      // Wait briefly for service to start
      setTimeout(() => {
        const status = getTunnelStatus(tunnelName);
        setTrayConnected(status);
        resolve({ ok: status });
      }, 1500);
    });
  });
}

async function tunnelDisconnect() {
  const tunnelName = store.get('tunnelName');
  return new Promise((resolve) => {
    exec(`"${WG_EXE}" /uninstalltunnelservice "${tunnelName}"`, (err) => {
      setTrayConnected(false);
      resolve({ ok: !err });
    });
  });
}

function getTunnelStatus(tunnelName) {
  try {
    if (!isWireGuardInstalled()) return false;
    const output = execSync(`"${WG_EXE}" show "${tunnelName}" 2>&1`, {
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
    const tunnelName = store.get('tunnelName');
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
    // Parse tunnel name from config
    const nameMatch = configText.match(/\[Interface\]/i);
    if (!nameMatch) return { ok: false, error: 'Invalid WireGuard config' };

    const configPath = store.get('configPath');
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, configText, { encoding: 'utf8', mode: 0o600 });

    store.set('setupDone', true);
    return { ok: true, path: configPath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
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
    const tunnelName = store.get('tunnelName');
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
