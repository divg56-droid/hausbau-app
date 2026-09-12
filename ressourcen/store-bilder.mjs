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

/* Zwei Formate.
 *
 * Play fragt Telefon- und Tablet-Bilder getrennt ab und stuft Apps ohne
 * Tabletbilder in der Tabletsuche zurueck. Die App sieht dort anders aus --
 * die Seitenleiste steht ausgeklappt neben dem Inhalt --, also taugt ein
 * hochskaliertes Telefonbild nicht.
 *
 * 360x640 bei dreifacher Dichte ergibt 1080x1920, 800x1280 bei doppelter
 * ergibt 1600x2560: beides Groessen, die Play annimmt, und beides das, was
 * auf einem echten Geraet steht. */
const FORMATE = [
  { name: 'Telefon', ordner: 'screenshots', breite: 360, hoehe: 640, dichte: 3 },
  { name: 'Tablet', ordner: 'screenshots-tablet', breite: 800, hoehe: 1280, dichte: 2 },
];

const seite = await browserStarten({ basis: BASIS });

try {
  await seite.groesse(360, 640, 3);
  await seite.laden('/');
  const stand = await seite.werten(FUELLEN);
  console.log(`Beispielprojekt: ${stand.posten} Posten, Budget ${stand.budget} EUR`);

  for (const format of FORMATE) {
    const ordner = join(HIER, 'play', format.ordner);
    mkdirSync(ordner, { recursive: true });
    await seite.groesse(format.breite, format.hoehe, format.dichte);
    console.log(`\n${format.name} (${format.breite * format.dichte}x${format.hoehe * format.dichte}):`);

    for (const [weg, datei] of BILDER) {
      await seite.hin(weg, 1500);
      const m = await seite.werten(`({
        titel: (document.querySelector('main h1') || {}).textContent,
        inhalt: document.querySelectorAll('main li, main tbody tr, main .karte').length,
        quer: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      })`);
      // Ein Bild mit leerem Bildschirm faellt im Store auf und im Skript
      // nicht -- deshalb steht der Inhalt hier in der Ausgabe.
      console.log(`  ${datei.padEnd(20)} ${m.titel} · ${m.inhalt} Elemente${m.quer ? '  QUERROLLE' : ''}`);
      writeFileSync(join(ordner, datei + '.png'), await seite.bild());
    }
  }
} finally {
  seite.schliessen();
}

console.log('\nFertig.');
