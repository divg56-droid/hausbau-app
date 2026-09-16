// Estrich, Trocknung und der Boden, der zu frueh darauf kommt.
//
// Der teuerste vermeidbare Schaden im Innenausbau entsteht an einem einzigen
// Tag: Der Belag wird verlegt, obwohl der Estrich noch Feuchte abgibt.
// Danach wellt sich das Parkett, die Fliese loest sich, und keine
// Versicherung zahlt, weil niemand gemessen hat.
//
// Deshalb zwei Dinge hier, und kein drittes:
//
//   1. Eine Spur der Trocknung: wann der Estrich kam, wann geheizt wurde,
//      was gemessen wurde, wer freigegeben hat. Alles mit Datum und Foto.
//   2. Die Warnung, wenn der Bodenbelag im Bauablauf naeherrueckt, ohne dass
//      eine Freigabe dokumentiert ist.
//
// Bewusst NICHT hier: ein Grenzwert. Wann ein Estrich belegreif ist, haengt
// an Estrichart, Aufbau, Dicke und Belag und wird vom Bodenleger gemessen.
// Eine Zahl in der App waere eine Zahl, auf die sich jemand verlaesst, und
// im Zweifel die falsche. Die App haelt fest, was gemessen wurde, und sagt,
// wer freigibt.
//
// Ohne Bildschirm und ohne Speicher, damit es sich ohne Browser pruefen
// laesst -- wie baustellenregeln.js und fristen.js.

import { norm } from './baustellenregeln.js';

const TAG = 86400000;

/** Ganze Tage von einem ISO-Datum zum anderen, negativ wenn davor. */
export function tageSeit(datum, heute) {
  if (!datum || !heute) return null;
  return Math.round((new Date(heute + 'T00:00:00Z') - new Date(datum + 'T00:00:00Z')) / TAG);
}

/** Estricharten, wie sie am Bau genannt werden. */
export const ESTRICHARTEN = [
  ['zement', 'Zementestrich'],
  ['anhydrit', 'Calciumsulfat (Anhydrit)'],
  ['guss', 'Gussasphalt'],
  ['unbekannt', 'weiß ich nicht'],
];

/**
 * Wo die Trocknung steht.
 *
 * @param plan  { eingebaut, art, heizbeginn, messungen: [{datum, wert, raum, bildIds}],
 *                freigabe: { datum, durch, bildIds } }
 * @param heute ISO-Datum
 * @returns {{
 *   angelegt: boolean, tage: number|null, heiztage: number|null,
 *   letzte: object|null, messungen: number, freigegeben: boolean,
 *   schritte: Array<{schluessel: string, text: string, stufe: 'offen'|'fertig'}>
 * }}
 */
export function trocknungStand(plan, heute) {
  const p = plan || {};
  const messungen = [...(p.messungen || [])]
    .filter((m) => m && m.datum)
    .sort((a, b) => String(a.datum).localeCompare(String(b.datum)));
  const letzte = messungen.length ? messungen[messungen.length - 1] : null;
  const freigegeben = !!(p.freigabe && p.freigabe.datum);

  const schritt = (schluessel, text, fertig) => ({
    schluessel, text, stufe: fertig ? 'fertig' : 'offen',
  });

  return {
    angelegt: !!p.eingebaut,
    tage: tageSeit(p.eingebaut, heute),
    heiztage: tageSeit(p.heizbeginn, heute),
    letzte,
    messungen: messungen.length,
    freigegeben,
    schritte: [
      schritt('eingebaut', 'Einbautag festgehalten', !!p.eingebaut),
      schritt('heizen', 'Funktionsheizen begonnen und protokolliert', !!p.heizbeginn),
      schritt('messung', 'Feuchte gemessen', messungen.length > 0),
      schritt('freigabe', 'Belegreife schriftlich freigegeben', freigegeben),
    ],
  };
}

/** Schritte, die einen Bodenbelag bringen. Fliesen zaehlen mit. */
export function istBelagsschritt(titel) {
  const t = norm(titel);
  if (/estrich/.test(t)) return false;
  return /bodenbela|parkett|laminat|vinyl|teppich|fliesenleg|fliesen legen|bodenfliese|bodenleger/.test(t);
}

/**
 * Warnt, wenn der Belag kommt, bevor jemand freigegeben hat.
 *
 * Gewarnt wird erst, wenn der Schritt in Sichtweite ist: Ein Plan, der im
 * Januar den Boden fuer November vorsieht, soll nicht das ganze Jahr
 * blinken. `vorlauf` ist derselbe Abstand wie bei den Fotoaufgaben.
 *
 * @returns [{ aufgabe, inTagen, grund }]
 */
export function belagOhneFreigabe(aufgaben, plan, heute, vorlauf = 7) {
  if (plan && plan.freigabe && plan.freigabe.datum) return [];
  return (aufgaben || [])
    .filter((a) => a.status !== 'fertig' && istBelagsschritt(a.titel))
    .map((a) => ({
      aufgabe: a,
      inTagen: a.start ? tageSeit(heute, a.start) : 0,
    }))
    .filter((x) => x.aufgabe.status === 'laeuft' || x.inTagen <= vorlauf)
    .map((x) => ({
      ...x,
      grund: (plan && (plan.messungen || []).length)
        ? 'gemessen wurde, aber niemand hat die Belegreife bestätigt'
        : 'die Belegreife weder gemessen noch bestätigt ist',
    }))
    .sort((a, b) => a.inTagen - b.inTagen);
}

/* ----------------------------------------------------------- Fussbodenaufbau
 *
 * Der Aufbau entscheidet ueber Dinge, die niemand mit dem Boden in
 * Verbindung bringt: ob die Innentuer passt, ob die Fensterbruestung noch
 * hoch genug ist, ob die Terrassentuer eine Stufe bekommt. Gerechnet wird
 * deshalb nicht der Boden, sondern das, was er den anderen Bauteilen
 * wegnimmt.
 */

/** Die Schichten von der Rohdecke bis zur Oberkante, in Millimetern. */
export const SCHICHTEN = [
  { schluessel: 'ausgleich', name: 'Ausgleich und Leitungen', vorgabe: 20 },
  { schluessel: 'daemmung', name: 'Wärme- und Trittschalldämmung', vorgabe: 60 },
  { schluessel: 'estrich', name: 'Estrich', vorgabe: 65 },
  { schluessel: 'belag', name: 'Bodenbelag samt Kleber', vorgabe: 15 },
];

/**
 * Was der Aufbau den Hoehen wegnimmt.
 *
 * Alle Masse in Millimetern. `rohbauTuer` ist die lichte Hoehe der
 * Tueroeffnung ueber der Rohdecke, `rohbauBruestung` die Hoehe der
 * Fensterbruestung ueber der Rohdecke.
 *
 * Es gibt hier keine Mindesthoehen: Sie stehen in der Landesbauordnung und
 * unterscheiden sich je nach Land. Die App rechnet, was uebrig bleibt, und
 * sagt, womit man es vergleicht.
 */
export function aufbauRechnen(werte = {}) {
  const mm = (schluessel) => Math.max(0, Number(werte[schluessel]) || 0);
  const aufbau = SCHICHTEN.reduce((s, sch) => s + mm(sch.schluessel), 0);
  const tuer = Number(werte.rohbauTuer) || 0;
  const bruestung = Number(werte.rohbauBruestung) || 0;
  const geplant = Number(werte.geplant) || 0;

  return {
    aufbau,
    // Was der Rohbau vorgesehen hatte, gegen das, was wirklich aufgebaut
    // wird. Positiv heisst: der Boden wird hoeher als geplant.
    abweichung: geplant > 0 ? aufbau - geplant : 0,
    tuerhoehe: tuer > 0 ? tuer - aufbau : 0,
    bruestungshoehe: bruestung > 0 ? bruestung - aufbau : 0,
    schichten: SCHICHTEN.map((sch) => ({ ...sch, wert: mm(sch.schluessel) })),
  };
}
