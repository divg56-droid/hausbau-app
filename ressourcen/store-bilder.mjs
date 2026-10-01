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
  ['', '1-uebersicht', 'Alles auf einen Blick', 'Was als Nächstes dran ist, und wie das Geld steht'],
  ['baukasse', '2-budget', 'Budgetplanung', 'Was geplant, beauftragt und bezahlt ist'],
  ['angebote', '3-angebote', 'Angebote vergleichen', 'Position für Position, nicht nur die Endsumme'],
  ['maengel', '4-maengel', 'Mängelliste', 'Mangel, Foto, Frist – bis er behoben ist'],
  ['baunebenkosten', '5-baunebenkosten', 'Baunebenkosten', 'Was in keinem Angebot steht'],
  ['tagebuch', '6-bautagebuch', 'Bautagebuch', 'Wer da war und was gemacht wurde, mit Fotos'],
  ['leitfaden', '7-bauleitfaden', 'Bauleitfaden', 'Was in welcher Phase ansteht'],
  // Die Kostenaufstellung steht hinten, obwohl sie das staerkste Argument
  // ist: Auf 360 Pixeln rollt ihre Tabelle quer, und im Bild sieht man
  // Position und Gewerk, aber keine Betraege. Als erstes Bild waere das
  // schwach, als siebtes erklaert es sich aus den Bildern davor.
  ['baukasse/kosten', '8-kostenaufstellung', 'Kostenaufstellung', 'Jede Position mit Gewerk, Firma und Stand'],
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
  { name: 'Telefon', ordner: 'screenshots', breite: 360, hoehe: 640, dichte: 3,
    buehne: { breite: 360, hoehe: 640, dichte: 3, rahmen: 300, titel: 25, unter: 14 } },
  { name: 'Tablet', ordner: 'screenshots-tablet', breite: 800, hoehe: 1280, dichte: 2,
    buehne: { breite: 400, hoehe: 640, dichte: 4, rahmen: 310, titel: 26, unter: 14.5 } },
];

/* Die Buehne, auf der das Bild am Ende steht.
 *
 * In der Trefferliste sieht man vom Eintrag zwei Bilder, und zwar klein.
 * Eine nackte Oberflaeche sagt dort nichts -- eine Zeile darueber schon.
 * Deshalb kommt jedes Bild auf einen farbigen Grund, mit Ueberschrift und
 * einem Geraeterahmen darunter.
 *
 * Gebaut wird das im selben Browser, der auch die Aufnahmen macht: Die
 * fertige Aufnahme geht als Datenadresse in ein <img>, der Rest ist CSS.
 * Eine Bildbibliothek waere eine Abhaengigkeit fuer etwas, das der Browser
 * ohnehin kann.
 *
 * Die Farben sind die der Marke, aus www/stil.css: Akzent, Papier, Tinte.
 * Die Schrift ist dieselbe Systemschrift wie in der App -- sie liegt auf
 * jedem Geraet, und ein nachgeladener Schriftschnitt waere eine Quelle fuer
 * ein halb gezeichnetes Bild.
 */
const BUEHNE = (b) => `
  <style>
    :root { --akzent: #0e6e72; --papier: #f5f7f6; --tinte: #1f2a30; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: ${b.breite}px; height: ${b.hoehe}px; overflow: hidden;
      background: var(--akzent);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .kopf { padding: 26px 20px 0; text-align: center; }
    h1 {
      font-size: ${b.titel}px; line-height: 1.12; font-weight: 800;
      letter-spacing: -0.4px; color: #fff;
    }
    p {
      margin-top: 9px; font-size: ${b.unter}px; line-height: 1.35;
      color: rgba(255,255,255,0.88);
    }
    /* Der Rahmen steht mittig und laeuft unten aus dem Bild. Das ist
       Absicht: Ein vollstaendig abgebildetes Telefon macht den Bildschirm
       darin kleiner, und gezeigt werden soll der Bildschirm. */
    .rahmen {
      width: ${b.rahmen}px; margin: 20px auto 0;
      border: 7px solid #2a3338; border-top-width: 9px;
      border-radius: 28px 28px 0 0; overflow: hidden;
      background: var(--papier);
      box-shadow: 0 10px 30px rgba(0,0,0,0.28);
    }
    .rahmen img { display: block; width: 100%; }
  </style>
  <div class="kopf"><h1 id="titel"></h1><p id="unter"></p></div>
  <div class="rahmen"><img id="schirm" alt=""></div>
`;

const seite = await browserStarten({ basis: BASIS });

/* Erst alle Aufnahmen, dann alle Buehnen.
 *
 * Die Buehne ersetzt den Inhalt der Seite; danach ist die App fort. Deshalb
 * wird zuerst aufgenommen und im Speicher behalten, und gestellt wird am
 * Ende. */
const roh = new Map();

try {
  await seite.groesse(360, 640, 3);
  await seite.laden('/');
  const stand = await seite.werten(FUELLEN);
  console.log(`Beispielprojekt: ${stand.posten} Posten, Budget ${stand.budget} EUR`);

  await seite.werten(`(async () => {
    localStorage.setItem('bauzeuge.installhinweis', 'installiert|' + Date.now());
    const d = await import('./daten.js');
    await d.einstellung('letzte_sicherung', new Date().toISOString().slice(0, 10));
    return true;
  })()`);

  for (const format of FORMATE) {
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
      roh.set(format.name + '/' + datei, await seite.bild());
    }
  }

  /* Jetzt die Buehne. Die App wird dabei aus der Seite geworfen -- ab hier
   * laesst sich nichts mehr aufnehmen. */
  console.log('\nBuehne stellen:');
  for (const format of FORMATE) {
    const b = format.buehne;
    const ordner = join(HIER, 'play', format.ordner);
    mkdirSync(ordner, { recursive: true });
    await seite.groesse(b.breite, b.hoehe, b.dichte);
    await seite.werten(
      `(() => { document.documentElement.innerHTML = ${JSON.stringify('<head><meta charset="utf-8"></head><body>' + BUEHNE(b) + '</body>')}; return true; })()`,
    );
    console.log(`  ${format.name} (${b.breite * b.dichte}x${b.hoehe * b.dichte})`);

    for (const [, datei, titel, unter] of BILDER) {
      const bild = roh.get(format.name + '/' + datei);
      await seite.werten(`(async () => {
        document.getElementById('titel').textContent = ${JSON.stringify(titel)};
        document.getElementById('unter').textContent = ${JSON.stringify(unter)};
        const i = document.getElementById('schirm');
        i.src = 'data:image/png;base64,${bild.toString('base64')}';
        await i.decode();
        await new Promise((g) => requestAnimationFrame(() => requestAnimationFrame(g)));
        return true;
      })()`);
      writeFileSync(join(ordner, datei + '.png'), await seite.bild());
      console.log(`    ${datei.padEnd(20)} ${titel}`);
    }
  }
} finally {
  seite.schliessen();
}

console.log('\nFertig.');
