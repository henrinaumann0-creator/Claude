// Prüft, ob der naive Reflex "einfach direkt aufs Ziel zielen" schon gewinnt.
const { load } = require('./core.js');
const M = load();
const { LEVELS, DT, makeWorld, step, launch, goalPos } = M;
const D2R = Math.PI / 180;

function run(li, t0, a, p){
  const w = makeWorld(li);
  while (w.tick < t0) step(w, null);
  launch(w, a * D2R, p);
  const guard = w.tick + Math.ceil((w.lv.tmax + 1) / DT);
  while (w.st === 'fly' && w.tick < guard) step(w, null);
  return w.st;
}
function directAngle(li, t0){
  const lv = LEVELS[li], P = {x:0, y:0};
  goalPos(lv, t0 * DT, P);
  return Math.atan2(P.y - lv.start.y, P.x - lv.start.x) / D2R;
}
// Wie weit muss man vom direkten Zielen abweichen, bis es klappt?
function naive(li){
  const lv = LEVELS[li], t0 = (lv.sol && lv.sol.t0) || 0;
  const d = directAngle(li, t0);
  let best = null, crash = 0, tot = 0;
  for (let off = 0; off <= 60; off += 0.5) {
    for (const s of (off === 0 ? [0] : [-1, 1])) {
      const a = d + off * s;
      for (let p = 0.15; p <= 1.0001; p += 0.01) {
        const st = run(li, t0, a, p);
        if (off <= 5) { tot++; if (st === 'dead') crash++; }
        if (st === 'win' && best === null) best = {off, s, p};
      }
    }
    if (best) break;
  }
  return {direct:+d.toFixed(1), ref:lv.sol ? lv.sol.a : null,
          needOff: best ? best.off : 99, atPow: best ? +best.p.toFixed(2) : null};
}
for (const n of process.argv.slice(2).map(Number)) {
  const r = naive(n - 1);
  console.log(`L${n}: direkte Zielrichtung ${r.direct}°, Referenz ${r.ref}°  ->  ` +
    (r.needOff === 0 ? 'direktes Zielen gewinnt sofort' :
     `mindestens ${r.needOff}° daneben zielen (dann bei Stärke ${r.atPow})`));
}
