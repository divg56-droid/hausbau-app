// Die Liste der Bauprojekte.
//
// Eigene Datei und kein Modul: Die Seitenleiste braucht sie beim Aufbau, und
// app.js darf nichts laden, was beim Einlesen schon das Dokument anfasst --
// dieselbe Trennung wie bei bereiche.js.
//
// Das erste Projekt gibt es immer. Es wird beim ersten Zugriff angelegt und
// traegt die feste Kennung aus daten.js; alle vorhandenen Saetze ohne
// projektId gehoeren dorthin.

import { daten, einstellung, projektAktiv, projektWechseln, ERSTES_PROJEKT } from './daten.js';

/**
 * Alle Projekte, aeltestes zuerst, mit garantiert vorhandenem ersten.
 *
 * @returns {Promise<Array<{id: string, name: string, angelegt: string}>>}
 */
export async function projekteListe() {
  const liste = await daten.alle('projekte');

  if (!liste.some((p) => p.id === ERSTES_PROJEKT)) {
    // Der Name stand bisher in den Einstellungen. Er wandert hier herueber,
    // damit die Kopfzeile der PDFs unveraendert bleibt.
    const name = (await einstellung('projektname')) || 'Mein Bauprojekt';
    await daten.sichern('projekte', {
      id: ERSTES_PROJEKT, name, angelegt: new Date().toISOString(), notiz: '',
    });
    return projekteListe();
  }

  return liste.sort((a, b) => String(a.angelegt || '').localeCompare(String(b.angelegt || '')));
}

/** Das Projekt, in dem gerade gearbeitet wird. Faellt auf das erste zurueck. */
export async function projektJetzt() {
  const [liste, id] = await Promise.all([projekteListe(), projektAktiv()]);
  return liste.find((p) => p.id === id) || liste[0];
}

/**
 * Legt ein Projekt an und schaltet hinein.
 *
 * Der Name landet zugleich als Einstellung "projektname" des neuen Projekts,
 * weil die PDF-Koepfe ihn dort lesen.
 */
export async function projektAnlegen(name) {
  const id = await daten.sichern('projekte', {
    name, angelegt: new Date().toISOString(), notiz: '',
  });
  await projektWechseln(id);
  await einstellung('projektname', name);
  return id;
}

/** Benennt um: der Datensatz und der Name in den Einstellungen des Projekts. */
export async function projektUmbenennen(id, name) {
  const liste = await projekteListe();
  const satz = liste.find((p) => p.id === id);
  if (!satz) return;
  await daten.sichern('projekte', { ...satz, name });

  // Die Einstellung haengt am aktiven Projekt. Fuer ein anderes laesst sie
  // sich von hier aus nicht schreiben; sie wird beim naechsten Wechsel
  // nachgezogen.
  if ((await projektAktiv()) === id) await einstellung('projektname', name);
}

// Was beim Loeschen mitgeht. Bilder stehen bewusst nicht dabei: Sie haengen
// an ihrer Kennung und werden von den Saetzen aus geloescht, die sie halten.
const PROJEKTSPEICHER = [
  'darlehen', 'leitfaden', 'posten', 'angebote', 'belege', 'geschosse',
  'raeume', 'pins', 'maengel', 'aufgaben', 'todos', 'tagebuch', 'dokumente',
  'baudoku', 'kontakte',
];

/**
 * Loescht ein Projekt samt allem, was daran haengt.
 *
 * Die Saetze bekommen Grabsteine wie beim einzelnen Loeschen, damit auch das
 * zweite Geraet sie beim naechsten Abgleich verliert. Ein stilles Wegwerfen
 * nur hier waere beim naechsten Abgleich wieder da.
 */
export async function projektLoeschen(id) {
  const liste = await projekteListe();
  if (liste.length <= 1) throw new Error('Das letzte Projekt lässt sich nicht löschen.');

  for (const speicher of PROJEKTSPEICHER) {
    for (const satz of await daten.alleMitGrabsteinen(speicher)) {
      if (satz.geloescht) continue;
      if ((satz.projektId || ERSTES_PROJEKT) !== id) continue;
      await daten.loeschen(speicher, satz.id);
    }
  }
  await daten.loeschen('projekte', id);

  if ((await projektAktiv()) === id) {
    await projektWechseln(liste.find((p) => p.id !== id).id);
  }
}

/** Zaehlt, was an einem Projekt haengt. Fuer die Rueckfrage vor dem Loeschen. */
export async function projektBestand(id) {
  let saetze = 0;
  for (const speicher of PROJEKTSPEICHER) {
    for (const satz of await daten.alleMitGrabsteinen(speicher)) {
      if (satz.geloescht) continue;
      if ((satz.projektId || ERSTES_PROJEKT) !== id) continue;
      saetze++;
    }
  }
  return saetze;
}
