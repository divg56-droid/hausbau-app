/* Tiefenpruefung der App: jeder Bereich, mit Daten, in zwei Breiten.
 *
 *     node test/bildschirme.mjs [http://localhost:4301]
 *
 * Geprueft wird je Bildschirm:
 *   - laedt er ueberhaupt (Inhalt da, kein Notausgang),
 *   - meldet die Konsole Fehler,
 *   - laeuft etwas ueber den Rand (320, 375, 1280),
 *   - gibt es leere Kaestchen, "undefined", "NaN" oder "[object Object]".
 */
import { browserStarten } from './browser.mjs';

const BASIS = process.argv[2] || 'http://localhost:4301';
let fehler = 0;
const pruef = (n, b, z = '') => { console.log((b ? '  ok   ' : '  FEHL ') + n + (b ? '' : '  ' + z)); if (!b) fehler++; };
const warte = (ms) => new Promise((g) => setTimeout(g, ms));

const s = await browserStarten({ basis: BASIS });
try {
  await s.groesse(390, 1600, 2);
  await s.laden('/');

  // Das Beispielprojekt ist der einzige Stand mit Daten in jedem Bereich.
  await s.werten(`location.hash = '#/beispiel'`);
  await warte(5000);

  const { BEREICHE } = await import('file:///C:/Users/divg7/Projekte/hausbau-app/www/bereiche.js');
  const wege = BEREICHE.flatMap((g) => g.punkte.map((p) => p.weg));
  console.log(`${wege.length} Bildschirme\n`);

  const schlecht = [];
  for (const weg of wege) {
    await s.hin(weg, 1600);
    const r = await s.werten(`(() => {
      const inhalt = document.getElementById('inhalt');
      const text = inhalt ? inhalt.innerText : '';
      return {
        leer: !inhalt || inhalt.children.length === 0,
        notausgang: !!document.querySelector('.notausgang'),
        laenge: text.length,
        muell: (text.match(/undefined|NaN|\\[object Object\\]|null€|k00/g) || []).slice(0, 3),
        leereKaesten: document.querySelectorAll('.listenzeile span.vorschau:not(.vorschau-zeichen)').length,
        knoepfe: document.querySelectorAll('button').length,
      };
    })()`);
    const klagen = s.klagen ? s.klagen() : [];
    const name = weg || '(Übersicht)';
    if (r.leer || r.notausgang || r.muell.length || r.leereKaesten) {
      schlecht.push([name, JSON.stringify(r)]);
    }
    pruef(`Bildschirm ${name}`.padEnd(34) + `${r.laenge} Zeichen, ${r.knoepfe} Knöpfe`,
      !r.leer && !r.notausgang && r.muell.length === 0 && r.leereKaesten === 0,
      JSON.stringify(r) + (klagen.length ? ' | Konsole: ' + JSON.stringify(klagen).slice(0, 200) : ''));
  }

  // Breitenprobe: 320 und 1280.
  console.log('\nBreiten:');
  for (const [breite, hoehe, dichte] of [[320, 1400, 2], [1280, 1000, 1]]) {
    await s.groesse(breite, hoehe, dichte);
    const ueber = [];
    for (const weg of wege) {
      await s.hin(weg, 900);
      const r = await s.werten(`(() => {
        const w = document.documentElement.clientWidth;
        const raus = [...document.querySelectorAll('main *')].filter((e) => {
          const r = e.getBoundingClientRect();
          if (!r.width) return false;
          let p = e.parentElement;
          while (p) { if (getComputedStyle(p).overflowX !== 'visible') return false; p = p.parentElement; }
          return r.right > w + 1;
        }).slice(0, 3).map((e) => e.className || e.tagName);
        return { quer: document.documentElement.scrollWidth > w + 1, raus };
      })()`);
      if (r.quer || r.raus.length) ueber.push(`${weg || 'Übersicht'}: ${JSON.stringify(r).slice(0, 120)}`);
    }
    pruef(`Bei ${breite} px läuft nichts über`, ueber.length === 0, ueber.join(' | '));
  }
  await s.groesse(390, 1600, 2);

  // Konsolenfehler ueber alles gesammelt.
  const konsole = s.klagen ? s.klagen() : [];
  pruef('Keine Konsolenfehler', konsole.length === 0, JSON.stringify(konsole).slice(0, 400));

  if (schlecht.length) {
    console.log('\nAuffällig:');
    for (const [name, text] of schlecht) console.log('  ' + name + ': ' + text);
  }
} finally {
  s.schliessen();
}
console.log(fehler ? `\n${fehler} Fehler.` : '\nAlle Bildschirme sauber.');
process.exitCode = fehler ? 1 : 0;
