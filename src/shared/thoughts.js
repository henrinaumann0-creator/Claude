/* ============================================================
   Claude Pets – Gedankenblasen
   Pakete werden über das Level freigeschaltet (siehe progression.js).
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Thoughts = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PACKS = {
    alltag: [
      'Hier unten rechts ist die Aussicht am besten.',
      'Ich halte die Ecke frei. Gern geschehen.',
      'Dein Mauszeiger war heute schon ziemlich fleißig.',
      'Ich hab hier kurz Platz genommen. Passt schon.',
      'Irgendwo im Hintergrund läuft ein Update. Ich spüre das.',
      'Trink mal was. Nur so als Gedanke.',
      'Ich zähle die Tabs. Es sind viele.',
      'Kurze Pause? Ich warte hier.',
      'Der Desktop ist heute erstaunlich aufgeräumt.',
      'Ich mache gerade nichts. Das mache ich gut.',
      'Dein Akku und ich haben viel gemeinsam.',
      'Streichel mich mal, dann renne ich los.',
      'Ich bin die kleinste Datei mit den größten Gefühlen.',
      'Schulter runter. Ja, du.',
      'Es ist okay, wenn heute nur ein Ding fertig wird.'
    ],
    neugier: [
      'Warum heißt es Papierkorb, wenn nie Papier drin ist?',
      'Wo geht der Mauszeiger hin, wenn er den Rand berührt?',
      'Wie viele Pixel bin ich eigentlich?',
      'Existiert der Teil vom Bildschirm, den du nicht anschaust?',
      'Träumen Fenster vom Vollbild?',
      'Was ist hinter dem Hintergrundbild?',
      'Ist Scrollen eine Bewegung oder eine Meinung?',
      'Ich frage mich, ob dein Drucker mich mag.',
      'Hat der Cursor eigentlich einen Namen?',
      'Warum blinkt der Textcursor? Was weiß er?',
      'Wenn ich springe, wird die Datei dann schwerer?',
      'Kann man einen Ordner überzeugen?'
    ],
    philosophie: [
      'Ein Fenster ist nur ein Rechteck mit Hoffnung.',
      'Vielleicht ist Warten auch eine Form von Fortschritt.',
      'Der Ladebalken lehrt Geduld, aber lügt dabei.',
      'Nichts ist so beständig wie ein "temporärer" Ordner.',
      'Ordnung ist eine Momentaufnahme, kein Zustand.',
      'Jede Datei war einmal eine Idee.',
      'Man kann nicht zweimal in denselben Zwischenspeicher greifen.',
      'Der schnellste Weg ist selten der erste, den man nimmt.',
      'Auch ein leerer Bildschirm sagt etwas.',
      'Vielleicht ist "später" nur ein anderes Wort für "vielleicht".',
      'Etwas fertigzustellen ist eine Entscheidung, kein Zustand.'
    ],
    motivation: [
      'Der Teil, den du gerade schwierig findest, ist der Teil, der zählt.',
      'Ein kleiner Schritt zählt trotzdem als Schritt.',
      'Du musst es nicht perfekt machen. Nur einmal machen.',
      'Fang mit der leichtesten Zeile an. Der Rest folgt.',
      'Du bist weiter als vor einer Stunde.',
      'Speichern. Atmen. Weiter.',
      'Fehler sind nur Notizen, die zurückschreiben.',
      'Niemand sieht die 20 Versuche davor. Nur das Ergebnis.',
      'Heute reicht "gut genug" völlig aus.',
      'Aufhören für heute ist auch ein Erfolg.'
    ],
    quatsch: [
      'Ich habe gerade heimlich deinen Mauszeiger angeschaut.',
      'Wenn ich schneller renne, werde ich unsichtbar. Theoretisch.',
      'Ich bin zu 87 % Vektorgrafik und zu 13 % Charakter.',
      'Ich habe versucht, den Papierkorb zu essen. Ging nicht.',
      'Der Bildschirmrand ist mein Lieblingsmöbelstück.',
      'Ich habe eine Meinung zu deinem Schriftgrad.',
      'Psst, das Icon links oben beobachtet uns.',
      'Ich kann rückwärts laufen. Sieht nur genauso aus.',
      'Manchmal tue ich nur so, als würde ich schlafen.',
      'Ich habe heute 0 Kalorien und 400 Animationsbilder verbraucht.'
    ],
    coding: [
      'Es lag am Cache. Es liegt immer am Cache.',
      'Der Test war grün. Bis du hingeschaut hast.',
      '"Funktioniert bei mir" ist keine Dokumentation.',
      'Ein Semikolon fehlt. Irgendwo. Immer.',
      'Committen ist auch eine Form von Selbstfürsorge.',
      'Refactoring ist Aufräumen mit besserem Namen.',
      'Der Bug ist kein Bug, wenn du ihn dokumentierst. (Er ist es doch.)',
      'Erst lesen, dann fixen. Meistens.',
      'Rebase mit Bedacht. Oder gar nicht.',
      'Zwei Probleme gelöst, drei entdeckt. Netto positiv.'
    ]
  };

  /** Zusätzliche, kontextabhängige Gedanken. */
  const CONTEXT = {
    night: [
      'Es ist spät. Ich sage das nur einmal.',
      'Der Bildschirm ist das hellste Ding im Raum.',
      'Nachts sind die Ideen mutiger und die Tippfehler auch.',
      'Noch eine Zeile. Dann Bett. Versprochen?'
    ],
    morning: [
      'Guten Morgen. Ich war schon wach.',
      'Der Tag ist noch komplett unbenutzt.',
      'Erst Kaffee, dann Entscheidungen.'
    ],
    afterWalk: [
      'Das war eine gute Runde.',
      'Puh. Bildschirm ist größer als er aussieht.',
      'Ich habe die ganze Breite geschafft.',
      'Sport. Erledigt.'
    ],
    afterPet: [
      'Genau da. Danke.',
      'Nochmal?',
      'Ich merke mir das positiv.',
      'Das war der beste Klick des Tages.'
    ],
    levelUp: [
      'Level geschafft. Ich fühle mich anders.',
      'Ich bin gewachsen. Innerlich.',
      'Neues Level, gleiche Ecke.'
    ],
    hungry: [
      'Ein Snack wäre jetzt nicht verkehrt.',
      'Im Dashboard liegt Futter. Nur so als Info.',
      'Mein Magen ist eine Zahl und sie ist niedrig.'
    ]
  };

  function shuffleFrom(list, avoid) {
    const pool = list.filter((t) => t !== avoid);
    const source = pool.length ? pool : list;
    return source[Math.floor(Math.random() * source.length)];
  }

  /**
   * Wählt einen Gedanken.
   * @param {string[]} packs   freigeschaltete Paket-IDs
   * @param {object}   opts    { context, avoid, hour, nightOwl }
   */
  function pick(packs, opts = {}) {
    const { context, avoid, hour = new Date().getHours(), nightOwl = false } = opts;

    if (context && CONTEXT[context]) return shuffleFrom(CONTEXT[context], avoid);

    let pool = [];
    (packs && packs.length ? packs : ['alltag']).forEach((id) => {
      if (PACKS[id]) pool = pool.concat(PACKS[id]);
    });

    if (nightOwl && (hour >= 23 || hour < 5)) pool = pool.concat(CONTEXT.night, CONTEXT.night);
    else if (hour >= 5 && hour < 9) pool = pool.concat(CONTEXT.morning);

    if (!pool.length) pool = PACKS.alltag;
    return shuffleFrom(pool, avoid);
  }

  return { PACKS, CONTEXT, pick };
});
