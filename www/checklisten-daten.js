// Vorlagen für Checklisten.
//
// Anders als der Bauleitfaden sind das keine Bauabschnitte, sondern Listen
// fuer einen einzigen Termin: Was nehme ich mit zur Abnahme, was muss vor dem
// Estrich fertig sein, was gehoert in den Bauantrag. Man arbeitet sie an
// einem Nachmittag ab und legt sie dann weg.
//
// Die Vorlage wird beim Laden in echte Eintraege kopiert. Danach gehoert die
// Liste dem Nutzer: Er kann Punkte streichen, umbenennen und eigene
// dazuschreiben, ohne dass ihm eine Programmaenderung dazwischenfunkt.

export const VORLAGEN = [
  {
    titel: 'Unterlagen für den Bauantrag',
    text: 'Was das Bauamt sehen will. Fehlt eines davon, liegt der Antrag liegen.',
    punkte: [
      'Amtlicher Lageplan vom Vermessungsbüro',
      'Bauzeichnungen: Grundrisse, Schnitte, Ansichten',
      'Baubeschreibung',
      'Berechnung von Wohnfläche und umbautem Raum',
      'Statischer Nachweis',
      'Nachweis Wärmeschutz nach GEG',
      'Entwässerungsplan',
      'Nachweis der Stellplätze',
      'Standsicherheitsnachweis der Zufahrt für die Feuerwehr',
    ],
  },
  {
    titel: 'Bauvertrag prüfen',
    text: 'Der teuerste Nachmittag am ganzen Bau ist der, an dem man den Vertrag ' +
      'nicht gelesen hat. Vor der Unterschrift abarbeiten, nicht danach.',
    punkte: [
      'Baubeschreibung liegt vollständig bei und ist Vertragsbestandteil',
      'Verbindlicher Fertigstellungstermin steht drin, nicht nur eine Bauzeit in Wochen',
      'Zahlungsplan folgt dem Baufortschritt, nicht dem Kalender',
      'Keine Abschlagszahlung vor Leistung, insgesamt höchstens 90 Prozent vor Abnahme',
      'Fertigstellungssicherheit von 5 Prozent ist vereinbart',
      'Widerrufsbelehrung ist enthalten und in Ordnung',
      'Vertragsstrafe bei Verzug ist geregelt',
      'Was ist Eigenleistung, was schuldet die Firma: eindeutig aufgeteilt',
      'Bemusterung: Budgets stehen im Vertrag, nicht „marktüblich“',
      'Erdarbeiten und Bodengutachten: wer trägt das Baugrundrisiko',
      'Hausanschlüsse, Baustrom und Bauwasser: wer bezahlt was',
      'Nachträge nur schriftlich und nur mit vorheriger Preisangabe',
      'Abnahme ist förmlich geregelt, keine fiktive Abnahme durch Einzug',
      'Gewährleistung: fünf Jahre ab Abnahme, nicht ab Rechnungsstellung',
      'Vertrag von einem Bausachverständigen oder Fachanwalt gegenlesen lassen',
    ],
  },
  {
    titel: 'Vor Baubeginn',
    text: 'Alles, was stehen muss, bevor der erste Bagger kommt.',
    punkte: [
      'Baugenehmigung liegt schriftlich vor',
      'Bauleiter benannt und dem Amt gemeldet',
      'Baustelleneinrichtung geklärt: Zufahrt, Lagerfläche, WC',
      'Baustrom und Bauwasser beantragt',
      'Bauschild aufgestellt',
      'Bauherrenhaftpflicht abgeschlossen',
      'Bauleistungsversicherung abgeschlossen',
      'Baustelle gegen Zutritt gesichert',
      'Nachbarn über Baubeginn informiert',
      'Beweissicherung der Nachbargebäude mit Fotos',
    ],
  },
  {
    titel: 'Vor dem Estrich',
    text: 'Was unter dem Estrich verschwindet, ist danach nur noch mit Stemmen zu erreichen.',
    punkte: [
      'Alle Leitungen verlegt und dokumentiert',
      'Fotos von jeder Wand und jedem Boden, mit Zollstock im Bild',
      'Heizkreise beschriftet und im Plan eingetragen',
      'Druckprobe Heizung und Sanitär bestanden, Protokoll erhalten',
      'Dämmung vollflächig, keine offenen Fugen',
      'Randdämmstreifen umlaufend, auch an Türzargen',
      'Fenster dicht, Haus trocken',
      'Estrichart und Aufbauhöhe schriftlich bestätigt',
    ],
  },
  {
    titel: 'Zur Abnahme mitnehmen',
    text: 'Die Abnahme ist der wichtigste Termin am Bau. Ohne Vorbereitung verschenkt man ihn.',
    punkte: [
      'Bauvertrag und Baubeschreibung',
      'Alle Nachträge und Bemusterungsprotokolle',
      'Mängelliste aus der App, ausgedruckt',
      'Zollstock, Wasserwaage, Taschenlampe',
      'Zweite Person als Zeuge',
      'Kamera oder Telefon mit freiem Speicher',
      'Abnahmeprotokoll in zwei Ausfertigungen',
      'Kein Termin unter Zeitdruck: mindestens drei Stunden einplanen',
    ],
  },
  {
    titel: 'Vor dem Einzug',
    text: 'Der Papierkram, für den am Umzugstag niemand mehr Zeit hat.',
    punkte: [
      'Alle Zählerstände abgelesen und fotografiert',
      'Strom, Gas und Wasser auf den eigenen Namen angemeldet',
      'Internetanschluss bestellt, Termin steht',
      'Wohngebäudeversicherung läuft, Bauleistungsversicherung gekündigt',
      'Hausratversicherung auf die neue Anschrift umgestellt',
      'Ummeldung beim Einwohnermeldeamt terminiert',
      'Nachsendeauftrag der Post eingerichtet',
      'Grundsteuer und Abfallentsorgung angemeldet',
      'Rauchmelder eingebaut und geprüft',
      'Schlüssel gezählt und übernommen',
    ],
  },
];
