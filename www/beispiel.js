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

// Speicher mit projektbezogenen Saetzen. Die Bilder des Beispiels tragen
// die Projektkennung ausdruecklich: Der Bilderspeicher ist sonst nicht nach
// Projekt getrennt, und so gehen sie weder in den Abgleich noch bleiben sie
// nach dem Schliessen liegen.
const SPEICHER = [
  'darlehen', 'leitfaden', 'posten', 'angebote', 'belege', 'geschosse',
  'raeume', 'pins', 'maengel', 'aufgaben', 'todos', 'tagebuch', 'dokumente',
  'baudoku', 'kontakte', 'bilder',
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

/**
 * Oeffnet das Beispiel; legt es beim ersten Mal an. Laedt danach neu.
 *
 * @param {string} [ziel]  Bereich, in dem es danach weitergeht, etwa
 *   "angebote". Leer heisst Uebersicht.
 */
export async function beispielOeffnen(ziel = '') {
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

  // Nur einfache Wege: Buchstaben, Ziffern, Schraegstrich, Bindestrich.
  location.hash = /^[a-z0-9/-]+$/i.test(ziel) ? '#/' + ziel : '';
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
    ['Heizung und Sanitär', 'Sanitär', 'kg400', 38900, 0, 'beauftragt'],
    ['Estrich', 'Estrich', 'kg300', 11200, 0, 'geplant'],
    ['Innenputz und Maler', 'Putz', 'kg300', 26200, 0, 'beauftragt'],
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

  // Elektro ist vergeben: drei Angebote, eines beauftragt. So sieht man,
  // wie ein abgeschlossener Vergleich aussieht.
  for (const [firma, betrag, status, notiz] of [
    ['Elektro Muster GmbH', 22400, 'beauftragt', 'Komplett, 42 Steckdosen, Zählerschrank inklusive'],
    ['Elektrotechnik Beispiel', 24980, 'abgelehnt', 'Gleicher Umfang, zusätzlich Außenbeleuchtung'],
    ['Elektro Probst', 26230, 'abgelehnt', 'Gleicher Umfang, längere Lieferzeit'],
  ]) {
    await daten.sichern('angebote', { postenId: ids[5], firma, betrag, status, notiz, datum: tag(-60) });
  }

  // Die Aussenanlagen sind offen, und genau hier zeigt der Vergleich seinen
  // Nutzen: Das guenstigste Angebot schliesst etwas aus und laesst etwas
  // offen. Erst nach der Rueckfrage ist es entscheidungsreif.
  const aussen = [
    { id: 'bsp-zufahrt', titel: 'Zufahrt pflastern' },
    { id: 'bsp-terrasse', titel: 'Terrasse anlegen' },
    { id: 'bsp-rigole', titel: 'Entwässerung und Rigole' },
    { id: 'bsp-oberboden', titel: 'Oberboden andecken' },
    { id: 'bsp-zaun', titel: 'Zaun zur Straße' },
  ];
  const aussenPosten = await daten.holen('posten', ids[9]);
  await daten.sichern('posten', { ...aussenPosten, leistungen: aussen });
  for (const [firma, betrag, enthalten, ausgeschlossen, notiz] of [
    ['Garten Kern', 17900, ['bsp-zufahrt', 'bsp-terrasse', 'bsp-oberboden'], ['bsp-rigole'],
      'Rigole bauseits. Zum Zaun steht nichts im Angebot.'],
    ['Grün und Stein Beispiel', 19400, ['bsp-zufahrt', 'bsp-terrasse', 'bsp-rigole', 'bsp-oberboden', 'bsp-zaun'], [],
      'Alles aus der Liste enthalten'],
    ['Außenanlagen Probst', 21100, ['bsp-zufahrt', 'bsp-terrasse', 'bsp-rigole', 'bsp-oberboden'], [],
      'Zaun: Rückfrage offen'],
  ]) {
    await daten.sichern('angebote', {
      postenId: ids[9], firma, betrag, status: 'offen', notiz, datum: tag(-10),
      enthalten, ausgeschlossen,
    });
  }

  // Raeume mit Beispielbildern, Materialpass und Tuerliste.
  const bild = async (titel, art) => daten.sichern('bilder', {
    blob: await beispielbild(titel, art), typ: 'image/jpeg',
    name: 'beispielbild.jpg', angelegt: new Date().toISOString(), projektId: BEISPIEL,
  });
  const wandKueche = await bild('Küche: Wand vor dem Putz', 'wand');
  const bodenWohnen = await bild('Wohnzimmer: Leitungen auf der Rohdecke', 'boden');
  const deckeEG = await bild('Decke EG: Leerrohre vor dem Betonieren', 'decke');

  const raumIds = {};
  for (const [name, flaeche, extra] of [
    ['Wohnzimmer', 38, { bildIds: [bodenWohnen], tueren: [
      { wohin: 'zum Flur', breite: 861, hoehe: 1985, anschlag: 'DIN rechts', wandstaerke: 175, ausfuehrung: 'weiß, Glasausschnitt', notiz: '' },
    ] }],
    ['Küche', 14, { bildIds: [wandKueche], material: [
      { art: 'Bodenfliese', produkt: 'Feinsteinzeug 60 × 60, grau', farbe: 'Zementgrau', charge: 'Beispiel 0412', menge: '16 m², ein Paket Rest im Keller', notiz: '' },
    ] }],
    ['Bad OG', 9, { material: [
      { art: 'Wandfliese', produkt: 'Steingut 30 × 60, weiß matt', farbe: 'Weiß', charge: 'Beispiel 2231', menge: '28 m²', notiz: 'Fugenfarbe silbergrau' },
      { art: 'Wandfarbe', produkt: 'Latexfarbe für Feuchträume', farbe: 'RAL 9010', charge: '', menge: '', notiz: 'Decke und Wand über den Fliesen' },
    ], tueren: [
      { wohin: 'zum Flur OG', breite: 736, hoehe: 1985, anschlag: 'DIN links', wandstaerke: 125, ausfuehrung: 'weiß, WC-Beschlag', notiz: '' },
    ] }],
    ['Kind 1', 13, { tueren: [
      { wohin: 'zum Flur OG', breite: 861, hoehe: 1985, anschlag: 'DIN rechts', wandstaerke: 125, ausfuehrung: 'weiß', notiz: '' },
    ] }],
  ]) {
    raumIds[name] = await daten.sichern('raeume', {
      name, flaeche, notiz: '', bildIds: [], material: [], tueren: [], ...extra,
    });
  }

  // Zwei dokumentierte Maengel mit Raum, Gewerk, Frist und Beschreibung.
  for (const [titel, raum, gewerk, status, frist, beschreibung] of [
    ['Fensterbank Bad nicht dicht', 'Bad OG', 'Fenster', 'offen', tag(9),
      'Bei Regen läuft Wasser innen an der Wand herunter. Firma am ' + tag(-5).split('-').reverse().join('.') + ' schriftlich informiert.'],
    ['Riss im Putz neben der Terrassentür', 'Wohnzimmer', 'Putz', 'arbeit', tag(14),
      'Senkrecht, etwa 40 cm lang. Maler kommt zur Nachbesserung.'],
  ]) {
    await daten.sichern('maengel', {
      titel, raum, raumId: raumIds[raum] || null, gewerk, status, frist, beschreibung,
    });
  }

  // Der Bauablauf, passend zu fuenf Monaten Bauzeit: Rohbau und Dach sind
  // fertig, die Rohinstallation laeuft, in fuenf Tagen kommt der Innenputz.
  // Genau deshalb meldet sich die Fotoaufgabe. Feste Starttage statt
  // Vorgaengerkette, damit der Stand nicht von der Rechnung abhaengt.
  for (const [titel, phase, ab, dauer, status] of [
    ['Baugenehmigung liegt vor', 'Vorbereitung', -165, 1, 'fertig'],
    ['Baustelle einrichten, Absteckung', 'Vorbereitung', -150, 3, 'fertig'],
    ['Baugrube und Erdarbeiten', 'Erdarbeiten', -146, 5, 'fertig'],
    ['Bodenplatte', 'Erdarbeiten', -140, 14, 'fertig'],
    ['Mauerwerk Erdgeschoss', 'Rohbau', -120, 12, 'fertig'],
    ['Decke Erdgeschoss', 'Rohbau', -107, 5, 'fertig'],
    ['Mauerwerk Obergeschoss', 'Rohbau', -100, 12, 'fertig'],
    ['Dachstuhl aufstellen', 'Dach', -85, 4, 'fertig'],
    ['Dachdeckung und Klempner', 'Dach', -80, 8, 'fertig'],
    ['Fenster und Außentüren einbauen', 'Fenster und Türen', -60, 5, 'fertig'],
    ['Elektro-Rohinstallation', 'Haustechnik roh', -12, 14, 'laeuft'],
    ['Sanitär-Rohinstallation', 'Haustechnik roh', -8, 10, 'laeuft'],
    ['Heizung-Rohinstallation', 'Haustechnik roh', -3, 7, 'laeuft'],
    ['Innenputz', 'Innenausbau', 5, 7, 'offen'],
    ['Estrich einbringen', 'Innenausbau', 16, 3, 'offen'],
    ['Estrich trocknen lassen', 'Innenausbau', 19, 28, 'offen'],
    ['Fliesenarbeiten', 'Oberflächen', 48, 8, 'offen'],
    ['Malerarbeiten', 'Oberflächen', 57, 7, 'offen'],
    ['Bodenbeläge verlegen', 'Oberflächen', 65, 5, 'offen'],
    ['Innentüren einbauen', 'Oberflächen', 71, 2, 'offen'],
    ['Außenanlagen und Zufahrt', 'Außenanlagen', 75, 10, 'offen'],
    ['Bauabnahme mit Sachverständigem', 'Abnahme', 90, 1, 'offen'],
  ]) {
    await daten.sichern('aufgaben', {
      titel, phase, dauer, start: tag(ab), vorgaengerId: null, status,
      kontaktId: null, notiz: '',
      ...(status === 'fertig' ? { fotosErledigt: true } : {}),
    });
  }

  // Die Baudokumentation bis heute, mit den Beispielbildern.
  for (const [titel, phase, ab, notiz, bildIds] of [
    ['Decke EG: Leerrohre vor dem Betonieren', 'Rohbau', -106,
      'Leerrohre für Deckenleuchten und Lüftung, Lage mit Maß zur Außenwand.', [deckeEG]],
    ['Küche: Wand vor dem Putz', 'Haustechnik roh', -2,
      'Dosen für die Arbeitsplatte auf 110 cm, Wasser links, Zollstock im Bild.', [wandKueche]],
    ['Wohnzimmer: Leitungen auf der Rohdecke', 'Haustechnik roh', -1,
      'Vor dem Estrich erneut fotografieren, dann mit den Heizrohren.', [bodenWohnen]],
  ]) {
    await daten.sichern('baudoku', { titel, phase, datum: tag(ab), notiz, bildIds });
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

  // Ein Teil des Bauleitfadens ist abgehakt, damit die Uebersicht einen
  // Fortschritt zeigt. Kennung mit Projekt dahinter, wie in leitfaden.js:
  // So bleiben die Haken des echten Projekts unberuehrt.
  // Passend zu fuenf Monaten Bauzeit: alles vor dem Bau erledigt, von der
  // Bauausfuehrung das erste Drittel.
  const { PHASEN: LEITFADEN, giltFuer } = await import('./leitfaden-daten.js');
  const erledigt = [];
  for (const phase of LEITFADEN) {
    const punkte = phase.punkte.filter((pk) => giltFuer(pk, 'einzelvergabe'));
    if (phase.id === 'bau') erledigt.push(...punkte.slice(0, Math.ceil(punkte.length / 3)));
    else if (['geld', 'grundstueck', 'behoerden', 'planung'].includes(phase.id)) erledigt.push(...punkte);
  }
  for (const punkt of erledigt) {
    await daten.sichern('leitfaden', {
      id: punkt.id + '@' + BEISPIEL, punkt: punkt.id, projektId: BEISPIEL,
      erledigt: true, am: tag(-30), notiz: '',
    });
  }
}

/*
 * Ein gezeichnetes Beispielbild.
 *
 * Keine echten Baustellenfotos: Die waeren entweder fremd oder erfunden
 * echt. Stattdessen eine einfache Zeichnung, die zeigt, worauf es beim Foto
 * ankommt (Leitungen, Dosen, Zollstock), und unten sichtbar als
 * Beispielbild beschriftet ist.
 */
async function beispielbild(titel, art) {
  const breite = 800;
  const hoehe = 600;
  const leinwand = document.createElement('canvas');
  leinwand.width = breite;
  leinwand.height = hoehe;
  const c = leinwand.getContext('2d');

  const linie = (farbe, dicke, punkte) => {
    c.strokeStyle = farbe;
    c.lineWidth = dicke;
    c.lineCap = 'round';
    c.beginPath();
    punkte.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
  };
  const dose = (x, y, r) => {
    c.fillStyle = '#e8e4dc';
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  };

  if (art === 'wand') {
    c.fillStyle = '#b9b1a4';
    c.fillRect(0, 0, breite, hoehe);
    c.strokeStyle = '#a79e90';
    c.lineWidth = 2;
    for (let y = 0; y < hoehe; y += 50) {
      for (let x = (y / 50) % 2 ? -60 : 0; x < breite; x += 120) c.strokeRect(x, y, 120, 50);
    }
    for (const x of [180, 330, 480]) linie('#e07a1f', 10, [[x, 0], [x, 230]]);
    linie('#e07a1f', 10, [[620, 0], [620, 110]]);
    for (const x of [180, 330, 480]) dose(x, 250, 22);
    dose(620, 130, 22);
    linie('#2f6fb3', 12, [[60, hoehe], [60, 330], [120, 330]]);
    c.fillStyle = '#f2c230';
    c.fillRect(150, 300, 30, 230);
    c.fillStyle = '#1f2a30';
    for (let y = 300; y < 530; y += 25) c.fillRect(150, y, 12, 2);
  } else if (art === 'boden') {
    c.fillStyle = '#9aa3a6';
    c.fillRect(0, 0, breite, hoehe);
    linie('#e07a1f', 10, [[0, 120], [760, 120]]);
    linie('#e07a1f', 10, [[0, 170], [520, 170], [520, 600]]);
    linie('#2f6fb3', 12, [[120, 600], [120, 260], [800, 260]]);
    c.fillStyle = '#f2c230';
    c.fillRect(250, 330, 300, 28);
    c.fillStyle = '#1f2a30';
    for (let x = 250; x < 550; x += 25) c.fillRect(x, 330, 2, 12);
  } else {
    c.fillStyle = '#8f8a80';
    c.fillRect(0, 0, breite, hoehe);
    c.strokeStyle = '#5b5750';
    c.lineWidth = 4;
    for (let x = 20; x < breite; x += 60) {
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, hoehe); c.stroke();
    }
    for (let y = 20; y < hoehe; y += 60) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(breite, y); c.stroke();
    }
    linie('#e07a1f', 12, [[80, 540], [80, 300], [400, 300], [400, 140]]);
    linie('#e07a1f', 12, [[720, 540], [720, 380], [520, 380]]);
    dose(400, 130, 26);
    dose(510, 380, 26);
  }

  // Beschriftung, damit niemand es fuer ein echtes Foto haelt.
  c.fillStyle = 'rgba(31, 42, 48, 0.88)';
  c.fillRect(0, hoehe - 64, breite, 64);
  c.fillStyle = '#ffffff';
  c.font = '600 24px sans-serif';
  c.fillText('Beispielbild · ' + titel, 22, hoehe - 24);

  return new Promise((gut) => leinwand.toBlob(gut, 'image/jpeg', 0.82));
}
