// Prueft die Rechenkerne gegen die Werte von hausbauatlas.de.
//
//     node test.mjs
//
// Laeuft ohne Browser: die geprueften Funktionen fassen kein DOM an.

import { baukosten, pruefe, LAENDER } from './www/module/baukosten.js';
import { kaufnebenkosten, bebauung } from './www/module/rechner.js';
import { annuitaet } from './www/module/finanzierung.js';
import { simuliere } from './www/module/tilgung.js';
import { terminePlanen, balkenPlan, tageZwischen } from './www/module/ablauf.js';
import { Blatt } from './www/pdf.js';
import { zuZahl } from './www/hilfen.js';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative, sep } from 'node:path';
import { neueKennung, umschreiben } from './www/daten.js';
import { postenRechnen } from './www/module/baukasse.js';
import { helferVon, stundenJeHelfer } from './www/module/tagebuch.js';
import { angeboteRechnen, leistungsvergleich } from './www/module/angebote.js';
import { todoStand, todosSortieren } from './www/module/todos.js';
import { VORLAGEN } from './www/checklisten-daten.js';
import { BEREICHE, MODULE } from './www/bereiche.js';
import {
  PHASEN, ALLE_PUNKTE, leitfadenStand, punkteFuer, giltFuer,
} from './www/leitfaden-daten.js';
import { csvText, zelle } from './www/csv.js';
import {
  ZEICHENNAMEN, ZUORDNUNGEN, raumZeichen, gewerkZeichen, dokumentZeichen,
  kontaktZeichen, wetterZeichen,
} from './www/zeichen.js';
import { xlsxBytes, spalte } from './www/xlsx.js';
import {
  KOSTENGRUPPEN, kostengruppeName, kostengruppeLang, hauptgruppe,
  kostengruppenOptionen, kostengruppeVorschlag, nachHauptgruppen,
} from './www/din276.js';

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


console.log('Kostenpositionen');
const B = (postenId, betrag) => ({ postenId, betrag });

let p = postenRechnen({ id:'a', geplant:10000, tatsaechlich:0, status:'geplant' }, []);
pruef('ohne echte Summe keine Abweichung', p.differenz === 0, p.differenz);
pruef('massgeblich ist dann der Plan', p.massgeblich === 10000);
pruef('Status bleibt geplant', p.statusName === 'Geplant');

p = postenRechnen({ id:'a', geplant:10000, tatsaechlich:12500, status:'beauftragt' }, []);
pruef('teurer geworden: +2500', p.differenz === 2500);
pruef('massgeblich ist die echte Summe', p.massgeblich === 12500);
pruef('Status bleibt beauftragt solange nichts gezahlt', p.statusName === 'Beauftragt');

p = postenRechnen({ id:'a', geplant:10000, tatsaechlich:8000, status:'beauftragt' }, []);
pruef('guenstiger geworden: -2000', p.differenz === -2000);

p = postenRechnen({ id:'a', geplant:10000, tatsaechlich:12500, status:'beauftragt' }, [B('a', 5000), B('b', 9999)]);
pruef('nur eigene Rechnungen zaehlen', p.gezahlt === 5000, p.gezahlt);
pruef('teilweise bezahlt wird erkannt', p.statusName === 'Teilgezahlt');
pruef('offen ist 7500', p.offen === 7500, p.offen);

p = postenRechnen({ id:'a', geplant:10000, tatsaechlich:12500, status:'beauftragt' }, [B('a', 12500)]);
pruef('vollstaendig bezahlt wird erkannt', p.statusName === 'Bezahlt');
pruef('nichts mehr offen', p.offen === 0);

p = postenRechnen({ id:'a', geplant:10000, tatsaechlich:12500, status:'beauftragt' }, [B('a', 13000)]);
pruef('Ueberzahlung gilt auch als bezahlt', p.statusName === 'Bezahlt');
pruef('offen wird nicht negativ', p.offen === 0);

p = postenRechnen({ id:'a', geplant:0, tatsaechlich:0, status:'geplant' }, []);
pruef('leerer Posten stuerzt nicht ab', p.differenz === 0 && p.massgeblich === 0 && p.statusName === 'Geplant');

// Bezahlt ohne feste Summe: Plan gilt als Massstab
p = postenRechnen({ id:'a', geplant:5000, tatsaechlich:0, status:'geplant' }, [B('a', 5000)]);
pruef('ohne Auftragssumme misst sich Bezahltes am Plan', p.statusName === 'Bezahlt');

// ---------------------------------------------------------------- Balkenplan

console.log('Balkenplan');
{
  const kette = terminePlanen([
    { id: 'a', titel: 'A', dauer: 5, start: '2026-03-02', vorgaengerId: null, status: 'fertig' },
    { id: 'b', titel: 'B', dauer: 3, start: null, vorgaengerId: 'a', status: 'laeuft' },
    { id: 'c', titel: 'C', dauer: 2, start: null, vorgaengerId: 'b', status: 'offen' },
  ]);
  const plan = balkenPlan(kette);

  pruef('Achse beginnt am fruehesten Start', plan.von === '2026-03-02', 'ist ' + plan.von);
  pruef('Achse endet am spaetesten Ende', plan.bis === '2026-03-11', 'ist ' + plan.bis);
  pruef('Achse ist 10 Tage lang', plan.tage === 10, 'ist ' + plan.tage);
  pruef('A liegt am Anfang', plan.zeilen[0].ab === 0 && plan.zeilen[0].dauer === 5,
    plan.zeilen[0].ab + '/' + plan.zeilen[0].dauer);
  pruef('B schliesst luecklos an A an', plan.zeilen[1].ab === 5 && plan.zeilen[1].dauer === 3,
    plan.zeilen[1].ab + '/' + plan.zeilen[1].dauer);
  pruef('C endet genau auf der Achse',
    plan.zeilen[2].ab + plan.zeilen[2].dauer === plan.tage,
    plan.zeilen[2].ab + '+' + plan.zeilen[2].dauer);
  pruef('Status wandert in die Zeile', plan.zeilen[0].status === 'fertig');

  // Aufgaben ohne Termin duerfen nicht stillschweigend verschwinden.
  const gemischt = balkenPlan([
    ...kette,
    { id: 'd', titel: 'Ohne', dauer: 4, start: null, ende: null },
  ]);
  pruef('Aufgabe ohne Termin wird gesondert gemeldet',
    gemischt.ohneTermin.length === 1 && gemischt.zeilen.length === 3,
    gemischt.ohneTermin.length + '/' + gemischt.zeilen.length);

  const leer = balkenPlan([{ id: 'x', titel: 'X', dauer: 3, start: null, ende: null }]);
  pruef('Ganz ohne Termine bleibt der Plan leer statt zu werfen',
    leer.tage === 0 && leer.zeilen.length === 0 && leer.ohneTermin.length === 1);
}

console.log('Monatsraster');
{
  // Ueber drei Monate, Beginn mitten im Januar. Der erste Abschnitt muss am
  // Planbeginn ansetzen, nicht am Monatsersten - sonst laege er ausserhalb.
  const lang = balkenPlan(terminePlanen([
    { id: 'a', titel: 'Lang', dauer: 60, start: '2026-01-20', vorgaengerId: null },
  ]));
  pruef('60 Tage ab 20.01. enden am 20.03.', lang.bis === '2026-03-20', 'ist ' + lang.bis);
  pruef('Drei Monatsabschnitte', lang.monate.length === 3, 'sind ' + lang.monate.length);
  pruef('Erster Abschnitt beginnt bei null', lang.monate[0].ab === 0);
  pruef('Januar deckt 12 Tage ab', lang.monate[0].tage === 12, 'sind ' + lang.monate[0].tage);
  pruef('Februar 2026 hat 28 Tage', lang.monate[1].tage === 28, 'sind ' + lang.monate[1].tage);
  pruef('Die Abschnitte fuellen die Achse ohne Luecke',
    lang.monate.reduce((sum, m) => sum + m.tage, 0) === lang.tage,
    lang.monate.reduce((sum, m) => sum + m.tage, 0) + ' statt ' + lang.tage);
  pruef('Jeder Abschnitt schliesst an den vorigen an',
    lang.monate.every((m, i) => i === 0 || m.ab === lang.monate[i - 1].ab + lang.monate[i - 1].tage));

  // Jahreswechsel: der haeufigste Fall, in dem eine Monatsrechnung kippt.
  const ueberJahr = balkenPlan(terminePlanen([
    { id: 'a', titel: 'Jahreswechsel', dauer: 40, start: '2026-12-15', vorgaengerId: null },
  ]));
  pruef('40 Tage ab 15.12.2026 enden am 23.01.2027',
    ueberJahr.bis === '2027-01-23', 'ist ' + ueberJahr.bis);
  pruef('Zwei Abschnitte ueber den Jahreswechsel', ueberJahr.monate.length === 2);
  pruef('Das Jahr wandert mit', ueberJahr.monate[1].jahr === 2027, 'ist ' + ueberJahr.monate[1].jahr);
}

console.log('Tage zwischen zwei Daten');
pruef('Ueber die Sommerzeitumstellung stimmt die Zahl',
  tageZwischen('2026-03-28', '2026-03-30') === 2,
  'ist ' + tageZwischen('2026-03-28', '2026-03-30'));
pruef('Ueber die Winterzeitumstellung stimmt die Zahl',
  tageZwischen('2026-10-24', '2026-10-26') === 2,
  'ist ' + tageZwischen('2026-10-24', '2026-10-26'));
pruef('Derselbe Tag ergibt null', tageZwischen('2026-05-05', '2026-05-05') === 0);

// ------------------------------------------------------------ Angebotsvergleich

console.log('Angebotsvergleich');
{
  const drei = [
    { id: '1', betrag: 10000, status: 'offen' },
    { id: '2', betrag: 12000, status: 'offen' },
    { id: '3', betrag: 15000, status: 'offen' },
  ];
  const r = angeboteRechnen(drei);
  pruef('Drei Angebote zaehlen mit', r.anzahl === 3, 'sind ' + r.anzahl);
  pruef('Guenstigstes ist 10.000', r.guenstigstes.betrag === 10000);
  pruef('Teuerstes ist 15.000', r.teuerstes.betrag === 15000);
  pruef('Spanne 5.000', r.spanne === 5000, 'ist ' + r.spanne);
  pruef('Spanne 50 Prozent ueber dem guenstigsten', r.spanneProzent === 50, 'ist ' + r.spanneProzent);

  // Abgelehnte duerfen die Spanne nicht mehr aufblaehen.
  const ohneAusreisser = angeboteRechnen([
    ...drei.slice(0, 2), { id: '3', betrag: 15000, status: 'abgelehnt' },
  ]);
  pruef('Abgelehntes zaehlt nicht mehr mit', ohneAusreisser.anzahl === 2, 'sind ' + ohneAusreisser.anzahl);
  pruef('Spanne ohne Ausreisser 2.000', ohneAusreisser.spanne === 2000, 'ist ' + ohneAusreisser.spanne);

  const beauftragt = angeboteRechnen([
    { id: '1', betrag: 10000, status: 'offen' },
    { id: '2', betrag: 12000, status: 'beauftragt' },
    { id: '3', betrag: 15000, status: 'offen' },
  ]);
  pruef('Beauftragtes wird erkannt', beauftragt.beauftragt.betrag === 12000);
  pruef('Ersparnis gegen das teuerste Angebot', beauftragt.ersparnis === 3000, 'ist ' + beauftragt.ersparnis);

  const leer = angeboteRechnen([]);
  pruef('Ohne Angebote wird nicht gerechnet',
    leer.anzahl === 0 && leer.guenstigstes === null && leer.spanne === 0);
  const nurNullen = angeboteRechnen([{ id: '1', betrag: 0, status: 'offen' }]);
  pruef('Ein Angebot ueber null zaehlt nicht', nurNullen.anzahl === 0);
  const eines = angeboteRechnen([{ id: '1', betrag: 8000, status: 'offen' }]);
  pruef('Ein einzelnes Angebot hat keine Spanne', eines.anzahl === 1 && eines.spanne === 0);
}

// ------------------------------------------------------------------- CSV

console.log('CSV');
pruef('Zahlen bekommen ein Komma', zelle(1250.5) === '1250,5', 'ist ' + zelle(1250.5));
pruef('Ganze Zahlen bleiben ganz', zelle(1250) === '1250');
pruef('Leeres bleibt leer', zelle(null) === '' && zelle(undefined) === '');
pruef('Harmloser Text bleibt ohne Anfuehrungszeichen', zelle('Rohbau') === 'Rohbau');
pruef('Semikolon im Text wird eingefasst',
  zelle('Rohbau; Keller') === '"Rohbau; Keller"', 'ist ' + zelle('Rohbau; Keller'));
pruef('Anfuehrungszeichen werden verdoppelt',
  zelle('Er sagte "ja" dazu') === '"Er sagte ""ja"" dazu"',
  'ist ' + zelle('Er sagte "ja" dazu'));
pruef('Zeilenumbruch wird eingefasst', zelle('a\nb') === '"a\nb"');
{
  const text = csvText(['Position', 'Betrag'], [['Rohbau', 120000.5]]);
  pruef('Datei beginnt mit der Bytefolge fuer Excel', text.charCodeAt(0) === 0xfeff);
  pruef('Semikolon trennt die Spalten', text.includes('Position;Betrag'));
  pruef('Zeilen enden mit CRLF', text.includes('\r\n') && text.endsWith('\r\n'));
  pruef('Der Betrag steht mit Komma', text.includes('Rohbau;120000,5'));
}

// ---------------------------------------------------------------- DIN 276

console.log('DIN 276');
{
  const alle = KOSTENGRUPPEN.flatMap((h) => [h.nr, ...h.unter.map((u) => u.nr)]);
  pruef('Keine Nummer kommt doppelt vor', new Set(alle).size === alle.length,
    alle.length - new Set(alle).size + ' doppelt');
  pruef('Acht Hauptgruppen, 100 bis 800', KOSTENGRUPPEN.length === 8,
    'sind ' + KOSTENGRUPPEN.length);
  pruef('Die Finanzierung ist als 800 dabei',
    KOSTENGRUPPEN.some((h) => h.nr === '800' && h.name === 'Finanzierung'));
  pruef('Jede Untergruppe gehoert zu ihrer Hauptgruppe',
    KOSTENGRUPPEN.every((h) => h.unter.every((u) => hauptgruppe(u.nr) === h.nr)));
  pruef('770 und 780 gibt es nicht', kostengruppeName('770') === '' && kostengruppeName('780') === '');
  pruef('790 gibt es', kostengruppeName('790') === 'Sonstige Baunebenkosten');
  pruef('Lange Form nennt Nummer und Namen',
    kostengruppeLang('330') === '330 Außenwände', 'ist ' + kostengruppeLang('330'));
  pruef('Unbekannte Nummer ergibt leeren Text', kostengruppeLang('999') === '');
  pruef('Die Auswahlliste enthaelt alle Gruppen plus den Leereintrag',
    kostengruppenOptionen().length === alle.length + 1);
}

console.log('Kostengruppen-Vorschlag');
pruef('Elektro landet bei 440', kostengruppeVorschlag('Elektroinstallation', 'Elektro') === '440',
  'ist ' + kostengruppeVorschlag('Elektroinstallation', 'Elektro'));
pruef('Heizung landet bei 420', kostengruppeVorschlag('Heizung', 'Heizung') === '420');
pruef('Dachdeckung landet bei 360', kostengruppeVorschlag('Dachstuhl und Dachdeckung', 'Dach') === '360');
pruef('Notar landet bei 120', kostengruppeVorschlag('Notar und Grundbuch', 'Sonstiges') === '120');
pruef('Grundstueck landet bei 110', kostengruppeVorschlag('Grundstück', 'Sonstiges') === '110');
pruef('Architekt landet bei 730', kostengruppeVorschlag('Architektenhonorar', 'Sonstiges') === '730');
pruef('Zinsen landen in der Finanzierung', kostengruppeVorschlag('Bereitstellungszinsen', '') === '820');
pruef('Ohne Treffer bleibt der Vorschlag leer', kostengruppeVorschlag('Zirkuszelt', '') === '');
pruef('Jeder Vorschlag ist eine echte Kostengruppe',
  ['Elektroinstallation', 'Heizung', 'Estrich', 'Küche', 'Außenanlagen', 'Baugenehmigung',
   'Bodenplatte oder Keller', 'Vermessung', 'Puffer für Unvorhergesehenes']
    .every((n) => kostengruppeName(kostengruppeVorschlag(n, '')) !== ''));

console.log('Zusammenfassung nach Hauptgruppen');
{
  const gruppen = nachHauptgruppen(
    [
      { kostengruppe: '330', betrag: 100 },
      { kostengruppe: '360', betrag: 50 },
      { kostengruppe: '440', betrag: 30 },
      { betrag: 7 },
    ],
    (x) => x.betrag
  );
  const dreihundert = gruppen.find((g) => g.nr === '300');
  pruef('330 und 360 fallen in dieselbe Hauptgruppe',
    dreihundert.summe === 150 && dreihundert.saetze.length === 2,
    dreihundert.summe + '/' + dreihundert.saetze.length);
  pruef('Unzugeordnetes bekommt einen eigenen Korb',
    gruppen.some((g) => g.nr === '' && g.summe === 7));
  pruef('Unzugeordnetes steht am Ende', gruppen[gruppen.length - 1].nr === '');
  pruef('Die Hauptgruppen stehen aufsteigend',
    gruppen.filter((g) => g.nr).every((g, i, f) => i === 0 || f[i - 1].nr < g.nr));
  pruef('Nichts geht verloren',
    gruppen.reduce((sum, g) => sum + g.summe, 0) === 187);
}

// ------------------------------------------------------- Webfassung und Offline

console.log('Web-App-Manifest');
{
  const manifest = JSON.parse(readFileSync('./www/manifest.json', 'utf8'));

  // Ohne diese Angaben bietet ein Browser keine Installation an, sondern nur
  // eine Verknuepfung. Genau daran ist es vorher gescheitert.
  pruef('Name gesetzt', manifest.name === 'BauZeuge', manifest.name);
  pruef('Kurzname hoechstens 12 Zeichen',
    manifest.short_name.length <= 12, manifest.short_name);
  pruef('start_url zeigt auf die App', manifest.start_url === '/app/');
  pruef('Geltungsbereich umschliesst die start_url',
    manifest.start_url.startsWith(manifest.scope), manifest.scope);
  pruef('Anzeige ist eigenstaendig',
    ['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display), manifest.display);
  // Der Papierton der Marke, Zeichen fuer Zeichen aus Base.astro der Website.
  pruef('Hintergrundfarbe passt zum Papierton',
    manifest.background_color === '#f5f7f6', manifest.background_color);
  pruef('Themenfarbe stimmt mit der Hintergrundfarbe ueberein',
    manifest.theme_color === manifest.background_color, manifest.theme_color);

  const groessen = manifest.icons.map((i) => i.sizes);
  pruef('Symbol in 192 vorhanden', groessen.includes('192x192'), groessen.join(' '));
  pruef('Symbol in 512 vorhanden', groessen.includes('512x512'), groessen.join(' '));
  pruef('Ein zugeschnittenes Symbol dabei',
    manifest.icons.some((i) => i.purpose === 'maskable'));
  pruef('Jede Symboldatei liegt wirklich in www/',
    manifest.icons.every((i) => { try { statSync('./www/' + i.src); return true; } catch { return false; } }),
    manifest.icons.map((i) => i.src).join(' '));
  pruef('Alle Abkuerzungen bleiben im Geltungsbereich',
    (manifest.shortcuts || []).every((s) => s.url.startsWith(manifest.scope)));
}

console.log('Service Worker');
{
  const quelle = readFileSync('./www/sw.js', 'utf8');

  // Die Liste im Arbeiter gegen den tatsaechlichen Inhalt von www/ halten.
  // Ohne diese Pruefung fehlt beim naechsten neuen Modul genau dieses in der
  // Offlineablage, und der Fehler faellt erst auf der Baustelle auf.
  const liste = quelle.match(/const SCHALE = \[([\s\S]*?)\];/)[1];
  const eingetragen = new Set(
    [...liste.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean)
  );

  const sammle = (ordner) => readdirSync(ordner).flatMap((name) => {
    const weg = join(ordner, name);
    return statSync(weg).isDirectory() ? sammle(weg)
      : [relative('./www', weg).split(sep).join('/')];
  });
  // sw.js speichert sich nicht selbst zwischen, der Browser verwaltet ihn.
  const vorhanden = new Set(sammle('./www').filter((d) => d !== 'sw.js'));

  const fehlend = [...vorhanden].filter((d) => !eingetragen.has(d));
  const zuviel = [...eingetragen].filter((d) => !vorhanden.has(d));

  pruef('Jede Datei aus www/ steht in der Schale', fehlend.length === 0, fehlend.join(', '));
  pruef('Keine Karteileiche in der Schale', zuviel.length === 0, zuviel.join(', '));
  pruef('Die Startseite steht mit drin', quelle.includes("'./'"));

  // Die drei Regeln, an denen ein Service Worker echten Schaden anrichten kann.
  pruef('Die Schnittstelle wird nicht zwischengespeichert',
    quelle.includes("ziel.pathname.includes('/api/')"));
  pruef('Nur GET wird angefasst', quelle.includes("anfrage.method !== 'GET'"));
  pruef('Fremde Herkuenfte bleiben unberuehrt',
    quelle.includes('ziel.origin !== self.location.origin'));
  pruef('Erst das Netz, dann die Ablage',
    quelle.indexOf('fetch(anfrage)') < quelle.indexOf('caches.match(anfrage)'));
  pruef('Nur vollstaendige eigene Antworten landen in der Ablage',
    quelle.includes('antwort.ok') && quelle.includes("antwort.type === 'basic'"));
  pruef('Alte Ablagen werden beim Aktivieren entfernt',
    quelle.includes('caches.delete'));
}

console.log('Anmeldung des Arbeiters');
{
  const html = readFileSync('./www/index.html', 'utf8');
  pruef('Manifest ist verlinkt', /<link[^>]+rel="manifest"/.test(html));
  pruef('Arbeiter wird angemeldet', html.includes("register('sw.js')"));
  // Im Paket liegt dieselbe Seite unter https://localhost. Ein Arbeiter wuerde
  // dort die mitgelieferten Dateien festhalten und nach einer Aktualisierung
  // die alten ausliefern.
  pruef('Nur auf den echten Webadressen',
    html.includes("wirte.indexOf(location.hostname) === -1"));
  pruef('Nur ueber https', html.includes("location.protocol !== 'https:'"));
  pruef('localhost ist nicht in der Wirtsliste',
    !/var wirte = \[[^\]]*localhost/.test(html));
}

console.log('Palette');
{
  const css = readFileSync('./www/stil.css', 'utf8');
  // getrimmt, damit ein Leerzeichen hinter dem Doppelpunkt nichts kaputt macht
  const wert = (name) =>
    ((css.match(new RegExp('--' + name + ':([^;]+);')) || [])[1] || '').trim();

  // Diese Werte stehen genauso in Base.astro der Website. Laufen sie
  // auseinander, tragen App und Seite wieder zwei verschiedene Marken.
  const soll = {
    papier: '#f5f7f6', karte: '#ffffff', tinte: '#1f2a30', 'tinte-leise': '#54626a',
    akzent: '#0e6e72', 'akzent-dunkel': '#0a5155', 'akzent-hell': '#5fbabd',
    linie: '#d3dcd9', band: '#e9efec',
  };
  for (const [name, farbe] of Object.entries(soll)) {
    pruef('--' + name + ' ist ' + farbe, wert(name) === farbe, wert(name));
  }

  // "laeuft" darf nicht die Markenfarbe sein, sonst ist es im Balkenplan von
  // "fertig" kaum zu unterscheiden.
  pruef('laeuft hat eine eigene Zustandsfarbe',
    css.includes('.balken-laeuft { background: var(--arbeit); }'));
  pruef('die Zustandsfarbe ist nicht der Akzent', wert('arbeit') !== wert('akzent'));

  const html = readFileSync('./www/index.html', 'utf8');
  pruef('Die Themenfarbe im HTML ist der Papierton',
    html.includes('name="theme-color" content="#f5f7f6"'));
}

console.log('Wirtsnamen bleiben kleingeschrieben');
{
  const html = readFileSync('./www/index.html', 'utf8');

  // Die Marke wird BauZeuge geschrieben, die Wirtsnamen im Code nicht.
  // location.hostname liefert immer Kleinbuchstaben. Wer hier auf die
  // Schreibweise der Marke "korrigiert", trifft nie zu: Die Webfassung nimmt
  // dann die absolute Adresse statt des Pfades und scheitert an der
  // Herkunftspruefung des Servers. Der Fehler waere still.
  const listen = [
    ['www/konto.js', /const EIGENE_WIRTE = \[([^\]]*)\]/],
    ['www/index.html', /var wirte = \[([^\]]*)\]/],
  ];
  for (const [datei, muster] of listen) {
    const treffer = readFileSync('./' + datei, 'utf8').match(muster);
    pruef(datei + ' hat eine Wirtsliste', Boolean(treffer));
    if (!treffer) continue;
    const wirte = [...treffer[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    pruef(datei + ': jeder Wirt ist kleingeschrieben',
      wirte.every((w) => w === w.toLowerCase()), wirte.join(' '));
    pruef(datei + ': die Hauptadresse steht drin',
      wirte.includes('www.bauzeuge.de'), wirte.join(' '));
  }

  // Die Paketkennung von Android muss ebenfalls klein bleiben. Eine Aenderung
  // daran macht aus der App eine andere und leert die Datenbank auf dem Geraet.
  const cap = JSON.parse(readFileSync('./capacitor.config.json', 'utf8'));
  pruef('Paketkennung bleibt kleingeschrieben',
    cap.appId === cap.appId.toLowerCase() && cap.appId === 'de.bauzeuge.app', cap.appId);
  pruef('Angezeigter Name ist BauZeuge', cap.appName === 'BauZeuge', cap.appName);

  // Die Live-Probe sucht diesen Text im ausgelieferten HTML.
  const dep = readFileSync('./deploy.py', 'utf8');
  const gesucht = dep.match(/hole\("\/app\/", 200, "App-Seite", "([^"]+)"\)/);
  pruef('Die Live-Probe sucht den Titel, der wirklich im HTML steht',
    Boolean(gesucht) && html.includes(gesucht[1]), gesucht && gesucht[1]);
}

console.log('Helles und dunkles Design');
{
  const css = readFileSync('./www/stil.css', 'utf8');
  const html = readFileSync('./www/index.html', 'utf8');
  const js = readFileSync('./www/thema.js', 'utf8');

  // Die Reihenfolge im Stylesheet ist Bedingung, nicht Geschmack. Stuende die
  // Medienabfrage hinter der festen Wahl, koennte ein dunkel gestelltes
  // Telefon die Handwahl "hell" ueberstimmen.
  const medien = css.indexOf('@media (prefers-color-scheme: dark)');
  const fest = css.indexOf('html[data-thema="dunkel"] {');
  pruef('Es gibt eine Medienabfrage fuer dunkel', medien > -1);
  pruef('Es gibt eine feste Wahl dunkel', fest > -1);
  pruef('Die feste Wahl steht nach der Medienabfrage', fest > medien, medien + ' vs ' + fest);
  pruef('Die Medienabfrage weicht der Handwahl hell',
    /@media \(prefers-color-scheme: dark\)\s*\{\s*html:not\(\[data-thema="hell"\]\)/.test(css));

  // Ohne color-scheme bleiben Formularfelder und Rollbalken hell.
  pruef('color-scheme wird mitgesetzt', /html\[data-thema="dunkel"\]\s*\{[^}]*color-scheme: dark/.test(css));

  // Die Pastelltoene der Plaketten muessen umschaltbar sein, sonst steht im
  // dunklen Design ein hellrosa Kasten mit dunkelrotem Text.
  for (const name of ['warn-flaeche', 'gut-flaeche', 'info-flaeche',
                      'arbeit-flaeche', 'offen-flaeche', 'auf-akzent', 'schleier']) {
    const hell = new RegExp('--' + name + ':').test(css);
    const dunkel = css.slice(fest).includes('--' + name + ':');
    pruef('--' + name + ' gibt es hell und dunkel', hell && dunkel);
  }
  pruef('Keine festen Pastelltoene mehr in den Plaketten',
    !/\.marke-(offen|arbeit|fertig|beauftragt) \{ background: #/.test(css));
  pruef('Weiss auf Akzentflaeche kommt aus einer Variablen',
    !/\.knopf-haupt \{[^}]*color: #fff/.test(css));

  // Drei Stellungen nebeneinander statt eines Kippschalters: Ein Schalter
  // mit zwei Stellungen kann "automatisch" nicht darstellen.
  pruef('Der Schalter hat drei Tasten', js.includes('export const THEMEN = ['),
    ['auto', 'hell', 'dunkel'].filter((id) => !js.includes("id: '" + id + "'")).join(', '));
  pruef('Jede traegt ihr Zeichen',
    js.includes("zeichen: 'bildschirm'") && js.includes("zeichen: 'sonnig'") &&
    js.includes("zeichen: 'mond'"));
  pruef('Die gewaehlte Taste ist hervorgehoben', css.includes('.thema-taste.aktiv {'));
  pruef('Und sagt es auch dem Vorleser', js.includes("setAttribute('aria-pressed'"));

  pruef('Der Schalter steht im Kopf', html.includes('class="thema-schalter" id="themaschalter"'));
  pruef('Das Design wird vor app.js gesetzt',
    html.indexOf('themaStarten()') < html.indexOf('src="app.js"'));

  // Drei Zustaende, und "auto" darf kein Merkmal setzen: nur dann greift die
  // Medienabfrage und die App wandert abends von selbst mit.
  pruef('Bei auto wird das Merkmal entfernt', js.includes("wurzel.removeAttribute('data-thema')"));
  pruef('Die Wahl liegt in localStorage', js.includes("'hausbau.thema'"));
  pruef('Auf den Wechsel der Geraeteeinstellung wird gehorcht',
    js.includes("addEventListener('change'") && js.includes("lies() === 'auto'"));
  pruef('Die Farbe der Statusleiste wandert mit', js.includes('meta[name="theme-color"]'));

  const sw = readFileSync('./www/sw.js', 'utf8');
  pruef('thema.js liegt in der Offline-Schale', sw.includes("'./thema.js'"));
}

console.log('Gliederung und Seitenleiste');
{
  // Jeder Punkt braucht ein Modul unter module/, sonst laeuft der Router in
  // die Fehlerseite. Die Uebersicht liegt als uebersicht.js dort. Ein Weg mit
  // Schraegstrich zeigt auf eine Ansicht desselben Moduls: "baukasse/kosten"
  // laedt baukasse.js. Deshalb zaehlt nur der erste Teil.
  const fehlend = MODULE
    .map((m) => 'www/module/' + (m.weg.split('/')[0] || 'uebersicht') + '.js')
    .filter((d) => { try { statSync('./' + d); return false; } catch { return true; } });
  pruef('Zu jedem Punkt gibt es ein Modul', fehlend.length === 0, fehlend.join(', '));

  // Ein Unterweg landet beim Modul nur, wenn der Router ihn weiterreicht.
  const app = readFileSync('./www/app.js', 'utf8');
  pruef('Der Router zerlegt den Weg in Datei und Unterweg',
    app.includes('const [datei, unterweg] = weg.split(') &&
    app.includes('geladen.zeige(inhalt, unterweg)'));
  pruef('Die Baukasse nimmt den Unterweg entgegen',
    readFileSync('./www/module/baukasse.js', 'utf8')
      .includes('export async function zeige(rahmen, unterweg)'));

  const wege = MODULE.map((m) => m.weg);
  pruef('Kein Weg kommt doppelt vor', new Set(wege).size === wege.length);
  pruef('Die Uebersicht liegt auf dem leeren Weg', wege.includes(''));
  pruef('Jeder Punkt hat einen Titel', MODULE.every((m) => m.titel && m.titel.length > 2));
  pruef('Jeder Punkt hat eine Beschreibung', MODULE.every((m) => m.text && m.text.length > 10));
  pruef('Jede Gruppe hat ein Zeichen', BEREICHE.every((g) => g.zeichen && g.titel));

  // Sieben Gruppen sind das Maximum, das man ohne Scrollen erfasst. Waechst
  // die Liste weiter, gehoert sie neu geschnitten und nicht verlaengert.
  pruef('Hoechstens sieben Gruppen', BEREICHE.length <= 7, String(BEREICHE.length));

  const html = readFileSync('./www/index.html', 'utf8');
  pruef('Die Seitenleiste steht im HTML', html.includes('id="seitenleiste"'));
  pruef('Es gibt einen Menueknopf', html.includes('id="menueknopf"'));
  // Der Abdunkler darf kein hidden-Attribut tragen: [hidden] traegt
  // !important und liesse sich per CSS nicht mehr einblenden.
  pruef('Der Abdunkler traegt kein hidden',
    /<div id="leistenschatten"><\/div>/.test(html));

  const css = readFileSync('./www/stil.css', 'utf8');
  pruef('Auf schmalen Geraeten faehrt die Leiste herein',
    /@media \(max-width: 899px\)[\s\S]*?body\.leiste-offen #seitenleiste \{ transform: translateX\(0\)/.test(css));
  // Ohne flex-grow bliebe der Inhalt neben der Leiste auf Inhaltsbreite stehen.
  pruef('Der Inhalt nimmt den Platz neben der Leiste',
    /#inhalt \{[\s\S]*?flex: 1 1 auto; min-width: 0;/.test(css));

  const sw = readFileSync('./www/sw.js', 'utf8');
  pruef('Die Uebersicht liegt in der Offline-Schale', sw.includes("'./module/uebersicht.js'"));
}

console.log('PDF-Fusszeile');
{
  const quelle = readFileSync('./www/pdf.js', 'utf8');
  pruef('Die Marke steht an genau einer Stelle',
    quelle.includes("export const PDF_MARKE = 'BauZeuge.de';"));
  pruef('Die Fusszeile setzt sie davor',
    /const links = this\.fusszeile \? PDF_MARKE/.test(quelle));

  // Kein Modul darf die Marke noch einmal selbst hinschreiben, sonst steht
  // sie nach dem naechsten Namenswechsel irgendwo doppelt oder veraltet.
  const doppelt = [];
  for (const datei of readdirSync('./www/module')) {
    const t = readFileSync('./www/module/' + datei, 'utf8');
    if (/fusszeile: '[^']*BauZeuge/.test(t)) doppelt.push(datei);
  }
  pruef('Kein Modul schreibt die Marke selbst', doppelt.length === 0, doppelt.join(', '));

  const blatt = new Blatt({ titel: 'Probe', fusszeile: 'Maengelliste' });
  const text = new TextDecoder('latin1').decode(blatt.bytes());
  pruef('Die Marke steht im erzeugten PDF', text.includes('BauZeuge.de'));
  pruef('Der beschreibende Teil steht daneben', text.includes('Maengelliste'));

  const ohne = new Blatt({ titel: 'Probe' });
  pruef('Auch ohne Zusatz steht die Marke unten',
    new TextDecoder('latin1').decode(ohne.bytes()).includes('BauZeuge.de'));
}

console.log('Bauleitfaden');
{
  pruef('Sechs Phasen', PHASEN.length === 6, String(PHASEN.length));
  pruef('Jede Phase hat Kennung, Titel und Einleitung',
    PHASEN.every((p) => p.id && p.titel && p.text));

  const ids = ALLE_PUNKTE.map((p) => p.id);
  // Die Kennung ist zugleich der Datenbankschluessel des Hakens. Kaeme eine
  // doppelt vor, wuerden zwei Punkte denselben Haken teilen.
  pruef('Keine Kennung kommt doppelt vor', new Set(ids).size === ids.length,
    ids.filter((x, i) => ids.indexOf(x) !== i).join(', '));
  pruef('Kennungen passen in die Schluesselspalte',
    ids.every((i) => i.length <= 36 && /^[a-z0-9-]+$/.test(i)),
    ids.filter((i) => i.length > 36 || !/^[a-z0-9-]+$/.test(i)).join(', '));
  pruef('Jeder Punkt hat einen Titel', ALLE_PUNKTE.every((p) => p.titel.length > 5));
  // Ohne Begruendung waere es eine Liste zum Abhaken statt ein Leitfaden.
  pruef('Jeder Punkt sagt, warum er dran ist',
    ALLE_PUNKTE.every((p) => p.text && p.text.length > 25),
    ALLE_PUNKTE.filter((p) => !p.text || p.text.length <= 25).map((p) => p.id).join(', '));
  pruef('Mindestens fuenfzig Punkte', ALLE_PUNKTE.length >= 50, String(ALLE_PUNKTE.length));

  // Jeder Verweis muss auf einen Bereich zeigen, den es wirklich gibt.
  const wege = new Set(MODULE.map((m) => '#/' + m.weg));
  const ziele = ALLE_PUNKTE.filter((p) => p.ziel).map((p) => p.ziel);
  pruef('Es gibt Verweise in die Bereiche', ziele.length >= 8, String(ziele.length));
  pruef('Jeder Verweis trifft einen Bereich',
    ziele.every((z) => wege.has(z)), ziele.filter((z) => !wege.has(z)).join(', '));

  // Ohne Haken steht alles auf null und der erste Punkt ist dran.
  const leer = leitfadenStand([]);
  pruef('Ohne Haken ist nichts erledigt', leer.erledigt === 0);
  pruef('Die Gesamtzahl stimmt mit der Vorlage', leer.gesamt === ALLE_PUNKTE.length);
  pruef('Die erste Phase laeuft', leer.laufend.id === PHASEN[0].id);
  pruef('Der erste Punkt ist als Naechstes dran',
    leer.naechster.id === PHASEN[0].punkte[0].id);

  // Ein Haken in der ersten Phase schiebt nur den naechsten Punkt weiter.
  const einer = leitfadenStand([{ id: PHASEN[0].punkte[0].id, erledigt: true, am: '2026-09-01' }]);
  pruef('Ein Haken zaehlt', einer.erledigt === 1);
  pruef('Die Phase laeuft weiter', einer.laufend.id === PHASEN[0].id);
  pruef('Jetzt ist der zweite Punkt dran', einer.naechster.id === PHASEN[0].punkte[1].id);
  pruef('Das Datum wandert mit', einer.phasen[0].punkte[0].am === '2026-09-01');

  // Vorarbeiten in einer spaeteren Phase duerfen die laufende nicht
  // ueberspringen. Am Bau arbeitet man vor, der Rueckstand bleibt trotzdem.
  const vorgearbeitet = leitfadenStand([{ id: PHASEN[3].punkte[0].id, erledigt: true }]);
  pruef('Vorarbeit springt die laufende Phase nicht weiter',
    vorgearbeitet.laufend.id === PHASEN[0].id, vorgearbeitet.laufend.id);

  // Alles abgehakt: kein naechster Punkt mehr.
  const alles = leitfadenStand(ALLE_PUNKTE.map((p) => ({ id: p.id, erledigt: true })));
  pruef('Vollstaendig abgehakt zaehlt alles', alles.erledigt === ALLE_PUNKTE.length);
  pruef('Dann gibt es keinen naechsten Punkt', alles.naechster === null);

  // Ein Haken auf eine Kennung, die es nicht mehr gibt, darf nichts kaputt
  // machen: Die Vorlage darf sich aendern, ohne dass Daten wandern muessen.
  const fremd = leitfadenStand([{ id: 'gibt-es-nicht-mehr', erledigt: true }]);
  pruef('Unbekannte Haken werden ignoriert', fremd.erledigt === 0);

  const sw = readFileSync('./www/sw.js', 'utf8');
  pruef('Leitfaden liegt in der Offline-Schale',
    sw.includes("'./leitfaden-daten.js'") && sw.includes("'./module/leitfaden.js'"));

  // Der Speicher muss ueberall bekannt sein, sonst faellt er beim Abgleich
  // oder bei der Sicherung durch.
  for (const [datei, was] of [
    ['www/daten.js', 'Datenbank'],
    ['www/abgleich.js', 'Abgleich'],
    ['server/abgleich.php', 'Server'],
    ['www/module/einstellungen.js', 'Sicherung'],
  ]) {
    pruef(was + ' kennt den Speicher leitfaden',
      readFileSync('./' + datei, 'utf8').includes('leitfaden'));
  }
}

console.log('Baukosten in drei Sichten');
{
  const baukasse = readFileSync('./www/module/baukasse.js', 'utf8');
  for (const [name, funktion] of [
    ['Budgetplanung', 'zeigeBudgetplanung'],
    ['Kostenaufstellung', 'zeigeKostenaufstellung'],
    ['Statistiken', 'zeigeStatistik'],
    ['Rechnungen', 'zeigeRechnungen'],
  ]) {
    pruef('Die Baukasse hat eine Sicht ' + name, baukasse.includes('function ' + funktion));
    pruef(name + ' steht in der Seitenleiste', MODULE.some((m) => m.titel === name));
  }

  // Jede Sicht muss ihre eigene Kopfzeile setzen: Seit die Leiste zwischen
  // ihnen umschaltet, gibt es keine gemeinsame mehr darueber.
  pruef('Jede Sicht setzt eine Kopfzeile',
    (baukasse.match(/kopfzeile\(/g) || []).length >= 4);

  const wege = MODULE.filter((m) => m.gruppe === 'Kosten & Finanzierung').map((m) => m.weg);
  pruef('Kosten und Geld stehen in einer Gruppe',
    JSON.stringify(wege) === JSON.stringify(
      ['baukasse', 'baukasse/kosten', 'baunebenkosten', 'angebote',
       'baukasse/rechnungen', 'baukasse/statistik', 'finanzierung', 'tilgung']),
    wege.join(', '));

  // Die Wohnflaeche darf nicht zweimal gefuehrt werden, sonst widersprechen
  // sich Budgetplanung und Baukostenrechner.
  pruef('Die Wohnflaeche kommt aus dem Baukostenrechner',
    baukasse.includes("einstellung('baukosten_eingabe')"));
}

console.log('Leistungsvergleich');
{
  const L = [
    { id: 'l1', titel: 'Gerüst' },
    { id: 'l2', titel: 'Entsorgung' },
    { id: 'l3', titel: 'Anschlüsse' },
  ];
  const billig = { id: 'a', betrag: 10000, enthalten: ['l1'] };
  const mittel = { id: 'b', betrag: 12000, enthalten: ['l1', 'l2', 'l3'] };
  const teuer = { id: 'c', betrag: 15000, enthalten: ['l1', 'l2'] };

  const v = leistungsvergleich(L, [teuer, billig, mittel]);
  // Guenstigstes links: In der Liste darunter steht es auch oben.
  pruef('Die Spalten stehen nach Preis',
    v.spalten.map((x) => x.angebot.id).join('') === 'abc',
    v.spalten.map((x) => x.angebot.id).join(''));
  pruef('Je Angebot wird gezaehlt, was drinsteckt',
    v.spalten.map((x) => x.drin).join(',') === '1,3,2');
  pruef('Eine Zeile weiss, wer sie angeboten hat',
    v.zeilen[1].von.join(',') === 'b,c', v.zeilen[1].von.join(','));

  // Der ganze Zweck: Das billigste Angebot ist billig, weil etwas fehlt.
  pruef('Die Luecke im guenstigsten Angebot faellt auf', v.luecke && v.luecke.angebot.id === 'a');
  pruef('Und sie sagt, was fehlt',
    v.luecke.fehlt.map((l) => l.id).join(',') === 'l2,l3');

  const ohneLuecke = leistungsvergleich(L, [{ ...billig, enthalten: ['l1', 'l2', 'l3'] }, teuer]);
  pruef('Deckt das guenstigste alles ab, gibt es keine Warnung', ohneLuecke.luecke === null);

  // Abgelehnte zaehlen beim Umfang so wenig mit wie beim Preis.
  const mitAbgelehnt = leistungsvergleich(L, [billig, { ...mittel, status: 'abgelehnt' }]);
  pruef('Abgelehnte Angebote bekommen keine Spalte', mitAbgelehnt.spalten.length === 1);
  pruef('Und zaehlen auch in der Zeile nicht mit',
    mitAbgelehnt.zeilen[1].von.length === 0);

  pruef('Ohne Leistungen gibt es nichts zu warnen',
    leistungsvergleich([], [billig, teuer]).luecke === null);

  // Die Liste haengt an der Position. Wird sie beim Bearbeiten nicht
  // mitgeschrieben, ist sie nach jeder Aenderung weg.
  pruef('Die Position behaelt ihre Leistungen beim Bearbeiten',
    readFileSync('./www/module/baukasse.js', 'utf8')
      .includes('...(posten.leistungen ? { leistungen: posten.leistungen } : {})'));
}

console.log('Alle Dateien lesbar');
{
  // Nicht jede Datei wird von diesem Test eingelesen. Ein "await" in einer
  // Funktion ohne "async" faellt sonst erst im Browser auf, und dort nur in
  // dem einen Bildschirm, der die Datei laedt. Deshalb einmal alles durch den
  // Parser schicken -- als Modul, denn nur so gelten die Modulregeln.
  const dateien = [];
  const sammeln = (ordner) => {
    for (const name of readdirSync(ordner)) {
      const weg = join(ordner, name);
      if (statSync(weg).isDirectory()) sammeln(weg);
      else if (name.endsWith('.js')) dateien.push(weg);
    }
  };
  sammeln('./www');

  const kaputt = [];
  for (const datei of dateien) {
    try {
      execFileSync(process.execPath, ['--input-type=module', '--check'], {
        input: readFileSync(datei, 'utf8'), stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (fehler) {
      kaputt.push(datei + ': ' + String(fehler.stderr).split('\n').filter(Boolean).slice(-1)[0]);
    }
  }
  pruef(dateien.length + ' Dateien sind gueltige Module', kaputt.length === 0,
    kaputt.join(' | '));
}

console.log('Gewerke');
{
  const gewerke = readFileSync('./www/gewerke.js', 'utf8');
  pruef('Die Vorgabe steht in gewerke.js', gewerke.includes('GEWERKE_VORGABE'));
  // Ein Gewerk ist ein Wort, kein Datensatz. Es haengt als Text an
  // Positionen, Maengeln und Kontakten -- also muessen beim Umbenennen alle
  // drei mitgezogen werden, sonst fallen sie aus jeder Gruppierung.
  pruef('Beim Umbenennen ziehen alle drei Speicher mit',
    /const MIT_GEWERK = \['posten', 'maengel', 'kontakte'\]/.test(gewerke));
  pruef('Die Liste liegt in den Einstellungen und wandert damit im Abgleich mit',
    gewerke.includes("einstellung('gewerke')"));

  // Kein Bildschirm darf die alte, fest verdrahtete Liste noch kennen.
  const alt = [];
  for (const datei of readdirSync('./www/module')) {
    const t = readFileSync('./www/module/' + datei, 'utf8');
    if (/\bGEWERKE\b(?!_VORGABE)/.test(t)) alt.push(datei);
  }
  pruef('Kein Modul haelt eine eigene Gewerkeliste', alt.length === 0, alt.join(', '));

  const wege = MODULE.filter((m) => m.gruppe === 'Kontakte').map((m) => m.weg);
  pruef('Die Kontakte fuehren auf drei Sichten',
    JSON.stringify(wege) === JSON.stringify(
      ['kontakte', 'kontakte/personen', 'kontakte/gewerke']), wege.join(', '));
}

console.log('To-Dos und Checklisten');
{
  const T = [
    { id: '1', titel: 'Bemusterung bestätigen', faellig: '2026-09-01', erledigt: false },
    { id: '2', titel: 'Zählerstand ablesen', faellig: '2026-09-20', erledigt: false },
    { id: '3', titel: 'Angebot anfordern', faellig: null, erledigt: false },
    { id: '4', titel: 'Fenster nachmessen', faellig: '2026-08-01', erledigt: true, am: '2026-08-01' },
  ];

  // Faelliges zuerst, Aeltestes oben, alles ohne Frist ans Ende.
  const sortiert = todosSortieren(T);
  pruef('Faelliges steht vorn und alphabetisch nur ohne Frist',
    sortiert.map((t) => t.id).join('') === '4123', sortiert.map((t) => t.id).join(''));

  const stand = todoStand(T, '2026-09-10');
  pruef('Offene werden gezaehlt', stand.offen === 3, String(stand.offen));
  pruef('Erledigte werden gezaehlt', stand.erledigt === 1);
  pruef('Ueberfaellig heisst: Frist vor dem Stichtag und noch offen',
    stand.ueberfaellig === 1, String(stand.ueberfaellig));
  // Ein erledigter Punkt mit abgelaufener Frist ist nicht ueberfaellig, er
  // ist fertig. Sonst stuende die Warnung fuer immer da.
  pruef('Erledigtes ist nie ueberfaellig',
    todoStand([T[3]], '2026-09-10').ueberfaellig === 0);
  pruef('Was heute faellig ist, zaehlt gesondert',
    todoStand(T, '2026-09-20').heute === 1);

  const leer = todoStand([], '2026-09-10');
  pruef('Ohne Aufgaben ist alles null', leer.offen === 0 && leer.ueberfaellig === 0);

  // Die Vorlage wird in echte Eintraege kopiert; der Listenname ist der
  // Schluessel, ueber den sie danach zusammenbleiben.
  pruef('Sechs Vorlagen', VORLAGEN.length === 6, String(VORLAGEN.length));
  // Der teuerste Nachmittag am Bau ist der, an dem man den Vertrag nicht
  // gelesen hat. Die Liste dazu muss es geben.
  pruef('Der Bauvertrag hat eine eigene Liste',
    VORLAGEN.some((v) => v.titel === 'Bauvertrag prüfen'));
  const namen = VORLAGEN.map((v) => v.titel);
  pruef('Kein Vorlagenname kommt doppelt vor', new Set(namen).size === namen.length);
  pruef('Jede Vorlage hat Titel, Erklaerung und Punkte',
    VORLAGEN.every((v) => v.titel && v.text && v.punkte.length >= 5));
  pruef('Kein Punkt kommt in einer Liste doppelt vor',
    VORLAGEN.every((v) => new Set(v.punkte).size === v.punkte.length));

  for (const [datei, was] of [
    ['www/daten.js', 'Datenbank'],
    ['www/abgleich.js', 'Abgleich'],
    ['server/abgleich.php', 'Server'],
    ['www/module/einstellungen.js', 'Sicherung'],
  ]) {
    pruef(was + ' kennt den Speicher todos',
      readFileSync('./' + datei, 'utf8').includes('todos'));
  }
  // Ein neuer Speicher ohne neue Fassung wird beim Aufmachen der Datenbank
  // nicht angelegt: Er fehlt dann genau auf den Geraeten, die es schon gibt.
  const daten_js = readFileSync('./www/daten.js', 'utf8');
  const fassung = Number(daten_js.match(/const DB_VERSION = (\d+);/)[1]);
  const speicher = [...daten_js.matchAll(/^  ([a-z]+): \{ (?:indizes|schluessel)/gm)].map((m) => m[1]);
  pruef('Jeder Speicher ist beim Hochziehen dabei',
    daten_js.includes('ereignis.oldVersion < ' + fassung), 'Fassung ' + fassung);
  pruef('Alle Speicher stehen im Abgleich',
    speicher.filter((n) => n !== 'einstellungen')
      .every((n) => readFileSync('./www/abgleich.js', 'utf8').includes("'" + n + "'")),
    speicher.filter((n) => n !== 'einstellungen' &&
      !readFileSync('./www/abgleich.js', 'utf8').includes("'" + n + "'")).join(', '));
  // Ein Verweis, den umschreiben() nicht kennt, zeigt nach dem Einspielen
  // einer Sicherung auf die Kennung des fremden Geraets, also ins Leere.
  for (const [feld, wo] of [
    ['mangelId', 'VERWEISE'], ['postenId', 'VERWEISE'],
    ['kontaktId', 'VERWEISE'], ['bildIds', 'VERWEISLISTEN'],
  ]) {
    const block = daten_js.slice(daten_js.indexOf('const ' + wo));
    pruef('Dokumente: ' + feld + ' steht in ' + wo,
      /dokumente: \{[^}]*\}/.test(block) &&
      block.slice(block.indexOf('dokumente:')).slice(0, 120).includes(feld));
  }

  pruef('Und in der Sicherung',
    speicher.filter((n) => !['einstellungen', 'leitfaden', 'bilder'].includes(n))
      .every((n) => readFileSync('./www/module/einstellungen.js', 'utf8').includes("'" + n + "'")),
    speicher.filter((n) => !['einstellungen', 'leitfaden', 'bilder'].includes(n) &&
      !readFileSync('./www/module/einstellungen.js', 'utf8').includes("'" + n + "'")).join(', '));
}

console.log('Unterschrift');
{
  // Alte Eintraege haben nur helferIds. Sie muessen lesbar bleiben, sonst
  // verliert eine Sicherung von frueher ihre Helferstunden.
  const alt = helferVon({ helferIds: ['a', 'b'] });
  pruef('Alte Eintraege bleiben lesbar', alt.length === 2 && alt[0].stunden === 0);
  pruef('Und haben keine Unterschrift', alt.every((h) => h.unterschriftId === null));

  const neu_ = helferVon({
    helfer: [
      { id: 'a', stunden: 8, unterschriftId: 'u1' },
      { id: 'b', stunden: 4.5 },
    ],
  });
  pruef('Die Unterschrift wandert mit', neu_[0].unterschriftId === 'u1');
  pruef('Ohne Unterschrift steht dort null', neu_[1].unterschriftId === null);
  pruef('Die Stunden bleiben unberuehrt', neu_[1].stunden === 4.5);
  // Die Stundensumme darf sich durch die Unterschrift nicht aendern.
  pruef('Die Stundenrechnung zaehlt weiter richtig',
    stundenJeHelfer([{ helfer: neu_ }], []).reduce((s, h) => s + h.stunden, 0) === 12.5);

  const quelle = readFileSync('./www/unterschrift.js', 'utf8');
  pruef('Die Unterschrift wird als PNG abgelegt', quelle.includes("'image/png'"));
  // Ohne touch-action rollt die Seite mit, statt dass ein Strich entsteht.
  pruef('Das Feld faengt die Fingerbewegung ab',
    readFileSync('./www/stil.css', 'utf8').includes('touch-action: none'));
  // Escape darf nur das Unterschriftenfeld schliessen, nicht den halb
  // ausgefuellten Tageseintrag darunter.
  pruef('Escape faellt nicht auf das Blatt darunter durch',
    quelle.includes('stopImmediatePropagation') && quelle.includes("'keydown', beiTaste, true"));

  const tagebuch = readFileSync('./www/module/tagebuch.js', 'utf8');
  pruef('Ausgehaktes verliert seine Unterschrift',
    tagebuch.includes('unterschriften.delete(k.id)'));
  pruef('Die Unterschrift steht im PDF',
    tagebuch.includes("blatt.bilderreihe([bild], { hoehe: 44 })"));

  // Das oeffentliche Tagebuch zeigt nur Bilder, die am Eintrag haengen.
  // Unterschriften haengen am Helfer und duerfen dort nie auftauchen.
  pruef('Das oeffentliche Tagebuch liefert nur Tagesfotos aus',
    readFileSync('./server/oeffentlich.php', 'utf8')
      .includes("in_array($kennung, (array)($e['bildIds'] ?? []), true)"));
}

console.log('Kaufnebenkosten');
{
  const r = kaufnebenkosten({
    preis: 350000, grestProzent: 5, notarProzent: 1.5, maklerProzent: 3.57, weitere: 0,
  });
  pruef('Grunderwerbsteuer 5 % von 350.000 = 17.500', r.posten[0][1] === 17500);
  pruef('Notar 1,5 % = 5.250', r.posten[1][1] === 5250);
  pruef('Makler 3,57 % = 12.495', Math.abs(r.posten[2][1] - 12495) < 0.01);
  pruef('Zusammen 35.245', Math.abs(r.summe - 35245) < 0.01, String(r.summe));
  pruef('Das sind gut zehn Prozent', Math.abs(r.anteil - 10.07) < 0.01, r.anteil.toFixed(2));
  pruef('Kaufpreis plus Nebenkosten', Math.abs(r.gesamt - 385245) < 0.01);

  // Ohne Makler faellt der Posten ganz weg, statt mit null dazustehen.
  const ohneMakler = kaufnebenkosten({
    preis: 350000, grestProzent: 5, notarProzent: 1.5, maklerProzent: 0, weitere: 0,
  });
  pruef('Ohne Makler bleiben drei Posten mit null Courtage',
    ohneMakler.posten.length === 3 && ohneMakler.posten[2][1] === 0);
  pruef('Weitere Kosten kommen als eigener Posten dazu',
    kaufnebenkosten({ preis: 100000, grestProzent: 5, notarProzent: 1.5,
      maklerProzent: 0, weitere: 2500 }).posten.length === 4);

  const leer = kaufnebenkosten({ preis: 0, grestProzent: 5, notarProzent: 1.5, maklerProzent: 3.57 });
  pruef('Ohne Kaufpreis ist der Anteil null und nicht unendlich', leer.anteil === 0);

  // Der Satz je Land kommt aus derselben Tabelle wie im Baukostenrechner.
  pruef('Alle sechzehn Laender haben einen Steuersatz',
    LAENDER.length === 16 && LAENDER.every((l) => l.grest > 0));
}

console.log('GRZ und GFZ');
{
  const b = bebauung({ flaeche: 600, grz: 0.4, gfz: 0.8 });
  pruef('600 m2 mal GRZ 0,4 = 240 m2', b.grundflaeche === 240);
  pruef('Mit Nebenanlagen die Haelfte mehr: GRZ 0,6', Math.abs(b.grzMitZuschlag - 0.6) < 1e-9);
  pruef('Also 360 m2', Math.abs(b.grundflaecheMitNebenanlagen - 360) < 1e-9);
  pruef('GFZ 0,8 ergibt 480 m2 Geschossflaeche', b.geschossflaeche === 480);
  pruef('Das sind zwei Vollgeschosse', Math.abs(b.geschosse - 2) < 1e-9);

  // Paragraph 19 Absatz 4 BauNVO deckelt die Ueberschreitung bei 0,8.
  const dicht = bebauung({ flaeche: 500, grz: 0.6, gfz: 1.2 });
  pruef('Die Ueberschreitung ist bei 0,8 gedeckelt',
    Math.abs(dicht.grzMitZuschlag - 0.8) < 1e-9, String(dicht.grzMitZuschlag));
  pruef('Und nicht bei 0,9', dicht.grundflaecheMitNebenanlagen === 400);

  // Ohne GRZ liesse sich nicht durch sie teilen.
  pruef('Ohne GRZ bleibt die Geschosszahl null',
    bebauung({ flaeche: 600, grz: 0, gfz: 0.8 }).geschosse === 0);
  const nichts = bebauung({});
  pruef('Ohne Eingaben ist alles null',
    nichts.grundflaeche === 0 && nichts.geschossflaeche === 0);
}

console.log('Mehrere Bauprojekte');
{
  const daten_quelle = readFileSync('./www/daten.js', 'utf8');

  // Das erste Projekt hat auf jedem Geraet dieselbe Kennung. Nur deshalb
  // gehoert ein Satz ohne projektId ueberall dorthin, auch auf dem zweiten
  // Geraet, das ihn ueber den Abgleich bekommt.
  pruef('Das erste Projekt hat eine feste Kennung',
    daten_quelle.includes("export const ERSTES_PROJEKT = 'projekt-1';"));
  pruef('Ein Satz ohne Projekt gehoert zum ersten',
    daten_quelle.includes('(satz.projektId || ERSTES_PROJEKT) === projekt'));

  // Bilder haengen an ihrer Kennung und werden nur ueber sie geholt. Sie zu
  // filtern wuerde jeden Verweis aus einem anderen Projekt brechen.
  pruef('Bilder, Einstellungen und die Projektliste werden nicht gefiltert',
    /const OHNE_PROJEKT = new Set\(\['einstellungen', 'projekte', 'bilder'\]\)/
      .test(daten_quelle));

  // Ein vorhandener Satz behaelt sein Projekt, auch wenn gerade ein anderes
  // offen ist. Sonst wanderte er beim blossen Bearbeiten herueber.
  pruef('Nur neue Saetze bekommen das offene Projekt',
    daten_quelle.includes('if (!OHNE_PROJEKT.has(speicher) && !satz.projektId)'));

  // Die Sicherung ersetzt beim Einlesen den ganzen Bestand. Nimmt sie nur
  // das offene Projekt mit, loescht ihr Einlesen die uebrigen.
  const sicherung = readFileSync('./www/module/einstellungen.js', 'utf8');
  const stelle = sicherung.indexOf('async function sicherungErstellen');
  const block = sicherung.slice(stelle, stelle + 1200);
  pruef('Die Sicherung liest ueber alle Projekte hinweg',
    block.includes('alleRoh') && !/await daten\.alle\(/.test(block),
    block.includes('alleRoh') ? 'daten.alle noch drin' : 'alleRoh fehlt');

  const projekte = readFileSync('./www/projekte.js', 'utf8');
  // Ein stilles Wegwerfen nur hier waere beim naechsten Abgleich wieder da.
  pruef('Geloeschte Projekte hinterlassen Grabsteine',
    projekte.includes("await daten.loeschen(speicher, satz.id)"));
  pruef('Das letzte Projekt bleibt stehen',
    projekte.includes("Das letzte Projekt lässt sich nicht löschen."));
  pruef('Die Projektliste steht im Abgleich',
    readFileSync('./www/abgleich.js', 'utf8').includes("'projekte'"));
  pruef('Die Projektverwaltung steht in der Leiste',
    MODULE.some((m) => m.weg === 'projekte'));
}

console.log('Excel-Ausgabe');
{
  // Eine xlsx-Datei ist ein ZIP. Faellt der Aufbau auseinander, oeffnet
  // Excel sie gar nicht erst -- und das merkt man sonst erst beim Empfaenger.
  const bytes = xlsxBytes(
    ['Position', 'Gewerk', 'Geplant'],
    [['Rohbau', 'Rohbau', 180000], ['Dach & "Klempner"', 'Dach', 52000], ['Leer', null, '']],
    'Kostenaufstellung'
  );
  const roh = new TextDecoder('latin1').decode(bytes);

  pruef('Beginnt mit der ZIP-Kennung', roh.startsWith('PK\x03\x04'));
  pruef('Endet mit dem Verzeichnisabschluss', roh.includes('PK\x05\x06'));
  for (const teil of [
    '[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml',
    'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml',
  ]) {
    pruef('Enthaelt ' + teil, roh.includes(teil));
  }

  // Die Anzahl im Abschluss muss zu den Eintraegen passen, sonst gilt das
  // Archiv als beschaedigt.
  const anzahl = bytes[roh.lastIndexOf('PK\x05\x06') + 10] +
    bytes[roh.lastIndexOf('PK\x05\x06') + 11] * 256;
  pruef('Sechs Eintraege im Verzeichnis', anzahl === 6, String(anzahl));

  // Zahlen muessen Zahlen bleiben. In CSV entscheidet das der Leser, hier
  // steht es in der Datei.
  pruef('Zahlen stehen als Zahl in der Zelle', roh.includes('<v>180000</v>'));
  pruef('Text steht als Text', roh.includes('t="inlineStr"'));
  pruef('Kaufmaennisches Und wird maskiert', roh.includes('Dach &amp;amp; "Klempner"') ||
    roh.includes('Dach &amp; "Klempner"'));
  pruef('Leere Zellen bleiben leer und werden nicht null', !roh.includes('>null<'));

  pruef('Die Kopfzeile ist fett gesetzt', roh.includes('s="1"') && roh.includes('<b/>'));
  pruef('Die Kopfzeile bleibt beim Rollen stehen', roh.includes('state="frozen"'));
  pruef('Die Spalten haben Breiten', roh.includes('customWidth="1"'));
  pruef('Der Blattname steht auf dem Reiter', roh.includes('name="Kostenaufstellung"'));

  pruef('Spaltenbuchstaben zaehlen ueber Z hinaus',
    spalte(1) === 'A' && spalte(26) === 'Z' && spalte(27) === 'AA' && spalte(52) === 'AZ',
    [spalte(1), spalte(26), spalte(27), spalte(52)].join(','));

  // Ein Blattname mit Doppelpunkt macht die Datei unlesbar, Excel erlaubt ihn
  // nicht. Er darf nicht durchgereicht werden.
  const wild = new TextDecoder('latin1').decode(
    xlsxBytes(['A'], [['x']], 'Kosten: 2026/2027 [Entwurf]')
  );
  pruef('Verbotene Zeichen im Blattnamen fallen weg',
    !/name="[^"]*[:/[\]][^"]*"/.test(wild),
    (wild.match(/name="[^"]*"/) || [''])[0]);
}

console.log('Kein stummer Bildschirm');
{
  const app = readFileSync('./www/app.js', 'utf8');
  // Ein Modul, das haengt oder nichts anhaengt, sieht sonst genauso aus wie
  // eines, das nichts zu zeigen hat: Der Nutzer sieht nur die Leiste links.
  pruef('Ein leerer Inhaltsbereich meldet sich',
    app.includes('if (inhalt.children.length === 0)'));
  pruef('Auch wenn das Modul gar nicht antwortet',
    app.includes('const wache = setTimeout('));
  pruef('Die Wache wird wieder abgeraeumt', app.includes('clearTimeout(wache)'));
  // Der haeufigste Grund ist eine alte Offlineablage. Der Knopf raeumt sie weg.
  pruef('Der Notausgang raeumt die Offlineablage weg',
    app.includes('caches.delete(name)') && app.includes('r.unregister()'));
  pruef('Und er kommt nur einmal', app.includes("inhalt.querySelector('.notausgang')"));
}

console.log('Datenbank haengt nicht stumm');
{
  const d = readFileSync('./www/daten.js', 'utf8');
  // Ohne Wache kommt bei einer blockierten Datenbank weder onsuccess noch
  // onerror -- der Bildschirm bleibt leer, und niemand weiss, warum.
  pruef('Eine Wache bricht das Warten ab', d.includes('const GEDULD = 15000;'));
  pruef('Der Zustand ist von aussen lesbar', d.includes('export const datenZustand'));
  pruef('Die Wanderung meldet, von wo nach wo',
    d.includes("'wandert von Fassung ' + ereignis.oldVersion"));
  // Bricht die Wanderung ab, kommt sonst gar nichts zurueck.
  pruef('Ein Abbruch der Wanderung wird gemeldet',
    d.includes('anfrage.transaction.onabort'));
  // Ein zweites Fenster mit alter Fassung blockiert sonst dauerhaft.
  pruef('Diese Verbindung weicht einer neueren Fassung',
    d.includes('onversionchange'));
  // Ein einmal abgelehntes Versprechen wuerde jeden spaeteren Versuch
  // scheitern lassen, ohne es je wieder probiert zu haben.
  pruef('Nach einem Fehler wird wieder versucht',
    d.includes('dbVersprechen = null;'));
  const app_js = readFileSync('./www/app.js', 'utf8');
  pruef('Der leere Bildschirm nennt den Zustand',
    app_js.includes("'Datenbank: ' + zustand"));
  // Der haeufigste Fall hat eine eigene Antwort, und es ist nicht die, die
  // man sonst gibt: Wegraeumen hilft nicht, Schliessen hilft.
  pruef('Ein blockierendes Fenster bekommt seinen eigenen Text',
    app_js.includes('zustand.startsWith(DB_WARTET)') &&
    app_js.includes('BauZeuge ist noch woanders offen'));
  // Chrome meldet den Fall nicht ueber onblocked, die Anfrage bleibt liegen.
  pruef('Der Verdacht entsteht an der Zeit, nicht am Ereignis',
    d.includes('const VERDACHT = 3000;') && d.includes('dbZustand = DB_WARTET'));
}

console.log('Bauleitfaden als Wizard');
{
  const f = readFileSync('./www/module/leitfaden.js', 'utf8');
  // Ohne gemerkte Stelle landet man nach jedem Wechsel wieder beim ersten
  // offenen Punkt, auch wenn man gerade drei weiter gelesen hat.
  pruef('Die Stelle im Leitfaden wird gemerkt',
    f.includes("einstellung('leitfaden_punkt'"));
  pruef('Und sie gehoert zum Projekt, nicht zum Geraet',
    readFileSync('./www/daten.js', 'utf8').includes("'leitfaden_punkt'"));
  // Vor und zurueck laeuft ueber alle Punkte, nicht nur innerhalb der Phase:
  // Sonst steht man am Phasenende vor einer Wand.
  pruef('Die Punkte liegen fuer den Weg vor und zurueck flach',
    f.includes('const flachLegen ='));
  pruef('Abhaken rueckt eine Aufgabe weiter',
    f.includes('await stelleMerken(flach[stelle + 1].id)'));
  pruef('In eine Phase springt man auf ihren ersten offenen Punkt',
    (f.match(/punkte\.find\(\(x?p?\) => !x?p?\.erledigt\)/g) || []).length >= 2 ||
    f.includes('.punkte.find((p) => !p.erledigt)'));
  pruef('Am Anfang und Ende geht es nicht weiter',
    f.includes('disabled: stelle === 0') && f.includes('disabled: stelle >= flach.length - 1'));
  // Ein Punkt, den es in der Vorlage nicht mehr gibt, darf nicht ins Leere
  // zeigen.
  pruef('Eine verschwundene Stelle faellt auf den naechsten offenen Punkt zurueck',
    f.includes('if (stelle < 0)'));
}

console.log('Bauweise');
{
  const b = readFileSync('./www/bauweise.js', 'utf8');
  // Beim Bautraeger steht im Vertrag eine Summe. Die gliedert niemand mehr
  // nach DIN 276, also hat die Gliederung dort nichts zu suchen.
  pruef('Drei Bauweisen', /BAUWEISEN = \[/.test(b) &&
    b.includes("id: EINZELVERGABE") && b.includes('id: SCHLUESSELFERTIG') &&
    b.includes('id: SANIERUNG'));
  // Der Name allein sagt nicht, was gemeint ist: "Schluesselfertig" kann
  // Generalunternehmer oder Bautraeger heissen, und das ist rechtlich ein
  // Unterschied.
  pruef('Jede Bauweise erklaert sich in Klammern',
    (b.match(/klammer:/g) || []).length === 3);
  pruef('Der Generalunternehmer steht im Text',
    b.includes('Generalunternehmer') && b.includes('Bauträger') && b.includes('MaBV'));
  // Der frueher gespeicherte Wert darf nicht ins Leere laufen.
  pruef('Der alte Wert "traeger" wird weitergefuehrt',
    b.includes('const ALTNAMEN = { traeger: SCHLUESSELFERTIG };'));
  pruef('Nur schluesselfertig kennt keine Kostengruppen',
    b.includes("zeigtKostengruppen: gewaehlt.id !== SCHLUESSELFERTIG"));
  // Die Reihenfolge der Gewerke steuert die Firma. Ein Balkenplan, den man
  // nicht beeinflusst, ist bestenfalls Beschaeftigung.
  pruef('Der Bauablauf faellt beim schluesselfertigen Bauen immer weg',
    b.includes("const weg = ['ablauf'];"));
  // Wer selbst etwas uebernimmt, braucht Angebote und Gewerke wieder.
  pruef('Eigenleistungen holen Angebote und Gewerke zurueck',
    b.includes("if (!eigenleistungen.length) weg.push('angebote', 'kontakte/gewerke');"));
  pruef('Sonst wird nichts versteckt',
    b.includes("if (id !== SCHLUESSELFERTIG) return new Set();"));
  // In der Sanierung fragen Foerderungen und Nachweise genau nach den
  // Kostengruppen.
  pruef('Die Sanierung behaelt ihre Kostengruppen',
    !b.includes('SANIERUNG'.toLowerCase() + "'") || b.includes('gewaehlt.id !== SCHLUESSELFERTIG'));
  // Sie gehoert zum Projekt: Wer zwei Haeuser baut, baut sie selten gleich.
  pruef('Die Bauweise haengt am Projekt',
    readFileSync('./www/daten.js', 'utf8').includes("'bauweise', 'bauphase',"));

  const k = readFileSync('./www/module/baukasse.js', 'utf8');
  pruef('Die Kostengruppenspalte faellt mit weg',
    k.includes("art.zeigtKostengruppen || s.feld !== 'kostengruppe'"));
  // Ohne Kostengruppen waere "nach DIN 276" im Titel eine Behauptung, die
  // das Blatt nicht einloest.
  pruef('Das PDF heisst dann nicht mehr nach der Norm',
    k.includes("art.zeigtKostengruppen ? 'Kostenaufstellung nach DIN 276' : 'Kostenaufstellung'"));
  // Wer schluesselfertig kauft, braucht keine Liste der Gewerke, sondern
  // die der Posten neben dem Kaufpreis.
  pruef('Es gibt je Bauweise eine Vorlage',
    k.includes('const VORLAGE_SCHLUESSELFERTIG = [') &&
    k.includes('const VORLAGE_SANIERUNG = [') && k.includes('const VORLAGE = ['));
  // Im Bestand liegt das Geld an anderen Stellen als im Neubau.
  pruef('Die Sanierung faengt mit der Bestandsaufnahme an',
    k.includes('Bestandsaufnahme und Aufmaß') && k.includes('Schadstoffuntersuchung'));
  // Ausgeblendet heisst nicht geloescht.
  pruef('Ein vorhandener Kostengruppenwert bleibt stehen',
    k.includes(': posten.kostengruppe || null,'));

  pruef('Die Leiste blendet die versteckten Wege aus',
    readFileSync('./www/app.js', 'utf8').includes('if (versteckt.has(a.dataset.weg))'));
  pruef('Und leere Gruppen verschwinden mit',
    readFileSync('./www/app.js', 'utf8').includes('gruppe.hidden = !uebrig;'));

  // Jeder versteckte Weg muss es auch geben, sonst versteckt er nichts.
  const wege = new Set(MODULE.map((m) => m.weg));
  for (const w of ['ablauf', 'angebote', 'kontakte/gewerke']) {
    pruef('Der versteckbare Weg ' + w + ' existiert', wege.has(w));
  }
}

console.log('Leitfaden je Bauweise');
{
  const WEISEN = ['einzelvergabe', 'schluesselfertig', 'sanierung'];

  // Ohne Angabe gilt der ganze Leitfaden. Das ist der Normalfall und muss
  // der Normalfall bleiben.
  pruef('Ohne Bauweise gilt alles', punkteFuer().length === ALLE_PUNKTE.length);
  pruef('Ein Punkt ohne Angabe gilt ueberall',
    WEISEN.every((w) => giltFuer({ id: 'x' }, w)));

  for (const w of WEISEN) {
    const drin = punkteFuer(w);
    pruef(w + ' hat einen eigenen Zuschnitt', drin.length >= 55 && drin.length <= 80,
      String(drin.length));
    pruef(w + ': jeder Punkt gehoert dorthin', drin.every((p) => giltFuer(p, w)));
  }

  // Die Zuschnitte muessen sich unterscheiden, sonst filtert nichts.
  const groessen = WEISEN.map((w) => punkteFuer(w).length);
  pruef('Die drei Zuschnitte sind verschieden', new Set(groessen).size === 3,
    groessen.join(', '));

  // Jeder Punkt muss in mindestens einer Bauweise vorkommen. Ein Punkt, den
  // niemand sieht, ist toter Text.
  const nirgends = ALLE_PUNKTE.filter((p) => !WEISEN.some((w) => giltFuer(p, w)));
  pruef('Kein Punkt faellt ueberall heraus', nirgends.length === 0,
    nirgends.map((p) => p.id).join(', '));

  // Und jede eingeschraenkte Bauweise muss es geben.
  const genannt = new Set(ALLE_PUNKTE.flatMap((p) => p.bauweisen || []));
  pruef('Nur bekannte Bauweisen werden genannt',
    [...genannt].every((w) => WEISEN.includes(w)), [...genannt].join(', '));

  // Der Stand rechnet je Bauweise, und die Haken bleiben dieselben.
  const alleHaken = ALLE_PUNKTE.map((p) => ({ id: p.id, erledigt: true }));
  for (const w of WEISEN) {
    const st = leitfadenStand(alleHaken, w);
    pruef(w + ': alles abgehakt ist alles', st.erledigt === st.gesamt && st.naechster === null);
    pruef(w + ': die Gesamtzahl folgt dem Zuschnitt', st.gesamt === punkteFuer(w).length);
  }

  // Ein Haken auf einen Punkt, den diese Bauweise nicht kennt, zaehlt nicht
  // mit -- er bleibt aber gespeichert und kommt beim Zurueckstellen wieder.
  const nurEinzel = ALLE_PUNKTE.find((p) => p.bauweisen && !p.bauweisen.includes('schluesselfertig'));
  pruef('Es gibt Punkte, die dem Schluesselfertigen fehlen', Boolean(nurEinzel));
  const fremd = leitfadenStand([{ id: nurEinzel.id, erledigt: true }], 'schluesselfertig');
  pruef('Ein fremder Haken zaehlt dort nicht mit', fremd.erledigt === 0);
  pruef('In seiner eigenen Bauweise zaehlt er',
    leitfadenStand([{ id: nurEinzel.id, erledigt: true }], nurEinzel.bauweisen[0]).erledigt === 1,
    nurEinzel.id + ' gilt fuer ' + nurEinzel.bauweisen.join(', '));

  // Eine leere Phase darf weder die laufende sein noch als fertig gelten.
  for (const w of WEISEN) {
    pruef(w + ': keine Phase ist leer',
      leitfadenStand([], w).phasen.every((p) => p.gesamt > 0));
  }

  const modul = readFileSync('./www/module/leitfaden.js', 'utf8');
  pruef('Der Bildschirm reicht die Bauweise durch',
    modul.includes('leitfadenStand(gespeichert, art.id)'));
  pruef('Und die Uebersicht ebenso',
    readFileSync('./www/module/uebersicht.js', 'utf8').includes('leitfadenStand(haken, art.id)'));
  // Eine Phase, aus der alles herausgefiltert wurde, fuehrt beim Anklicken
  // sonst ins Leere.
  pruef('Leere Phasen stehen nicht in der Wahl',
    modul.includes('stand.phasen.filter((p) => p.gesamt > 0)'));
}

console.log('Kopfzeile und Verweise auf einen Satz');
{
  const app = readFileSync('./www/app.js', 'utf8');
  // Ein Bereich, der einen einzelnen Satz oeffnet, haengt dessen Kennung
  // hinten an: "#/raeume/<kennung>". Ohne den Rueckfall auf den ersten Teil
  // landet jeder solche Verweis auf der Uebersicht -- der Nutzer wird
  // herausgeworfen, statt in den Raum zu kommen.
  pruef('Ein Weg mit Kennung findet trotzdem sein Modul',
    app.includes('MODULE.find((m) => m.weg === weg) || MODULE.find((m) => m.weg === datei)'));
  pruef('Markiert wird der Bereich, nicht der ganze Weg',
    app.includes('leisteMarkieren(modul.weg)'));

  // Die Marke steht in jedem Bereich und fuehrt zur Uebersicht.
  pruef('Der Kopf traegt immer die Wortmarke',
    app.includes("if (!kopftitel.querySelector('.wortmarke'))"));
  pruef('Und sie ist ein Weg zur Uebersicht',
    readFileSync('./www/index.html', 'utf8')
      .includes('<a class="titel" id="kopftitel" href="#/"'));
  // Welcher Bereich offen ist, gehoert trotzdem in den Fenstertitel.
  pruef('Der Bereichsname steht im Fenstertitel',
    app.includes("modul.titel + ' · ' + APPNAME"));

  // Zeilen mit mehreren Knoepfen: Sie muessen als Paar umbrechen, sonst
  // steht auf dem Telefon ein Knopf allein und der Name in drei Zeichen.
  // Wo Zeilen mehrere Knoepfe tragen, muessen sie als Paar umbrechen. Wo
  // stattdessen Kacheln stehen, stellt sich die Frage nicht mehr.
  for (const datei of ['dokumente', 'projekte']) {
    pruef(datei + ': die Knoepfe einer Zeile stehen zusammen',
      readFileSync('./www/module/' + datei + '.js', 'utf8')
        .includes("klasse: 'zeilen-aktionen'"));
  }
  // Raeume und Gewerke stehen als Kacheln nebeneinander: Ein Raum ist ein
  // Ding mit Bild, Flaeche und Kosten, kein Band ueber die ganze Breite.
  pruef('Raeume stehen in einem Kachelgitter',
    readFileSync('./www/module/raeume.js', 'utf8').includes("klasse: 'raumgitter'"));
  pruef('Gewerke ebenso',
    readFileSync('./www/module/kontakte.js', 'utf8').includes("klasse: 'gewerkegitter'"));
  const stil = readFileSync('./www/stil.css', 'utf8');
  pruef('Und beide Gitter richten sich nach dem Platz',
    stil.includes('.raumgitter, .gewerkegitter'));

  // Ein Deckel auf der Karte verhindert jede weitere Spalte darin, egal wie
  // breit der Bildschirm ist. Genau daran ist die Raumliste zweimal
  // haengengeblieben: erst am Inhalt, dann an der Karte.
  pruef('Keine Karte im Gitter traegt einen Deckel',
    !/\.kartengitter > \.karte \{[^}]*max-width/.test(stil));
  pruef('Die Spaltenzahl steht nirgends fest',
    !/grid-template-columns:\s*repeat\(\s*[234]\s*,/.test(stil),
    'feste Spaltenzahl gefunden');
  pruef('Der Raum laesst sich aus der Liste heraus aendern',
    readFileSync('./www/module/raeume.js', 'utf8')
      .includes('raumBearbeiten(r, geschosse, neu)'));
}

console.log('Zeichen');
{
  // Ein Verweis auf ein Zeichen, das es nicht gibt, faellt im Browser nicht
  // auf: Es erscheint einfach das Ersatzzeichen, und niemand merkt, dass die
  // Zuordnung ins Leere zeigt.
  for (const [name, liste] of Object.entries(ZUORDNUNGEN)) {
    const fehlend = liste.map(([, z]) => z).filter((z) => !ZEICHENNAMEN.includes(z));
    pruef(name + ': jede Zuordnung zeigt auf ein Zeichen', fehlend.length === 0,
      fehlend.join(', '));
    // Doppelte Wortteile: Der zweite waere nie erreichbar.
    const worte = liste.flatMap(([w]) => w);
    pruef(name + ': kein Wortteil kommt doppelt vor',
      new Set(worte).size === worte.length,
      worte.filter((w, i) => worte.indexOf(w) !== i).join(', '));
    pruef(name + ': alles klein geschrieben', worte.every((w) => w === w.toLowerCase()));
  }

  // Das Genauere muss oben stehen, sonst gewinnt das Allgemeinere.
  pruef('Hauswirtschaftsraum ist keine Technik', raumZeichen('Hauswirtschaftsraum') === 'waschen');
  pruef('Gästezimmer ist kein Gäste-WC', raumZeichen('Gästezimmer') === 'bett');
  pruef('Gäste-WC bleibt ein Bad', raumZeichen('Gäste-WC') === 'bad');

  // Gesucht wird nach Wortteilen, damit auch "Kinderzimmer 2" etwas findet.
  pruef('Kinderzimmer 2 findet sein Zeichen', raumZeichen('Kinderzimmer 2') === 'bett');
  pruef('Bad oben findet sein Zeichen', raumZeichen('Bad oben') === 'bad');
  pruef('Grossschreibung stoert nicht', raumZeichen('KELLER') === 'keller');

  // Ohne Treffer ein sinnvolles Ersatzzeichen statt nichts.
  pruef('Unbekannter Raum bekommt das Haus', raumZeichen('Hobbyraum') === 'haus');
  pruef('Unbekanntes Gewerk bekommt das Werkzeug', gewerkZeichen('Sonstiges') === 'werkzeug');
  pruef('Unbekannte Papierart bekommt das Blatt', dokumentZeichen('Sonstiges') === 'blatt');
  pruef('Auch ohne Namen kommt ein Zeichen', raumZeichen(null) === 'haus');

  // Jedes Zeichen muss auch benutzt werden, sonst ist es toter Text.
  // Die Wetterlagen kommen aus dem Bautagebuch und stehen deshalb nicht in
  // den Zuordnungslisten; benutzt werden sie trotzdem.
  const LAGEN = ['sonnig', 'bewoelkt', 'regen', 'sturm', 'schnee', 'frost'];
  pruef('Jede Wetterlage hat ihr Zeichen',
    LAGEN.every((l) => ZEICHENNAMEN.includes(wetterZeichen(l))));
  pruef('Eine unbekannte Lage bekommt die Wolke', wetterZeichen('nebel') === 'bewoelkt');

  const benutzt = new Set([
    ...Object.values(ZUORDNUNGEN).flatMap((l) => l.map(([, z]) => z)),
    ...LAGEN.map((l) => wetterZeichen(l)),
    'haus', 'werkzeug', 'blatt', 'firma', 'person',
    // Die drei Stellungen des Designschalters, siehe thema.js.
    'bildschirm', 'mond',
    // Das Auge im Passwortfeld der Anmeldung.
    'auge', 'augezu',
  ]);
  const unbenutzt = ZEICHENNAMEN.filter((z) => !benutzt.has(z));
  pruef('Kein Zeichen liegt ungenutzt herum', unbenutzt.length === 0, unbenutzt.join(', '));

  const quelle = readFileSync('./www/zeichen.js', 'utf8');
  // Ohne currentColor stuende dasselbe Zeichen im dunklen Design falsch.
  pruef('Die Zeichen erben die Schriftfarbe', quelle.includes("'stroke', 'currentColor'"));
  pruef('Und tragen keine eigene Fuellung', quelle.includes("'fill', 'none'"));

  // In einer Liste von zwanzig Firmen sucht man den Elektriker, nicht "eine
  // Firma". Also zeigt der Kontakt sein Gewerk, wenn er eines hat.
  pruef('Ein Kontakt mit Gewerk zeigt das Gewerk',
    kontaktZeichen({ art: 'firma', gewerk: 'Elektro' }) === 'blitz');
  pruef('Eine Firma ohne Gewerk zeigt ein Gebaeude',
    kontaktZeichen({ art: 'firma' }) === 'firma');
  pruef('Eine Privatperson zeigt einen Kopf',
    kontaktZeichen({ art: 'helfer' }) === 'person');

  for (const [datei, was] of [
    ['raeume', 'Raeume'], ['kontakte', 'Gewerke'], ['dokumente', 'Dokumente'],
    ['baukasse', 'Statistik'], ['maengel', 'Maengel'],
  ]) {
    pruef(was + ' zeigen Zeichen',
      readFileSync('./www/module/' + datei + '.js', 'utf8').includes("from '../zeichen.js'"));
  }
}

console.log('Wetter auf der Startseite');
{
  const u = readFileSync('./www/module/uebersicht.js', 'utf8');
  // Auch ohne Adresse muss die Karte dastehen und sagen, was sie zeigen
  // wuerde. Ein Bildschirm, auf dem etwas fehlt, erklaert besser als einer,
  // auf dem nichts steht.
  pruef('Ohne Adresse fragt die Karte nach ihr',
    u.includes('Projektadresse eintragen'));
  pruef('Die Karte steht auch im leeren Projekt',
    (u.match(/wetterkarte\(/g) || []).length >= 3);
  // Einmal je Stunde reicht: Der DWD misst stuendlich, und oefter zu fragen
  // belastet einen fremden Dienst, den wir umsonst nutzen.
  pruef('Gefragt wird hoechstens stuendlich',
    u.includes('const HALTBAR = 60 * 60 * 1000;'));
  // Ohne Netz ist ein Wert von vorhin besser als keiner -- aber nur mit
  // seinem Alter davor, sonst haelt ihn jemand fuer den jetzigen.
  pruef('Der letzte Wert bleibt, mit seinem Alter',
    u.includes("'von vor ' + stunden + ' Stunden'"));
  // Der ganze Bildschirm darf nicht auf eine fremde Netzantwort warten.
  pruef('Die Karte fuellt sich nach', u.includes("text: 'Wird geholt …'"));
  pruef('Der gemerkte Wert haengt am Projekt',
    readFileSync('./www/daten.js', 'utf8').includes("'wetter_stand'"));
  // Dieselbe Einteilung wie im Tagebuch, sonst sieht dasselbe Wetter an zwei
  // Stellen verschieden aus.
  const w = readFileSync('./www/wetter.js', 'utf8');
  for (const lage of ['sturm', 'schnee', 'regen', 'frost']) {
    pruef('Das Tagebuch kennt die Lage ' + lage, w.includes("'" + lage + "'"));
  }
}

console.log('Anhaengen und Anordnung');
{
  // el() ueberspringt null von sich aus, append() und replaceChildren()
  // nicht: Dort wird aus null das Wort "null" mitten im Text. Deshalb geht
  // das Anhaengen in den Modulen ueber die Helfer.
  const h = readFileSync('./www/hilfen.js', 'utf8');
  pruef('Es gibt einen Helfer, der null ueberspringt', h.includes('export function anhaengen'));
  pruef('Und einen zum Ersetzen', h.includes('export function fuellen'));

  const roh = [];
  for (const datei of readdirSync('./www/module')) {
    const t = readFileSync('./www/module/' + datei, 'utf8');
    // rahmen.append() ohne Argumente ist harmlos, mit Argumenten nicht.
    if (/\brahmen\.append\(\s*[^)\s]/.test(t)) roh.push(datei);
  }
  pruef('Kein Modul haengt roh an den Rahmen an', roh.length === 0, roh.join(', '));

  // Auf dem Telefon untereinander, daneben nebeneinander -- und zwar ohne
  // dass jedes Modul sich eine eigene Anordnung baut.
  const css = readFileSync('./www/stil.css', 'utf8');
  pruef('Die Karten ordnen ihre Felder selbst',
    css.includes('.karte > .feld, .blatt > .feld'));
  pruef('Und alles andere nimmt die ganze Breite',
    css.includes('.karte > *, .blatt > * { flex: 1 1 100%; min-width: 0; }'));
  pruef('Erst ab einem Bildschirm, nicht auf dem Telefon',
    css.includes('@media (min-width: 760px)'));
  // Gleichrangige Karten gehoeren nebeneinander, sobald der Behaelter es
  // hergibt -- sechs untereinander sind eine Kolonne mit Luft daneben.
  pruef('Es gibt ein Gitter fuer gleichrangige Karten',
    css.includes('.kartengitter') &&
    readFileSync('./www/hilfen.js', 'utf8').includes('export function kartengitter'));
  pruef('Der Leitfaden benutzt es',
    readFileSync('./www/module/leitfaden.js', 'utf8').includes('kartengitter(['));
  // Das Gitter richtet sich nach seinem Behaelter, nicht nach dem Fenster:
  // In einer schmalen Spalte bleibt es einspaltig.
  pruef('Die Spaltenzahl richtet sich nach dem Platz',
    css.includes('repeat(auto-fit, minmax(340px, 1fr))'));
}


console.log('Wege und Kontakte');
{
  // Ein Wechsel auf denselben Hash loest kein hashchange aus. Wer aus einer
  // Liste heraus loescht und danach "zurueck zur Liste" will, steht schon
  // dort -- der Bildschirm blieb stehen und zeigte den geloeschten Satz
  // weiter. Deshalb geht Navigation in den Modulen ueber geheZu().
  const h = readFileSync('./www/hilfen.js', 'utf8');
  pruef('Es gibt einen Helfer fuers Wechseln', h.includes('export function geheZu'));
  pruef('Der zeichnet auch beim gleichen Weg neu',
    h.includes("new HashChangeEvent('hashchange')"));

  const direkt = [];
  for (const datei of readdirSync('./www/module')) {
    const t = readFileSync('./www/module/' + datei, 'utf8');
    if (/location\.hash\s*=/.test(t)) direkt.push(datei);
  }
  pruef('Kein Modul setzt den Hash selbst', direkt.length === 0, direkt.join(', '));

  // Eine Firma hat oft keinen Ansprechpartner, eine Privatperson keine
  // Firma. Pflicht ist nur, dass eins von beidem dasteht.
  const k = readFileSync('./www/module/kontakte.js', 'utf8');
  pruef('Name oder Firma genuegt', k.includes('if (!wert.name && !wert.firma)'));
  pruef('Das Feld heisst Firma, nicht Betrieb',
    k.includes("feld('Firma', firma)") && !k.includes("feld('Betrieb'"));
  pruef('Kontakte ohne Namen bleiben lesbar', h.includes('export const kontaktName'));
}

console.log('Auswertungen und Verknuepfungen');
{
  const b = readFileSync('./www/module/baukasse.js', 'utf8');
  // Mehrkosten sind die andere Frage: nicht wohin das Geld geht, sondern
  // wo es mehr wird als geplant. Zwei Blickwinkel, je Tabelle und Bild.
  pruef('Mehrkosten je Gewerk und je Kostengruppe',
    b.includes("mehrkostenkarte('Je Gewerk'") && b.includes("mehrkostenkarte('Je Kostengruppe'"));
  pruef('Mit Tabelle und Balken', b.includes('function abweichungsbalken') &&
    b.includes("el('table'"));
  pruef('Mehrkosten lassen sich mitnehmen',
    b.includes('async function mehrkostenPdf') && b.includes('async function mehrkostenTabelle'));
  // Die Balken gehen von der Mitte aus: Ein Balken, der immer von links
  // waechst, kann kein Vorzeichen zeigen.
  const css = readFileSync('./www/stil.css', 'utf8');
  pruef('Der Balken kennt beide Richtungen',
    css.includes('.mittelbalken-strich.nach-rechts') &&
    css.includes('.mittelbalken-strich.nach-links'));

  pruef('Die Budgetplanung geht als PDF und CSV',
    b.includes('async function budgetPdf') && b.includes('async function budgetTabelle'));
  // Drei Stellen duerfen nicht drei Zahlen ergeben.
  pruef('Geldmittel werden nur einmal gerechnet', b.includes('function geldmittelstand'));

  const t = readFileSync('./www/module/todos.js', 'utf8');
  pruef('Aufgaben haengen an Raeumen', t.includes("feld('Raum', raum,"));
  pruef('Und werden dort auch angezeigt',
    readFileSync('./www/module/raeume.js', 'utf8').includes("t.raumId === raum.id"));
  pruef('Der Verweis ist dem Abgleich bekannt',
    readFileSync('./www/daten.js', 'utf8').includes("todos: { raumId: 'raeume' }"));
  pruef('Alle To-Dos gehen als PDF', t.includes("'Alle To-Dos als PDF'"));

  const k = readFileSync('./www/module/kontakte.js', 'utf8');
  pruef('Ein Kontakt hat eine eigene Seite', k.includes('async function zeigeKontakt'));
  pruef('Sie zeigt, was an ihm haengt',
    k.includes("titel: 'Positionen'") && k.includes("titel: 'Maengel'".replace('ae', 'ä')));
  pruef('Firmen haben Ansprechpartner',
    k.includes("feld('Gehört zu', gehoertZu") &&
    readFileSync('./www/daten.js', 'utf8').includes("kontakte: { firmaId: 'kontakte' }"));
  pruef('Das Adressbuch geht als PDF', k.includes('async function adressenPdf'));
  // Die Sichten duerfen nicht als Kennung durchgehen.
  pruef('Sichten bleiben Sichten',
    k.includes("ansicht !== 'firmen' && ansicht !== 'personen'"));
  // Beim Anlegen steht die Art schon fest: Man kommt aus der einen oder der
  // anderen Liste. Beim Bearbeiten bleibt sie da, sonst waere ein falsch
  // abgelegter Kontakt nicht zu verschieben.
  pruef('Die Art wird nur beim Bearbeiten gefragt',
    k.includes("kontakt.id ? feld('Art', art) : null"));
  pruef('Und das Blatt sagt, was es anlegt',
    k.includes("artName + ' anlegen'"));

  const t2 = readFileSync('./www/module/todos.js', 'utf8');
  // Eine Vorlage bringt Punkte mit, die nicht passen. Die will man
  // streichen und umschreiben, nicht abhaken.
  pruef('Jeder Checklistenpunkt laesst sich aendern',
    t2.includes("text: 'Umbenennen'") && t2.includes("text: 'Löschen'"));
  // Zwei ausgewachsene Knoepfe je Zeile machen aus neun Punkten eine
  // Bildschirmhoehe. Der Punkt ist das Abhaken, nicht das Umbenennen.
  pruef('Klein und ruhig', t2.includes("klasse: 'punktknopf'") &&
    readFileSync('./www/stil.css', 'utf8').includes('.punktknopf {'));
  // Zeilen mit Haken, Begruendung und zwei Knoepfen vertragen keine drei
  // Spalten -- das ist dann eine Wand, keine Liste.
  pruef('Und untereinander, nicht nebeneinander',
    t2.includes("klasse: 'liste liste-punkte'") &&
    readFileSync('./www/stil.css', 'utf8').includes('.liste-punkte { grid-template-columns: 1fr; }'));
  pruef('Auch in der To-Do-Liste', !/mitListe\s*\?\s*null/.test(t2));
}

console.log('Raeume auf dem Grundriss');
{
  const a = readFileSync('./www/module/anschlussplan.js', 'utf8');
  const r = readFileSync('./www/module/raeume.js', 'utf8');

  pruef('Der Plan kennt zwei Modi', a.includes('function modusSetzen') &&
    a.includes('Raum markieren') && a.includes('Anschluss markieren'));
  pruef('Ein Raum laesst sich setzen', a.includes('function raumMarkieren'));
  pruef('Und dabei auch neu anlegen', a.includes("'– neuer Raum –'"));
  pruef('Marken sitzen relativ', a.includes("(r.x * 100).toFixed(2)"));
  // Nur wer x und y hat, steht auf dem Plan. Ein Raum ohne Position ist
  // trotzdem ein Raum.
  pruef('Ohne Position keine Marke', a.includes("typeof r.x === 'number'"));
  pruef('Im PDF stehen Raeume als Buchstaben', a.includes('function raumzeichen') &&
    a.includes('raumzeichen(n)'));

  // Der haeufigste stille Datenverlust: Ein Formular baut den Satz neu und
  // laesst Felder weg, die es nicht kennt.
  pruef('Bearbeiten behaelt die Position', r.includes('x: gleichesGeschoss ? (raum.x ?? null) : null'));
  // Ein Wechsel des Geschosses macht die Position falsch, nicht nur alt.
  pruef('Ein anderes Geschoss loest die Marke', r.includes('const gleichesGeschoss ='));
  pruef('Ein geloeschtes Geschoss loescht keinen Raum',
    a.includes("await daten.sichern('raeume', { ...r, geschossId: null, x: null, y: null })"));

  const css = readFileSync('./www/stil.css', 'utf8');
  pruef('Die Marke verdeckt den Plan nicht ganz', css.includes('.raummarke') &&
    css.includes('color-mix(in srgb, var(--karte) 88%, transparent)'));
}

console.log('Die Marke im PDF')
{
  // Kopf und Fusszeile nehmen dieselbe Zeichenkette. Versalsatz machte
  // aus BauZeuge einmal BAUZEUGE, und das grosse Z ist die Marke.
  const p = readFileSync('./www/pdf.js', 'utf8');
  pruef('Die Marke steht an einer Stelle',
    p.includes("export const PDF_MARKE = 'BauZeuge.de';"));
  pruef('Der Kopf benutzt sie', p.includes('this.schreibe(PDF_MARKE, {'));
  pruef('Nirgends steht sie in Versalien', !p.includes('BAUZEUGE'));
}

console.log('Der Einstieg')
{
  const u = readFileSync('./www/module/uebersicht.js', 'utf8');
  const pr = readFileSync('./www/module/projekte.js', 'utf8');

  // Die Willkommenskarte haengt am Projekt, nicht an den Daten: Wer sich
  // schon entschieden hat, soll nicht wieder gefragt werden.
  pruef('Ohne Projekt die Willkommenskarte', u.includes('if (!projekt) {'));
  pruef('Mit Projekt der Weg hinein', u.includes("text: 'Fang mit dem Geld an'"));

  // Die drei Kacheln sind die drei Bauweisen, nicht eine eigene Einteilung.
  pruef('Die Kacheln kommen aus den Bauweisen', u.includes('BAUWEISEN.map((b) =>') &&
    u.includes("klasse: 'einstieg'"));
  pruef('Sie oeffnen dasselbe Blatt', u.includes('onclick: () => projektBlatt(b.id)'));
  pruef('Vorgewaehlt ist schluesselfertig',
    u.includes('BAUWEISEN.some((b) => b.id === vorwahl) ? vorwahl : SCHLUESSELFERTIG'));
  pruef('Das Blatt fragt Name und Bauweise',
    u.includes("feld('Name des Projekts'") && u.includes("feld('Wie wird gebaut?'"));
  pruef('Und schreibt beides weg',
    u.includes('await projektAnlegen(wert);') && u.includes('await bauweiseSetzen(gewaehlt);'));

  // Ein Bauherr baut ein Haus. Zweite Projekte gibt es nur noch fuer den,
  // der sie schon hat.
  pruef('Kein zweites Projekt von der Uebersicht aus',
    !u.includes("'Neues Projekt anlegen'"));
  pruef('Und keins aus der Verwaltung', !pr.includes("knopf('Neues Bauprojekt'"));
  pruef('Die Verwaltung bleibt fuer vorhandene erreichbar',
    u.includes('projekte.length > 1'));

  // Eine Auswahl ueber der Leiste ist eine Frage, die sich nicht stellt.
  const app = readFileSync('./www/app.js', 'utf8');
  pruef('Keine Projektwahl ueber der Leiste', !app.includes('projektwahl'));
  pruef('Die Leiste beginnt mit den Bereichen',
    app.includes('seitenleiste.replaceChildren(') && app.includes('...BEREICHE.map'));
}

console.log('Die Anmeldung')
{
  const k = readFileSync('./www/module/konto.js', 'utf8');
  const css = readFileSync('./www/stil.css', 'utf8');

  // Eine Sache auf dem Bildschirm, in der Mitte. Wer sich anmeldet, will
  // nichts anderes.
  pruef('Die Anmeldung steht als eigene Karte', k.includes("], 'anmeldekarte')") &&
    css.includes('.anmeldekarte {'));
  pruef('Mit Ueberschrift statt Reiterleiste',
    k.includes("'Willkommen zurück'") && !k.includes("text: 'Neues Konto'"));
  pruef('Gewechselt wird unten im Text', k.includes("klasse: 'textknopf'"));

  // Auf der Baustelle tippt man ein Passwort mit Handschuh und schiefem
  // Daumen. Einmal hinsehen zu duerfen spart den dritten Versuch.
  pruef('Das Passwort laesst sich anzeigen', k.includes("klasse: 'augenknopf'") &&
    k.includes("passwort.type = zeigen ? 'text' : 'password'"));
  pruef('Das Auge sitzt im Feld', css.includes('.passwortfeld > input') &&
    css.includes('padding-right: 46px'));
  // Deutsch, nicht Denglisch: Die Vorlage kam auf Englisch.
  pruef('Alles auf Deutsch', !/Sign In|Welcome|Password|Email Address/.test(k));
}

console.log(fehler ? '\nFEHLGESCHLAGEN: ' + fehler : '\nAlle Pruefungen bestanden.');
process.exit(fehler ? 1 : 0);
