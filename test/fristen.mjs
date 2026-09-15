/* Fristen je Firma, ohne Browser.
 *
 *     node test/fristen.mjs
 */
import { plusJahre, gewaehrleistungsEnde, faelligeFristen } from '../www/fristen.js';

let fehler = 0;
const pruef = (n, b, z = '') => { console.log((b ? '  ok   ' : '  FEHL ') + n + (b ? '' : '  ' + z)); if (!b) fehler++; };

pruef('5 Jahre ab Abnahme', gewaehrleistungsEnde({ gewaehrleistung: 'bgb', abnahme: '2026-03-15' }) === '2031-03-15');
pruef('VOB/B 4 Jahre', gewaehrleistungsEnde({ gewaehrleistung: 'vob', abnahme: '2026-03-15' }) === '2030-03-15');
pruef('Kein Bauwerk 2 Jahre', gewaehrleistungsEnde({ gewaehrleistung: 'kurz', abnahme: '2026-03-15' }) === '2028-03-15');
pruef('Eigenes Ende gilt', gewaehrleistungsEnde({ gewaehrleistung: 'eigen', gewaehrleistungBis: '2030-01-01', abnahme: '2026-03-15' }) === '2030-01-01');
pruef('Ohne Abnahme kein Ende', gewaehrleistungsEnde({ gewaehrleistung: 'bgb' }) === null);
pruef('29. Februar wird 28.', plusJahre('2028-02-29', 1) === '2029-02-28', plusJahre('2028-02-29', 1));

const k = [
  { id: 'a', gewaehrleistung: 'bgb', abnahme: '2021-11-01' },  // endet 2026-11-01
  { id: 'b', gewaehrleistung: 'bgb', abnahme: '2024-01-01' },  // endet 2029, noch weit
  { id: 'c', festpreisBis: '2026-10-20' },
  { id: 'd', festpreisBis: '2027-06-01' },
  { id: 'e', gewaehrleistung: 'bgb', abnahme: '2021-06-01' },  // abgelaufen vor mehr als 30 Tagen
];
const f = faelligeFristen(k, '2026-09-16');
const ids = f.map((x) => x.kontakt.id + ':' + x.art);
pruef('Gewährleistung in 46 Tagen ist fällig', ids.includes('a:gewaehrleistung'), JSON.stringify(ids));
pruef('Weit entferntes Ende nicht', !ids.includes('b:gewaehrleistung'));
pruef('Festpreis in 34 Tagen ist fällig', ids.includes('c:festpreis'));
pruef('Festpreis in 8 Monaten nicht', !ids.includes('d:festpreis'));
pruef('Lange abgelaufen nicht mehr', !ids.includes('e:gewaehrleistung'));
pruef('Nach Nähe sortiert', f[0].kontakt.id === 'c', JSON.stringify(ids));

console.log(fehler ? `\n${fehler} Fehler.` : '\nFristen stimmen.');
process.exitCode = fehler ? 1 : 0;
