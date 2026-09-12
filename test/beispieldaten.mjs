/* Ein Beispielprojekt zum Fuellen einer leeren App.
 *
 * Gebraucht an zwei Stellen: von test/breite.mjs, das die Bildschirme auf
 * ueberstehende Kaesten prueft, und von ressourcen/store-bilder.mjs, das die
 * Screenshots fuer den Play Store aufnimmt. Beide brauchen dieselben Daten --
 * eine Pruefung an leeren Listen findet nichts, und ein Store-Bild mit
 * leeren Listen verkauft nichts.
 *
 * Der Ausdruck laeuft im Browser, nicht hier: Er wird ueber das
 * DevTools-Protokoll in die laufende App geschickt. Gefuellt wird ueber
 * daten.js, also ueber dieselbe Schicht, die auch die Formulare benutzen.
 * An der Datenbank vorbei zu schreiben hiesse, Felder zu raten, die die App
 * danach nicht liest -- der erste Versuch tat das und lieferte eine
 * Uebersicht mit "Budget: noch nicht festgelegt".
 */
export const FUELLEN = `(async () => {
  const { daten, einstellung, projektAktiv } = await import('/daten.js');

  await einstellung('projektname', 'Neubau Ahornweg 12');
  await einstellung('bauweise', 'einzelvergabe');
  await einstellung('bauphase', 'bau');
  await einstellung('baubeginn', '2026-04-13');
  await einstellung('ort', 'Nünschweiler');
  await einstellung('baustelle', 'Nünschweiler');

  /* Die Wohnflaeche ist kein eigener Schluessel, sie steckt in der Eingabe
     des Baukostenrechners: einstellung('baukosten_eingabe', { flaeche }).
     Ohne sie steht auf der Budgetplanung zweimal ein Strich statt des
     Preises je Quadratmeter. */
  await einstellung('baukosten_eingabe', {
    land: 'rheinland-pfalz', flaeche: 148, standard: 'mittel',
    keller: false, grundstueck: 132000,
  });

  /* Das Budget kommt aus der Finanzierung, nicht aus einer Einstellung:
     finanzierungsstand() summiert Eigenkapital, Zuschuesse und Darlehen.
     Ohne diese Saetze steht auf der Uebersicht "Noch nicht festgelegt". */
  for (const [art, name, betrag, extra] of [
    ['eigenkapital', 'Erspartes', 96000, {}],
    ['eigenkapital', 'Eigenleistung Malerarbeiten', 14000, {}],
    ['zuschuss', 'KfW 297 Tilgungszuschuss', 18000, {}],
    ['darlehen', 'Bankdarlehen Sparkasse', 320000,
     { zinsProzent: 3.7, tilgungProzent: 2.0, bindungJahre: 15 }],
    ['darlehen', 'KfW 297 Klimafreundlicher Neubau', 66000,
     { zinsProzent: 2.4, tilgungProzent: 2.5, bindungJahre: 10 }],
  ]) {
    await daten.sichern('darlehen', { art, name, betrag, ...extra });
  }

  const posten = [
    ['Grundstück', 'Grundstück', 'kg100', 132000, 132000, 'bezahlt'],
    ['Erdarbeiten und Baugrube', 'Erdbau', 'kg300', 18400, 21150, 'bezahlt'],
    ['Bodenplatte mit Dämmung', 'Rohbau', 'kg300', 26800, 26800, 'bezahlt'],
    ['Rohbau Mauerwerk', 'Rohbau', 'kg300', 94500, 98720, 'bezahlt'],
    ['Dachstuhl und Eindeckung', 'Zimmerer', 'kg300', 48200, 47390, 'bezahlt'],
    ['Fenster und Haustür', 'Fenster', 'kg300', 31500, 34280, 'beauftragt'],
    ['Elektroinstallation', 'Elektro', 'kg400', 22400, 0, 'beauftragt'],
    ['Heizung und Sanitär', 'Sanitär', 'kg400', 38900, 0, 'beauftragt'],
    ['Estrich', 'Estrich', 'kg300', 11200, 0, 'beauftragt'],
    ['Innenputz', 'Putz', 'kg300', 16800, 0, 'geplant'],
    ['Fliesenarbeiten', 'Fliesen', 'kg300', 14500, 0, 'geplant'],
    ['Innentüren', 'Schreiner', 'kg300', 8900, 0, 'geplant'],
    ['Malerarbeiten', 'Maler', 'kg300', 9400, 0, 'geplant'],
    ['Außenanlagen und Zufahrt', 'Garten', 'kg500', 19600, 0, 'geplant'],
  ];
  const kennungen = [];
  // "name", nicht "titel": Die Kostenaufstellung liest p.name. Der erste
  // Versuch schrieb titel -- die Summen stimmten, die Spalte "Position" war
  // leer, und im Screenshot faellt genau das auf.
  for (const [name, gewerk, kostengruppe, geplant, tatsaechlich, status] of posten) {
    kennungen.push(await daten.sichern('posten', {
      name, gewerk, kostengruppe, geplant, tatsaechlich, status,
    }));
  }

  // Rechnungen zu dem, was bezahlt ist -- sonst steht die Kostenaufstellung
  // auf "beauftragt", obwohl oben "bezahlt" steht.
  const rechnungen = [
    [0, 132000, '2026-03-02', 'Kaufpreis Grundstück'],
    [1, 21150, '2026-04-21', 'Erdarbeiten Schlussrechnung'],
    [2, 26800, '2026-05-04', 'Bodenplatte'],
    [3, 60000, '2026-06-12', 'Rohbau 1. Abschlag'],
    [3, 38720, '2026-07-18', 'Rohbau Schlussrechnung'],
    [4, 47390, '2026-08-05', 'Dachstuhl und Eindeckung'],
  ];
  for (const [nr, betrag, datum, beschreibung] of rechnungen) {
    await daten.sichern('belege', { postenId: kennungen[nr], betrag, datum, beschreibung });
  }

  const angebote = [
    [6, 'Elektro Kessler', 22400, true, 'Komplett inkl. 42 Steckdosen, KNX vorbereitet'],
    [6, 'Elektrotechnik Zawadski', 24980, false, 'Ohne Außenbeleuchtung'],
    [6, 'Elektro Hemmer GmbH', 21150, false, 'Ohne Zählerschrank'],
    [7, 'Sanitär Pirmasens', 38900, true, 'Wärmepumpe Luft-Wasser, 3 Bäder'],
    [7, 'Haustechnik Weber', 41300, false, 'Gleiche Leistung, andere Wärmepumpe'],
  ];
  for (const [nr, firma, betrag, gewaehlt, notiz] of angebote) {
    await daten.sichern('angebote', {
      postenId: kennungen[nr], firma, betrag, gewaehlt, notiz,
      datum: '2026-06-' + (10 + nr),
    });
  }

  const maengel = [
    ['Steckdose Küche fehlt', 'Küche', 'Elektro', 'offen', '2026-09-30',
     'In der Planung waren vier Steckdosen an der Arbeitsplatte, montiert sind drei.'],
    ['Riss im Innenputz', 'Wohnzimmer', 'Putz', 'arbeit', '2026-09-25',
     'Senkrecht neben der Terrassentür, etwa 40 cm.'],
    ['Fensterbank Bad nicht dicht', 'Bad OG', 'Fenster', 'offen', '2026-10-06',
     'Wasser läuft bei Regen innen an der Wand herunter.'],
    ['Kratzer Haustür', 'Flur', 'Fenster', 'behoben', '2026-08-20',
     'Vom Einbau. Ist getauscht.'],
  ];
  for (const [titel, raum, gewerk, status, frist, beschreibung] of maengel) {
    await daten.sichern('maengel', { titel, raum, gewerk, status, frist, beschreibung });
  }

  /* Kontakte zuerst: Das Tagebuch haelt Helfer als Kennung und holt den
     Namen aus den Kontakten. Ohne sie steht unter "Stunden je Helfer"
     nichts. */
  const helferListe = [];
  /* Mit Nummer und Adresse, und mit einem absichtlich langen Firmennamen:
     Die Zeile zeigt rechts die Marken "Anrufen" und "E-Mail schreiben", und
     ob die neben einem langen Namen noch auf ein 320 Pixel breites Telefon
     passen, sieht man nur, wenn beides zusammen dasteht. Kontakte ohne
     Erreichbarkeit haetten die Marken gar nicht erst erzeugt -- und die
     Breitenpruefung haette nichts gefunden, weil nichts da war. */
  for (const [name, art, gewerk, telefon, epost] of [
    ['Matthias Volz', 'person', '', '0631 4477201', 'm.volz@example.de'],
    ['Stefan Bähr', 'person', '', '0170 2244880', ''],
    ['Elektro Kessler GmbH & Co. KG', 'firma', 'Elektro',
     '06331 984512', 'kontakt@elektro-kessler-pirmasens.example.de'],
    ['Sanitär Pirmasens', 'firma', 'Sanitär', '06331 771030', 'info@sanitaer-ps.example.de'],
    ['Zimmerei Hohenecken', 'firma', 'Zimmerer', '', 'buero@zimmerei-hohenecken.example.de'],
  ]) {
    helferListe.push(await daten.sichern('kontakte', {
      name, art, gewerk, telefon, epost,
      strasse: 'Hauptstraße 14', plzOrt: '66989 Nünschweiler',
    }));
  }

  const tage = [
    ['2026-09-10', 'Trocken', 19, 'Estrich im ganzen Erdgeschoss eingebracht.',
     'Ab jetzt zwei Wochen nicht betreten.', [[0, 8], [1, 6]]],
    ['2026-09-08', 'Bewölkt', 16, 'Innenputz Obergeschoss, zwei Räume fertig.',
     'Bad fehlt noch.', [[0, 7.5]]],
    ['2026-09-05', 'Regen', 14, 'Alle Fenster eingebaut und ausgeschäumt.',
     'Haustür folgt nächste Woche.', [[0, 9], [1, 9]]],
  ];
  for (const [datum, wetter, temperatur, gemacht, offen, wer] of tage) {
    await daten.sichern('tagebuch', {
      datum, wetter, temperatur, gemacht, offen,
      helfer: wer.map(([i, stunden]) => ({ id: helferListe[i], stunden, unterschriftId: null })),
    });
  }

  const todos = [
    ['Rohbauversicherung verlängern', '2026-09-18', false],
    ['Zählerschrank mit Stadtwerken abstimmen', '2026-09-22', false],
    ['Termin Estrichfeuchtemessung', '2026-10-02', false],
    ['Angebot Fliesen einholen', '2026-09-15', true],
  ];
  for (const [titel, faellig, erledigt] of todos) {
    await daten.sichern('todos', { titel, faellig, erledigt });
  }

  // Bauleitfaden: die ersten Punkte abgehakt, damit ein Fortschritt dasteht.
  // Die Liste heisst punkteFuer(bauweise), nicht LEITFADEN -- der erste
  // Versuch importierte einen Namen, den es nicht gibt, und lief still ins
  // Leere: "0 % erledigt" auf jedem Bild.
  const { punkteFuer } = await import('/leitfaden-daten.js');
  const punkte = punkteFuer('einzelvergabe');
  for (const punkt of punkte.slice(0, Math.round(punkte.length * 0.45))) {
    await daten.sichern('leitfaden', { id: punkt.id, erledigt: true, am: '2026-07-01' });
  }

  const { finanzierungsstand } = await import('/module/finanzierung.js');
  const geld = await finanzierungsstand();
  return {
    posten: kennungen.length, projekt: await projektAktiv(),
    budget: geld.gesamt, punkte: punkte.length,
  };
})()`;
