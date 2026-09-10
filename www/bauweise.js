// Wie gebaut wird: alles aus einer Hand oder Gewerk für Gewerk.
//
// Das ist die Entscheidung, die den Rest der App am staerksten praegt, und
// sie faellt vor dem ersten Spatenstich:
//
//   Einzelvergabe   Der Bauherr vergibt jedes Gewerk selbst. Dann zaehlt
//                   alles, was mit Gewerken zu tun hat: Angebote vergleichen,
//                   Reihenfolge planen, Kosten nach DIN 276 gliedern.
//   Bauträger       Ein Vertrag, ein Preis, eine Firma. Dann gibt es nichts
//                   je Gewerk zu vergleichen und keine Kostengruppen zu
//                   pflegen -- die Gliederung macht der Bautraeger, nicht der
//                   Bauherr.
//
// Ausgeblendet wird nur die Anzeige. Die Daten bleiben stehen: Wer umstellt
// und zurueckstellt, findet alles wieder. Auch die Wege bleiben erreichbar,
// wenn man sie von Hand aufruft -- verschwinden soll nur, was im Weg steht,
// nicht, was jemand noch braucht.
//
// Eigenleistungen sind der Grund, warum "Bauträger" nicht alles wegraeumt.
// Fast jeder, der so baut, macht doch etwas selbst: Maler, Bodenbelaege,
// Aussenanlagen. Fuer diese Gewerke holt er weiterhin Angebote ein, und
// dafuer bleiben die Bereiche stehen.

import { einstellung } from './daten.js';

export const EINZELVERGABE = 'einzelvergabe';
export const TRAEGER = 'traeger';

export const BAUWEISEN = [
  {
    id: EINZELVERGABE,
    name: 'Einzelvergabe',
    kurz: 'Ich vergebe die Gewerke selbst',
    text: 'Du holst je Gewerk Angebote ein, beauftragst einzeln und steuerst die ' +
      'Reihenfolge. Die App zeigt dann alles dazu: Angebotsvergleich, Bauablauf, ' +
      'Gewerkeliste und die Gliederung nach DIN 276.',
  },
  {
    id: TRAEGER,
    name: 'Bauträger oder Generalunternehmer',
    kurz: 'Eine Firma baut schlüsselfertig',
    text: 'Ein Vertrag, ein Preis, eine Firma. Die Gewerke steuert sie, nicht du. ' +
      'Die App räumt dann weg, was du dafür nicht brauchst, und lässt Platz für ' +
      'das, was bei dieser Bauweise zählt: Zahlungsplan, Sonderwünsche, ' +
      'Bemusterung und Abnahme.',
  },
];

/**
 * Die Bauweise dieses Projekts samt allem, was daraus folgt.
 *
 * @returns {Promise<{
 *   id: string, istTraeger: boolean, eigenleistungen: string[],
 *   zeigtKostengruppen: boolean, versteckt: Set<string>
 * }>}
 */
export async function bauweise() {
  const [gesetzt, eigen] = await Promise.all([
    einstellung('bauweise'), einstellung('eigenleistungen'),
  ]);
  const id = gesetzt === TRAEGER ? TRAEGER : EINZELVERGABE;
  const eigenleistungen = Array.isArray(eigen) ? eigen : [];

  return {
    id,
    istTraeger: id === TRAEGER,
    eigenleistungen,
    // Die Kostengruppen sind die Sprache der Planer und Banken bei einem
    // Bauvorhaben, das man selbst gliedert. Beim Bautraeger steht im Vertrag
    // eine Summe, und die gliedert niemand mehr nach DIN.
    zeigtKostengruppen: id !== TRAEGER,
    versteckt: verstecken(id, eigenleistungen),
  };
}

export async function bauweiseSetzen(id) {
  await einstellung('bauweise', id === TRAEGER ? TRAEGER : EINZELVERGABE);
}

export async function eigenleistungenSetzen(liste) {
  await einstellung('eigenleistungen', liste);
}

/**
 * Welche Bereiche bei dieser Bauweise nicht in der Leiste stehen.
 *
 * Der Bauablauf faellt immer weg: Die Reihenfolge der Gewerke steuert der
 * Bautraeger, und ein Balkenplan, den man nicht beeinflusst, ist bestenfalls
 * Beschaeftigung.
 *
 * Angebote und Gewerkeliste fallen nur weg, solange es keine Eigenleistungen
 * gibt. Sobald der Bauherr selbst etwas uebernimmt, braucht er beides wieder.
 */
function verstecken(id, eigenleistungen) {
  if (id !== TRAEGER) return new Set();
  const weg = ['ablauf'];
  if (!eigenleistungen.length) weg.push('angebote', 'kontakte/gewerke');
  return new Set(weg);
}
