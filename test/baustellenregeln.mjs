/* Regeln fuer Fotos, Reihenfolge und Wetter im Bauablauf, ohne Browser.
 *
 *     node test/baustellenregeln.mjs
 */
import {
  fotoregelFuer, faelligeFotos, reihenfolgeWarnungen, wetterWarnungen, FOTOREGELN,
} from '../www/baustellenregeln.js';

let fehler = 0;
const pruef = (n, b, z = '') => { console.log((b ? '  ok   ' : '  FEHL ') + n + (b ? '' : '  ' + z)); if (!b) fehler++; };
const id = (a) => a && a.id;

// Titel aus der Vorlage im Bauablauf und typische eigene Schreibweisen.
const regel = (titel) => id(fotoregelFuer({ titel }));
pruef('Bodenplatte erkannt', regel('Bodenplatte oder Keller') === 'bodenplatte');
pruef('Decke erkannt', regel('Decke Erdgeschoss') === 'decke');
pruef('Dachdecker ist keine Decke', regel('Dachdeckung und Klempner') === 'dachdeckung', regel('Dachdeckung und Klempner'));
pruef('"Dachdecker kommt" ist keine Decke', regel('Dachdecker kommt') !== 'decke', regel('Dachdecker kommt'));
pruef('Innenputz erkannt', regel('Innenputz') === 'innenputz');
pruef('Außenputz ist kein Innenputz', regel('Außenputz Fassade') === 'fassade', regel('Außenputz Fassade'));
pruef('Estrich einbringen erkannt', regel('Estrich einbringen') === 'estrich');
pruef('Estrich trocknen löst keine Fotos aus', regel('Estrich trocknen lassen') === null, regel('Estrich trocknen lassen'));
pruef('Fließestrich EG erkannt', regel('Fließestrich EG') === 'estrich');
pruef('Trockenbau erkannt', regel('Trockenbau und Dachgeschossausbau') === 'trockenbau');
pruef('Fliesen erkannt', regel('Fliesenarbeiten') === 'fliesen');
pruef('Malerarbeiten brauchen keine Fotoregel', regel('Malerarbeiten') === null);
pruef('Jede Regel hat Fotos', FOTOREGELN.every((r) => r.fotos.length >= 2));

// Faellig: nur innerhalb des Vorlaufs, nicht fertig, nicht abgehakt.
const plan = [
  { id: 'e', titel: 'Estrich einbringen', start: '2026-10-05', ende: '2026-10-07', status: 'offen' },
  { id: 'p', titel: 'Innenputz', start: '2026-11-01', ende: '2026-11-07', status: 'offen' },
  { id: 'f', titel: 'Fliesenarbeiten', start: '2026-10-02', ende: '2026-10-09', status: 'offen', fotosErledigt: true },
  { id: 'd', titel: 'Decke Erdgeschoss', start: '2026-09-01', ende: '2026-09-05', status: 'fertig' },
  { id: 'l', titel: 'Trockenbau', start: '2026-12-01', ende: '2026-12-10', status: 'laeuft' },
];
const faellig = faelligeFotos(plan, '2026-10-01');
pruef('Estrich in 4 Tagen ist fällig', faellig.some((x) => x.aufgabe.id === 'e' && x.inTagen === 4), JSON.stringify(faellig.map((x) => x.aufgabe.id)));
pruef('Putz in 31 Tagen noch nicht', !faellig.some((x) => x.aufgabe.id === 'p'));
pruef('Abgehakte Fotos nicht mehr', !faellig.some((x) => x.aufgabe.id === 'f'));
pruef('Fertige Schritte nicht mehr', !faellig.some((x) => x.aufgabe.id === 'd'));
pruef('Laufender Schritt ist fällig', faellig.some((x) => x.aufgabe.id === 'l'));

// Reihenfolge: nur wenn der Plan es falsch rechnet.
const richtig = [
  { id: 1, titel: 'Elektro-Rohinstallation', start: '2026-10-01', ende: '2026-10-07', status: 'offen' },
  { id: 2, titel: 'Innenputz', start: '2026-10-08', ende: '2026-10-14', status: 'offen' },
  { id: 3, titel: 'Estrich einbringen', start: '2026-10-15', ende: '2026-10-17', status: 'offen' },
  { id: 4, titel: 'Estrich trocknen lassen', start: '2026-10-18', ende: '2026-11-14', status: 'offen' },
  { id: 5, titel: 'Bodenbeläge verlegen', start: '2026-11-15', ende: '2026-11-20', status: 'offen' },
];
pruef('Richtige Reihenfolge ohne Warnung', reihenfolgeWarnungen(richtig).length === 0, JSON.stringify(reihenfolgeWarnungen(richtig).map((w) => w.text)));
const falsch = richtig.map((a) => (a.id === 5 ? { ...a, start: '2026-11-01', ende: '2026-11-05' } : a));
const w = reihenfolgeWarnungen(falsch);
pruef('Belag vor Trocknungsende warnt', w.length === 1 && /Bodenbelag/.test(w[0].text), JSON.stringify(w.map((x) => x.text)));
const putzZuFrueh = richtig.map((a) => (a.id === 2 ? { ...a, start: '2026-10-03', ende: '2026-10-09' } : a));
pruef('Putz während Elektro warnt', reihenfolgeWarnungen(putzZuFrueh).some((x) => /Elektro/.test(x.text)));

// Wetter: kritischer Tag im Zeitraum des Schritts.
const tage = {
  '2026-10-15': { min: 2, max: 9, niederschlag: 0, wind: 20 },
  '2026-10-16': { min: 6, max: 14, niederschlag: 8, wind: 70 },
};
const ww = wetterWarnungen([
  { id: 'e', titel: 'Estrich einbringen', start: '2026-10-15', ende: '2026-10-17', status: 'offen' },
  { id: 'd', titel: 'Dachdeckung und Klempner', start: '2026-10-16', ende: '2026-10-20', status: 'offen' },
  { id: 'm', titel: 'Malerarbeiten', start: '2026-10-15', ende: '2026-10-20', status: 'offen' },
], tage);
pruef('Estrich bei 2 °C warnt', ww.some((x) => x.aufgabe.id === 'e' && /2 °C/.test(x.grund)), JSON.stringify(ww));
pruef('Dach bei Regen oder Sturm warnt', ww.some((x) => x.aufgabe.id === 'd'), JSON.stringify(ww));
pruef('Maler ohne Wetterregel', !ww.some((x) => x.aufgabe.id === 'm'));

// Aussentueren sind keine Innentueren: Der Fenstereinbau vor dem Bodenbelag
// ist richtig und darf nicht warnen.
const aussentuer = reihenfolgeWarnungen([
  { id: 'f', titel: 'Fenster und Außentüren einbauen', start: '2026-03-01', ende: '2026-03-05' },
  { id: 'b', titel: 'Bodenbeläge verlegen', start: '2026-06-01', ende: '2026-06-05' },
  { id: 't', titel: 'Innentüren einbauen', start: '2026-06-10', ende: '2026-06-11' },
]);
pruef('Außentüren vor dem Bodenbelag warnen nicht', aussentuer.length === 0, JSON.stringify(aussentuer.map((x) => x.nachher.titel)));
const innentuer = reihenfolgeWarnungen([
  { id: 'b', titel: 'Bodenbeläge verlegen', start: '2026-06-01', ende: '2026-06-05' },
  { id: 't', titel: 'Türen einbauen', start: '2026-05-20', ende: '2026-05-21' },
]);
pruef('Türen einbauen vor dem Belag warnt weiterhin', innentuer.length === 1, String(innentuer.length));

console.log(fehler ? `\n${fehler} Fehler.` : '\nRegeln stimmen.');
process.exitCode = fehler ? 1 : 0;
