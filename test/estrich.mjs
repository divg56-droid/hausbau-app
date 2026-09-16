/* Trocknung, Belegreife und Fussbodenaufbau, ohne Browser.
 *
 *     node test/estrich.mjs
 */
import {
  trocknungStand, belagOhneFreigabe, istBelagsschritt, aufbauRechnen, tageSeit,
} from '../www/estrich.js';

let fehler = 0;
const pruef = (n, b, z = '') => { console.log((b ? '  ok   ' : '  FEHL ') + n + (b ? '' : '  ' + z)); if (!b) fehler++; };

const HEUTE = '2026-04-20';

// ------------------------------------------------------------ Trocknung

const leer = trocknungStand(null, HEUTE);
pruef('Ohne Plan ist nichts angelegt', leer.angelegt === false && leer.tage === null);
pruef('Ohne Plan sind alle vier Schritte offen',
  leer.schritte.length === 4 && leer.schritte.every((s) => s.stufe === 'offen'));

const plan = {
  eingebaut: '2026-03-31',
  art: 'zement',
  heizbeginn: '2026-04-15',
  messungen: [
    { datum: '2026-04-18', wert: 2.4, raum: 'Wohnen' },
    { datum: '2026-04-10', wert: 3.1, raum: 'Wohnen' },
  ],
};
const stand = trocknungStand(plan, HEUTE);
pruef('Tage seit Einbau', stand.tage === 20, String(stand.tage));
pruef('Heiztage', stand.heiztage === 5, String(stand.heiztage));
pruef('Letzte Messung ist die juengste, nicht die zuletzt eingetragene',
  stand.letzte.datum === '2026-04-18', String(stand.letzte && stand.letzte.datum));
pruef('Ohne Freigabe bleibt der letzte Schritt offen',
  stand.freigegeben === false && stand.schritte[3].stufe === 'offen');
pruef('Gemessen gilt als erledigt', stand.schritte[2].stufe === 'fertig');

const frei = trocknungStand({ ...plan, freigabe: { datum: '2026-04-19', durch: 'Bodenleger' } }, HEUTE);
pruef('Mit Freigabe sind alle Schritte fertig',
  frei.freigegeben === true && frei.schritte.every((s) => s.stufe === 'fertig'));

// --------------------------------------------------------- Belagsschritte

pruef('Parkett ist ein Belagsschritt', istBelagsschritt('Parkett verlegen'));
pruef('Bodenbeläge ebenso', istBelagsschritt('Bodenbeläge'));
pruef('Fliesen legen ebenso', istBelagsschritt('Fliesen legen EG'));
pruef('Estrich selbst ist keiner', istBelagsschritt('Estrich einbringen') === false);
pruef('Estrich trocknen ist keiner', istBelagsschritt('Estrich trocknen') === false);
pruef('Innenputz ist keiner', istBelagsschritt('Innenputz') === false);

const aufgaben = [
  { id: '1', titel: 'Estrich einbringen', status: 'fertig', start: '2026-03-31' },
  { id: '2', titel: 'Parkett verlegen', status: 'offen', start: '2026-04-24' },
  { id: '3', titel: 'Innentüren einbauen', status: 'offen', start: '2026-05-02' },
];

const warnung = belagOhneFreigabe(aufgaben, plan, HEUTE);
pruef('Parkett in vier Tagen warnt', warnung.length === 1 && warnung[0].aufgabe.id === '2');
pruef('Grund nennt die fehlende Bestätigung',
  /bestätigt/.test(warnung[0].grund), warnung[0] && warnung[0].grund);

const ohneMessung = belagOhneFreigabe(aufgaben, { eingebaut: '2026-03-31' }, HEUTE);
pruef('Ohne Messung lautet der Grund anders',
  /weder gemessen/.test(ohneMessung[0].grund), ohneMessung[0] && ohneMessung[0].grund);

pruef('Mit Freigabe keine Warnung',
  belagOhneFreigabe(aufgaben, { ...plan, freigabe: { datum: '2026-04-19' } }, HEUTE).length === 0);

pruef('Weit entfernter Belag warnt noch nicht',
  belagOhneFreigabe([{ id: '4', titel: 'Parkett verlegen', status: 'offen', start: '2026-09-01' }], plan, HEUTE).length === 0);

pruef('Laufender Belag warnt auch ohne Termin',
  belagOhneFreigabe([{ id: '5', titel: 'Bodenbelag', status: 'laeuft' }], plan, HEUTE).length === 1);

pruef('Fertiger Belag warnt nicht',
  belagOhneFreigabe([{ id: '6', titel: 'Parkett verlegen', status: 'fertig', start: '2026-04-24' }], plan, HEUTE).length === 0);

// ------------------------------------------------------- Fussbodenaufbau

const a = aufbauRechnen({
  ausgleich: 20, daemmung: 60, estrich: 65, belag: 15,
  geplant: 150, rohbauTuer: 2135, rohbauBruestung: 1050,
});
pruef('Aufbau summiert die Schichten', a.aufbau === 160, String(a.aufbau));
pruef('Abweichung gegen die Planung', a.abweichung === 10, String(a.abweichung));
pruef('Lichte Türhöhe nach Aufbau', a.tuerhoehe === 1975, String(a.tuerhoehe));
pruef('Brüstung nach Aufbau', a.bruestungshoehe === 890, String(a.bruestungshoehe));
pruef('Ohne Vorgabe keine Abweichung', aufbauRechnen({ estrich: 60 }).abweichung === 0);
pruef('Ohne Rohbaumaß keine Türhöhe', aufbauRechnen({ estrich: 60 }).tuerhoehe === 0);
pruef('Negative Eingaben zählen als null', aufbauRechnen({ estrich: -50, belag: 10 }).aufbau === 10);

pruef('tageSeit rechnet über den Monatswechsel', tageSeit('2026-03-31', '2026-04-01') === 1);

console.log(fehler ? `\n${fehler} Fehler.` : '\nEstrich und Aufbau stimmen.');
process.exitCode = fehler ? 1 : 0;
