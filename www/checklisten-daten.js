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
    text: 'Der Papierkram, den man am Umzugstag garantiert nicht mehr erledigt.',
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
