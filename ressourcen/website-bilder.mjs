/* Nimmt die App-Bilder fuer die Startseite von www.bauzeuge.de auf.
 *
 *     node ressourcen/website-bilder.mjs [http://localhost:4301]
 *
 * Schreibt PNG nach ressourcen/website/. Die Website wandelt sie in WebP
 * (540 x 960) und legt sie unter public/bilder/app/ ab.
 *
 * Anders als store-bilder.mjs zeigt es das eingebaute Beispielprojekt,
 * dasselbe, das der Knopf "Beispielprojekt ansehen" oeffnet. So stimmt, was
 * auf der Website zu sehen ist, mit dem ueberein, was ein Besucher danach
 * selbst anklickt.
 *
 * Fuer das Bild ausgeblendet werden das Band "Beispielprojekt" und der
 * Installationshinweis: Sie gehoeren zur Bedienung, nicht zum Inhalt. Die
 * Website schreibt unter das Bild, dass es Beispieldaten sind.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { browserStarten } from '../test/browser.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const BASIS = process.argv[2] || 'http://localhost:4301';
const ORDNER = join(HIER, 'website');

const BILDER = [
  ['', 'uebersicht'],
  ['baukasse', 'budget'],
  ['angebote', 'angebote', '.gruppenkarte, .karte:nth-of-type(3)'],
  ['maengel', 'maengel'],
  ['leitfaden', 'bauleitfaden'],
];

mkdirSync(ORDNER, { recursive: true });
const seite = await browserStarten({ basis: BASIS });

try {
  // Dieselbe Groesse wie die Play-Bilder: 360 x 640 bei dreifacher Dichte.
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

  for (const [weg, datei, ziel] of BILDER) {
    await seite.hin(weg, 1800);
    // Bei den Angeboten steht oben nur der Knopf zum Anlegen. Das Bild zeigt
    // stattdessen den Vergleich selbst.
    await seite.werten(ziel
      ? `(() => {
          document.querySelectorAll('details.leistungsblock').forEach((d) => { d.open = true; });
          const k = [...document.querySelectorAll('.karte')].find((e) => /Außenanlagen/.test(e.innerText));
          if (k) window.scrollTo(0, k.getBoundingClientRect().top + window.scrollY - 70);
        })()`
      : `window.scrollTo(0, 0)`);
    await new Promise((gut) => setTimeout(gut, 400));
    writeFileSync(join(ORDNER, datei + '.png'), await seite.bild());
    console.log('  ' + datei);
  }

} finally {
  seite.schliessen();
}
