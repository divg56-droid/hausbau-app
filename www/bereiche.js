// Gliederung der App: welche Bereiche es gibt und wie sie gruppiert sind.
//
// Eigene Datei und kein Teil von app.js: Dort wird beim Laden das Dokument
// angefasst, und dann laesst sich die Liste im Test nicht mehr einlesen.
// Dieselbe Trennung wie bei den Kostengruppen in din276.js.

/*
 * Die Gliederung der App.
 *
 * Geschnitten nach dem Bauablauf und nicht nach der Technik: Was man am
 * selben Tag braucht, steht beieinander. Zuerst kommt, was man plant, dann
 * das Geld, dann die Baustelle; die Werkzeuge sind Rechnungen, die man
 * einmal aufmacht und wieder zuklappt, und stehen deshalb unten.
 *
 * Sieben Gruppen, und dabei bleibt es. Waechst die Liste weiter, gehoert
 * sie neu geschnitten und nicht verlaengert.
 *
 * "weg" ist zugleich der Dateiname unter module/. Der leere Weg ist die
 * Uebersicht und wird gesondert behandelt. "ausLeiste" heisst: erreichbar,
 * aber nicht in der Liste.
 */
export const BEREICHE = [
  {
    titel: 'Übersicht', zeichen: '\u{1F3E0}',
    punkte: [
      { weg: '', titel: 'Projektübersicht',
        text: 'Wie der Bau gerade steht: Budget, nächste Schritte, offene Punkte.' },
      // Nicht in der Leiste: Angelegt wird oben auf der Projektübersicht,
      // gewechselt wird über die Auswahl darüber. Ein eigener Punkt für
      // etwas, das die meisten einmal im Leben tun, stand nur im Weg. Der
      // Weg bleibt erreichbar -- die Übersicht verweist darauf.
      { weg: 'projekte', titel: 'Bauprojekte', ausLeiste: true,
        text: 'Mehrere Bauvorhaben getrennt führen und dazwischen wechseln.' },
    ],
  },
  {
    // Was zu tun ist, bevor jemand kommt: die Reihenfolge, die Listen für
    // den einzelnen Termin und der Plan, der beim Elektriker liegt.
    titel: 'Planen', zeichen: '\u{1F4D0}',
    punkte: [
      { weg: 'leitfaden', titel: 'Bauleitfaden',
        text: 'Was in welcher Reihenfolge zu tun ist, von der Finanzierung bis zur Abnahme.' },
      { weg: 'todos', titel: 'To-Dos',
        text: 'Was offen ist, nach Fälligkeit. Mit Frist und Notiz.' },
      { weg: 'todos/checklisten', titel: 'Checklisten',
        text: 'Listen für einen Termin: Bauantrag, Estrich, Abnahme, Einzug.' },
      { weg: 'anschlussplan', titel: 'Anschlussplan',
        text: 'Steckdosen, Schalter und Leitungen auf dem Grundriss markieren.' },
    ],
  },
  {
    // Kosten und Geldmittel gehoeren zusammen: Ein Budget ohne Positionen
    // ist eine Zahl, und Positionen ohne Budget sind eine Liste.
    titel: 'Kosten & Finanzierung', zeichen: '\u{1F4B6}',
    punkte: [
      { weg: 'baukasse', titel: 'Budgetplanung',
        text: 'Gesamtbudget, Budget je Quadratmeter, Geldmittel und Zahlungsverlauf.' },
      { weg: 'baukasse/kosten', titel: 'Kostenaufstellung',
        text: 'Alle Positionen als Tabelle, sortierbar, filterbar, als PDF und CSV.' },
      { weg: 'baunebenkosten', titel: 'Baunebenkosten',
        text: 'Notar, Vermessung, Statik, Anschlüsse: was in keinem Angebot steht.' },
      { weg: 'angebote', titel: 'Angebote',
        text: 'Mehrere Angebote je Gewerk nebeneinander legen und vergleichen.' },
      { weg: 'baukasse/rechnungen', titel: 'Rechnungen',
        text: 'Was tatsächlich abgeflossen ist, mit Beleg und Zuordnung.' },
      { weg: 'baukasse/statistik', titel: 'Statistiken',
        text: 'Kosten je Status, je Gewerk, je Kostengruppe und je Geldmittel.' },
      { weg: 'finanzierung', titel: 'Baufinanzierung',
        text: 'Eigenkapital, Zuschüsse und Darlehen erfassen oder rechnen lassen.' },
      { weg: 'tilgung', titel: 'Tilgungsverlauf',
        text: 'Restschuld, Rate und Laufzeit Jahr für Jahr, als PDF.' },
    ],
  },
  {
    // Alles, was auf der Baustelle passiert und danach nachweisbar sein
    // muss, samt der Reihenfolge, in der es passiert.
    titel: 'Baustelle & Orga', zeichen: '\u{1F3D7}',
    punkte: [
      { weg: 'ablauf', titel: 'Bauablauf',
        text: 'Reihenfolge der Gewerke planen, mit Terminen und Balkenplan.' },
      { weg: 'tagebuch', titel: 'Bauhelfertagebuch',
        text: 'Täglich festhalten, wer da war und wie lange.' },
      { weg: 'maengel', titel: 'Mängelliste',
        text: 'Jeden Schaden mit Foto, Raum, Gewerk und Status festhalten.' },
      { weg: 'raeume', titel: 'Räume',
        text: 'Jeder Raum mit Fotos, Mängeln und dem, was er gekostet hat.' },
      { weg: 'baudoku', titel: 'Baudokumentation',
        text: 'Fotos nach Bauabschnitt: was unter Putz und Estrich verschwindet.' },
      { weg: 'dokumente', titel: 'Dokumente',
        text: 'Genehmigung, Verträge, Pläne und Protokolle, mit Zuordnung.' },
    ],
  },
  {
    titel: 'Kontakte', zeichen: '\u{1F4C7}',
    punkte: [
      { weg: 'kontakte', titel: 'Firmen',
        text: 'Handwerker, Bauleiter und Planer, mit Anschrift für die Mängelrüge.' },
      { weg: 'kontakte/personen', titel: 'Privatpersonen',
        text: 'Bauhelfer, Nachbarn, Verwandte: alle, die keine Firma sind.' },
      { weg: 'kontakte/gewerke', titel: 'Gewerke',
        text: 'Die Liste, aus der Positionen, Mängel und Kontakte wählen.' },
    ],
  },
  {
    // Rechnungen, die man einmal aufmacht und wieder zuklappt. Sie
    // speichern nichts am Projekt ausser dem, was man ausdruecklich
    // uebernimmt -- deshalb stehen sie fuer sich und nicht bei den Kosten.
    titel: 'Werkzeuge', zeichen: '\u{1F9EE}',
    punkte: [
      { weg: 'baukosten', titel: 'Baukostenrechner',
        text: 'Was das Haus samt Grundstück und Nebenkosten wirklich kostet.' },
      { weg: 'rechner/kredite', titel: 'Kreditvergleich',
        text: 'Dieselbe Summe bei mehreren Anbietern nebeneinander.' },
      { weg: 'rechner/nebenkosten', titel: 'Kaufnebenkosten',
        text: 'Grunderwerbsteuer, Notar, Makler: was zum Kaufpreis dazukommt.' },
      { weg: 'rechner/flaechen', titel: 'GRZ und GFZ',
        text: 'Was auf das Grundstück überhaupt gebaut werden darf.' },
    ],
  },
  {
    titel: 'Einstellungen', zeichen: '\u{2699}',
    punkte: [
      { weg: 'konto', titel: 'Konto',
        text: 'Anmelden, damit App und Internetseite dieselben Daten zeigen.' },
      { weg: 'einstellungen', titel: 'Einstellungen',
        text: 'Projekt, Darstellung, Sicherung, CSV, alles löschen.' },
    ],
  },
];

/** Alle Bereiche flach, wie der Router sie braucht. */
export const MODULE = BEREICHE.flatMap((g) =>
  g.punkte.map((punkt) => ({ ...punkt, gruppe: g.titel, zeichen: g.zeichen }))
);
