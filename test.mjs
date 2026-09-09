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
import { neueKennung, umschreiben } from './www/daten.js';
import { helferVon, stundenJeHelfer } from './www/module/tagebuch.js';

const TEST_JPEG =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAAYACgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDeREjjWONQiKAFVRgADsBQiJHGscahEUAKqjAAHYChESONY41CIoAVVGAAOwFCIkcaxxqERQAqqMAAdgK+DbPpAREjjWONQiKAFVRgADsBQiJHGscahEUAKqjAAHYChESONY41CIoAVVGAAOwFCIkcaxxqERQAqqMAAdgKGwBESONY41CIoAVVGAAOwFFCIkcaxxqERQAqqMAAdgKKGMERI41jjUIigBVUYAA7AUIiRxrHGoRFACqowAB2AooouAIiRxrHGoRFACqowAB2AoREjjWONQiKAFVRgADsBRRRcAREjjWONQiKAFVRgADsBRRRSA//2Q==';

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


console.log('Bilder im PDF');
// Ein echtes 40x24-JPEG als Grundlage. Der Weg ueber bildLaden() braucht ein
// Canvas und laesst sich nur im Browser pruefen; die Einbettung selbst
// haengt daran nicht.
const jpegBytes = Uint8Array.from(atob(TEST_JPEG), (z) => z.charCodeAt(0));
const testbild = { bytes: jpegBytes, breite: 40, hoehe: 24, kanaele: 3 };

const mitBild = new Blatt({ titel: 'Mängelliste', fusszeile: 'Prüfung' });
mitBild.ueberschrift('1. Kratzer in der Fensterbank');
mitBild.wertzeile('Raum', 'Wohnzimmer');
mitBild.bilderreihe([testbild, testbild, testbild], { hoehe: 108 });
const rahmen = mitBild.bildGross(testbild);
mitBild.marke(rahmen, 0.25, 0.4, 1);
mitBild.marke(rahmen, 0.8, 0.7, 12, [37, 99, 235]);
const bb = mitBild.bytes();
const bt = new TextDecoder('latin1').decode(bb);

pruef('Bild nur einmal eingebettet trotz vierfacher Nutzung', mitBild.bilder.length === 1, mitBild.bilder.length + ' Bilder');
pruef('XObject im Betriebsmittelverzeichnis', bt.includes('/XObject << /Im0'));
pruef('Bildobjekt mit DCTDecode', bt.includes('/Subtype /Image') && bt.includes('/Filter /DCTDecode'));
pruef('Masse im Bildobjekt', bt.includes('/Width 40 /Height 24'));
pruef('Farbraum RGB', bt.includes('/ColorSpace /DeviceRGB'));
pruef('Bild wird viermal gezeichnet', (bt.match(/\/Im0 Do/g) || []).length === 4, (bt.match(/\/Im0 Do/g) || []).length + ' Aufrufe');
pruef('JPEG-Daten unveraendert eingebettet', bt.includes(String.fromCharCode(0xff, 0xd8, 0xff, 0xe0)));
pruef('Marken als Bezierkurven', (bt.match(/ c /g) || []).length >= 8, (bt.match(/ c /g) || []).length + ' Boegen');
const sx2 = Number(bt.slice(bt.lastIndexOf('startxref') + 9).trim().split('\n')[0]);
pruef('Querverweistabelle stimmt trotz Bildobjekten', bt.slice(sx2, sx2 + 4) === 'xref', JSON.stringify(bt.slice(sx2, sx2 + 8)));
const nummern = [...bt.matchAll(/^(\d+) 0 obj$/gm)].map((m) => Number(m[1]));
pruef('Objektnummern eindeutig und lueckenlos', new Set(nummern).size === nummern.length && Math.max(...nummern) === nummern.length, nummern.length + ' Objekte, hoechste ' + Math.max(...nummern));

const grau = new Blatt({ titel: 'Grau' });
grau.bilderreihe([{ bytes: jpegBytes, breite: 40, hoehe: 24, kanaele: 1 }]);
pruef('Ein Farbkanal ergibt Graustufen', new TextDecoder('latin1').decode(grau.bytes()).includes('/ColorSpace /DeviceGray'));

const ohne = new Blatt({ titel: 'Ohne Bild' });
ohne.absatz('nur Text');
pruef('Ohne Bilder kein XObject-Verzeichnis', !new TextDecoder('latin1').decode(ohne.bytes()).includes('/XObject'));

const viele = new Blatt({ titel: 'Umbruch' });
viele.bilderreihe(Array.from({ length: 30 }, () => testbild), { hoehe: 108 });
viele.bytes();
pruef('Viele Bilder brechen auf mehrere Seiten um', viele.seiten.length >= 2, viele.seiten.length + ' Seiten');


console.log('Helferstunden');
const KONTAKTE = [
  { id: 1, name: 'Onkel Fritz', art: 'helfer' },
  { id: 2, name: 'Nachbar Klein', art: 'helfer' },
  { id: 3, name: 'Schwager Ott', art: 'helfer' },
];
const TAGE = [
  { id: 10, datum: '2026-05-02', helfer: [{ id: 1, stunden: 8 }, { id: 2, stunden: 4.5 }] },
  { id: 11, datum: '2026-05-03', helfer: [{ id: 1, stunden: 6 }] },
  // Alter Eintrag ohne Stunden: muss lesbar bleiben und mit 0 zaehlen
  { id: 12, datum: '2026-05-04', helferIds: [1, 3] },
];

const norm = helferVon(TAGE[2]);
pruef('Alter Eintrag wird gelesen', norm.length === 2 && norm[0].stunden === 0, JSON.stringify(norm));
pruef('Neuer Eintrag behaelt die Stunden', helferVon(TAGE[0])[1].stunden === 4.5);

const summe = stundenJeHelfer(TAGE, KONTAKTE);
const fritz = summe.find((h) => h.name === 'Onkel Fritz');
const nachbar = summe.find((h) => h.name === 'Nachbar Klein');
const ott = summe.find((h) => h.name === 'Schwager Ott');
pruef('Fritz: 8 + 6 + 0 = 14 Stunden', fritz.stunden === 14, 'ist ' + fritz.stunden);
pruef('Fritz war an 3 Tagen da', fritz.tage === 3, 'ist ' + fritz.tage);
pruef("Klein: 4,5 Stunden an 1 Tag", nachbar.stunden === 4.5 && nachbar.tage === 1);
pruef('Ott aus dem alten Eintrag: 0 Stunden, 1 Tag', ott.stunden === 0 && ott.tage === 1);
pruef('Absteigend nach Stunden sortiert', summe[0].name === 'Onkel Fritz' && summe[summe.length - 1].stunden === 0);
pruef('Gesamtsumme 18,5', summe.reduce((s, h) => s + h.stunden, 0) === 18.5);
pruef('Ohne Eintraege leere Liste', stundenJeHelfer([], KONTAKTE).length === 0);
pruef('Unbekannte id bekommt einen Platzhalter', stundenJeHelfer([{ helfer: [{ id: 99, stunden: 2 }] }], KONTAKTE)[0].name === 'Unbekannt');


console.log('Kennungen und Wanderung');
const k1 = neueKennung(), k2 = neueKennung();
const istUuid = (x) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(x);
pruef('Kennung hat UUID-Form', istUuid(k1), k1);
pruef('zwei Kennungen sind verschieden', k1 !== k2);
pruef('tausend Kennungen ohne Doppelung', new Set(Array.from({length:1000}, neueKennung)).size === 1000);

// Karte alte Nummer -> neue Kennung, wie sie die Wanderung aufbaut
const karte = {
  kontakte:  new Map([[1,'K-eins'],[2,'K-zwei']]),
  bilder:    new Map([[1,'B-eins'],[7,'B-sieben']]),
  geschosse: new Map([[1,'G-eins']]),
  maengel:   new Map([[1,'M-eins']]),
  darlehen:  new Map([[1,'D-eins']]),
  aufgaben:  new Map([[1,'A-eins'],[2,'A-zwei']]),
  pins: new Map(), belege: new Map(), tagebuch: new Map(),
};
const ZEIT = '2026-09-09T00:00:00.000Z';

const pin = umschreiben('pins', { id:1, geschossId:1, bildId:7, art:'steckdose' }, { ...karte, pins:new Map([[1,'P-eins']]) }, ZEIT);
pruef('Pin: eigene Kennung', pin.id === 'P-eins');
pruef('Pin: Geschossverweis', pin.geschossId === 'G-eins');
pruef('Pin: Bildverweis', pin.bildId === 'B-sieben');
pruef('Pin: Sachfeld unangetastet', pin.art === 'steckdose');
pruef('Pin: bekommt geaendert', pin.geaendert === ZEIT);
pruef('Pin: nicht als geloescht markiert', pin.geloescht === false);

const mangel = umschreiben('maengel', { id:1, kontaktId:2, bildIds:[1,7], titel:'Riss' }, karte, ZEIT);
pruef('Mangel: Kontaktverweis', mangel.kontaktId === 'K-zwei');
pruef('Mangel: Bildliste', JSON.stringify(mangel.bildIds) === '["B-eins","B-sieben"]');

const folge = umschreiben('aufgaben', { id:2, vorgaengerId:1, kontaktId:1, mangelId:1 }, karte, ZEIT);
pruef('Aufgabe: Verweis auf denselben Speicher', folge.vorgaengerId === 'A-eins');
pruef('Aufgabe: Mangelverweis', folge.mangelId === 'M-eins');

const ohneVerweis = umschreiben('aufgaben', { id:1, vorgaengerId:null, kontaktId:null }, karte, ZEIT);
pruef('leerer Verweis bleibt leer', ohneVerweis.vorgaengerId === null && ohneVerweis.kontaktId === null);

const tot = umschreiben('pins', { id:1, geschossId:99, bildId:1 }, { ...karte, pins:new Map([[1,'P']]) }, ZEIT);
pruef('Verweis ins Leere wird null, statt eine falsche Kennung zu erben', tot.geschossId === null);

const tag = umschreiben('tagebuch', { id:1, helferIds:[1,2,99], helfer:[{id:2,stunden:7.5},{id:99,stunden:3}], bildIds:[7] }, { ...karte, tagebuch:new Map([[1,'T']]) }, ZEIT);
pruef('Tagebuch: Helferliste umgeschrieben', JSON.stringify(tag.helferIds) === '["K-eins","K-zwei"]');
pruef('Tagebuch: unbekannter Helfer faellt raus', tag.helfer.length === 1 && tag.helfer[0].id === 'K-zwei');
pruef('Tagebuch: Stunden bleiben', tag.helfer[0].stunden === 7.5);

const beleg = umschreiben('belege', { id:1, kontaktId:1, quelleId:1, bildId:1, betrag:1250.5 }, { ...karte, belege:new Map([[1,'BE']]) }, ZEIT);
pruef('Beleg: alle drei Verweise', beleg.kontaktId === 'K-eins' && beleg.quelleId === 'D-eins' && beleg.bildId === 'B-eins');
pruef('Beleg: Betrag unveraendert', beleg.betrag === 1250.5);

const altZeit = umschreiben('maengel', { id:1, geaendert:'2020-01-01T00:00:00.000Z' }, karte, ZEIT);
pruef('vorhandener Zeitstempel wird nicht ueberschrieben', altZeit.geaendert === '2020-01-01T00:00:00.000Z');

console.log(fehler ? '\nFEHLGESCHLAGEN: ' + fehler : '\nAlle Pruefungen bestanden.');
process.exit(fehler ? 1 : 0);
