/* Laufzeit und Buchcode, ohne Browser.
 *
 *     node test/laufzeit.mjs
 */
import { codeNormalisieren, laufzeitText } from '../www/laufzeit.js';

let fehler = 0;
const pruef = (n, b, z = '') => { console.log((b ? '  ok   ' : '  FEHL ') + n + (b ? '' : '  ' + z)); if (!b) fehler++; };

pruef('Bindestrich und Kleinschrift egal', codeNormalisieren('qakr-tzk9') === 'QAKR-TZK9'.replace('-', ''));
pruef('Leerzeichen fliegen raus', codeNormalisieren(' QAKR tzk9 ') === 'QAKRTZK9');
pruef('Nichts bleibt nichts', codeNormalisieren(null) === '');

const bis = '27.10.2026';  // so schreibt datumLang()
pruef('Ohne Laufzeit kein Datum',
  laufzeitText({}, bis) === 'Die Laufzeit steht noch nicht fest.');
pruef('Zeit laeuft',
  laufzeitText({ frei_bis: '2026-10-27 12:00:00', tage_frei: 30 }, bis)
    === 'Kostenlos bis 27.10.2026: noch 30 Tage.');
pruef('Ein Tag im Singular',
  laufzeitText({ frei_bis: '2026-10-27 12:00:00', tage_frei: 1 }, bis).includes('noch 1 Tag.'));
pruef('Buchcode wird genannt',
  laufzeitText({ frei_bis: '2026-12-27 12:00:00', tage_frei: 91, buchcode: true }, bis)
    .startsWith('Mit dem Code aus dem Buch'));
pruef('Abgelaufen sperrt nicht, sondern erklaert',
  laufzeitText({ frei_bis: '2026-08-01 12:00:00', tage_frei: 0 }, bis).includes('abgelaufen'));
pruef('Negative Tage gelten als abgelaufen',
  laufzeitText({ frei_bis: '2026-08-01 12:00:00', tage_frei: -12 }, bis).includes('abgelaufen'));

console.log(fehler ? `\n${fehler} Fehler.` : '\nLaufzeit stimmt.');
process.exitCode = fehler ? 1 : 0;
