/* Nimmt die Screenshots fuer den Play Store auf.
 *
 *     npm run dev          (oder der Vorschau-Server auf Port 4301)
 *     node ressourcen/store-bilder.mjs [http://localhost:4301]
 *
 * Schreibt nach ressourcen/play/screenshots/.
 *
 * 360x640 CSS-Punkte bei dreifacher Dichte ergeben 1080x1920 -- das Format,
 * das Play fuer Telefonbilder erwartet, und zugleich die Groesse, in der die
 * App auf einem echten Geraet laeuft. Ein Bild bei 1080 CSS-Punkten saehe
 * aus wie ein Tablet und haette mit dem, was der Nutzer sieht, nichts zu tun.
 *
 * Gezeigt wird ein Beispielprojekt aus test/beispieldaten.mjs, keine echten
 * Daten. Wer eigene Bilder will, nimmt sie auf dem Telefon auf -- dieselben
 * Bildschirme, dieselbe Reihenfolge.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { browserStarten } from '../test/browser.mjs';
import { FUELLEN } from '../test/beispieldaten.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const ZIEL = join(HIER, 'play', 'screenshots');
const BASIS = process.argv[2] || 'http://localhost:4301';

/* Acht Bilder, Play erlaubt bis zu acht. Die Reihenfolge ist die des
 * Eintrags: zuerst, was in zwei Sekunden ueberzeugt (Zahlen), danach, was
 * die Arbeit zeigt. */
const BILDER = [
  ['', '1-uebersicht'],
  ['baukasse', '2-budget'],
  ['angebote', '3-angebote'],
  ['maengel', '4-maengel'],
  ['baunebenkosten', '5-baunebenkosten'],
  ['tagebuch', '6-bautagebuch'],
  ['leitfaden', '7-bauleitfaden'],
  // Die Kostenaufstellung steht hinten, obwohl sie das staerkste Argument
  // ist: Auf 360 Pixeln rollt ihre Tabelle quer, und im Bild sieht man
  // Position und Gewerk, aber keine Betraege. Als erstes Bild waere das
  // schwach, als siebtes erklaert es sich aus den Bildern davor.
  ['baukasse/kosten', '8-kostenaufstellung'],
];

mkdirSync(ZIEL, { recursive: true });
const seite = await browserStarten({ basis: BASIS });

try {
  await seite.groesse(360, 640, 3);
  await seite.laden('/');
  const stand = await seite.werten(FUELLEN);
  console.log(`Beispielprojekt: ${stand.posten} Posten, Budget ${stand.budget} EUR`);

  for (const [weg, datei] of BILDER) {
    await seite.hin(weg, 1500);
    const m = await seite.werten(`({
      titel: (document.querySelector('main h1') || {}).textContent,
      inhalt: document.querySelectorAll('main li, main tbody tr, main .karte').length,
    })`);
    // Ein Bild mit leerem Bildschirm faellt im Store auf und im Skript nicht
    // -- deshalb steht der Inhalt hier in der Ausgabe.
    console.log(`  ${datei.padEnd(18)} ${m.titel} · ${m.inhalt} Elemente`);
    writeFileSync(join(ZIEL, datei + '.png'), await seite.bild());
  }
} finally {
  seite.schliessen();
}

console.log('\nFertig: ' + ZIEL);
