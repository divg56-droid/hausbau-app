// Wie gebaut wird. Die Entscheidung faellt vor dem ersten Spatenstich und
// praegt den Rest der App staerker als jede andere.
//
// Zur Begrifflichkeit, weil sie gern durcheinandergeht:
//
//   Generalunternehmer (GU)   Uebernimmt die gesamte Bauausfuehrung und
//                             vergibt die Gewerke an Nachunternehmer. Der
//                             Bauherr bleibt Eigentuemer des Grundstuecks,
//                             es ist ein Werkvertrag.
//   Generaluebernehmer (GUe)  Wie der GU, fuehrt aber selbst keine
//                             Bauleistung aus, sondern vergibt alles weiter.
//   Bautraeger                Baut auf eigenem Grundstueck und verkauft
//                             Grundstueck und Haus zusammen. Das ist ein
//                             Kaufvertrag beim Notar, und die Zahlungen
//                             folgen dem Ratenplan der MaBV.
//
// Fuer die App verhalten sich alle drei gleich: ein Vertrag, ein Preis, eine
// Firma, die die Gewerke steuert. Deshalb stehen sie unter einem Punkt, und
// der heisst "Schluesselfertig" -- der Oberbegriff, unter dem sie auch
// verkauft werden.
//
// Ausgeblendet wird nur die Anzeige. Die Daten bleiben stehen: Wer umstellt
// und zurueckstellt, findet alles wieder. Auch die Wege bleiben erreichbar,
// wenn man sie von Hand aufruft -- verschwinden soll nur, was im Weg steht,
// nicht, was jemand noch braucht.

import { einstellung } from './daten.js';

export const EINZELVERGABE = 'einzelvergabe';
export const SCHLUESSELFERTIG = 'schluesselfertig';
export const SANIERUNG = 'sanierung';

export const BAUWEISEN = [
  {
    id: EINZELVERGABE,
    name: 'Einzelvergabe',
    klammer: 'Architektenhaus: du vergibst Gewerk für Gewerk',
    text: 'Ein Architekt oder Planer entwirft, du holst je Gewerk Angebote ein, ' +
      'beauftragst einzeln und steuerst die Reihenfolge. Das ist die aufwendigste ' +
      'Bauweise und die mit dem größten Einfluss auf Preis und Ausführung. Die App ' +
      'zeigt dafür alles: Angebotsvergleich, Bauablauf, Gewerkeliste und die ' +
      'Gliederung nach DIN 276.',
  },
  {
    id: SCHLUESSELFERTIG,
    name: 'Schlüsselfertig',
    klammer: 'Generalunternehmer, Generalübernehmer, Fertighaus oder Bauträger',
    text: 'Ein Vertrag, ein Preis, eine Firma: Sie steuert die Gewerke, nicht du. ' +
      'Beim Generalunternehmer bleibt dir das Grundstück und es ist ein Werkvertrag; ' +
      'beim Bauträger kaufst du Grundstück und Haus zusammen, beim Notar, und die ' +
      'Raten folgen der MaBV. Für die App ist das dasselbe. Sie räumt weg, was du ' +
      'dafür nicht brauchst, und lässt Platz für das, was hier zählt: Zahlungsplan, ' +
      'Sonderwünsche, Bemusterung und Abnahme.',
  },
  {
    id: SANIERUNG,
    name: 'Sanierung',
    klammer: 'Umbau, Modernisierung oder Anbau im Bestand',
    text: 'Du baust an einem Haus, das schon steht. Vergeben wird meist einzeln, ' +
      'oft in Abschnitten, und die Überraschungen stecken im Bestand statt im ' +
      'Bauplan. Deshalb bleibt hier alles sichtbar. Die Baudokumentation zählt ' +
      'doppelt: Was vor dem Verschließen nicht fotografiert ist, findet später ' +
      'niemand wieder.',
  },
];

// Der frueher gespeicherte Wert. "Bautraeger" war als Bezeichnung zu eng: Er
// meint einen bestimmten Vertragstyp, gemeint war die ganze Gruppe.
const ALTNAMEN = { traeger: SCHLUESSELFERTIG };

/**
 * Die Bauweise dieses Projekts samt allem, was daraus folgt.
 *
 * @returns {Promise<{
 *   id: string, name: string, istSchluesselfertig: boolean,
 *   eigenleistungen: string[], zeigtKostengruppen: boolean, versteckt: Set<string>
 * }>}
 */
export async function bauweise() {
  const [gesetzt, eigen] = await Promise.all([
    einstellung('bauweise'), einstellung('eigenleistungen'),
  ]);
  const roh = ALTNAMEN[gesetzt] || gesetzt;
  const gewaehlt = BAUWEISEN.find((b) => b.id === roh) || BAUWEISEN[0];
  const eigenleistungen = Array.isArray(eigen) ? eigen : [];

  return {
    id: gewaehlt.id,
    name: gewaehlt.name,
    istSchluesselfertig: gewaehlt.id === SCHLUESSELFERTIG,
    eigenleistungen,
    // Die Kostengruppen sind die Sprache der Planer und Banken bei einem
    // Vorhaben, das man selbst gliedert. Steht im Vertrag eine Summe,
    // gliedert sie niemand mehr nach DIN. In der Sanierung dagegen schon:
    // Foerderungen und Nachweise fragen genau danach.
    zeigtKostengruppen: gewaehlt.id !== SCHLUESSELFERTIG,
    versteckt: verstecken(gewaehlt.id, eigenleistungen),
  };
}

export async function bauweiseSetzen(id) {
  const gueltig = BAUWEISEN.some((b) => b.id === id) ? id : EINZELVERGABE;
  await einstellung('bauweise', gueltig);
}

export async function eigenleistungenSetzen(liste) {
  await einstellung('eigenleistungen', liste);
}

/**
 * Welche Bereiche bei dieser Bauweise nicht in der Leiste stehen.
 *
 * Nur beim schluesselfertigen Bauen faellt etwas weg. Der Bauablauf immer:
 * Die Reihenfolge der Gewerke steuert die Firma, und ein Balkenplan, den man
 * nicht beeinflusst, ist bestenfalls Beschaeftigung.
 *
 * Angebote und Gewerkeliste fallen nur weg, solange es keine Eigenleistungen
 * gibt. Sobald der Bauherr selbst etwas uebernimmt, braucht er beides wieder.
 *
 * In der Sanierung bleibt alles stehen: Dort wird einzeln vergeben wie beim
 * Architektenhaus, nur im Bestand.
 */
function verstecken(id, eigenleistungen) {
  if (id !== SCHLUESSELFERTIG) return new Set();
  const weg = ['ablauf'];
  if (!eigenleistungen.length) weg.push('angebote', 'kontakte/gewerke');
  return new Set(weg);
}
