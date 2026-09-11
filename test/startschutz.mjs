/* Prueft, dass die App nie als weisse Flaeche endet.
 *
 *     npm run dev          (oder der Vorschau-Server auf Port 4301)
 *     node test/startschutz.mjs [http://localhost:4301]
 *
 * Anlass: Eine andere App desselben Kontos wurde vom Play Store mit der
 * Begruendung abgelehnt, sie stuerze ab. Bei einer App, die in einer WebView
 * laeuft, heisst das fast immer dasselbe -- ein JavaScript-Fehler beim
 * Start, danach steht nichts da. Fuer den Pruefenden ist das ein Absturz,
 * und er hat recht: Eine weisse Flaeche ist nicht weniger kaputt als ein
 * geschlossenes Fenster.
 *
 * Geprueft wird deshalb nicht, ob die App laeuft -- das tun die anderen
 * Pruefungen. Geprueft wird, was passiert, wenn sie es nicht tut.
 */
import { browserStarten } from './browser.mjs';

const BASIS = process.argv[2] || 'http://localhost:4301';

let fehler = 0;
const pruef = (name, bedingung, zusatz = '') => {
  if (bedingung) console.log('  ok   ' + name);
  else { console.log('  FEHL ' + name + '  ' + zusatz); fehler++; }
};

const STAND = `({
  zettel: !document.getElementById('startfehler').hidden,
  grund: (document.getElementById('startfehler-grund') || {}).textContent || '',
  inhalt: document.getElementById('inhalt').children.length,
  /* Ueberschrift statt "main h1": Ein frisch installiertes Konto sieht die
     Willkommenskarte, und die traegt ein h2. Genau dieser Bildschirm ist
     der, den eine Pruefstelle zu sehen bekommt. */
  titel: (document.querySelector('#inhalt h1, #inhalt h2') || {}).textContent || '',
  ersatz: typeof Element.prototype.replaceChildren === 'function',
})`;

async function fall(vorbereiten, warten = 2500) {
  const seite = await browserStarten({ basis: BASIS });
  try {
    await seite.groesse(390, 800);
    if (vorbereiten) await vorbereiten(seite);
    await seite.laden('/');
    await new Promise((g) => setTimeout(g, warten));
    return await seite.werten(STAND);
  } finally {
    seite.schliessen();
  }
}

console.log('Startschutz');

// 1. Der Normalfall. Ohne ihn sagt der Rest nichts aus: Ein Zettel, der
//    immer steht, ist so schlimm wie einer, der nie steht.
const gut = await fall();
pruef('Normaler Start zeichnet die Übersicht', gut.inhalt > 0 && gut.titel.length > 0,
  JSON.stringify(gut));
pruef('Und zeigt keinen Zettel', !gut.zettel);

// 2. Eine Datei kommt nicht an. Das wirft nichts -- der Bildschirm bliebe
//    ohne den Zeitgeber einfach leer.
const weg = await fall((s) => s.blockieren(['*/app.js']), 8000);
pruef('Fehlt app.js, steht nach sechs Sekunden der Zettel', weg.zettel, JSON.stringify(weg));
pruef('Und nicht der leere Bildschirm', weg.inhalt === 0 || weg.zettel);

// 3. Ein Fehler beim Start, wie ihn ein alter WebView wirft.
const kaputt = await fall((s) => s.vorschalten(`
  window.addEventListener('DOMContentLoaded', () => {
    throw new Error('Pruefung: so sieht ein alter WebView aus');
  });
`));
pruef('Ein Fehler beim Start zeigt den Zettel', kaputt.zettel, JSON.stringify(kaputt));
pruef('Mit der Meldung darin', kaputt.grund.includes('Pruefung'), kaputt.grund);

// 4. Ein WebView vor Chrome 86 kennt replaceChildren nicht. Die App benutzt
//    es an jeder Stelle, an der ein Bildschirm neu entsteht.
const alt = await fall((s) => s.vorschalten(`
  delete Element.prototype.replaceChildren;
  delete DocumentFragment.prototype.replaceChildren;
`));
pruef('Ohne replaceChildren springt der Ersatz ein', alt.ersatz, JSON.stringify(alt));
pruef('Und die Übersicht steht trotzdem', alt.inhalt > 0 && alt.titel.length > 0,
  JSON.stringify(alt));
pruef('Ohne Zettel, denn es ist nichts kaputt', !alt.zettel);

console.log(fehler ? `\nFEHLGESCHLAGEN: ${fehler}` : '\nDer Startschutz haelt.');
process.exit(fehler ? 1 : 0);
