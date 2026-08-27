/* ============================================================
   Claude Pets – Hauptprozess
   • Transparentes, klick-durchlässiges Overlay für das Pet
   • Dashboard-Fenster mit Level, XP und Belohnungen
   • Tray-Menü, XP-Logik, Persistenz
   ============================================================ */
'use strict';

const { app, BrowserWindow, ipcMain, screen, Tray, Menu, shell, nativeImage } = require('electron');
const path = require('path');

const { Store } = require('./store');
const Progression = require('../shared/progression');
const Achievements = require('../shared/achievements');

const IS_DEV = process.argv.includes('--dev');
const ASSETS = path.join(__dirname, '..', 'assets');

let store = null;
let overlayWin = null;
let dashboardWin = null;
let tray = null;
let idleTimer = null;
let interactive = false;

/* Nur eine Instanz zulassen */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => openDashboard());
}

/* ------------------------------------------------------------
   Abgeleiteter Zustand
   ------------------------------------------------------------ */
const HUNGER_FULL_MS = 12 * 60 * 60 * 1000; // 12 h von satt auf hungrig
const PLAY_COOLDOWN_MS = 30 * 60 * 1000;

function hungerOf(state) {
  const since = Date.now() - (state.lastFedAt || state.createdAt || Date.now());
  return Math.max(0, Math.min(100, Math.round(100 - (since / HUNGER_FULL_MS) * 100)));
}

function snapshot() {
  const s = store.get();
  const prog = Progression.levelFromTotalXp(s.totalXp);
  const unlocked = Progression.unlocked(prog.level);
  return {
    achievements: Achievements.summary(s, prog.level),
    state: s,
    level: prog.level,
    xpInLevel: prog.xpInLevel,
    xpForNext: prog.xpForNext,
    progress: prog.progress,
    isMax: prog.isMax,
    totalXp: s.totalXp,
    hunger: hungerOf(s),
    canFeed: hungerOf(s) <= 75,
    canPlay: Date.now() - (s.lastPlayedAt || 0) > PLAY_COOLDOWN_MS,
    playReadyIn: Math.max(0, PLAY_COOLDOWN_MS - (Date.now() - (s.lastPlayedAt || 0))),
    unlockedIds: unlocked.map((r) => r.id),
    nextReward: Progression.nextReward(prog.level),
    thoughtPacks: unlocked.filter((r) => r.type === 'thoughts').map((r) => r.id),
    perks: unlocked.filter((r) => r.type === 'perk').map((r) => r.id)
  };
}

function broadcast(extra) {
  const payload = Object.assign(snapshot(), extra || {});
  for (const win of [overlayWin, dashboardWin]) {
    if (win && !win.isDestroyed()) win.webContents.send('state:update', payload);
  }
  updateTrayTitle(payload);
}

/* ------------------------------------------------------------
   Erfolge
   ------------------------------------------------------------ */
/**
 * Wertet die Erfolge aus, schreibt neu erreichte fort und schenkt die
 * zugehoerigen XP. Da die XP wiederum ein Level ausloesen koennen,
 * laeuft das in wenigen Durchgaengen, bis nichts Neues mehr dazukommt.
 */
function checkAchievements() {
  const gained = [];
  for (let pass = 0; pass < 3; pass++) {
    const s = store.get();
    const level = Progression.levelFromTotalXp(s.totalXp).level;
    const res = Achievements.evaluate(s, level);
    if (!res.newly.length) break;
    store.update({ achievements: res.all, totalXp: s.totalXp + res.xp });
    gained.push(...res.newly);
  }
  return gained;
}

/* ------------------------------------------------------------
   XP-Vergabe
   ------------------------------------------------------------ */
const lastEventAt = Object.create(null);

function addXp(kind, multiplier = 1) {
  const def = Progression.XP_EVENTS[kind];
  if (!def) return null;

  const now = Date.now();
  if (def.cooldownMs && now - (lastEventAt[kind] || 0) < def.cooldownMs) {
    return { gained: 0, throttled: true };
  }
  lastEventAt[kind] = now;

  const s = store.get();
  const before = Progression.levelFromTotalXp(s.totalXp).level;

  let amount = def.amount * multiplier;
  if (kind === 'pet' && Progression.isUnlocked('big-heart', before)) amount *= 1.5;
  amount = Math.max(1, Math.round(amount));

  const totalXp = s.totalXp + amount;
  const after = Progression.levelFromTotalXp(totalXp).level;

  const statKey = { pet: 'pets', walk: 'walks', thought: 'thoughts', feed: 'feeds', play: 'plays', idle: 'minutes' }[kind];
  const patch = { totalXp };
  if (statKey) patch.stats = { [statKey]: (s.stats[statKey] || 0) + 1 };
  if (kind === 'pet') {
    const hour = new Date().getHours();
    if (hour >= 23 || hour < 5) patch.stats = Object.assign(patch.stats || {}, { nightPets: (s.stats.nightPets || 0) + 1 });
    else if (hour >= 5 && hour < 8) patch.stats = Object.assign(patch.stats || {}, { morningPets: (s.stats.morningPets || 0) + 1 });
  }
  if (after > before) patch.stats = Object.assign(patch.stats || {}, { levelUps: (s.stats.levelUps || 0) + (after - before) });
  store.update(patch);

  const earned = checkAchievements();
  const finalLevel = Progression.levelFromTotalXp(store.get().totalXp).level;

  const leveledUp = finalLevel > before;
  const newRewards = [];
  if (leveledUp) {
    for (let lvl = before + 1; lvl <= finalLevel; lvl++) newRewards.push(...Progression.rewardsAtLevel(lvl));
  }

  const extra = {};
  if (leveledUp) extra.levelUp = { from: before, to: finalLevel, rewards: newRewards };
  if (earned.length) extra.achievementsUnlocked = earned;
  broadcast(Object.keys(extra).length ? extra : null);

  return { gained: amount, leveledUp, level: finalLevel, rewards: newRewards, achievements: earned };
}

/* ------------------------------------------------------------
   Overlay-Fenster
   ------------------------------------------------------------ */
function overlayBounds() {
  const display = screen.getPrimaryDisplay();
  return display.workArea;
}

function createOverlay() {
  const b = overlayBounds();

  overlayWin = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    show: false,
    backgroundColor: '#00000000',
    title: 'Claude Pets',
    icon: path.join(ASSETS, 'icon-256.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWin.setIgnoreMouseEvents(true, { forward: true });
  overlayWin.loadFile(path.join(__dirname, '..', 'renderer', 'pet', 'index.html'));

  overlayWin.once('ready-to-show', () => {
    if (store.get().settings.visible) overlayWin.showInactive();
  });

  overlayWin.on('closed', () => { overlayWin = null; });

  if (IS_DEV) overlayWin.webContents.openDevTools({ mode: 'detach' });

  const resize = () => {
    if (!overlayWin || overlayWin.isDestroyed()) return;
    const nb = overlayBounds();
    overlayWin.setBounds(nb);
    overlayWin.webContents.send('overlay:resized', nb);
  };
  screen.on('display-metrics-changed', resize);
  screen.on('display-added', resize);
  screen.on('display-removed', resize);
}

function setOverlayVisible(visible) {
  store.update({ settings: { visible } });
  if (!overlayWin || overlayWin.isDestroyed()) { if (visible) createOverlay(); }
  else if (visible) { overlayWin.showInactive(); overlayWin.setAlwaysOnTop(true, 'screen-saver'); }
  else overlayWin.hide();
  broadcast();
  buildTrayMenu();
}

/* ------------------------------------------------------------
   Dashboard-Fenster
   ------------------------------------------------------------ */
function openDashboard() {
  if (dashboardWin && !dashboardWin.isDestroyed()) {
    if (dashboardWin.isMinimized()) dashboardWin.restore();
    dashboardWin.show();
    dashboardWin.focus();
    return;
  }

  dashboardWin = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 880,
    minHeight: 600,
    show: false,
    title: 'Claude Pets',
    backgroundColor: '#FAF9F5',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    icon: path.join(ASSETS, 'icon-256.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  dashboardWin.setMenuBarVisibility(false);
  dashboardWin.loadFile(path.join(__dirname, '..', 'renderer', 'dashboard', 'index.html'));
  dashboardWin.once('ready-to-show', () => dashboardWin.show());
  dashboardWin.on('closed', () => { dashboardWin = null; });

  dashboardWin.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (IS_DEV) dashboardWin.webContents.openDevTools({ mode: 'right' });
}

/* ------------------------------------------------------------
   Tray
   ------------------------------------------------------------ */
function buildTrayMenu() {
  if (!tray) return;
  const snap = snapshot();
  const menu = Menu.buildFromTemplate([
    { label: `${snap.state.petName} · Level ${snap.level}`, enabled: false },
    { label: `${snap.xpInLevel} / ${snap.isMax ? '∞' : snap.xpForNext} XP`, enabled: false },
    { type: 'separator' },
    { label: 'Dashboard öffnen', click: () => openDashboard() },
    {
      label: 'Pet anzeigen',
      type: 'checkbox',
      checked: !!snap.state.settings.visible,
      click: (item) => setOverlayVisible(item.checked)
    },
    { label: 'Spazieren gehen', click: () => overlayWin && overlayWin.webContents.send('pet:command', { type: 'walk' }) },
    { label: 'Gedanke zeigen', click: () => overlayWin && overlayWin.webContents.send('pet:command', { type: 'thought' }) },
    { type: 'separator' },
    { label: 'Beenden', click: () => { store.flush(); app.exit(0); } }
  ]);
  tray.setContextMenu(menu);
}

function updateTrayTitle(snap) {
  if (!tray) return;
  tray.setToolTip(`Claude Pets · ${snap.state.petName} · Level ${snap.level}`);
}

function createTray() {
  const img = nativeImage.createFromPath(path.join(ASSETS, 'tray.png'));
  tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img.resize({ width: 18, height: 18 }));
  tray.on('click', () => openDashboard());
  buildTrayMenu();
  updateTrayTitle(snapshot());
}

/* ------------------------------------------------------------
   Täglicher Bonus & passive XP
   ------------------------------------------------------------ */
function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function checkDailyBonus() {
  const s = store.get();
  const today = dayKey();
  if (s.lastSeenDay === today) return;

  const yesterday = dayKey(new Date(Date.now() - 86400000));
  const streak = s.lastSeenDay === yesterday ? (s.streak || 0) + 1 : 1;

  store.update({
    lastSeenDay: today,
    streak,
    bestStreak: Math.max(s.bestStreak || 0, streak)
  });

  const bonusMultiplier = Math.min(3, 1 + (streak - 1) * 0.15);
  const result = addXp('dailyBonus', bonusMultiplier);
  if (result && result.gained && overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.webContents.send('pet:command', {
      type: 'celebrate',
      text: `Tag ${streak} in Folge! +${result.gained} XP`
    });
  }
}

function startIdleXp() {
  clearInterval(idleTimer);
  idleTimer = setInterval(() => {
    if (!store.get().settings.visible) return;
    addXp('idle');
  }, 60 * 1000);
}

/* ------------------------------------------------------------
   IPC
   ------------------------------------------------------------ */
function registerIpc() {
  ipcMain.handle('state:get', () => snapshot());

  ipcMain.handle('xp:add', (_e, kind, multiplier) => addXp(kind, multiplier || 1));

  ipcMain.handle('pet:equip', (_e, slot, id) => {
    const valid = ['pet', 'accessory', 'palette', 'effect'];
    if (!valid.includes(slot)) return snapshot();
    const level = Progression.levelFromTotalXp(store.get().totalXp).level;
    if (id !== null && !Progression.isUnlocked(id, level)) return snapshot();
    store.update({ equipped: { [slot]: id } });
    if (id) {
      const listKey = { accessory: 'worn', pet: 'petsTried', palette: 'palettesTried' }[slot];
      if (listKey) {
        const list = store.get()[listKey] || [];
        if (!list.includes(id)) store.update({ [listKey]: list.concat(id) });
      }
    }
    if (slot === 'pet' && id) {
      const reward = Progression.byId(id);
      if (reward) store.update({ petName: reward.name });
    }
    const earned = checkAchievements();
    broadcast(earned.length ? { equipChanged: slot, achievementsUnlocked: earned }
                            : { equipChanged: slot });
    buildTrayMenu();
    return snapshot();
  });

  ipcMain.handle('pet:rename', (_e, name) => {
    const clean = String(name || '').trim().slice(0, 18);
    if (clean) store.update({ petName: clean });
    broadcast();
    buildTrayMenu();
    return snapshot();
  });

  ipcMain.handle('pet:feed', () => {
    const snap = snapshot();
    if (!snap.canFeed) return { ok: false, reason: 'not-hungry' };
    store.update({ lastFedAt: Date.now() });
    const res = addXp('feed');
    if (overlayWin && !overlayWin.isDestroyed()) {
      overlayWin.webContents.send('pet:command', { type: 'eat' });
    }
    return { ok: true, xp: res && res.gained };
  });

  ipcMain.handle('pet:play', () => {
    const snap = snapshot();
    if (!snap.canPlay) return { ok: false, reason: 'cooldown', readyIn: snap.playReadyIn };
    store.update({ lastPlayedAt: Date.now() });
    const res = addXp('play');
    if (overlayWin && !overlayWin.isDestroyed()) {
      overlayWin.webContents.send('pet:command', { type: 'play' });
    }
    return { ok: true, xp: res && res.gained };
  });

  ipcMain.handle('settings:set', (_e, patch) => {
    store.update({ settings: patch || {} });
    if (Object.prototype.hasOwnProperty.call(patch || {}, 'visible')) setOverlayVisible(!!patch.visible);
    if (Object.prototype.hasOwnProperty.call(patch || {}, 'launchOnStartup') && app.isPackaged) {
      app.setLoginItemSettings({ openAtLogin: !!patch.launchOnStartup, openAsHidden: true });
    }
    broadcast();
    buildTrayMenu();
    return snapshot();
  });

  ipcMain.handle('rewards:markSeen', (_e, ids) => {
    const s = store.get();
    const set = new Set(s.seenRewards || []);
    (Array.isArray(ids) ? ids : [ids]).forEach((id) => id && set.add(id));
    store.update({ seenRewards: Array.from(set) });
    return snapshot();
  });

  ipcMain.handle('save:export', () => {
    store.flush();
    return Buffer.from(JSON.stringify(store.get()), 'utf8').toString('base64');
  });

  ipcMain.handle('save:import', (_e, code) => {
    try {
      const json = Buffer.from(String(code || '').trim(), 'base64').toString('utf8');
      const parsed = JSON.parse(json);
      if (typeof parsed !== 'object' || typeof parsed.totalXp !== 'number') throw new Error('Ungültig');
      store.reset();
      store.update(parsed);
      store.flush();
      broadcast({ reset: true });
      buildTrayMenu();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: 'Der Code konnte nicht gelesen werden.' };
    }
  });

  ipcMain.handle('state:reset', () => {
    store.reset();
    broadcast({ reset: true });
    buildTrayMenu();
    return snapshot();
  });

  ipcMain.handle('stat:track', (_e, key, amount) => {
    const allowed = ['drags', 'distance'];
    if (!allowed.includes(key)) return false;
    const s = store.get();
    store.update({ stats: { [key]: (s.stats[key] || 0) + Math.max(0, Math.round(amount || 1)) } });
    const earned = checkAchievements();
    if (earned.length) broadcast({ achievementsUnlocked: earned });
    return true;
  });

  ipcMain.handle('pet:command', (_e, type) => {
    if (!overlayWin || overlayWin.isDestroyed()) return false;
    if (!store.get().settings.visible) setOverlayVisible(true);
    overlayWin.webContents.send('pet:command', { type });
    return true;
  });

  ipcMain.handle('dashboard:open', () => { openDashboard(); return true; });

  ipcMain.handle('overlay:hide', () => { setOverlayVisible(false); return true; });

  ipcMain.handle('app:quit', () => { store.flush(); app.exit(0); });

  ipcMain.on('overlay:interactive', (_e, on) => {
    if (!overlayWin || overlayWin.isDestroyed()) return;
    const next = !!on;
    if (next === interactive) return;
    interactive = next;
    overlayWin.setIgnoreMouseEvents(!next, { forward: true });
  });

  ipcMain.on('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
  ipcMain.on('window:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());
}

/* ------------------------------------------------------------
   App-Lebenszyklus
   ------------------------------------------------------------ */
app.whenReady().then(() => {
  store = new Store(path.join(app.getPath('userData'), 'pet-state.json'));

  if (process.platform === 'darwin' && app.dock) app.dock.hide();
  app.setAppUserModelId('de.henri.claudepets');

  registerIpc();
  createOverlay();
  createTray();
  checkAchievements();
  checkDailyBonus();
  startIdleXp();

  setInterval(() => broadcast(), 30 * 1000); // Hunger/Cooldowns aktualisieren

  app.on('activate', () => { if (!overlayWin) createOverlay(); });
});

app.on('window-all-closed', (e) => { e.preventDefault(); }); // Tray-App bleibt am Leben
app.on('before-quit', () => { if (store) store.flush(); });
