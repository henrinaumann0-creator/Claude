/* ============================================================
   Claude Pets – Preload-Brücke (contextIsolation: true)
   ============================================================ */
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pets', {
  /* Lesen */
  getState: () => ipcRenderer.invoke('state:get'),
  onState: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('state:update', handler);
    return () => ipcRenderer.removeListener('state:update', handler);
  },
  onCommand: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('pet:command', handler);
    return () => ipcRenderer.removeListener('pet:command', handler);
  },
  onResized: (cb) => {
    const handler = (_e, bounds) => cb(bounds);
    ipcRenderer.on('overlay:resized', handler);
    return () => ipcRenderer.removeListener('overlay:resized', handler);
  },

  /* Schreiben */
  addXp: (kind, multiplier) => ipcRenderer.invoke('xp:add', kind, multiplier),
  equip: (slot, id) => ipcRenderer.invoke('pet:equip', slot, id),
  rename: (name) => ipcRenderer.invoke('pet:rename', name),
  feed: () => ipcRenderer.invoke('pet:feed'),
  command: (type) => ipcRenderer.invoke('pet:command', type),
  play: () => ipcRenderer.invoke('pet:play'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  markRewardsSeen: (ids) => ipcRenderer.invoke('rewards:markSeen', ids),
  resetProgress: () => ipcRenderer.invoke('state:reset'),
  exportSave: () => ipcRenderer.invoke('save:export'),
  importSave: (code) => ipcRenderer.invoke('save:import', code),

  /* Fenster / Overlay */
  openDashboard: () => ipcRenderer.invoke('dashboard:open'),
  hidePet: () => ipcRenderer.invoke('overlay:hide'),
  quit: () => ipcRenderer.invoke('app:quit'),
  setInteractive: (on) => ipcRenderer.send('overlay:interactive', !!on),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  closeWindow: () => ipcRenderer.send('window:close'),

  platform: process.platform
});
