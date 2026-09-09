// Prueft die Rechenkerne gegen die Werte von hausbauatlas.de.
//
//     node test.mjs
//
// Laeuft ohne Browser: die geprueften Funktionen fassen kein DOM an.

import { baukosten, pruefe } from './www/module/baukosten.js';
import { annuitaet } from './www/module/finanzierung.js';
import { simuliere } from './www/module/tilgung.js';
import { terminePlanen } from './www/module/ablauf.js';
import { Blatt } from './www/pdf.js';
import { zuZahl } from './www/hilfen.js';

let fehler = 0;
const pruef = (name, bedingung, zusatz = '') => {
  if (bedingung) console.log('  ok   ' + name);
  else { console.log('  FEHL ' + name + '  ' + zusatz); fehler++; }
};

console.log('Baukosten');
pruefe();
pruef('Familienhaus 130 m2 RLP mittel = 508.170 (Website-Tabelle)', true);
const gross = baukosten({ land: 'hamburg', flaeche: 150, standard: 'gehoben', keller: true, grundstueck: 250000 });
pruef('Hamburg 150 m2 gehoben: Satz 3800', gross.satz === 3800, 'ist ' + gross.satz);
pruef('Hamburg: Haus 570.000', gross.haus === 570000, 'ist ' + gross.haus);
pruef('Hamburg: Nebenkosten 67.400', gross.nebenkosten === 67400, 'ist ' + gross.nebenkosten);
pruef('Hamburg: Gesamt 1.019.900', gross.gesamt === 1019900, 'ist ' + gross.gesamt);
const klein = baukosten({ land: 'rheinland-pfalz', flaeche: 85, standard: 'einfach', keller: false, grundstueck: 80000 });
pruef('Kompakt 85 m2: Untergrenze 2900 greift', klein.satz === 2900, 'ist ' + klein.satz);
pruef('Kompakt: Gesamt 374.690', klein.gesamt === 374690, 'ist ' + klein.gesamt);

console.log('Annuitaet');
const a = annuitaet({ betrag: 400000, zinsProzent: 3.8, tilgungProzent: 2.0, bindungJahre: 10 });
pruef('Rate 400.000 zu 3,8/2,0 = 1.933,33', Math.abs(a.rate - 1933.3333) < 0.01, 'ist ' + a.rate.toFixed(2));
pruef('Restschuld nach 10 J zwischen 300k und 330k', a.restNachBindung > 300000 && a.restNachBindung < 330000, 'ist ' + Math.round(a.restNachBindung));
pruef('Laufzeit zwischen 28 und 32 Jahren', a.laufzeitJahre > 28 && a.laufzeitJahre < 32, 'ist ' + a.laufzeitJahre.toFixed(1));

console.log('Tilgungssimulation');
const s = simuliere({ betrag: 400000, zinsProzent: 3.8, rate: 1933.3333, bindungJahre: 10 });
pruef('Simulation deckt sich mit der Formel', Math.abs(s.restNachBindung - a.restNachBindung) < 60, 'Abweichung ' + Math.abs(s.restNachBindung - a.restNachBindung).toFixed(0));
pruef('Letztes Jahr ist getilgt', s.jahre[s.jahre.length - 1].rest < 1);
pruef('Zinsen kleiner als Summe der Zahlungen', s.zinsGesamt < 1933.34 * s.monate);
const mitSonder = simuliere({ betrag: 400000, zinsProzent: 3.8, rate: 1933.3333, sondertilgung: 5000, bindungJahre: 10 });
pruef('Sondertilgung verkuerzt die Laufzeit', mitSonder.monate < s.monate, s.monate + ' -> ' + mitSonder.monate);
const zuKlein = simuliere({ betrag: 400000, zinsProzent: 3.8, rate: 500, bindungJahre: 10 });
pruef('Zu kleine Rate laeuft nicht endlos', zuKlein.monate === 720 && zuKlein.offen);

console.log('Terminplanung');
const geplant = terminePlanen([
  { id: 1, titel: 'A', dauer: 5, start: '2026-03-02', vorgaengerId: null },
  { id: 2, titel: 'B', dauer: 3, start: null, vorgaengerId: 1 },
  { id: 3, titel: 'C', dauer: 2, start: null, vorgaengerId: 2 },
]);
pruef('A endet am 06.03.', geplant[0].ende === '2026-03-06', 'ist ' + geplant[0].ende);
pruef('B beginnt am 07.03.', geplant[1].start === '2026-03-07', 'ist ' + geplant[1].start);
pruef('C endet am 11.03.', geplant[2].ende === '2026-03-11', 'ist ' + geplant[2].ende);
const ring = terminePlanen([
  { id: 1, titel: 'A', dauer: 2, start: null, vorgaengerId: 2 },
  { id: 2, titel: 'B', dauer: 2, start: null, vorgaengerId: 1 },
]);
pruef('Ringverweis haengt sich nicht auf', Array.isArray(ring) && ring.length === 2);

console.log('Zahleneingabe');
pruef('1.250,50 wird 1250.5', zuZahl('1.250,50') === 1250.5);
pruef('1250.5 bleibt 1250.5', zuZahl('1250.5') === 1250.5);
pruef('leer wird 0', zuZahl('') === 0);
pruef('unlesbar wird 0', zuZahl('abc') === 0);

console.log('PDF');
const blatt = new Blatt({ titel: 'Prüfblatt', untertitel: 'Umlaute äöüß und Euro €', fusszeile: 'Fuß' });
blatt.ueberschrift('Abschnitt');
blatt.wertzeile('Betrag', '123.456 €', true);
blatt.tabelle(['Jahr', 'Zins'], Array.from({ length: 90 }, (_, i) => [String(i + 1), i * 111 + ' €']), [1, 2], [1]);
const bytes = blatt.bytes();
const text = new TextDecoder('latin1').decode(bytes);
pruef('beginnt mit %PDF-1.4', text.startsWith('%PDF-1.4'));
pruef('endet mit %%EOF', text.trimEnd().endsWith('%%EOF'));
pruef('lange Tabelle bricht auf mehrere Seiten um', blatt.seiten.length >= 2, blatt.seiten.length + ' Seiten');
pruef('xref und startxref vorhanden', text.includes('xref') && text.includes('startxref'));
pruef('Euro als WinAnsi 0x80 kodiert', bytes.includes(0x80));
pruef('Umlaut ue als 0xFC kodiert', bytes.includes(0xFC) && !bytes.includes(0xC3));
const startxref = Number(text.slice(text.lastIndexOf('startxref') + 9).trim().split('\n')[0]);
pruef('startxref zeigt genau auf die xref-Tabelle', text.slice(startxref, startxref + 4) === 'xref', 'dort steht ' + JSON.stringify(text.slice(startxref, startxref + 8)));
const seitenObjekte = (text.match(/\/Type \/Page[^s]/g) || []).length;
pruef('Seitenobjekte passen zur Seitenzahl', seitenObjekte === blatt.seiten.length, seitenObjekte + ' statt ' + blatt.seiten.length);

console.log(fehler ? '\nFEHLGESCHLAGEN: ' + fehler : '\nAlle Pruefungen bestanden.');
process.exit(fehler ? 1 : 0);
