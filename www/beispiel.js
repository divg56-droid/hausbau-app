// Das Beispielprojekt.
//
// Wer die App zum ersten Mal oeffnet, etwa nach einem QR-Code auf der Messe,
// sieht leere Listen: Der Angebotsvergleich braucht erst Kostenpositionen,
// die Uebersicht erst ein Budget. Der Nutzen zeigt sich erst nach zehn
// Minuten Eintippen. Das Beispiel zeigt ihn in einer.
//
// Es ist ein eigenes Projekt mit fester Kennung und bleibt vom Rest
// getrennt:
//
//   - abgleich.js schickt nichts davon auf den Server (istBeispielSatz),
//   - beim Schliessen wird alles endgueltig entfernt, ohne Grabsteine, weil
//     es nie woanders war,
//   - danach ist das Projekt wieder offen, das vorher offen war.
//
// Gefuellt wird ueber daten.js wie in den Formularen, damit die Bildschirme
// genau die Felder finden, die sie lesen. Die Werte sind erfunden.

import {
  daten, einstellung, projektAktiv, projektWechseln, ERSTES_PROJEKT,
} from './daten.js';

export const BEISPIEL = 'beispielprojekt';
const ZURUECK = 'beispiel_zurueck';

// Speicher mit projektbezogenen Saetzen. Bilder legt das Beispiel nicht an.
const SPEICHER = [
  'darlehen', 'posten', 'angebote', 'belege', 'geschosse',
  'raeume', 'pins', 'maengel', 'aufgaben', 'todos', 'tagebuch', 'dokumente',
  'baudoku', 'kontakte',
];

export const istBeispielAktiv = async () => (await projektAktiv()) === BEISPIEL;

/** Gehoert ein Satz zum Beispiel? Fuer den Abgleich, der ihn auslaesst. */
export function istBeispielSatz(speicher, satz) {
  if (speicher === 'einstellungen') {
    return String(satz.name || '').endsWith('@' + BEISPIEL) ||
      satz.name === ZURUECK ||
      (satz.name === 'projekt_aktiv' && satz.wert === BEISPIEL);
  }
  if (speicher === 'projekte') return satz.id === BEISPIEL;
  return satz.projektId === BEISPIEL;
}

// Termine relativ zu heute, damit Fristen und Tagebuch nicht veraltet wirken.
const tag = (versatz) => {
  const d = new Date();
  d.setDate(d.getDate() + versatz);
  return d.toISOString().slice(0, 10);
};

/** Oeffnet das Beispiel; legt es beim ersten Mal an. Laedt danach neu. */
export async function beispielOeffnen() {
  const vorher = await projektAktiv();
  if (vorher !== BEISPIEL) {
    // Das erste Projekt muss angelegt sein, bevor das Beispiel aktiv ist:
    // projekteListe() legt es sonst mit dem Namen des gerade offenen
    // Projekts an -- und das waere dann "Beispielprojekt".
    const { projekteListe } = await import('./projekte.js');
    await projekteListe();
    await daten.sichern('einstellungen', { name: ZURUECK, wert: vorher });
  }

  if (!(await daten.holen('projekte', BEISPIEL))) {
    await daten.sichern('projekte', {
      id: BEISPIEL, name: 'Beispielprojekt', angelegt: new Date().toISOString(),
      notiz: '', beispiel: true,
    });
    await projektWechseln(BEISPIEL);
    await fuellen();
  } else {
    await projektWechseln(BEISPIEL);
  }

  location.hash = '';
  location.reload();
}

/** Entfernt das Beispiel restlos und kehrt ins vorherige Projekt zurueck. */
export async function beispielSchliessen() {
  for (const speicher of SPEICHER) {
    for (const satz of await daten.alleMitGrabsteinen(speicher)) {
      if (satz.projektId === BEISPIEL) await daten.entfernen(speicher, satz.id);
    }
  }
  for (const satz of await daten.alleMitGrabsteinen('einstellungen')) {
    if (String(satz.name).endsWith('@' + BEISPIEL)) await daten.loeschen('einstellungen', satz.name);
  }
  await daten.entfernen('projekte', BEISPIEL);

  const zurueck = await daten.holen('einstellungen', ZURUECK);
  await daten.loeschen('einstellungen', ZURUECK);
  const ziel = zurueck && zurueck.wert && zurueck.wert !== BEISPIEL ? zurueck.wert : ERSTES_PROJEKT;
  await projektWechseln(ziel);

  location.hash = '';
  location.reload();
}

async function fuellen() {
  await einstellung('projektname', 'Beispiel: Neubau Ahornweg 12');
  await einstellung('bauweise', 'einzelvergabe');
  await einstellung('bauphase', 'bau');
  await einstellung('baubeginn', tag(-150));
  await einstellung('baukosten_eingabe', {
    land: 'rheinland-pfalz', flaeche: 148, standard: 'mittel', keller: false, grundstueck: 132000,
  });

  for (const [art, name, betrag, extra] of [
    ['eigenkapital', 'Erspartes', 96000, {}],
    ['zuschuss', 'Förderzuschuss', 18000, {}],
    ['darlehen', 'Bankdarlehen', 386000, { zinsProzent: 3.6, tilgungProzent: 2.0, bindungJahre: 15 }],
  ]) {
    await daten.sichern('darlehen', { art, name, betrag, ...extra });
  }

  // Positionen: geplant gegen tatsaechlich, damit Mehrkosten sichtbar werden.
  const posten = [
    ['Grundstück', 'Grundstück', 'kg100', 132000, 132000, 'bezahlt'],
    ['Erdarbeiten und Baugrube', 'Erdbau', 'kg300', 18400, 21150, 'bezahlt'],
    ['Rohbau Mauerwerk', 'Rohbau', 'kg300', 94500, 98720, 'bezahlt'],
    ['Dachstuhl und Eindeckung', 'Zimmerer', 'kg300', 48200, 47390, 'bezahlt'],
    ['Fenster und Haustür', 'Fenster', 'kg300', 31500, 34280, 'beauftragt'],
    ['Elektroinstallation', 'Elektro', 'kg400', 22400, 0, 'beauftragt'],
    ['Heizung und Sanitär', 'Sanitär', 'kg400', 38900, 0, 'geplant'],
    ['Estrich', 'Estrich', 'kg300', 11200, 0, 'geplant'],
    ['Innenputz und Maler', 'Putz', 'kg300', 26200, 0, 'geplant'],
    ['Außenanlagen', 'Garten', 'kg500', 19600, 0, 'geplant'],
  ];
  const ids = [];
  for (const [name, gewerk, kostengruppe, geplant, tatsaechlich, status] of posten) {
    ids.push(await daten.sichern('posten', { name, gewerk, kostengruppe, geplant, tatsaechlich, status }));
  }

  for (const [nr, betrag, datum, beschreibung] of [
    [0, 132000, tag(-200), 'Kaufpreis Grundstück'],
    [1, 21150, tag(-140), 'Erdarbeiten Schlussrechnung'],
    [2, 98720, tag(-80), 'Rohbau Schlussrechnung'],
    [3, 47390, tag(-45), 'Dachstuhl und Eindeckung'],
  ]) {
    await daten.sichern('belege', { postenId: ids[nr], betrag, datum, beschreibung });
  }

  // Drei vergleichbare Angebote fuer dieselbe Leistung, mit spuerbarer Spanne.
  for (const [firma, betrag, gewaehlt, notiz] of [
    ['Elektro Muster GmbH', 22400, true, 'Komplett, 42 Steckdosen, Zählerschrank inklusive'],
    ['Elektrotechnik Beispiel', 24980, false, 'Gleicher Umfang, zusätzlich Außenbeleuchtung'],
    ['Elektro Probst', 26230, false, 'Gleicher Umfang, längere Lieferzeit'],
  ]) {
    await daten.sichern('angebote', { postenId: ids[5], firma, betrag, gewaehlt, notiz, datum: tag(-60) });
  }

  // Zwei dokumentierte Maengel mit Raum, Gewerk, Frist und Beschreibung.
  for (const [titel, raum, gewerk, status, frist, beschreibung] of [
    ['Fensterbank Bad nicht dicht', 'Bad OG', 'Fenster', 'offen', tag(9),
      'Bei Regen läuft Wasser innen an der Wand herunter. Firma am ' + tag(-5).split('-').reverse().join('.') + ' schriftlich informiert.'],
    ['Riss im Putz neben der Terrassentür', 'Wohnzimmer', 'Putz', 'arbeit', tag(14),
      'Senkrecht, etwa 40 cm lang. Maler kommt zur Nachbesserung.'],
  ]) {
    await daten.sichern('maengel', { titel, raum, gewerk, status, frist, beschreibung });
  }

  // Eine kurze Checkliste: die Vorlage fuer den Abnahmetermin, zum Teil abgehakt.
  const { VORLAGEN } = await import('./checklisten-daten.js');
  const vorlage = VORLAGEN.find((v) => v.titel === 'Zur Abnahme mitnehmen') || VORLAGEN[0];
  const punkte = vorlage.punkte.slice(0, 6);
  for (const [i, punkt] of punkte.entries()) {
    const p = typeof punkt === 'string' ? { titel: punkt } : punkt;
    const erledigt = i < 2;
    await daten.sichern('todos', {
      titel: p.titel, warum: p.warum || '', tun: p.tun || '', notiz: '',
      liste: vorlage.titel, erledigt, am: erledigt ? tag(-1) : null, faellig: null,
    });
  }

  // Keine Haken im Bauleitfaden: Dort ist die Kennung des Punktes zugleich
  // die des Satzes, ueber alle Projekte hinweg. Ein Haken hier ueberschriebe
  // den im echten Projekt, und das Schliessen des Beispiels loeschte ihn.
}
