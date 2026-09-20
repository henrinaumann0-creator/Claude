// Findet für die Treibstoff-Level eine Zielposition, die ballistisch
// nachweislich nicht erreichbar ist, und sucht dazu eine Schublösung.
const fs = require('fs');
const { load } = require('./core.js');
const M = load();
const { LEVELS, DT, makeWorld, step, launch, bpos, goalPos, GOAL_R, R_OUT, THRUST_A } = M;
const D2R = Math.PI / 180;

const CS = 2, LO = -98, N = Math.round(196 / CS) + 1;
const ci = (x) => Math.round((x - LO) / CS);
const cx = (i) => LO + i * CS;

function reachSet(li, aStep, pStep){
  const lv = LEVELS[li];
  const savedGoal = lv.goal;
  lv.goal = {x:1e7, y:1e7};                 // Ziel wegschieben: Läufe laufen aus
  const vis = new Uint8Array(N * N);
  let runs = 0;
  for (let a = 0; a < 360; a += aStep) {
    for (let p = 0.14; p <= 1.0001; p += pStep) {
      const w = makeWorld(li);
      launch(w, a * D2R, p);
      const guard = Math.ceil((lv.tmax + 1) / DT);
      let k = 0;
      while (w.st === 'fly' && w.tick < guard) {
        step(w, null);
        if ((k++ & 3) === 0) {
          const i = ci(w.x), j = ci(w.y);
          if (i >= 0 && i < N && j >= 0 && j < N) vis[j * N + i] = 1;
        }
      }
      runs++;
    }
  }
  lv.goal = savedGoal;
  // Dilatation um den Zielradius, damit die Aussage konservativ bleibt.
  const rad = Math.ceil((GOAL_R + 1.5) / CS);
  const dil = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    if (!vis[j * N + i]) continue;
    for (let dj = -rad; dj <= rad; dj++) for (let di = -rad; di <= rad; di++) {
      const jj = j + dj, ii = i + di;
      if (ii < 0 || ii >= N || jj < 0 || jj >= N) continue;
      if (di * di + dj * dj <= rad * rad) dil[jj * N + ii] = 1;
    }
  }
  return { vis, dil, runs };
}

// Kandidaten: knapp außerhalb der ballistisch erreichbaren Zone.
function candidates(li, dil){
  const lv = LEVELS[li];
  const out = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    if (dil[j * N + i]) continue;
    const x = cx(i), y = cx(j), r = Math.hypot(x, y);
    if (r > R_OUT - 10 || r < 30) continue;
    let bad = false;
    for (const b of lv.bodies) {
      const P = {x:0, y:0};
      if (b.orb) { for (let k = 0; k < 24; k++) { bpos(b, k * b.orb.T / 24, P); if (Math.hypot(P.x-x, P.y-y) < b.rc + GOAL_R + 6) bad = true; } }
      else if (Math.hypot(b.x-x, b.y-y) < b.rc + GOAL_R + 6) bad = true;
    }
    if (bad) continue;
    if (Math.hypot(lv.start.x-x, lv.start.y-y) < 60) continue;
    // Wie nah liegt erreichbares Gebiet? Kurze Distanz = kleiner Burn genügt.
    let near = 99;
    for (let dj = -8; dj <= 8; dj++) for (let di = -8; di <= 8; di++) {
      const jj = j + dj, ii = i + di;
      if (ii < 0 || ii >= N || jj < 0 || jj >= N) continue;
      if (dil[jj * N + ii]) near = Math.min(near, Math.hypot(di, dj) * CS);
    }
    if (near > 20) continue;
    out.push({x, y, near, r});
  }
  out.sort((a, b) => a.near - b.near);
  return out;
}

// Schubsuche: ein Burn in Richtung phi, Start relativ zum Abschuss.
function thrustSearch(li, opts){
  const lv = LEVELS[li];
  const fuel = lv.fuel;
  const res = [];
  const aStep = opts.aStep, pStep = opts.pStep;
  const t0s = opts.t0s, phis = opts.phis, durs = opts.durs;
  for (let a = 0; a < 360; a += aStep) {
    for (let p = 0.2; p <= 1.0001; p += pStep) {
      // Vorlauf ohne Schub: sterben die Bahnen sofort, gar nicht erst verzweigen
      const probe = makeWorld(li);
      launch(probe, a * D2R, p);
      let alive = 0;
      const guard = Math.ceil((lv.tmax + 1) / DT);
      while (probe.st === 'fly' && probe.tick < guard) { step(probe, null); alive++; }
      if (alive < 60) continue;
      for (const bt of t0s) {
        if (bt > alive * DT) break;
        for (const dur of durs) {
          if (dur > fuel + 1e-9) continue;
          for (const phi of phis) {
            const th = [{t0:bt, t1:bt + dur, x:Math.cos(phi * D2R) * 600, y:Math.sin(phi * D2R) * 600}];
            const w = makeWorld(li);
            launch(w, a * D2R, p);
            const g2 = w.tick + guard;
            while (w.st === 'fly' && w.tick < g2) {
              const rt = (w.tick - w.lt) * DT;
              let inp = null;
              if (rt >= th[0].t0 && rt < th[0].t1) inp = {thrust:true, tx:th[0].x, ty:th[0].y};
              step(w, inp);
            }
            if (w.st === 'win') res.push({t0:0, a, v:p, th, flight:(w.tick - w.lt) * DT});
          }
        }
      }
    }
  }
  return res;
}

module.exports = { reachSet, candidates, thrustSearch, M, ci, cx, N, CS };

if (require.main === module) {
  const li = Number(process.argv[2]) - 1;
  const t = Date.now();
  const { vis, dil, runs } = reachSet(li, 0.75, 0.015);
  const cand = candidates(li, dil);
  console.log(`L${li+1}: ${runs} ballistische Läufe, ${cand.length} Kandidatenzellen, ${Date.now()-t}ms`);
  console.log(JSON.stringify(cand.slice(0, 60).map(c => [c.x, c.y, +c.near.toFixed(1)])));
  fs.writeFileSync(process.argv[3] || `/tmp/pocket${li+1}.json`, JSON.stringify(cand.slice(0, 400)));
}
