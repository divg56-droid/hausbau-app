/* Prueft jeden Bildschirm der App auf ueberstehende Kaesten.
 *
 *     npm run dev          (oder der Vorschau-Server auf Port 4301)
 *     node test/breite.mjs [http://localhost:4301]
 *
 * Geprueft wird mit einem gefuellten Beispielprojekt, nicht mit einer leeren
 * App: Ein Ueberlauf entsteht an langen Namen, vielen Spalten und grossen
 * Zahlen, und all das fehlt im Leerzustand. Genau deshalb ist die
 * Baunebenkosten-Seite jahrelang niemandem aufgefallen -- ohne Posten war da
 * nichts, was ueberstehen konnte.
 *
 * 320 Pixel ist kein akademischer Fall: Ein Galaxy A-Modell im geteilten
 * Bildschirm landet dort, und auf der Baustelle steht die App neben der
 * Kamera.
 */
import { browserStarten, UEBERLAUF } from './browser.mjs';
import { FUELLEN } from './beispieldaten.mjs';

const BASIS = process.argv[2] || 'http://localhost:4301';
const BREITEN = [1280, 768, 390, 360, 320];

/* Jeder Weg, den die Leiste anbietet, plus die Unterseiten und die
 * Verwaltung. Die Liste steht hier und wird nicht aus bereiche.js gelesen:
 * Faellt dort ein Eintrag weg, soll diese Pruefung das melden und nicht
 * stillschweigend weniger pruefen. */
const WEGE = [
  '', 'projekte',
  'leitfaden', 'todos', 'todos/checklisten', 'anschlussplan',
  'baukasse', 'baukasse/kosten', 'baunebenkosten', 'angebote',
  'baukasse/rechnungen', 'baukasse/statistik', 'finanzierung', 'tilgung',
  'ablauf', 'tagebuch', 'maengel', 'raeume', 'baudoku', 'dokumente',
  'kontakte', 'kontakte/personen', 'kontakte/gewerke',
  'baukosten', 'rechner/kredite', 'rechner/nebenkosten', 'rechner/flaechen',
  'konto', 'einstellungen', 'admin',
];

const seite = await browserStarten({ basis: BASIS });
let fehler = 0;

try {
  await seite.groesse(390, 800);
  await seite.laden('/');
  const gefuellt = await seite.werten(FUELLEN);
  console.log(`Beispielprojekt: ${gefuellt.posten} Posten, Budget ${gefuellt.budget} EUR\n`);

  for (const breite of BREITEN) {
    await seite.groesse(breite, 900);
    // Nach einem Groessenwechsel einmal neu zeichnen lassen: Manche Ansichten
    // rechnen ihre Spalten beim Aufbau aus und nicht bei jedem Bildpunkt.
    await seite.hin('', 600);

    const schlimm = [];
    for (const weg of WEGE) {
      await seite.hin(weg, 700);
      const m = await seite.werten(UEBERLAUF);
      if (m.quer || m.ueber.length) {
        schlimm.push(`    ${('#/' + weg).padEnd(24)} ${m.quer ? `quer bis ${m.scroll} ` : ''}${m.ueber.join(', ')}`);
      }
    }

    if (schlimm.length) {
      fehler += schlimm.length;
      console.log(`  ${String(breite).padStart(4)} px  ${schlimm.length} Bildschirm(e):`);
      console.log(schlimm.join('\n'));
    } else {
      console.log(`  ${String(breite).padStart(4)} px  alle ${WEGE.length} in Ordnung`);
    }
  }
} finally {
  seite.schliessen();
}

console.log(fehler ? `\nFEHLGESCHLAGEN: ${fehler} Ueberlaeufe.` : '\nKein Ueberlauf.');
process.exit(fehler ? 1 : 0);
