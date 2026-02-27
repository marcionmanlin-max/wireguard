# IonMan DNS — Windows Client

A lightweight Windows tray app that manages your IonMan DNS WireGuard VPN connection and shows live DNS stats.

## Features

- **System tray icon** — green when connected, red when disconnected
- **One-click connect / disconnect** — manages the WireGuard tunnel as a Windows service
- **Live stats** — queries today, blocked count, cache hits pulled from your IonMan API
- **WireGuard tunnel info** — data transferred, endpoint, last handshake
- **Setup wizard** — paste your WireGuard peer config and go
- **Auto-start** — optionally launch at Windows startup
- **Always-on VPN** — auto-reconnect on startup and after sleep/hibernate
- **Open Dashboard** — one click to your full web dashboard in the browser
- **NSIS installer** — single `.exe` for end users

## Requirements

| Software | Where to get it |
|---|---|
| [WireGuard for Windows](https://www.wireguard.com/install/) | Required on the Windows machine |
| Node.js 18+ | For building the app |
| IonMan DNS server | Running on your VPS |

> The installer will prompt to download WireGuard if it's not found.

## Quick Start (for users)

1. Download `IonManDNS-Setup-1.0.0.exe` from Releases
2. Run the installer (requires admin — needed to install the WireGuard tunnel service)
3. On first launch, enter your server URL (e.g. `https://your-server.com`)
4. Paste your WireGuard peer config from the dashboard (WireGuard → your peer → Download Config)
5. Click **Connect** — done

## Build from Source

```bash
cd client-windows

# 1. Install dependencies
npm install

# 2. Copy icons from parent project
python prepare-icons.py

# 3. Convert icon-512x512.png to icon.ico (requires ImageMagick on the build machine)
magick assets/icons/icon-512x512.png assets/icons/icon.ico

# 4. Build installer (Windows only — run on a Windows machine or CI)
npm run build:installer
# Output: dist-electron/IonManDNS Setup 1.0.0.exe

# 5. Build portable .exe (no install required)
npm run build:portable
# Output: dist-electron/IonManDNS 1.0.0.exe
```

## Cross-compiling on Linux (for CI)

```bash
# Install Wine + required build tools
sudo apt install -y wine64 wine32 libc6-i386

npm install
npm run build
# electron-builder will use Wine to produce the Windows .exe
```

## Project Layout

```
client-windows/
  main.js                  Electron main process (tray, WireGuard IPC, store)
  preload.js               Context bridge (safe IPC to renderer)
  vite.renderer.config.js  Vite config for the React renderer
  installer.nsh            NSIS hooks (WireGuard check on install/uninstall)
  prepare-icons.py         Copy icons from parent project
  src/
    index.html             Renderer HTML entry
    main.jsx               React entry point
    App.jsx                Root — titlebar, nav, screen router
    index.css              Global styles (dark theme)
    components/
      Setup.jsx            First-launch wizard (3 steps)
      Home.jsx             Connect/disconnect + status
      Stats.jsx            DNS stats + WireGuard tunnel stats
      Settings.jsx         Server URL, autostart, always-on, config update
  assets/
    icons/                 PNG icons + icon.ico (generated — not in git)
  renderer/                Built output (generated — not in git)
  dist-electron/           Installer output (generated — not in git)
```

## How WireGuard Control Works

The app uses the official WireGuard for Windows CLI:

```
# Connect (installs tunnel as a Windows Service — requires admin)
"C:\Program Files\WireGuard\wireguard.exe" /installtunnelservice "C:\Users\...\AppData\Roaming\ionman-dns-client\ionman.conf"

# Disconnect
"C:\Program Files\WireGuard\wireguard.exe" /uninstalltunnelservice "IonManDNS"

# Status / stats
"C:\Program Files\WireGuard\wg.exe" show "IonManDNS"
```

The app requests **administrator privileges** (`requestedExecutionLevel: requireAdministrator` in `package.json`) so it can install/remove the tunnel service. This is the same model as the official WireGuard UI.

## Config Storage

All settings are stored in `%APPDATA%\ionman-dns-client\config.json` (managed by `electron-store`).
The WireGuard `.conf` file is saved to `%APPDATA%\ionman-dns-client\ionman.conf` with `0600` permissions.

Neither file is synced or uploaded anywhere.

## Always-on VPN (Kill Switch)

Enable "Always-on VPN" in Settings. The app will:
- Auto-connect on launch
- Auto-reconnect after sleep/hibernate (via `powerMonitor` resume event)

For a true kill switch (block all traffic without VPN), set your WireGuard peer config to:
```ini
[Interface]
...

[Peer]
AllowedIPs = 0.0.0.0/0, ::/0   # Route ALL traffic through the tunnel
```

Then in Windows Settings → Network → VPN → your connection → **Block connections without VPN**.
