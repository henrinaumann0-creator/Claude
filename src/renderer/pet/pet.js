/* ============================================================
   Claude Pets – Verhalten des Overlay-Pets
   ============================================================ */
'use strict';

(() => {
  const $ = (id) => document.getElementById(id);

  const el = {
    pet: $('pet'), art: $('art'), fx: $('fx'), floaters: $('floaters'),
    bubble: $('bubble'), bubbleText: $('bubbleText'), hint: $('hint'),
    menu: $('menu'), menuName: $('menuName'), menuLevel: $('menuLevel'),
    menuBar: $('menuBar'), menuAvatar: $('menuAvatar'),
    toast: $('toast'), toastBadge: $('toastBadge'), toastTitle: $('toastTitle'),
    toastText: $('toastText'), confetti: $('confetti')
  };

  const SIZE = 132;
  const MARGIN = 14;

  const S = {
    snap: null,
    x: 0, y: 0,
    facing: -1,
    mode: 'idle',
    walking: null,
    lastInteraction: Date.now(),
    lastThought: '',
    bubbleTimer: null,
    typeTimer: null,
    thoughtTimer: null,
    idleTimer: null,
    hintShown: false,
    menuOpen: false,
    interactive: false,
    drag: null,
    trailTimer: null
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const view = () => ({ w: window.innerWidth, h: window.innerHeight });


  /* =========================================================
     Frame-Treiber: schaltet die Pixel-Frames im Takt
     ========================================================= */
  const Anim = {
    frames: new Map(),
    current: null,
    timer: null,
    state: 'idle',
    i: 0,
    timelines: {
      idle:     [['idle-0', 1500], ['idle-1', 820]],
      walking:  [['walk-0', 105], ['walk-1', 105], ['walk-2', 105], ['walk-3', 105]],
      sleeping: [['sleep-0', 1500], ['sleep-1', 1500]],
      happy:    [['happy-0', 130], ['happy-1', 130]],
      dragged:  [['happy-0', 220], ['walk-1', 220]],
      eating:   [['idle-0', 170], ['idle-1', 170]]
    },

    bind(container) {
      this.frames = new Map();
      this.current = null;
      container.querySelectorAll('.px-f').forEach((node) => {
        const m = /px-([a-z]+-\d+)/.exec(node.getAttribute('class') || '');
        if (m) this.frames.set(m[1], node);
      });
      this.play(this.state, true);
    },

    show(name) {
      if (this.current) this.current.classList.remove('is-on');
      const node = this.frames.get(name);
      if (node) { node.classList.add('is-on'); this.current = node; }
    },

    play(state, force) {
      const next = this.timelines[state] ? state : 'idle';
      if (!force && this.state === next) return;
      this.state = next;
      this.i = 0;
      this.tick();
    },

    tick() {
      clearTimeout(this.timer);
      const tl = this.timelines[this.state];
      const [name, ms] = tl[this.i % tl.length];
      this.show(name);
      this.i++;

      // Gelegentliches Blinzeln im Ruhezustand
      if (this.state === 'idle' && Math.random() < 0.28) {
        this.timer = setTimeout(() => {
          this.show('blink-0');
          this.timer = setTimeout(() => this.tick(), 130);
        }, ms);
        return;
      }
      this.timer = setTimeout(() => this.tick(), ms);
    }
  };

  /* =========================================================
     Rendern des Charakters
     ========================================================= */
  function renderPet() {
    const eq = (S.snap && S.snap.state.equipped) || {};
    el.art.innerHTML = PetArt.build({
      pet: eq.pet || 'nova',
      palette: eq.palette || 'amber',
      accessory: eq.accessory || null
    });
    Anim.bind(el.art);
    el.menuAvatar.innerHTML = PetArt.build({
      pet: eq.pet || 'nova',
      palette: eq.palette || 'amber',
      accessory: eq.accessory || null,
      static: true
    });
  }

  /* =========================================================
     Position
     ========================================================= */
  function place(x, y, animate) {
    const v = view();
    S.x = clamp(x, MARGIN, v.w - SIZE - MARGIN);
    S.y = clamp(y, MARGIN, v.h - SIZE - MARGIN);
    el.pet.style.setProperty('--x', S.x + 'px');
    el.pet.style.setProperty('--y', S.y + 'px');
    el.pet.style.transition = animate ? 'transform .5s var(--ease-out)' : '';
    el.bubble.dataset.side = S.x + SIZE / 2 > v.w / 2 ? 'right' : 'left';
  }

  function homePosition() {
    const v = view();
    const right = !S.snap || S.snap.state.settings.side !== 'left';
    return {
      x: right ? v.w - SIZE - 28 : 28,
      y: v.h - SIZE - 10
    };
  }

  function goHome() {
    const h = homePosition();
    walkTo(h.x, h.y, { xp: false });
  }

  /* =========================================================
     Zustands-Wechsel
     ========================================================= */
  function setMode(mode) {
    if (S.mode === mode) return;
    el.pet.classList.remove('is-idle', 'is-walking', 'is-happy', 'is-sleeping', 'is-dragged', 'is-eating', 'is-petted');
    S.mode = mode;
    el.pet.classList.add('is-' + mode);
    Anim.play(mode);
    if (mode !== 'walking') stopTrail();
  }

  function pulse(cls, ms) {
    el.pet.classList.add(cls);
    setTimeout(() => el.pet.classList.remove(cls), ms);
  }

  /* =========================================================
     Laufen
     ========================================================= */
  function walkTo(tx, ty, opts = {}) {
    if (S.walking) cancelAnimationFrame(S.walking.raf);

    const v = view();
    tx = clamp(tx, MARGIN, v.w - SIZE - MARGIN);
    ty = clamp(ty, MARGIN, v.h - SIZE - MARGIN);

    const sx = S.x, sy = S.y;
    const dx = tx - sx, dy = ty - sy;
    const dist = Math.hypot(dx, dy);
    if (dist < 6) { arrive(opts); return; }

    const fast = S.snap && S.snap.perks.includes('fast-feet');
    const speed = (fast ? 310 : 205) * (opts.speedFactor || 1);
    const dur = Math.max(320, (dist / speed) * 1000);

    setFacing(dx >= 0 ? 1 : -1);
    setMode('walking');
    el.pet.style.transition = '';
    emit('walkStart');
    startTrail();

    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      // Sanftes An- und Abbremsen
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      // leichte vertikale Wellenbewegung für Lebendigkeit
      const hopArc = Math.sin(p * Math.PI * (dist / 140)) * 3;
      place(sx + dx * e, sy + dy * e - hopArc);
      if (p < 1) S.walking.raf = requestAnimationFrame(step);
      else { S.walking = null; arrive(opts); }
    };
    S.walking = { raf: requestAnimationFrame(step) };
  }

  function arrive(opts = {}) {
    setMode('idle');
    stopTrail();
    if (opts.xp !== false) window.pets.addXp('walk');
    if (opts.thought !== false && Math.random() < 0.55) {
      showThought(Thoughts.pick([], { context: 'afterWalk' }));
    }
  }

  function setFacing(dir) {
    S.facing = dir;
    el.pet.style.setProperty('--face', String(dir));
    el.pet.dataset.facing = dir === 1 ? 'right' : 'left';
  }

  /** Zufälliges Ziel – bevorzugt in der unteren Bildschirmhälfte. */
  function randomTarget() {
    const v = view();
    let tx, ty, tries = 0;
    do {
      tx = rand(MARGIN, v.w - SIZE - MARGIN);
      ty = Math.random() < 0.72
        ? rand(v.h * 0.55, v.h - SIZE - MARGIN)   // meistens unten
        : rand(v.h * 0.15, v.h * 0.6);            // gelegentlich höher
      tries++;
    } while (Math.hypot(tx - S.x, ty - S.y) < 220 && tries < 12);
    return { x: tx, y: ty };
  }

  /* =========================================================
     Gedankenblase
     ========================================================= */
  function showThought(text, opts = {}) {
    if (!text) return;
    clearTimeout(S.bubbleTimer);
    clearInterval(S.typeTimer);
    S.lastThought = text;

    el.bubble.hidden = false;
    el.bubble.classList.remove('is-leaving', 'is-done');
    el.bubbleText.textContent = '';

    // Schreibmaschinen-Effekt
    let i = 0;
    const speed = 22;
    S.typeTimer = setInterval(() => {
      i++;
      el.bubbleText.textContent = text.slice(0, i);
      if (i >= text.length) {
        clearInterval(S.typeTimer);
        el.bubble.classList.add('is-done');
        if (opts.xp !== false) window.pets.addXp('thought');
      }
    }, speed);

    const readMs = Math.max(3200, text.length * 68) + text.length * speed;
    S.bubbleTimer = setTimeout(hideThought, opts.duration || readMs);
  }

  function hideThought() {
    if (el.bubble.hidden) return;
    el.bubble.classList.add('is-leaving');
    setTimeout(() => { el.bubble.hidden = true; el.bubble.classList.remove('is-leaving'); }, 280);
  }

  function scheduleThoughts() {
    clearTimeout(S.thoughtTimer);
    if (!S.snap || !S.snap.state.settings.thoughtsEnabled) return;

    const chatty = S.snap.perks.includes('chatty');
    const base = (S.snap.state.settings.thoughtIntervalSec || 45) * 1000 / (chatty ? 2 : 1);
    const wait = rand(base * 0.7, base * 1.5);

    S.thoughtTimer = setTimeout(() => {
      if (S.mode !== 'sleeping' && S.mode !== 'dragged' && el.bubble.hidden) {
        const hungry = S.snap.hunger < 25 && Math.random() < 0.4;
        showThought(Thoughts.pick(S.snap.thoughtPacks, {
          context: hungry ? 'hungry' : null,
          avoid: S.lastThought,
          nightOwl: S.snap.perks.includes('night-owl')
        }));
      }
      scheduleThoughts();
    }, wait);
  }

  /* =========================================================
     Partikel & Effekte
     ========================================================= */
  function spawn(cls, count, cfg = {}) {
    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'particle particle--' + cls;
      p.style.setProperty('--dx', rand(cfg.dxMin ?? -34, cfg.dxMax ?? 34).toFixed(0) + 'px');
      p.style.setProperty('--dy', rand(cfg.dyMin ?? -70, cfg.dyMax ?? -34).toFixed(0) + 'px');
      p.style.left = rand(24, 76) + '%';
      p.style.top = rand(30, 78) + '%';
      if (cls === 'z') p.textContent = ['z', 'Z', 'z'][i % 3];
      p.style.animationDelay = (i * (cfg.stagger ?? 70)) + 'ms';
      el.fx.appendChild(p);
      setTimeout(() => p.remove(), (cfg.life ?? 1600) + i * (cfg.stagger ?? 70));
    }
  }

  function emit(event) {
    const fx = S.snap && S.snap.state.equipped.effect;
    if (event === 'walkStart' && fx === 'sparkles') spawn('sparkle', 6, { life: 1000 });
    if (event === 'pet' && fx === 'hearts') spawn('heart', 5, { life: 1500, dyMin: -80, dyMax: -50 });
    if (event === 'pet' && fx !== 'hearts') spawn('sparkle', 3, { life: 900 });
    if (event === 'ambient' && fx === 'aurora') spawn('aurora', 1, { life: 2500 });
  }

  function startTrail() {
    stopTrail();
    if (!S.snap || S.snap.state.equipped.effect !== 'stardust') return;
    S.trailTimer = setInterval(() => {
      spawn('dust', 2, { life: 1200, dyMin: 8, dyMax: 26, dxMin: -18, dxMax: 18, stagger: 0 });
    }, 110);
  }
  function stopTrail() { clearInterval(S.trailTimer); S.trailTimer = null; }

  function floatText(text) {
    const f = document.createElement('span');
    f.className = 'floater';
    f.textContent = text;
    el.floaters.appendChild(f);
    setTimeout(() => f.remove(), 1600);
  }

  function confettiBurst(count = 46) {
    const v = view();
    const colors = ['#D97757', '#EFA07C', '#F3C57A', '#FAF9F5', '#B25A3D', '#E7E4DA'];
    for (let i = 0; i < count; i++) {
      const p = document.createElement('i');
      p.className = 'confetti-piece';
      p.style.left = (S.x + SIZE / 2 + rand(-70, 70)) + 'px';
      p.style.top = (S.y + 20) + 'px';
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--dx', rand(-220, 220).toFixed(0) + 'px');
      p.style.setProperty('--dy', rand(-160, -30).toFixed(0) + 'px');
      p.style.setProperty('--rot', rand(-720, 720).toFixed(0) + 'deg');
      p.style.setProperty('--dur', rand(1.6, 2.8).toFixed(2) + 's');
      p.style.animationDelay = rand(0, 260).toFixed(0) + 'ms';
      el.confetti.appendChild(p);
      setTimeout(() => p.remove(), 3400);
    }
    // Zweite Welle: nach unten fallend
    setTimeout(() => {
      for (let i = 0; i < count / 2; i++) {
        const p = document.createElement('i');
        p.className = 'confetti-piece';
        p.style.left = rand(v.w * 0.35, v.w * 0.95) + 'px';
        p.style.top = '-20px';
        p.style.background = colors[(i + 2) % colors.length];
        p.style.setProperty('--dx', rand(-80, 80).toFixed(0) + 'px');
        p.style.setProperty('--dy', (v.h + 60) + 'px');
        p.style.setProperty('--rot', rand(-900, 900).toFixed(0) + 'deg');
        p.style.setProperty('--dur', rand(2.4, 3.6).toFixed(2) + 's');
        el.confetti.appendChild(p);
        setTimeout(() => p.remove(), 4200);
      }
    }, 220);
  }

  /* =========================================================
     Level-Up
     ========================================================= */
  let toastTimer = null;
  function showLevelUp(info) {
    const rewards = info.rewards || [];
    el.toastBadge.textContent = info.to;
    el.toastTitle.textContent = `Level ${info.to} erreicht!`;
    el.toastText.textContent = rewards.length
      ? `Freigeschaltet: ${rewards.map((r) => r.name).join(', ')}`
      : 'Weiter so – die nächste Belohnung wartet.';

    el.toast.hidden = false;
    el.toast.classList.remove('is-leaving');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.classList.add('is-leaving');
      setTimeout(() => { el.toast.hidden = true; }, 360);
    }, 5200);

    setMode('happy');
    setTimeout(() => setMode('idle'), 1300);
    confettiBurst();
    spawn('sparkle', 10, { life: 1200 });
    showThought(Thoughts.pick([], { context: 'levelUp' }), { xp: false });
  }

  /* =========================================================
     Interaktion
     ========================================================= */
  function wake() {
    S.lastInteraction = Date.now();
    if (S.mode === 'sleeping') { setMode('idle'); scheduleThoughts(); }
    resetIdleTimer();
  }

  function resetIdleTimer() {
    clearTimeout(S.idleTimer);
    S.idleTimer = setTimeout(() => {
      if (S.mode === 'idle' && !S.drag) {
        setMode('sleeping');
        hideThought();
        const sleepZ = setInterval(() => {
          if (S.mode !== 'sleeping') return clearInterval(sleepZ);
          spawn('z', 3, { life: 2700, stagger: 320 });
        }, 3000);
        spawn('z', 3, { life: 2700, stagger: 320 });
      }
    }, 150000);
  }

  async function onPetClick() {
    wake();
    const res = await window.pets.addXp('pet');
    if (res && res.gained) floatText(`+${res.gained} XP`);
    emit('pet');
    pulse('is-petted', 460);

    if (Math.random() < 0.35) showThought(Thoughts.pick([], { context: 'afterPet' }), { xp: false });

    // Linksklick schickt das Pet auf einen zufälligen Streifzug
    setTimeout(() => {
      const t = randomTarget();
      walkTo(t.x, t.y);
    }, 380);
  }

  /* --- Maus: Ziehen, Klicken, Menü --- */
  el.art.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    wake();
    S.drag = {
      startX: e.screenX, startY: e.screenY,
      offX: e.clientX - S.x, offY: e.clientY - S.y,
      moved: false
    };
    if (S.walking) { cancelAnimationFrame(S.walking.raf); S.walking = null; setMode('idle'); }
  });

  window.addEventListener('mousemove', (e) => {
    if (S.drag) {
      const dist = Math.hypot(e.screenX - S.drag.startX, e.screenY - S.drag.startY);
      if (dist > 5) {
        if (!S.drag.moved) { S.drag.moved = true; setMode('dragged'); hideThought(); }
        place(e.clientX - S.drag.offX, e.clientY - S.drag.offY);
      }
    }
    updateHover(e.clientX, e.clientY);
  });

  window.addEventListener('mouseup', (e) => {
    if (!S.drag) return;
    const moved = S.drag.moved;
    S.drag = null;
    if (moved) {
      setMode('idle');
      // Sanft auf den Boden absetzen
      const v = view();
      const floorY = v.h - SIZE - 10;
      if (S.y < floorY - 40) {
        place(S.x, S.y);
        walkTo(S.x, floorY, { xp: false, thought: false, speedFactor: 1.6 });
      }
    } else if (e.button === 0) {
      onPetClick();
    }
  });

  el.art.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    wake();
    openMenu(e.clientX, e.clientY);
  });

  el.art.addEventListener('mouseenter', () => {
    el.pet.classList.add('is-hovered');
    if (!S.hintShown) {
      S.hintShown = true;
      el.hint.hidden = false;
      setTimeout(() => { el.hint.hidden = true; }, 4200);
    }
    wake();
  });
  el.art.addEventListener('mouseleave', () => el.pet.classList.remove('is-hovered'));

  /* =========================================================
     Kontextmenü
     ========================================================= */
  function openMenu(cx, cy) {
    S.menuOpen = true;
    el.menu.hidden = false;
    el.menu.classList.remove('is-leaving');

    const v = view();
    const rect = { w: 232, h: 300 };
    const left = cx + rect.w > v.w ? cx - rect.w : cx;
    const top = cy + rect.h > v.h ? cy - rect.h : cy;
    el.menu.style.left = clamp(left, 8, v.w - rect.w - 8) + 'px';
    el.menu.style.top = clamp(top, 8, v.h - rect.h - 8) + 'px';
    el.menu.style.setProperty('--origin', `${cy + rect.h > v.h ? 'bottom' : 'top'} ${cx + rect.w > v.w ? 'right' : 'left'}`);
    syncMenu();
  }

  function closeMenu() {
    if (!S.menuOpen) return;
    S.menuOpen = false;
    el.menu.classList.add('is-leaving');
    setTimeout(() => { el.menu.hidden = true; el.menu.classList.remove('is-leaving'); }, 140);
  }

  function syncMenu() {
    if (!S.snap) return;
    el.menuName.textContent = S.snap.state.petName;
    el.menuLevel.textContent = S.snap.isMax
      ? `Level ${S.snap.level} · Max`
      : `Level ${S.snap.level} · ${S.snap.xpInLevel}/${S.snap.xpForNext} XP`;
    el.menuBar.style.width = Math.round(S.snap.progress * 100) + '%';
  }

  el.menu.addEventListener('click', async (e) => {
    const btn = e.target.closest('.menu-item');
    if (!btn) return;
    const action = btn.dataset.action;
    closeMenu();
    wake();

    if (action === 'walk') { const t = randomTarget(); walkTo(t.x, t.y); }
    if (action === 'thought') {
      showThought(Thoughts.pick(S.snap.thoughtPacks, {
        avoid: S.lastThought, nightOwl: S.snap.perks.includes('night-owl')
      }));
    }
    if (action === 'sleep') { setMode('sleeping'); hideThought(); spawn('z', 3, { life: 2700, stagger: 320 }); }
    if (action === 'dashboard') window.pets.openDashboard();
    if (action === 'remove') {
      el.pet.style.transition = 'transform .35s var(--ease-out), opacity .35s var(--ease-out)';
      el.pet.style.opacity = '0';
      el.pet.style.transform += ' scale(.6)';
      setTimeout(() => window.pets.hidePet(), 320);
    }
  });

  window.addEventListener('mousedown', (e) => {
    if (S.menuOpen && !el.menu.contains(e.target) && !el.art.contains(e.target)) closeMenu();
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeMenu(); hideThought(); } });

  /* =========================================================
     Klick-Durchlässigkeit (Hit-Testing)
     ========================================================= */
  function inRect(r, x, y, pad = 0) {
    return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
  }

  function updateHover(x, y) {
    let hit = false;
    if (S.drag) hit = true;
    else {
      const petRect = el.art.getBoundingClientRect();
      // Etwas engere Trefferfläche, damit Klicks daneben durchgehen
      hit = inRect({
        left: petRect.left + 14, right: petRect.right - 14,
        top: petRect.top + 10, bottom: petRect.bottom - 4
      }, x, y);
      if (!hit && !el.bubble.hidden) hit = inRect(el.bubble.getBoundingClientRect(), x, y, 4);
      if (!hit && S.menuOpen) hit = inRect(el.menu.getBoundingClientRect(), x, y, 8);
    }
    if (hit !== S.interactive) {
      S.interactive = hit;
      window.pets.setInteractive(hit);
      if (!hit) el.pet.classList.remove('is-hovered');
    }
  }

  /* =========================================================
     Autonomes Verhalten
     ========================================================= */
  function autonomy() {
    setInterval(() => {
      if (!S.snap || !S.snap.state.settings.wander) return;
      if (S.mode !== 'idle' || S.drag || S.menuOpen) return;
      if (Date.now() - S.lastInteraction < 40000) return;

      const r = Math.random();
      const home = homePosition();
      const awayFromHome = Math.hypot(S.x - home.x, S.y - home.y) > 200;

      if (awayFromHome && r < 0.5) goHome();
      else if (r < 0.22) { const t = randomTarget(); walkTo(t.x, t.y, { xp: false }); }
      else if (r < 0.3) emit('ambient');
    }, 22000);
  }

  /* =========================================================
     Zustand vom Hauptprozess
     ========================================================= */
  function applySnapshot(snap, prevSnap) {
    S.snap = snap;
    el.pet.style.setProperty('--size', SIZE + 'px');

    const eq = snap.state.equipped;
    const changed = !prevSnap ||
      prevSnap.state.equipped.pet !== eq.pet ||
      prevSnap.state.equipped.palette !== eq.palette ||
      prevSnap.state.equipped.accessory !== eq.accessory;
    if (changed) renderPet();

    if (S.menuOpen) syncMenu();
    if (!prevSnap || prevSnap.state.settings.thoughtIntervalSec !== snap.state.settings.thoughtIntervalSec
        || prevSnap.state.settings.thoughtsEnabled !== snap.state.settings.thoughtsEnabled) {
      scheduleThoughts();
    }
  }

  window.pets.onState((snap) => {
    const prev = S.snap;
    applySnapshot(snap, prev);
    if (snap.levelUp) showLevelUp(snap.levelUp);
    if (snap.reset) { place(homePosition().x, homePosition().y, true); }
  });

  window.pets.onCommand((cmd) => {
    wake();
    if (cmd.type === 'walk') { const t = randomTarget(); walkTo(t.x, t.y); }
    if (cmd.type === 'thought') {
      showThought(Thoughts.pick(S.snap ? S.snap.thoughtPacks : [], { avoid: S.lastThought }));
    }
    if (cmd.type === 'celebrate') {
      setMode('happy'); setTimeout(() => setMode('idle'), 1300);
      confettiBurst(30);
      if (cmd.text) showThought(cmd.text, { xp: false });
    }
    if (cmd.type === 'eat') {
      setMode('eating');
      floatText('Mmh!');
      spawn('heart', 4, { life: 1400 });
      setTimeout(() => setMode('idle'), 1800);
    }
    if (cmd.type === 'play') {
      setMode('happy');
      confettiBurst(18);
      setTimeout(() => { setMode('idle'); const t = randomTarget(); walkTo(t.x, t.y, { xp: false }); }, 1200);
    }
  });

  window.pets.onResized(() => {
    place(S.x, S.y);
    if (S.mode === 'idle') { const h = homePosition(); place(Math.min(S.x, h.x), Math.min(S.y, h.y)); }
  });
  window.addEventListener('resize', () => place(S.x, S.y));

  /* =========================================================
     Start
     ========================================================= */
  (async function init() {
    const snap = await window.pets.getState();
    applySnapshot(snap, null);

    const home = homePosition();
    place(home.x, home.y + 60);
    setFacing(-1);
    requestAnimationFrame(() => {
      el.pet.style.transition = 'transform .8s var(--ease-spring)';
      place(home.x, home.y);
      setTimeout(() => { el.pet.style.transition = ''; }, 850);
    });

    setMode('idle');
    resetIdleTimer();
    scheduleThoughts();
    autonomy();

    setTimeout(() => {
      showThought(`Hallo! Ich bin ${snap.state.petName}. Klick mich an – dann laufe ich los.`, { xp: false });
    }, 1400);
  })();
})();
