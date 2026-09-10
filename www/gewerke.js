// Die Gewerke des Projekts.
//
// Bisher stand die Liste fest im Programm. Das geht so lange gut, wie jeder
// dasselbe baut: Wer eine Zisterne, eine Photovoltaikanlage oder einen
// Kaminbauer hat, fand sein Gewerk nicht und landete bei "Sonstiges".
//
// Deshalb steht die Liste jetzt in den Einstellungen. Solange dort nichts
// steht, gilt die Vorgabe. Sie wird beim Abgleich mitgefuehrt wie jede andere
// Einstellung, also haben beide Geraete dieselben Gewerke.
//
// Gespeichert wird an Positionen, Maengeln und Kontakten der Name des
// Gewerks, nicht eine Kennung. Das ist bewusst so: Ein Gewerk ist ein Wort,
// keine Sache mit Eigenschaften. Dafuer muss beim Umbenennen alles
// mitgezogen werden, was den alten Namen trug -- siehe gewerkUmbenennen().

import { daten, einstellung } from './daten.js';

/** Die Vorgabe: was bei einem Einfamilienhaus fast immer vorkommt. */
export const GEWERKE_VORGABE = [
  'Rohbau', 'Dach', 'Fenster und Türen', 'Elektro', 'Sanitär', 'Heizung',
  'Estrich', 'Putz und Trockenbau', 'Fliesen', 'Maler', 'Bodenbelag',
  'Treppe', 'Außenanlagen', 'Sonstiges',
];

/** Die Gewerke dieses Projekts, in der Reihenfolge, in der sie gebaut werden. */
export async function gewerkeListe() {
  const eigene = await einstellung('gewerke');
  return Array.isArray(eigene) && eigene.length ? eigene : [...GEWERKE_VORGABE];
}

export async function gewerkeSetzen(liste) {
  await einstellung('gewerke', liste);
}

/** Die Speicher, in denen ein Gewerk am Datensatz haengt. */
const MIT_GEWERK = ['posten', 'maengel', 'kontakte'];

/**
 * Zaehlt, wo ein Gewerk benutzt wird.
 *
 * @returns {Promise<{gesamt: number, posten: number, maengel: number, kontakte: number}>}
 */
export async function gewerkVerwendung(name) {
  const zahlen = { gesamt: 0 };
  for (const speicher of MIT_GEWERK) {
    const treffer = (await daten.alle(speicher)).filter((s) => s.gewerk === name).length;
    zahlen[speicher] = treffer;
    zahlen.gesamt += treffer;
  }
  return zahlen;
}

/**
 * Benennt ein Gewerk um und zieht alles mit, was darauf zeigt.
 *
 * Ohne das zweite haetten Positionen, Maengel und Kontakte danach ein Gewerk,
 * das es nicht mehr gibt: Sie fielen aus jeder Gruppierung heraus, ohne dass
 * eine Fehlermeldung darauf hinweist.
 */
export async function gewerkUmbenennen(alt, neu) {
  const liste = await gewerkeListe();
  await gewerkeSetzen(liste.map((g) => (g === alt ? neu : g)));

  for (const speicher of MIT_GEWERK) {
    for (const satz of await daten.alle(speicher)) {
      if (satz.gewerk !== alt) continue;
      await daten.sichern(speicher, { ...satz, gewerk: neu });
    }
  }
}
