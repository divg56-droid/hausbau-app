/* Nimmt die Tafel "Vier Ansichten aus der App" fuer das Buch auf.
 *
 *     node ressourcen/buch-bilder.mjs [http://localhost:4301]
 *
 * Schreibt nach ressourcen/buch/:
 *     app-ansichten.png   die Tafel, zwei mal zwei, in Graustufen
 *     1-budget.png …      die vier Einzelaufnahmen
 *
 * Warum ein eigenes Skript und nicht ein Schalter an store-bilder.mjs:
 *
 *   - Das Buch wird schwarz-weiss gedruckt. Eine Tafel in Farbe sieht am
 *     Bildschirm gut aus und im Druck grau in grau; hier wird sie deshalb
 *     gleich entfaerbt und der Kontrast dabei geprueft.
 *   - Im Buch steht das Beispiel als SCHLUESSELFERTIG. In der App bleibt das
 *     Beispielprojekt bei Einzelvergabe -- es zeigt dort den Fall mit den
 *     meisten Entscheidungen. Nur fuer diese Aufnahme wird umgestellt, und
 *     zwar im Browser, nicht in den Beispieldaten.
 *   - Der Zuschnitt ist der des Buches: oben angeschnitten, unten weich
 *     auslaufend, Bildunterschrift darunter.
 *
 * Die Bildunterschriften stehen in Archivo, der Hausschrift. Sie liegt im
 * Website-Projekt nebenan; fehlt es, nimmt das Skript die Systemschrift und
 * sagt es. Eine zweite Kopie der Schrift hier einzuchecken hiesse, zwei
 * Staende zu pflegen, von denen einer irgendwann der falsche ist.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { browserStarten } from '../test/browser.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const BASIS = process.argv[2] || 'http://localhost:4301';
const ORDNER = join(HIER, 'buch');
const SCHRIFT = join(
  HIER, '..', '..', 'hausbauatlas', 'node_modules', '@fontsource', 'archivo',
  'files', 'archivo-latin-700-normal.woff2',
);

/* Vier Ansichten, dieselben wie bisher im Buch. Die Reihenfolge ist die des
 * Bauens: erst das Geld, dann die Angebote, dann die Baustelle, dann der
 * Weg durch alles hindurch. */
const BILDER = [
  ['baukasse', '1-budget', 'Budget und Finanzierung'],
  ['angebote', '2-angebote', 'Angebote vergleichen'],
  ['maengel', '3-maengel', 'Mängel mit Foto und Status'],
  ['leitfaden', '4-bauleitfaden', 'Bauleitfaden Schritt für Schritt'],
];

// 720 x 1076 bei dreifacher Dichte ergibt 2160 x 3228 -- genug fuer A5 im
// Druck, und dasselbe Seitenverhaeltnis wie die Tafel bisher.
const TAFEL = { breite: 720, hoehe: 1076, dichte: 3 };

const schriftDa = existsSync(SCHRIFT);
if (!schriftDa) {
  console.log('Hinweis: Archivo nicht gefunden, die Unterschriften stehen in der Systemschrift.');
  console.log('  Gesucht in: ' + SCHRIFT);
}
const schriftRegel = schriftDa
  ? `@font-face { font-family: Archivo; font-weight: 700; font-display: block;
       src: url(data:font/woff2;base64,${readFileSync(SCHRIFT).toString('base64')}) format('woff2'); }`
  : '';

const tafelSeite = `
<style>
  ${schriftRegel}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${TAFEL.breite}px; height: ${TAFEL.hoehe}px; background: #fff;
    /* Das Buch ist schwarz-weiss. Entfaerbt wird hier und nicht beim Setzen:
       So sieht man schon in der Vorschau, ob die Zustandsfarben der App
       (gruen, bernstein, grau) im Druck noch auseinanderzuhalten sind. */
    filter: grayscale(1) contrast(1.06);
    font-family: Archivo, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  .tafel { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 40px; row-gap: 48px; }
  .zelle { display: flex; flex-direction: column; }
  .bild { position: relative; height: 470px; overflow: hidden;
    border: 1px solid #c9d2cf; border-radius: 6px; background: #fff; }
  .bild img { display: block; width: 100%; }
  /* Unten weich auslaufen lassen: Ein hart abgeschnittener Bildschirm sieht
     im Druck aus wie ein Fehler, ein auslaufender wie eine Fortsetzung. */
  .bild::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 64px;
    background: linear-gradient(to bottom, rgba(255,255,255,0), #fff); }
  .unterschrift { margin-top: 14px; font-size: 20px; font-weight: 700;
    line-height: 1.25; letter-spacing: -0.2px; color: #1F2A30; }
</style>
<div class="tafel" id="tafel"></div>
`;

mkdirSync(ORDNER, { recursive: true });
const seite = await browserStarten({ basis: BASIS });
const roh = new Map();

try {
  await seite.groesse(360, 640, 3);
  await seite.vorschalten(`
    window.addEventListener('beforeinstallprompt', (e) => e.stopImmediatePropagation(), true);
    document.addEventListener('DOMContentLoaded', () => {
      const stil = document.createElement('style');
      stil.textContent = '.beispielband, .install-karte, .kopfaktionen { display: none !important; }';
      document.head.append(stil);
    });
  `);
  await seite.laden('/');
  await seite.werten(`location.hash = '#/beispiel'`);
  await new Promise((gut) => setTimeout(gut, 5000));

  const aktiv = await seite.werten(`(async () => (await import('/beispiel.js')).istBeispielAktiv())()`);
  if (!aktiv) throw new Error('Das Beispielprojekt ist nicht offen.');

  // Nur fuer diese Aufnahme: schluesselfertig statt Einzelvergabe.
  const weise = await seite.werten(`(async () => {
    const b = await import('/bauweise.js');
    await b.bauweiseSetzen(b.SCHLUESSELFERTIG);
    return (await b.bauweise()).name;
  })()`);
  console.log('Bauweise fuer die Aufnahme: ' + weise);

  for (const [weg, datei, unterschrift] of BILDER) {
    await seite.hin(weg, 1800);
    await seite.werten(weg === 'angebote'
      ? `(() => {
          document.querySelectorAll('details.leistungsblock').forEach((d) => { d.open = true; });
          const k = [...document.querySelectorAll('.karte')].find((e) => /Außenanlagen/.test(e.innerText));
          if (k) window.scrollTo(0, k.getBoundingClientRect().top + window.scrollY - 70);
        })()`
      : `window.scrollTo(0, 0)`);
    await new Promise((gut) => setTimeout(gut, 400));
    const bild = await seite.bild();
    roh.set(datei, bild);
    writeFileSync(join(ORDNER, datei + '.png'), bild);
    console.log('  ' + datei.padEnd(16) + unterschrift);
  }

  // Die Tafel. Ab hier ist die App aus der Seite geworfen.
  await seite.groesse(TAFEL.breite, TAFEL.hoehe, TAFEL.dichte);
  await seite.werten(
    `(() => { document.documentElement.innerHTML = ${JSON.stringify('<head><meta charset="utf-8"></head><body>' + tafelSeite + '</body>')}; return true; })()`,
  );
  await seite.werten(`(async () => {
    const zellen = ${JSON.stringify(BILDER.map(([, datei, unter]) => ({ datei, unter })))};
    const daten = ${JSON.stringify(Object.fromEntries([...roh].map(([k, v]) => [k, v.toString('base64')])))};
    const tafel = document.getElementById('tafel');
    for (const z of zellen) {
      const zelle = document.createElement('div');
      zelle.className = 'zelle';
      const kasten = document.createElement('div');
      kasten.className = 'bild';
      const bild = document.createElement('img');
      bild.src = 'data:image/png;base64,' + daten[z.datei];
      bild.alt = z.unter;
      kasten.append(bild);
      const text = document.createElement('div');
      text.className = 'unterschrift';
      text.textContent = z.unter;
      zelle.append(kasten, text);
      tafel.append(zelle);
    }
    await Promise.all([...document.images].map((b) => b.decode()));
    if (document.fonts) await document.fonts.ready;
    await new Promise((g) => requestAnimationFrame(() => requestAnimationFrame(g)));
    return true;
  })()`);
  writeFileSync(join(ORDNER, 'app-ansichten.png'), await seite.bild());
  console.log(`\nTafel: app-ansichten.png (${TAFEL.breite * TAFEL.dichte}x${TAFEL.hoehe * TAFEL.dichte})`);
} finally {
  seite.schliessen();
}

console.log('Fertig.');
