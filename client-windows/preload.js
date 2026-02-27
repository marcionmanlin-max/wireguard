/**
 * Preload script — exposes safe IPC bridge to renderer via contextBridge.
 * No Node.js APIs exposed directly; everything goes through typed channels.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ionman', {
  // Store
  getStore:     (key)         => ipcRenderer.invoke('get-store', key),
  setStore:     (key, value)  => ipcRenderer.invoke('set-store', key, value),
  getAllStore:   ()            => ipcRenderer.invoke('get-all-store'),

  // Tunnel
  connect:      ()            => ipcRenderer.invoke('tunnel-connect'),
  disconnect:   ()            => ipcRenderer.invoke('tunnel-disconnect'),
  status:       ()            => ipcRenderer.invoke('tunnel-status'),
  tunnelStats:  ()            => ipcRenderer.invoke('wg-tunnel-stats'),
  saveConfig:   (text)        => ipcRenderer.invoke('save-wg-config', text),

  // Navigation
  openDashboard:  ()          => ipcRenderer.invoke('open-dashboard'),
  openExternal:   (url)       => ipcRenderer.invoke('open-external', url),

  // Window
  close:          ()          => ipcRenderer.invoke('close-window'),
  minimize:       ()          => ipcRenderer.invoke('minimize-window'),

  // System
  setAutoStart:   (enable)    => ipcRenderer.invoke('set-auto-start', enable),
  checkWG:        ()          => ipcRenderer.invoke('check-wg-installed'),

  // Events from main
  onStatus:       (cb)        => ipcRenderer.on('connection-status', (_, data) => cb(data)),
  onError:        (cb)        => ipcRenderer.on('wg-error',          (_, msg)  => cb(msg)),
  onNavigate:     (cb)        => ipcRenderer.on('navigate',          (_, path) => cb(path)),

  // Remove listeners
  removeAllListeners: (ch)    => ipcRenderer.removeAllListeners(ch),
});
