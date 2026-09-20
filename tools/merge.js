// Wählt je Level die Lösung mit dem besten Bahncharakter und schreibt den
// SOLS-Block in swingby.html.
const fs = require('fs');
const { HTML } = require('./core.js');
const S = process.argv[2];
const TARGET = {1:0.75,2:1.70,3:2.60,4:1.60,5:1.40,6:1.80,7:3.40,8:2.20,9:1.00,10:1.60,11:1.80,12:2.40};
const out = {};
const rep = [];
for (let n = 1; n <= 12; n++) {
  const cands = [];
  for (const pre of ['k', 'm']) {
    const f = `${S}/${pre}${n}.json`;
    if (!fs.existsSync(f)) continue;
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (!d.sol || !d.cps) continue;
    d.cost = Math.abs(d.turn - TARGET[n]) + Math.abs(d.sol.v - 0.5) * 0.5 - (d.f === 9 ? 10 : 0);
    cands.push(d);
  }
  if (!cands.length) throw new Error('keine Lösung für Level ' + n);
  cands.sort((a, b) => a.cost - b.cost);
  const d = cands[0];
  out[n] = { sol:d.sol, cps:d.cps };
  rep.push({level:n, f:d.f, turn:d.turn, peri:d.peri, flight:d.flight, v:d.sol.v, thrust:!!d.sol.th});
}
const body = Object.keys(out).map(k => {
  const o = out[k];
  const cps = o.cps.map(c => `{x:${c.x},y:${c.y}}`).join(',');
  let sol = `{t0:${o.sol.t0},a:${o.sol.a},v:${o.sol.v}`;
  if (o.sol.th) sol += `,th:[${o.sol.th.map(t => `{t0:${t.t0},t1:${t.t1},x:${t.x},y:${t.y}}`).join(',')}]`;
  sol += '}';
  return `  ${k}:{sol:${sol},\n     cps:[${cps}]}`;
}).join(',\n');
const block = `/*<<SOL>>*/\n// Referenzlösungen (3 Sterne) und Messpunkte. Vom Selbsttest geprüft.\nvar SOLS = {\n${body}\n};\n/*<</SOL>>*/`;
let h = fs.readFileSync(HTML, 'utf8');
h = h.replace(/\/\*<<SOL>>\*\/[\s\S]*?\/\*<<\/SOL>>\*\//, block);
fs.writeFileSync(HTML, h);
console.table(rep);
