/* ============================================================
   Claude Pets – Web-Hülle
   Verbindet die geteilte Oberfläche mit Browser-Eigenheiten:
   Laufbereich des Pets, Tab-Wechsel, PWA-Installation.
   ============================================================ */
'use strict';

(() => {
  let currentView = 'home';

  /* ---------------------------------------------------------
     Laufbereich: Kopfzeile und Tab-Leiste bleiben frei.
     Auf allen Seiten außer der Übersicht parkt das Pet in der Ecke,
     damit es keine Inhalte verdeckt.
     --------------------------------------------------------- */
  const yard = () => document.getElementById('petYard');

  /** Höhe von Kopfzeile und Tab-Leiste, damit beide frei bleiben. */
  function chrome() {
    if (window.innerWidth >= 861) return { top: 0, bottom: 0 };
    const bar = document.querySelector('.topbar');
    const tabs = document.querySelector('.sidebar');
    return {
      top: bar ? Math.round(bar.getBoundingClientRect().height) : 52,
      bottom: tabs ? Math.round(tabs.getBoundingClientRect().height) : 66
    };
  }

  /**
   * Das Pet lebt im Browser auf einem eigenen Spielplatz und läuft
   * ausschließlich dort – so verdeckt es nie Text oder Schaltflächen.
   */
  window.__petRoam = () => {
    const box = yard();
    const size = window.__petSize || 132;
    if (!box) return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
    const r = box.getBoundingClientRect();
    const c = chrome();
    const padX = 8;

    // Der Laufbereich ist der Spielplatz, zusätzlich beschnitten auf das,
    // was gerade sichtbar ist – so gerät das Pet nie unter Kopfzeile
    // oder Tab-Leiste, egal wie weit gescrollt wurde.
    const top = Math.max(r.top + 10, c.top + 6);
    const bottom = Math.min(r.bottom - 8, window.innerHeight - c.bottom - 6);

    return {
      x: r.left + padX,
      y: top,
      w: Math.max(size + 24, r.width - padX * 2),
      h: Math.max(size + 16, bottom - top)
    };
  };

  /** Sichtbar nur, wenn der Spielplatz auch wirklich zu sehen ist. */
  function yardVisible() {
    if (currentView !== 'home') return false;
    const box = yard();
    if (!box) return false;
    const r = box.getBoundingClientRect();
    const size = window.__petSize || 132;
    const c = chrome();
    const shown = Math.min(r.bottom, window.innerHeight - c.bottom) - Math.max(r.top, c.top);
    return shown > size * 0.9;
  }

  /* ---------------------------------------------------------
     Ansichts-Wechsel
     --------------------------------------------------------- */
  function activeView() {
    const on = document.querySelector('.nav-item.is-active');
    return on ? on.dataset.view : 'home';
  }

  function syncView() {
    const next = activeView();
    if (next === currentView) return;
    currentView = next;
    document.body.dataset.view = next;
    // Jede Ansicht beginnt oben – sonst landet man mitten in einer Liste
    const content = document.querySelector('.content');
    if (content) content.scrollTop = 0;
    refreshStage(true);
  }

  let lastVisible = null;
  function refreshStage(recenter) {
    const stageEl = document.getElementById('stage');
    if (!stageEl) return;

    const wanted = petEnabled && yardVisible();
    if (wanted !== lastVisible) {
      lastVisible = wanted;
      stageEl.classList.toggle('is-away', !wanted);
    }
    if (!wanted) return;

    if (recenter && typeof window.__petGoHome === 'function') window.__petGoHome();
    else if (typeof window.__petReplace === 'function') window.__petReplace();
  }

  /* Beim Scrollen wandert der Spielplatz mit – das Pet folgt ihm. */
  let scrollFrame = null;
  const onScroll = () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => { scrollFrame = null; refreshStage(false); });
  };
  document.addEventListener('scroll', onScroll, true);

  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => setTimeout(syncView, 0));
  });

  window.__pets_openView = (view) => {
    const btn = document.querySelector(`.nav-item[data-view="${view}"]`);
    if (btn) btn.click();
  };

  document.body.dataset.view = 'home';

  /* ---------------------------------------------------------
     Sichtbarkeit des Pets & Level in der Kopfzeile
     --------------------------------------------------------- */
  const topLevel = document.getElementById('topLevel');
  let petEnabled = true;

  function applySnapshot(snap) {
    petEnabled = !!snap.state.settings.visible;
    if (topLevel) topLevel.textContent = snap.level;
    refreshStage(false);
  }

  window.pets.onState(applySnapshot);
  window.pets.getState().then((snap) => {
    applySnapshot(snap);
    setTimeout(() => refreshStage(true), 60);
    window.pets._checkDailyBonus();
  });

  /* ---------------------------------------------------------
     Größenänderungen / Bildschirmdrehung
     --------------------------------------------------------- */
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      window.pets._emitResize(window.__petRoam());
      refreshStage(true);
    }, 180);
  });

  // Echte Höhe auf mobilen Browsern (dynamische Adressleiste)
  const setVH = () => document.documentElement.style.setProperty('--vh', window.innerHeight + 'px');
  setVH();
  window.addEventListener('resize', setVH);
  window.addEventListener('orientationchange', () => setTimeout(setVH, 220));

  /* ---------------------------------------------------------
     PWA: Installation & Service Worker
     --------------------------------------------------------- */
  let installPrompt = null;
  const installBtn = document.getElementById('installBtn');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    if (installBtn) installBtn.hidden = false;
  });

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      installBtn.hidden = true;
    });
  }

  window.addEventListener('appinstalled', () => {
    if (installBtn) installBtn.hidden = true;
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => {
        console.warn('[pets] Service Worker nicht registriert:', err.message);
      });
    });
  }

  /* ---------------------------------------------------------
     Texte an den Browser anpassen
     --------------------------------------------------------- */
  (function adaptCopy() {
    const touch = window.matchMedia('(pointer: coarse)').matches;

    const setRow = (inputId, title, note) => {
      const input = document.getElementById(inputId);
      if (!input) return;
      const row = input.closest('.row-toggle, .row-slider');
      if (!row) return;
      const strong = row.querySelector('strong');
      const small = row.querySelector('small');
      if (title && strong) strong.textContent = title;
      if (note && small) small.textContent = note;
      return row;
    };

    setRow('setVisible', 'Pet anzeigen', 'Begleiter über der App einblenden');
    setRow('setWander', 'Frei herumlaufen', 'Läuft auf der Übersicht von allein los');

    // Autostart gibt es im Browser nicht
    const auto = document.getElementById('setAutostart');
    if (auto) {
      const row = auto.closest('.row-toggle');
      if (row) row.hidden = true;
    }

    // Lieblingsecke-Beschreibung
    const side = document.getElementById('setSide');
    if (side) {
      const small = side.closest('.row-slider')?.querySelector('small');
      if (small) small.textContent = 'Wo dein Pet sich hinsetzt';
    }

    const foot = document.querySelector('.foot');
    if (foot) {
      foot.textContent = touch
        ? 'Claude Pets · Web · Tippen zum Streicheln, Halten öffnet das Menü.'
        : 'Claude Pets · Web · Rechtsklick auf das Pet öffnet das Schnellmenü.';
    }

    const sub = document.querySelector('.view[data-view="settings"] .sub');
    if (sub) sub.textContent = 'Verhalten, Erscheinungsbild und Spielstand.';
  })();

  /* ---------------------------------------------------------
     Kleine Anpassungen für den Browser
     --------------------------------------------------------- */
  // Auf Touch-Geräten gibt es kein Kontextmenü per Rechtsklick –
  // der Hinweis-Chip erklärt stattdessen das Langdrücken.
  if (window.matchMedia('(pointer: coarse)').matches) {
    const hint = document.getElementById('hint');
    if (hint) {
      hint.innerHTML =
        '<span class="pet-hint-key">Tippen</span> laufen' +
        '<span class="pet-hint-sep"></span>' +
        '<span class="pet-hint-key">Halten</span> Menü';
    }
  }

  // Doppeltipp-Zoom auf dem Pet unterbinden
  document.addEventListener('gesturestart', (e) => e.preventDefault());
})();
