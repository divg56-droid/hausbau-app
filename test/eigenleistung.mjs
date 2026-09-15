/* Eigenleistung geplant gegen geleistet, ohne Browser.
 *
 *     node test/eigenleistung.mjs
 */
import { eigenleistungStand } from '../www/eigenleistung.js';

let fehler = 0;
const pruef = (n, b, z = '') => { console.log((b ? '  ok   ' : '  FEHL ') + n + (b ? '' : '  ' + z)); if (!b) fehler++; };

const eintraege = [
  { gewerk: 'Maler', helfer: [{ id: 'a', stunden: 8 }, { id: 'b', stunden: 6 }] },
  { gewerk: 'Maler', helfer: [{ id: 'a', stunden: 9 }] },
  { gewerk: 'Bodenbelag', helfer: [{ id: 'a', stunden: 4 }] },
  { helfer: [{ id: 'a', stunden: 5 }] }, // ohne Gewerk zaehlt nirgends
];
const plan = { Maler: { stunden: 20, ersparnis: 4600 }, Bodenbelag: { stunden: 30 } };
const [maler, boden, garten] = eigenleistungStand(plan, ['Maler', 'Bodenbelag', 'Garten'], eintraege);

pruef('Maler: 23 Stunden geleistet', maler.ist === 23, String(maler.ist));
pruef('Maler über Plan', maler.drueber === true);
pruef('Maler: 200 € je Stunde', maler.jeStunde === 200, String(maler.jeStunde));
pruef('Boden: 4 von 30, nicht drüber', boden.ist === 4 && !boden.drueber);
pruef('Boden ohne Ersparnis: kein Stundenwert', boden.jeStunde === null);
pruef('Garten ohne Plan und Stunden', garten.soll === 0 && garten.ist === 0 && garten.anteil === null);

console.log(fehler ? `\n${fehler} Fehler.` : '\nEigenleistung stimmt.');
process.exitCode = fehler ? 1 : 0;
