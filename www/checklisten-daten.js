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
    ],
  },
  {
    titel: 'Bauvertrag prüfen',
    text: 'Der teuerste Nachmittag am ganzen Bau ist der, an dem man den Vertrag ' +
      'nicht gelesen hat. Vor der Unterschrift abarbeiten, nicht danach.',
    // Hier steht zu jedem Punkt, warum er zählt und was zu tun ist. Ein Satz
    // wie „Abnahme ist förmlich geregelt“ ist fachlich richtig und sagt einem
    // Bauherrn trotzdem nicht, was er als Nächstes machen soll.
    punkte: [
      { titel: 'Baubeschreibung liegt vollständig bei und ist Vertragsbestandteil',
        warum: 'Ohne sie schuldet die Firma nur, was im Prospekt stand.',
        tun: 'Baubeschreibung anfordern und im Vertrag als Anlage benennen lassen.' },
      { titel: 'Verbindlicher Fertigstellungstermin steht drin, nicht nur eine Bauzeit in Wochen',
        warum: 'Eine Bauzeit ohne Startdatum läuft nie ab.',
        tun: 'Auf ein Datum bestehen und den Beginn daran koppeln.' },
      { titel: 'Zahlungsplan folgt dem Baufortschritt, nicht dem Kalender',
        warum: 'Sonst zahlst du für Leistungen, die noch nicht erbracht sind.',
        tun: 'Jede Rate einem fertigen Bauabschnitt zuordnen.' },
      { titel: 'Keine Abschlagszahlung vor Leistung, höchstens 90 Prozent vor Abnahme',
        warum: 'Die letzten 10 Prozent sind dein einziges Druckmittel bei Mängeln.',
        tun: 'Schlussrate von mindestens 10 Prozent auf die Abnahme legen.' },
      { titel: 'Fertigstellungssicherheit von 5 Prozent ist vereinbart',
        warum: 'Sie steht dir bei Verbraucherbauverträgen zu und rettet dich bei Insolvenz.',
        tun: 'Bürgschaft oder Einbehalt von 5 Prozent in den Vertrag schreiben.' },
      { titel: 'Widerrufsbelehrung ist enthalten und in Ordnung',
        warum: 'Fehlt sie, verlängert sich deine Widerrufsfrist erheblich.',
        tun: 'Belehrung suchen, Datum notieren, 14 Tage im Kalender markieren.' },
      { titel: 'Vertragsstrafe bei Verzug ist geregelt',
        warum: 'Ohne Strafe kostet eine Verzögerung nur dich, nicht die Firma.',
        tun: 'Tagessatz und Obergrenze vereinbaren, üblich sind 0,2 Prozent je Werktag.' },
      { titel: 'Was ist Eigenleistung, was schuldet die Firma: eindeutig aufgeteilt',
        warum: 'Jede Lücke dazwischen zahlst am Ende du.',
        tun: 'Eigenleistungen einzeln auflisten, mit Termin und Schnittstelle.' },
      { titel: 'Bemusterung: Budgets stehen im Vertrag, nicht „marktüblich“',
        warum: '„Marktüblich“ wird beim Bemustern zu einer vierstelligen Nachzahlung.',
        tun: 'Je Gewerk einen Euro-Betrag eintragen lassen.' },
      { titel: 'Erdarbeiten und Bodengutachten: wer trägt das Baugrundrisiko',
        warum: 'Schlechter Baugrund ist der häufigste teure Nachtrag.',
        tun: 'Bodengutachten vorher beauftragen und zum Vertragsbestandteil machen.' },
      { titel: 'Hausanschlüsse, Baustrom und Bauwasser: wer bezahlt was',
        warum: 'Beim Schlüsselfertigen sind sie fast nie enthalten.',
        tun: 'Jede Position einzeln zuordnen und in die Kostenaufstellung übernehmen.' },
      { titel: 'Nachträge nur schriftlich und nur mit vorheriger Preisangabe',
        warum: 'Mündliche Zusagen auf der Baustelle stehen später auf der Rechnung.',
        tun: 'Klausel aufnehmen: kein Nachtrag ohne unterschriebenes Angebot.' },
      { titel: 'Abnahme ist förmlich geregelt, keine fiktive Abnahme durch Einzug',
        warum: 'Schützt dich vor einer stillschweigenden Abnahme mit allen Mängeln.',
        tun: 'Förmliche Abnahme mit Protokoll vereinbaren, Einzug ausdrücklich ausnehmen.' },
      { titel: 'Gewährleistung: fünf Jahre ab Abnahme, nicht ab Rechnungsstellung',
        warum: 'Der falsche Stichtag kostet dich Monate deiner Gewährleistung.',
        tun: 'Formulierung „ab Abnahme“ prüfen und das Abnahmedatum festhalten.' },
      { titel: 'Vertrag von einem Bausachverständigen oder Fachanwalt gegenlesen lassen',
        warum: 'Ein paar hundert Euro gegen eine sechsstellige Verpflichtung.',
        tun: 'Termin vor der Unterschrift buchen, Vertrag vorab schicken.' },
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
