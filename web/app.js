/* ============================================================
   Claude Pets – Web-Hülle
   Verbindet die geteilte Oberfläche mit Browser-Eigenheiten:
   Laufbereich des Pets, Tab-Wechsel, PWA-Installation.
   ============================================================ */
'use strict';

(() => {
  const TABBAR_BREAKPOINT = 860;
  const isNarrow = () => window.innerWidth < TABBAR_BREAKPOINT;

  let currentView = 'home';

  /* ---------------------------------------------------------
     Laufbereich: Kopfzeile und Tab-Leiste bleiben frei.
     Auf allen Seiten außer der Übersicht parkt das Pet in der Ecke,
     damit es keine Inhalte verdeckt.
     --------------------------------------------------------- */
  function chrome() {
    if (!isNarrow()) return { top: 0, bottom: 0 };
    const bar = document.querySelector('.topbar');
    const tabs = document.querySelector('.sidebar');
    return {
      top: bar ? Math.round(bar.getBoundingClientRect().height) : 52,
      bottom: tabs ? Math.round(tabs.getBoundingClientRect().height) : 66
    };
  }

  window.__petRoam = () => {
    const c = chrome();
    const size = window.__petSize || 132;
    const full = {
      x: 0,
      y: c.top,
      w: window.innerWidth,
      h: Math.max(size + 40, window.innerHeight - c.top - c.bottom)
    };
    if (currentView === 'home') return full;

    // Geparkte Ecke
    const boxW = Math.min(size + 60, full.w);
    return {
      x: full.x + full.w - boxW,
      y: full.y + full.h - (size + 26),
      w: boxW,
      h: size + 26
    };
  };

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
    // Pet neu einordnen (pet.js hört auf resize)
    window.dispatchEvent(new Event('resize'));
  }

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
  const stage = document.getElementById('stage');
  const topLevel = document.getElementById('topLevel');

  function applySnapshot(snap) {
    if (stage) stage.hidden = !snap.state.settings.visible;
    if (topLevel) topLevel.textContent = snap.level;
  }

  window.pets.onState(applySnapshot);
  window.pets.getState().then((snap) => {
    applySnapshot(snap);
    window.pets._checkDailyBonus();
  });

  /* ---------------------------------------------------------
     Größenänderungen / Bildschirmdrehung
     --------------------------------------------------------- */
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => window.pets._emitResize(window.__petRoam()), 180);
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
