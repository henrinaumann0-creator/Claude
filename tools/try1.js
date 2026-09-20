// Probiert Geometrien für Level 1 durch und bewertet sie.
const { load } = require('./core.js');
const M = load();
const { LEVELS, DT, makeWorld, step, launch, goalPos } = M;
const D2R = Math.PI / 180;

function apply(cand){
  const lv = LEVELS[0];
  lv.start = {x:cand.sx, y:cand.sy};
  lv.goal = {x:cand.gx, y:cand.gy};
  lv.tmax = cand.tmax || 30;
  const b = lv.bodies[0];
  b.x = cand.px; b.y = cand.py; b.mu = cand.mu; b.rc = cand.rc;
  b.soft = b.rc * 0.85; b.s2 = b.soft * b.soft;
  lv.cps = [];
}
function run(a, p){
  const w = makeWorld(0);
  launch(w, a * D2R, p);
  const guard = Math.ceil((w.lv.tmax + 1) / DT);
  let turn = 0, peri = 1e9, ph = Math.atan2(w.vy, w.vx);
  const P = {x:0, y:0}, b = w.lv.bodies[0];
  while (w.st === 'fly' && w.tick < guard) {
    step(w, null);
    peri = Math.min(peri, Math.hypot(b.x - w.x, b.y - w.y) / b.rc);
    const h = Math.atan2(w.vy, w.vx);
    let dh = h - ph; while (dh > Math.PI) dh -= 2*Math.PI; while (dh < -Math.PI) dh += 2*Math.PI;
    turn += Math.abs(dh); ph = h;
  }
  return {st:w.st, turn, peri, flight:(w.tick - w.lt) * DT};
}
function evaluate(cand){
  apply(cand);
  const lv = LEVELS[0];
  const d = Math.atan2(lv.goal.y - lv.start.y, lv.goal.x - lv.start.x) / D2R;
  // naives Zielen
  let need = 99;
  outer: for (let off = 0; off <= 60; off += 0.5)
    for (const s of (off === 0 ? [0] : [-1, 1]))
      for (let p = 0.15; p <= 1.0001; p += 0.01)
        if (run(d + off * s, p).st === 'win') { need = off; break outer; }
  // Gesamtfenster + beste Bahn
  let hit = 0, n = 0, best = null;
  for (let a = 0; a < 360; a += 1)
    for (let p = 0.15; p <= 1.0001; p += 0.02) {
      n++;
      const r = run(a, p);
      if (r.st !== 'win') continue;
      hit++;
      const cost = Math.abs(r.turn - 1.0) + Math.abs(Math.log(Math.max(1.05, r.peri) / 1.9)) + Math.abs(p - 0.55);
      if (!best || cost < best.cost) best = {a, p, cost, ...r};
    }
  return {name:cand.name, direct:+d.toFixed(1), need, frac:+(100*hit/n).toFixed(2), wins:hit,
          best: best ? {a:best.a, p:+best.p.toFixed(2), turn:+best.turn.toFixed(2),
                        peri:+best.peri.toFixed(2), flight:+best.flight.toFixed(1)} : null};
}

const cands = [
  {name:'A Planet mittig, mu 2600 rc 15', sx:-80, sy:0, gx:80, gy:0, px:0, py:0, mu:2600, rc:15},
  {name:'B Planet mittig, mu 3400 rc 18', sx:-80, sy:0, gx:80, gy:0, px:0, py:0, mu:3400, rc:18},
  {name:'C leicht schräg, mu 2800 rc 16', sx:-78, sy:18, gx:78, gy:-18, px:0, py:0, mu:2800, rc:16},
  {name:'D Ziel versetzt, mu 2600 rc 16', sx:-80, sy:0, gx:62, gy:-54, px:0, py:0, mu:2600, rc:16},
  {name:'E Planet aus der Mitte, mu 3000 rc 16', sx:-80, sy:0, gx:80, gy:0, px:-14, py:0, mu:3000, rc:16}
];
for (const c of cands) {
  const r = evaluate(c);
  console.log(`${r.name.padEnd(36)} direkt ${String(r.direct).padStart(6)}° | naiv: ` +
    (r.need === 0 ? 'gewinnt sofort ' : `${String(r.need).padStart(4)}° daneben`) +
    ` | Fenster ${String(r.frac).padStart(5)} % | beste Bahn ` +
    (r.best ? `a=${r.best.a}° v=${r.best.p} Drehung ${r.best.turn} Abstand ${r.best.peri}·rc Flug ${r.best.flight}s` : 'keine'));
}
