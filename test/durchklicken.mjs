/* Geht jeden Bildschirm der App durch und horcht auf Fehler.
 *
 *     node test/durchklicken.mjs [http://localhost:4301]
 *
 * Gedacht fuer das gebaute Paket: entpacktes APK ausliefern, diese Adresse
 * uebergeben, und man weiss, ob das, was auf dem Telefon landet, ohne Fehler
 * durchlaeuft -- nicht bloss, ob es der Arbeitsstand tut.
 *
 * Anlass ist die Ablehnung einer anderen App mit "stuerzt ab". In einer
 * WebView heisst das fast immer: irgendwo wirft JavaScript, der Bildschirm
 * bleibt leer, und fuer den Pruefenden ist das ein Absturz. Ein leerer
 * Bereich ist hier deshalb genauso ein Fehlschlag wie eine Ausnahme.
 *
 * Geprueft wird zweimal: einmal mit leeren Speichern, wie bei einer frisch
 * installierten App -- genau das sieht eine Pruefstelle --, und einmal mit
 * einem gefuellten Beispielprojekt, weil Listen, lange Namen und grosse
 * Zahlen andere Wege durch den Code nehmen.
 */
import { browserStarten } from './browser.mjs';
import { FUELLEN } from './beispieldaten.mjs';

const BASIS = process.argv[2] || 'http://localhost:4301';

let fehler = 0;
const pruef = (name, bedingung, zusatz = '') => {
  if (bedingung) console.log('  ok   ' + name);
  else { console.log('  FEHL ' + name + '  ' + zusatz); fehler++; }
};

/* Was beim Laden der Seite an Klagen anfaellt, ohne dass etwas kaputt ist.
 * Der Wetterdienst ist im Pruefaufbau nicht erreichbar, und die
 * Schnittstelle liegt auf bauzeuge.de -- beides faengt die App selbst ab. */
const HARMLOS = [
  /brightsky/i, /bauzeuge\.de\/app\/api/i, /ERR_INTERNET_DISCONNECTED/i,
  /Keine Verbindung/i, /favicon/i, /Nicht angemeldet/i,
];
const ernst = (k) => !HARMLOS.some((m) => m.test(k.text || '') || m.test(k.wo || ''));

async function durchlauf(seite, titel, vorbereiten) {
  const wege = await seite.werten(`(async () => {
    const { MODULE } = await import('/bereiche.js');
    return MODULE.map((m) => m.weg);
  })()`);

  if (vorbereiten) await vorbereiten(seite);
  seite.klagenHolen();

  const leer = [];
  const laut = [];
  for (const weg of wege) {
    await seite.hin(weg, 900);
    const stand = await seite.werten(`({
      kinder: document.getElementById('inhalt').children.length,
      zettel: !document.getElementById('startfehler').hidden,
    })`);
    if (stand.kinder === 0 || stand.zettel) leer.push('#/' + weg);
    for (const k of seite.klagenHolen().filter(ernst)) {
      laut.push(`#/${weg}: [${k.art}] ${String(k.text).slice(0, 120)}`);
    }
  }

  console.log(`\n${titel} (${wege.length} Bildschirme)`);
  pruef('Jeder Bildschirm zeigt etwas', leer.length === 0, leer.join(', '));
  pruef('Keine Fehlermeldung unterwegs', laut.length === 0,
    '\n       ' + laut.slice(0, 6).join('\n       '));
}

const seite = await browserStarten({ basis: BASIS });

try {
  await seite.groesse(390, 840);
  await seite.laden('/');
  await new Promise((g) => setTimeout(g, 1500));

  // So sieht die App aus, wenn sie gerade installiert wurde.
  await durchlauf(seite, 'Frisch installiert, ohne Daten', null);

  // Und so, wenn jemand damit arbeitet.
  await durchlauf(seite, 'Mit Beispielprojekt', async (s) => {
    await s.werten(FUELLEN);
    await s.hin('', 600);
  });
} finally {
  seite.schliessen();
}

console.log(fehler ? `\nFEHLGESCHLAGEN: ${fehler}` : '\nAlle Bildschirme laufen sauber durch.');
process.exit(fehler ? 1 : 0);
