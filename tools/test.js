// Selbsttest für swingby.html (Chromium, headless).
const path = require('path');
const fs = require('fs');
function loadPW(){
  const tries = [process.env.PW, 'playwright-core', 'playwright'].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch (e) {} }
  console.error('playwright-core fehlt. Einmalig: npm install playwright-core');
  process.exit(2);
}
const { chromium } = loadPW();
function findChrome(){
  if (process.env.CHROME) return process.env.CHROME;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  for (const d of (fs.existsSync(base) ? fs.readdirSync(base) : [])) {
    const p = path.join(base, d, 'chrome-linux', 'chrome');
    if (d.startsWith('chromium-') && fs.existsSync(p)) return p;
  }
  return undefined;   // dann nimmt Playwright seinen eigenen Fund
}
const EXE = findChrome();
const URL = 'file://' + path.join(__dirname, '..', 'swingby.html');
const SHOT = process.env.SHOT || '/tmp/shots';
fs.mkdirSync(SHOT, {recursive:true});

const R = [];
let fails = 0;
function ok(name, pass, info){ R.push({name, pass, info}); if (!pass) fails++;
  console.log(`${pass ? 'OK  ' : 'FEHL'} ${name}${info ? '  ' + info : ''}`); }

async function newPage(browser, w, h, dpr){
  const ctx = await browser.newContext({viewport:{width:w, height:h}, deviceScaleFactor:dpr, hasTouch:true, isMobile:true});
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto(URL, {waitUntil:'load'});
  await page.waitForFunction('!!window.SB');
  const cdp = await ctx.newCDPSession(page);
  return {ctx, page, errs, cdp};
}

// CDP-Touch, damit echte Pointer-Events entstehen.
async function touch(cdp, type, pts){
  await cdp.send('Input.dispatchTouchEvent', {type, touchPoints:pts.map((p, i) => ({x:p.x, y:p.y, id:i}))});
}
async function drag(cdp, x0, y0, x1, y1, steps){
  await touch(cdp, 'touchStart', [{x:x0, y:y0}]);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await touch(cdp, 'touchMove', [{x:x0 + (x1-x0)*t, y:y0 + (y1-y0)*t}]);
  }
  await touch(cdp, 'touchEnd', []);
}

(async () => {
  const browser = await chromium.launch({executablePath:EXE, args:['--no-sandbox', '--disable-gpu', '--font-render-hinting=none']});
  const allErrs = [];

  // ---- 1  Integrator ------------------------------------------------------
  {
    const {ctx, page, errs} = await newPage(browser, 820, 1180, 2);
    const e = await page.evaluate(() => SB.energyDrift(100));
    ok('1 Integrator: 100 Umläufe, Energiedrift < 0,1 %',
       !e.err && e.drift < 1e-3,
       `Drift ${(e.drift*100).toExponential(2)} % · Radiusfehler ${(e.radial*100).toExponential(2)} % · ${e.ticks} Schritte`);
    allErrs.push(...errs); await ctx.close();
  }

  // ---- 2  Referenzlösungen + Bitgleichheit --------------------------------
  {
    const {ctx, page, errs} = await newPage(browser, 820, 1180, 2);
    const res = await page.evaluate(() => {
      const out = [];
      for (let i = 0; i < SB.LEVELS.length; i++) {
        const s = SB.LEVELS[i].sol;
        const a = SB.runSolution(i, s), b = SB.runSolution(i, s);
        out.push({i, win:a.win, nc:a.nc, ncp:SB.LEVELS[i].cps.length,
                  same:a.hash === b.hash && a.ticks === b.ticks && a.x === b.x && a.y === b.y,
                  hash:a.hash, flight:+a.flight.toFixed(2)});
      }
      return out;
    });
    for (const r of res)
      ok(`2 Level ${r.i+1}: Ziel + alle Messpunkte + bitgenau reproduzierbar`,
         r.win && r.nc === 3 && r.ncp === 3 && r.same,
         `Ziel=${r.win} Messpunkte=${r.nc}/3 Flug=${r.flight}s Prüfsumme=${r.hash}`);
    allErrs.push(...errs); await ctx.close();
  }

  // ---- 3  Fairness --------------------------------------------------------
  {
    const {ctx, page, errs} = await newPage(browser, 820, 1180, 2);
    const res = await page.evaluate(() => {
      const out = [];
      for (let i = 0; i < SB.LEVELS.length; i++) {
        const s = SB.LEVELS[i].sol;
        let good = 0, tot = 0, bad = [];
        for (const dAng of [-0.5, -0.25, 0, 0.25, 0.5])
          for (const dPow of [-0.01, -0.005, 0, 0.005, 0.01]) {
            tot++;
            const r = SB.runSolution(i, s, {dAng, dPow});
            if (r.win) good++; else bad.push(dAng + '/' + dPow + ':' + r.why);
          }
        out.push({i, good, tot, bad:bad.slice(0, 3)});
      }
      return out;
    });
    for (const r of res)
      ok(`3 Level ${r.i+1}: ±1 % Stärke und ±0,5° Winkel führen ins Ziel`,
         r.good === r.tot, `${r.good}/${r.tot}${r.bad.length ? ' · ' + r.bad.join(' ') : ''}`);
    allErrs.push(...errs); await ctx.close();
  }

  // ---- 4  Fuzz ------------------------------------------------------------
  {
    const {ctx, page, errs} = await newPage(browser, 820, 1180, 2);
    const res = await page.evaluate(() => {
      const out = [];
      for (let i = 0; i < SB.LEVELS.length; i++) {
        let bad = null;
        try { bad = SB.fuzz(i, 200, 777 + i * 31); }
        catch (e) { return [{i, ex:String(e && e.message)}]; }
        out.push({i, bad:bad.length, first:bad[0] || null});
      }
      return out;
    });
    for (const r of res)
      ok(`4 Level ${r.i+1}: 200 Zufallsstarts ohne NaN/Ausnahme, jede Runde endet`,
         !r.ex && r.bad === 0, r.ex ? r.ex : (r.bad ? JSON.stringify(r.first) : '200/200'));
    allErrs.push(...errs); await ctx.close();
  }

  // ---- 5  Schärfe ---------------------------------------------------------
  const sizes = [[820,1180,'iPad hoch'],[1180,820,'iPad quer'],[744,1133,'iPad mini hoch'],[1133,744,'iPad mini quer']];
  for (const [vw, vh, label] of sizes) {
    const {ctx, page, errs} = await newPage(browser, vw, vh, 2);
    await page.evaluate(() => SB.go(6));
    await page.waitForTimeout(260);
    const st = await page.evaluate(() => SB.state());
    const exactW = st.cw === Math.round(st.cssW * st.dpr);
    const exactH = st.ch === Math.round(st.cssH * st.dpr);
    const noScale = await page.evaluate(() => {
      const cv = document.getElementById('cv');
      const r = cv.getBoundingClientRect();
      return {styleW:cv.style.width, rw:r.width, rh:r.height, tw:cv.width, th:cv.height};
    });
    ok(`5 ${label} ${vw}×${vh} DPR 2: Canvas exakt CSS × DPR`,
       exactW && exactH && st.dpr === 2,
       `${st.cw}×${st.ch} = ${st.cssW}×${st.cssH} × ${st.dpr}`);
    // Alles sichtbar? Spielfeldkreis muss in beide Richtungen hineinpassen.
    const fits = await page.evaluate(() => {
      const s = SB.state();
      return {lo:s.ox - SB.R_OUT * s.sc, hi:s.ox + SB.R_OUT * s.sc,
              to:s.oy - SB.R_OUT * s.sc, bo:s.oy + SB.R_OUT * s.sc, cw:s.cw, ch:s.ch};
    });
    ok(`5 ${label}: Spielfeld vollständig sichtbar`,
       fits.lo >= -1 && fits.to >= -1 && fits.hi <= fits.cw + 1 && fits.bo <= fits.ch + 1,
       `x ${fits.lo.toFixed(0)}..${fits.hi.toFixed(0)} in 0..${fits.cw}, y ${fits.to.toFixed(0)}..${fits.bo.toFixed(0)} in 0..${fits.ch}`);
    await page.screenshot({path:`${SHOT}/L7_${vw}x${vh}.png`});
    allErrs.push(...errs); await ctx.close();
  }
  // Je ein Bild pro Level (hoch) und ein Zielbildschirm
  {
    const {ctx, page, errs} = await newPage(browser, 820, 1180, 2);
    for (let i = 0; i < 12; i++) {
      await page.evaluate(i => SB.go(i), i);
      await page.waitForTimeout(200);
      await page.screenshot({path:`${SHOT}/level${String(i+1).padStart(2,'0')}.png`});
    }
    await page.evaluate(() => SB.play(2));
    await page.waitForTimeout(500);
    await page.screenshot({path:`${SHOT}/ziel.png`});
    await page.evaluate(() => document.getElementById('bGrid').click());
    await page.waitForTimeout(200);
    await page.screenshot({path:`${SHOT}/raster.png`});
    allErrs.push(...errs); await ctx.close();
  }

  // ---- 5b Keine Weichzeichner, kein Glow, keine Verläufe ------------------
  {
    const {ctx, page, errs} = await newPage(browser, 820, 1180, 2);
    const src = fs.readFileSync(path.join(__dirname, '..', 'swingby.html'), 'utf8');
    const verboten = [
      ['CSS-Filter', /filter\s*:\s*(?!none)[a-z]/i],
      ['Canvas-Filter', /\.filter\s*=/],
      ['Schattenweichzeichnung', /shadowBlur/],
      ['Schattenfarbe', /shadowColor/],
      ['linearer Verlauf', /createLinearGradient/],
      ['radialer Verlauf', /createRadialGradient/],
      ['CSS-Verlauf', /linear-gradient|radial-gradient/],
      ['backdrop-filter', /backdrop-filter/]
    ];
    const treffer = verboten.filter(([, re]) => re.test(src)).map(([n]) => n);
    ok('5b Quelltext ohne Weichzeichner, Glow oder Verläufe',
       treffer.length === 0, treffer.length ? treffer.join(', ') : 'keine Fundstellen');

    // Laufzeit: Zeichenzustand muss neutral sein, Hintergrundebene 1:1 gesetzt
    const st = await page.evaluate(() => {
      const g = document.getElementById('cv').getContext('2d');
      return {filter:g.filter, blur:g.shadowBlur, alpha:g.globalAlpha,
              smooth:g.imageSmoothingEnabled};
    });
    ok('5b Zeichenzustand neutral (kein Filter, kein Schatten, volle Deckkraft)',
       (st.filter === 'none' || st.filter === undefined) && st.blur === 0 && st.alpha === 1,
       `filter=${st.filter} shadowBlur=${st.blur} globalAlpha=${st.alpha}`);

    // Flächen müssen flach sein: wenige verschiedene Farben auf einem Körper
    await page.evaluate(() => SB.go(0));
    await page.waitForTimeout(250);
    const tones = await page.evaluate(() => {
      const cv = document.getElementById('cv'), g = cv.getContext('2d');
      const s = SB.state();
      const R = Math.round(15 * s.sc), cx = Math.round(s.ox), cy = Math.round(s.oy);
      const d = g.getImageData(cx - R, cy - R, R * 2, R * 2).data;
      const seen = {};
      for (let i = 0; i < d.length; i += 4) {
        const k = d[i] + ',' + d[i+1] + ',' + d[i+2];
        seen[k] = (seen[k] || 0) + 1;
      }
      const all = Object.entries(seen).sort((a, b) => b[1] - a[1]);
      const total = all.reduce((a, b) => a + b[1], 0);
      const top8 = all.slice(0, 8).reduce((a, b) => a + b[1], 0);
      return {unique:all.length, deckung:top8 / total};
    });
    ok('5b Planetenflächen sind flach, kein Verlauf',
       tones.deckung > 0.80,
       `acht Haupttöne decken ${(tones.deckung*100).toFixed(1)} % der Scheibe ab ` +
       `(${tones.unique} Farbwerte insgesamt, Rest ist Kantenglättung)`);
    allErrs.push(...errs); await ctx.close();
  }

  // ---- 6  Touch, Drehen, Größenänderung im Flug ---------------------------
  {
    const {ctx, page, errs, cdp} = await newPage(browser, 820, 1180, 2);
    await page.evaluate(() => SB.go(0));
    await page.waitForTimeout(150);
    // Ziehen und loslassen -> Start
    await drag(cdp, 500, 700, 400, 760, 12);
    await page.waitForTimeout(120);
    let st = await page.evaluate(() => SB.state());
    ok('6 Ziehen und loslassen startet die Sonde', st.st === 'fly' || st.st === 'dead', 'Zustand ' + st.st);

    // Abbruch: zurück zum Ausgangspunkt ziehen
    await page.evaluate(() => { SB.go(0); });
    await page.waitForTimeout(120);
    await drag(cdp, 500, 700, 500, 700, 6);
    await page.waitForTimeout(100);
    st = await page.evaluate(() => SB.state());
    ok('6 Zurück zum Ausgangspunkt bricht ab', st.st === 'aim', 'Zustand ' + st.st);

    // Vorschau nur beim Ziehen
    await touch(cdp, 'touchStart', [{x:520, y:720}]);
    await touch(cdp, 'touchMove', [{x:600, y:800}]);
    await page.waitForTimeout(80);
    const prev = await page.evaluate(() => {
      const s = SB.state();
      return {st:s.st, pts:SB.preview(SB.makeWorld(0), 0.3, 0.5, 2.0, 24).length / 2};
    });
    ok('6 Vorschau zeigt ~2 s in gleichen Zeitabständen', prev.pts >= 18 && prev.pts <= 21, prev.pts + ' Punkte (Soll 20)');
    await touch(cdp, 'touchEnd', []);

    // Halten = Schub (Level 4)
    await page.evaluate(() => SB.go(3));
    await page.waitForTimeout(120);
    await drag(cdp, 420, 600, 430, 760, 10);
    await page.waitForTimeout(80);
    const f0 = await page.evaluate(() => SB.state().fuel);
    await touch(cdp, 'touchStart', [{x:600, y:400}]);
    await page.waitForTimeout(420);
    const f1 = await page.evaluate(() => SB.state().fuel);
    await touch(cdp, 'touchEnd', []);
    ok('6 Finger halten verbraucht Treibstoff', f1 < f0 - 0.05, `${f0.toFixed(2)} s -> ${f1.toFixed(2)} s`);

    // Zwei-Finger-Tipp = Neustart
    await page.evaluate(() => SB.go(0));
    await page.waitForTimeout(120);
    await drag(cdp, 500, 700, 400, 780, 10);
    await page.waitForTimeout(300);
    const before = await page.evaluate(() => SB.state());
    await touch(cdp, 'touchStart', [{x:300, y:500}]);
    await touch(cdp, 'touchStart', [{x:300, y:500}, {x:500, y:500}]);
    await page.waitForTimeout(60);
    await touch(cdp, 'touchEnd', [{x:300, y:500}]);
    await touch(cdp, 'touchEnd', []);
    await page.waitForTimeout(120);
    const after = await page.evaluate(() => SB.state());
    ok('6 Zwei-Finger-Tipp startet sofort neu',
       after.st === 'aim' && after.tick < before.tick, `${before.st}@${before.tick} -> ${after.st}@${after.tick}`);

    // Drehen und Größenänderung mitten im Flug
    await page.evaluate(() => SB.go(6));
    await page.waitForTimeout(150);
    await drag(cdp, 500, 700, 420, 800, 10);
    await page.waitForTimeout(500);
    const pre = await page.evaluate(() => SB.state());
    await page.setViewportSize({width:1180, height:820});
    await page.waitForTimeout(260);
    const post = await page.evaluate(() => SB.state());
    ok('6 Drehen im Flug: Zustand bleibt, Kamera passt sich an',
       post.st === pre.st && post.tick > pre.tick && post.x === pre.x === false &&
       post.cw === Math.round(post.cssW * post.dpr) && post.ch === Math.round(post.cssH * post.dpr) &&
       Math.abs(post.ox - pre.oy) < 1 && Math.abs(post.oy - pre.ox) < 1,
       `${pre.st} Tick ${pre.tick} -> ${post.tick}, Mitte ${pre.ox.toFixed(0)}/${pre.oy.toFixed(0)} -> ${post.ox.toFixed(0)}/${post.oy.toFixed(0)}, Canvas ${post.cw}×${post.ch}`);
    // Echte Größenänderung im Flug: Maßstab muss sich mitziehen
    await page.setViewportSize({width:700, height:900});
    await page.waitForTimeout(240);
    const post2 = await page.evaluate(() => SB.state());
    ok('6 Größenänderung im Flug: Maßstab zieht mit, Flug läuft weiter',
       post2.st === post.st && post2.tick > post.tick && Math.abs(post2.sc - post.sc) > 0.05 &&
       post2.cw === Math.round(post2.cssW * post2.dpr),
       `Maßstab ${post.sc.toFixed(2)} -> ${post2.sc.toFixed(2)}, Tick ${post.tick} -> ${post2.tick}, Canvas ${post2.cw}×${post2.ch}`);
    await page.screenshot({path:`${SHOT}/dreh_quer.png`});
    allErrs.push(...errs); await ctx.close();
  }

  // ---- 7  Leistung im schwersten Level ------------------------------------
  {
    const {ctx, page, errs} = await newPage(browser, 1180, 820, 2);
    const perf = [];
    for (const i of [8, 11, 6]) {
      await page.evaluate(i => SB.go(i), i);
      await page.waitForTimeout(250);
      const b = await page.evaluate(() => { SB.bench(30); return SB.bench(120); });
      const rb = await page.evaluate(() => SB.rebuild());
      perf.push({i:i+1, render:+b.renderMs.toFixed(3), step:+b.stepUs.toFixed(2), feld:+rb.toFixed(1)});
    }
    const worst = perf.reduce((a, b) => a.render > b.render ? a : b);
    ok('7 Physikkosten: 240 Hz (4 Schritte je Bild) bleiben im Budget',
       worst.step * 4 / 1000 < 1.0,
       perf.map(p => `L${p.i}: 4 Schritte ${(p.step*4/1000).toFixed(3)} ms, Zeichenbefehle ${p.render} ms (Chromium puffert, nur Untergrenze), Feldneubau ${p.feld} ms`).join(' · '));

    // Laufende Schleife im schwersten Level
    await page.evaluate(() => SB.go(8));
    await page.waitForTimeout(200);
    await page.evaluate(() => { const s = SB.state(); window.__bf0 = s.bfN; });
    const live = await page.evaluate(() => new Promise(res => {
      let n = 0; const t0 = performance.now();
      (function loop(){
        n++;
        if (performance.now() - t0 > 1500) {
          const s = SB.state();
          return res({n, ms:performance.now() - t0, fps:s.fps, ft:s.ft, steps:s.steps, bfN:s.bfN, bf0:window.__bf0});
        }
        requestAnimationFrame(loop);
      })();
    }));
    ok('7 Laufende Schleife im schwersten Level',
       live.ft < 16.7 && live.steps <= 8,
       `${live.n} Bilder in ${live.ms.toFixed(0)} ms, ${live.fps.toFixed(0)} fps, ${live.ft.toFixed(2)} ms Bildzeit, ${live.steps} Physikschritte je Bild`);
    ok('7 Statisches wird nicht je Bild neu berechnet',
       live.bfN === live.bf0,
       `Neuberechnungen der statischen Ebene während ${live.n} Bildern: ${live.bfN - live.bf0}`);
    allErrs.push(...errs); await ctx.close();
  }

  // ---- 8  Konsole ---------------------------------------------------------
  ok('8 Konsole ohne Fehler und Warnungen', allErrs.length === 0, allErrs.slice(0, 5).join(' | ') || 'keine Meldungen');

  await browser.close();
  console.log('\n' + (fails ? `${fails} FEHLGESCHLAGEN von ${R.length}` : `alle ${R.length} Prüfungen bestanden`));
  fs.writeFileSync(path.join(SHOT, 'ergebnis.json'), JSON.stringify(R, null, 1));
  process.exit(fails ? 1 : 0);
})();
