// Sucht für jedes Level eine 3-Sterne-Referenzlösung mit gutem Swing-by-
// Charakter und legt die Messpunkte auf die gefundene Bahn.
const fs = require('fs');
const { load } = require('./core.js');
const M = load();
const { LEVELS, DT, makeWorld, step, launch, bpos, goalPos, GOAL_R, R_OUT, VMAX } = M;
const D2R = Math.PI / 180;

function fly(li, t0, angDeg, pow, th, wantPath){
  const w = makeWorld(li);
  while (w.tick < t0) step(w, null);
  launch(w, angDeg * D2R, pow);
  const lv = w.lv;
  const guard = w.tick + Math.ceil((lv.tmax + 1) / DT);
  const P = {x:0, y:0};
  let best = 1e9, turn = 0, peri = 1e9, ph = Math.atan2(w.vy, w.vx);
  const peris = lv.bodies.map(() => 1e9);
  const path = wantPath ? [] : null;
  while (w.st === 'fly' && w.tick < guard) {
    step(w, inpAt(th, w));
    const t = w.tick * DT;
    goalPos(lv, t, P);
    const d = Math.hypot(P.x - w.x, P.y - w.y);
    if (d < best) best = d;
    for (let bi = 0; bi < lv.bodies.length; bi++) {
      const b = lv.bodies[bi];
      if (b.mu <= 0) continue;
      bpos(b, t, P);
      const q = Math.hypot(P.x - w.x, P.y - w.y) / b.rc;
      if (q < peri) peri = q;
      if (q < peris[bi]) peris[bi] = q;
    }
    const h = Math.atan2(w.vy, w.vx);
    let dh = h - ph; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
    turn += Math.abs(dh); ph = h;
    if (wantPath) path.push(w.tick, w.x, w.y);
  }
  return { win:w.st === 'win', why:w.why, best, turn, peri, peris, ticks:w.tick,
           flight:(w.tick - w.lt) * DT, path, w };
}
function inpAt(th, w){
  if (!th) return null;
  const rt = (w.tick - w.lt) * DT;
  for (const s of th) if (rt >= s.t0 && rt < s.t1) return {thrust:true, tx:s.x, ty:s.y};
  return null;
}

const FAIR = [];
for (const da of [-0.5, 0, 0.5]) for (const dp of [-0.01, 0, 0.01]) FAIR.push([da, dp]);
function fair(li, s){
  let ok = 0;
  for (const [da, dp] of FAIR) if (fly(li, s.t0 || 0, s.a + da, s.v * (1 + dp), s.th, false).win) ok++;
  return ok;
}

function t0List(lv, n){
  let per = 0;
  for (const b of lv.bodies) if (b.orb) per = Math.max(per, b.orb.T);
  if (lv.goal.orb) per = Math.max(per, lv.goal.orb.T);
  if (!per) return [0];
  const out = [];
  n = n || 14;
  for (let i = 0; i < n; i++) out.push(Math.round(i * per / n / DT));
  return out;
}

// Bewertung: Fairness zuerst, dann Bahncharakter (Ablenkung, sauberer
// Vorbeiflugabstand, nicht am Stärkeanschlag, kurze Flugzeit).
// Pro Level ein gewünschter Bahncharakter: Gesamtablenkung, Vorbeiflugabstand
// (in Körperradien) und ob zwei Körper eng passiert werden sollen.
const TARGET = {
  1:{turn:1.00, peri:2.0}, 2:{turn:1.70, peri:2.2}, 3:{turn:2.60, peri:1.9},
  4:{turn:1.60, peri:2.2}, 5:{turn:1.40, peri:2.2}, 6:{turn:1.80, peri:2.2},
  7:{turn:3.40, peri:2.0, both:true}, 8:{turn:2.20, peri:2.4},
  9:{turn:1.00, peri:2.4}, 10:{turn:1.60, peri:2.2},
  11:{turn:1.80, peri:2.2, both:true}, 12:{turn:2.40, peri:2.2}
};
function score(r, c, f, li){
  const W = TARGET[li + 1] || {turn:1.5, peri:2.3};
  let s = f * 400;
  s -= Math.abs(r.turn - W.turn) * 45;
  if (c.v > 0.86) s -= (c.v - 0.86) * 350;
  if (c.v < 0.38) s -= (0.38 - c.v) * 350;
  const pr = Math.max(1.05, Math.min(r.peri, 14));
  s -= Math.abs(Math.log(pr / W.peri)) * 30;
  s -= Math.max(0, r.flight - 20) * 2.0;
  if (W.both) {
    const q = r.peris.filter(v => v < 1e8).sort((a, b) => a - b);
    if (q.length > 1) s -= Math.max(0, Math.min(q[1], 14) - 4.0) * 25;
  }
  return s;
}

function sweep(li){
  const lv = LEVELS[li];
  const ts = t0List(lv);
  const moving = ts.length > 1;
  const aStep = moving ? 2.0 : 1.0;
  const pStep = moving ? 0.035 : 0.02;
  const wins = [];
  for (const t0 of ts)
    for (let a = 0; a < 360; a += aStep)
      for (let p = 0.16; p <= 1.0001; p += pStep) {
        const r = fly(li, t0, a, p, null, false);
        if (r.win) wins.push({c:{t0, a, v:p}, r});
      }
  return wins;
}

function refine(li, c0){
  let cur = {...c0};
  let bestF = fair(li, cur), bestS = score(fly(li, cur.t0 || 0, cur.a, cur.v, cur.th, false), cur, bestF, li);
  for (const [aR, pR] of [[0.4, 0.008], [0.15, 0.003], [0.06, 0.0012]]) {
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
      const cand = {t0:cur.t0, a:cur.a + i * aR, v:cur.v + j * pR, th:cur.th};
      if (cand.v < 0.12 || cand.v > 1) continue;
      const r = fly(li, cand.t0 || 0, cand.a, cand.v, cand.th, false);
      if (!r.win) continue;
      const f = fair(li, cand);
      const s = score(r, cand, f, li);
      if (s > bestS) { bestS = s; cur = cand; bestF = f; }
    }
  }
  return {sol:cur, f:bestF, s:bestS};
}

function placeCps(li, sol){
  const lv = LEVELS[li];
  const r = fly(li, sol.t0 || 0, sol.a, sol.v, sol.th, true);
  if (!r.win) return null;
  const P = {x:0, y:0};
  const N = r.path.length / 3;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const tick = r.path[i*3], x = r.path[i*3+1], y = r.path[i*3+2], t = tick * DT;
    let minB = 1e9;
    for (const b of lv.bodies) { bpos(b, t, P); minB = Math.min(minB, Math.hypot(P.x-x, P.y-y) - b.rc); }
    goalPos(lv, t, P);
    const dg = Math.hypot(P.x-x, P.y-y);
    const ds = Math.hypot(lv.start.x-x, lv.start.y-y);
    const ok = minB > 5.0 && dg > 15 && ds > 16 && Math.hypot(x, y) < R_OUT - 6;
    pts.push({x, y, ok, f:i / (N - 1)});
  }
  const pick = [];
  for (const target of [0.24, 0.52, 0.80]) {
    let bp = null, bd = 1e9;
    for (const p of pts) {
      if (!p.ok) continue;
      if (pick.some(q => Math.hypot(q.x-p.x, q.y-p.y) < 19)) continue;
      const d = Math.abs(p.f - target);
      if (d < bd) { bd = d; bp = p; }
    }
    if (!bp) return null;
    pick.push(bp);
  }
  return pick.map(p => ({x:+p.x.toFixed(3), y:+p.y.toFixed(3)}));
}

function solveLevel(li){
  const t = Date.now();
  const wins = sweep(li);
  if (!wins.length) return {err:'keine Lösung', ms:Date.now() - t};
  for (const wn of wins) wn.s = score(wn.r, wn.c, 9, li);
  wins.sort((a, b) => b.s - a.s);
  const seen = new Set(), sample = [];
  for (const wn of wins) {
    const k = Math.round((wn.c.t0 || 0) / 80) + ':' + Math.round(wn.c.a / 5) + ':' + Math.round(wn.c.v * 10);
    if (seen.has(k)) continue;
    seen.add(k); sample.push(wn.c);
    if (sample.length >= 45) break;
  }
  let best = null;
  for (const c of sample) {
    const rr = refine(li, c);
    if (rr.f < 9) continue;
    if (!best || rr.s > best.s) best = rr;
  }
  if (!best) for (const c of sample) { const rr = refine(li, c); if (!best || rr.s > best.s) best = rr; }
  const sol = { t0:best.sol.t0 || 0, a:+best.sol.a.toFixed(4), v:+best.sol.v.toFixed(5) };
  if (best.sol.th) sol.th = best.sol.th;
  const cps = placeCps(li, sol);
  const r = fly(li, sol.t0, sol.a, sol.v, sol.th, false);
  return { sol, cps, f:best.f, s:+best.s.toFixed(1), wins:wins.length,
           turn:+r.turn.toFixed(2), peri:+r.peri.toFixed(2), flight:+r.flight.toFixed(2),
           ms:Date.now() - t };
}

module.exports = { M, fly, fair, sweep, refine, placeCps, solveLevel, t0List, score, D2R, inpAt };

if (require.main === module) {
  const li = Number(process.argv[2]) - 1;
  const out = solveLevel(li);
  out.level = li + 1;
  fs.writeFileSync(process.argv[3] || `/tmp/sol${li+1}.json`, JSON.stringify(out));
  console.log(JSON.stringify(out));
}
