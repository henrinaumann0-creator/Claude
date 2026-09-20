// Misst, wie leicht ein Level zu treffen ist: Anteil gewinnender Abschüsse
// und die Toleranz rund um die Referenzlösung.
const { load } = require('./core.js');
const M = load();
const { LEVELS, DT, makeWorld, step, launch, goalPos } = M;
const D2R = Math.PI / 180;

function win(li, t0, a, p){
  const w = makeWorld(li);
  while (w.tick < t0) step(w, null);
  launch(w, a * D2R, p);
  const guard = w.tick + Math.ceil((w.lv.tmax + 1) / DT);
  while (w.st === 'fly' && w.tick < guard) step(w, null);
  return w.st === 'win';
}

function basin(li, t0){
  let n = 0, hit = 0;
  for (let a = 0; a < 360; a += 0.5)
    for (let p = 0.15; p <= 1.0001; p += 0.01) { n++; if (win(li, t0, a, p)) hit++; }
  return {n, hit, frac: hit / n};
}

// Größte Abweichung, die noch trifft (einseitig gesucht, in Grad bzw. relativ).
function tol(li, sol){
  const t0 = sol.t0 || 0;
  let dA = 0;
  for (let d = 0.1; d <= 30; d += 0.1) {
    if (win(li, t0, sol.a + d, sol.v) || win(li, t0, sol.a - d, sol.v)) dA = d; else break;
  }
  let dP = 0;
  for (let d = 0.002; d <= 0.6; d += 0.002) {
    if (win(li, t0, sol.a, sol.v * (1 + d)) || win(li, t0, sol.a, sol.v * (1 - d))) dP = d; else break;
  }
  return {dA:+dA.toFixed(1), dP:+(dP * 100).toFixed(1)};
}

if (require.main === module) {
  for (const n of process.argv.slice(2).map(Number)) {
    const li = n - 1, lv = LEVELS[li];
    const b = basin(li, lv.sol.t0 || 0);
    const t = tol(li, lv.sol);
    console.log(`L${n}: Trefferanteil ${(b.frac*100).toFixed(2)} % (${b.hit}/${b.n})  ` +
                `Toleranz um die Referenz: ±${t.dA}° / ±${t.dP} % Stärke`);
  }
}
module.exports = { basin, tol, win };
