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

/* Jedes Anlegen-Formular einmal aufmachen.
 *
 * Die Luecke, durch die "Rechnung erfassen" gekommen ist: Der Durchlauf oben
 * oeffnet Bildschirme, keine Formulare. Dort lag ein ReferenceError -- eine
 * oertliche Variable hiess wie ein Import und beschattete ihn --, und
 * gefunden hat ihn niemand, weil niemand den Knopf gedrueckt hat.
 *
 * Gedrueckt wird, was nach Anlegen aussieht: "hinzufuegen", "erfassen",
 * "anlegen", "neu". Was sich oeffnet, wird gleich wieder geschlossen.
 */
async function formulare(seite, titel) {
  const wege = await seite.werten(`(async () => {
    const { MODULE } = await import('/bereiche.js');
    return MODULE.map((m) => m.weg).filter((w) => w !== '');
  })()`);

  const kaputt = [];
  let geoeffnet = 0;

  for (const weg of wege) {
    await seite.hin(weg, 700);
    seite.klagenHolen();

    const knoepfe = await seite.werten(`(() => [...document.querySelectorAll('#inhalt button')]
      .map((b, i) => ({ i, text: b.textContent.trim().slice(0, 40) }))
      .filter((b) => /hinzuf|erfass|anlegen|^neue|neuer |ergänz/i.test(b.text)))()`);

    for (const { i, text } of knoepfe.slice(0, 3)) {
      const wie = await seite.werten(`(async () => {
        document.querySelectorAll('#inhalt button')[${i}].click();
        await new Promise((g) => setTimeout(g, 900));
        const blatt = document.querySelector('.ueberlagerung');
        const zettel = !document.getElementById('startfehler').hidden;
        if (blatt) blatt.remove();
        return { blatt: !!blatt, zettel };
      })()`);
      // Rueckfragen abholen, damit sie nicht in den naechsten Durchgang
      // hineinragen -- beantwortet hat sie der Browser-Helfer schon.
      seite.dialogeHolen();
      const klagen = seite.klagenHolen().filter(ernst);
      geoeffnet++;
      if (klagen.length || wie.zettel) {
        kaputt.push(`#/${weg} "${text}": ` +
          (wie.zettel ? '[Startzettel] ' : '') +
          klagen.map((k) => `[${k.art}] ${String(k.text).slice(0, 140)}`).join(' '));
      }
    }
  }

  console.log(`\n${titel} (${geoeffnet} Formulare)`);
  pruef('Jedes Formular oeffnet ohne Fehler', kaputt.length === 0,
    '\n       ' + kaputt.slice(0, 6).join('\n       '));
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

  await formulare(seite, 'Anlegen-Formulare');
} finally {
  seite.schliessen();
}

console.log(fehler ? `\nFEHLGESCHLAGEN: ${fehler}` : '\nAlle Bildschirme laufen sauber durch.');
process.exit(fehler ? 1 : 0);
