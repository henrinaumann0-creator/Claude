// Referenzlösung für die Treibstoff-Level: Suche über Abschuss und einen Burn,
// anschließend lokale Verfeinerung auf Fairness und Bahncharakter.
const fs = require('fs');
const P = require('./pocket.js');
const S = require('./solve.js');
const M = P.M;
const D2R = Math.PI / 180;
const FAR = 600;

function mk(a, v, bt, dur, phi){
  return { t0:0, a, v, th:[{t0:bt, t1:bt + dur, x:Math.cos(phi * D2R) * FAR, y:Math.sin(phi * D2R) * FAR}], bt, dur, phi };
}
function evalSol(li, s){
  const r = S.fly(li, 0, s.a, s.v, s.th, false);
  if (!r.win) return null;
  const f = S.fair(li, s);
  return { r, f, s:S.score(r, {v:s.v}, f, li) + (s.bt > 1.2 ? 25 : 0) };
}

function solve(li){
  const lv = M.LEVELS[li];
  const t0s = []; for (let t = 0.2; t <= 9.01; t += 0.4) t0s.push(+t.toFixed(2));
  const phis = []; for (let f = 0; f < 360; f += 15) phis.push(f);
  const hits = P.thrustSearch(li, {aStep:6, pStep:0.2, t0s, phis, durs:[lv.fuel]});
  if (!hits.length) return {err:'keine Schublösung'};
  const scored = [];
  for (const h of hits) {
    const s = mk(h.a, h.v, h.th[0].t0, h.th[0].t1 - h.th[0].t0,
                 Math.round(Math.atan2(h.th[0].y, h.th[0].x) / D2R));
    const e = evalSol(li, s);
    if (e) scored.push({sol:s, ...e});
  }
  scored.sort((a, b) => b.s - a.s);
  let best = null;
  for (const c of scored.slice(0, 25)) {
    let cur = c.sol;
    let curE = c;
    for (const [dA, dV, dT, dP, dD] of [[3, 0.08, 0.2, 8, 0.2], [1, 0.03, 0.08, 3, 0.08], [0.3, 0.01, 0.03, 1, 0.03]]) {
      let improved = true, guard = 0;
      while (improved && guard++ < 14) {
        improved = false;
        for (const k of ['a', 'v', 'bt', 'phi', 'dur']) {
          for (const sgn of [-1, 1]) {
            const n = {...cur};
            if (k === 'a') n.a += sgn * dA;
            if (k === 'v') n.v += sgn * dV;
            if (k === 'bt') n.bt += sgn * dT;
            if (k === 'phi') n.phi += sgn * dP;
            if (k === 'dur') n.dur += sgn * dD;
            if (n.v < 0.15 || n.v > 1 || n.bt < 0.05 || n.dur < 0.15 || n.dur > lv.fuel) continue;
            const s2 = mk(n.a, n.v, n.bt, n.dur, n.phi);
            const e = evalSol(li, s2);
            if (e && e.s > curE.s) { cur = {...n}; curE = e; improved = true; }
          }
        }
      }
    }
    if (!best || (curE.f > best.f) || (curE.f === best.f && curE.s > best.s)) best = {...curE, sol:mk(cur.a, cur.v, cur.bt, cur.dur, cur.phi)};
  }
  const sol = { t0:0, a:+best.sol.a.toFixed(4), v:+best.sol.v.toFixed(5),
    th:[{ t0:+best.sol.th[0].t0.toFixed(4), t1:+best.sol.th[0].t1.toFixed(4),
          x:+best.sol.th[0].x.toFixed(3), y:+best.sol.th[0].y.toFixed(3) }] };
  const cps = S.placeCps(li, sol);
  const r = S.fly(li, 0, sol.a, sol.v, sol.th, false);
  return { level:li + 1, sol, cps, f:best.f, s:+best.s.toFixed(1), hits:hits.length,
           turn:+r.turn.toFixed(2), peri:+r.peri.toFixed(2), flight:+r.flight.toFixed(2) };
}

const li = Number(process.argv[2]) - 1;
const out = solve(li);
fs.writeFileSync(process.argv[3], JSON.stringify(out));
console.log(JSON.stringify(out));
