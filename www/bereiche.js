// Gliederung der App: welche Bereiche es gibt und wie sie gruppiert sind.
//
// Eigene Datei und kein Teil von app.js: Dort wird beim Laden das Dokument
// angefasst, und dann laesst sich die Liste im Test nicht mehr einlesen.
// Dieselbe Trennung wie bei den Kostengruppen in din276.js.

/*
 * Die Gliederung der App.
 *
 * Bisher lagen alle Bereiche als gleichrangige Kacheln nebeneinander. Bei
 * dreizehn Eintraegen findet man so nichts mehr, und es ist auch nicht
 * ersichtlich, was zusammengehoert. Deshalb Gruppen: Geld, Nachweise,
 * Planung, Adressen, Rechnen.
 *
 * "weg" ist zugleich der Dateiname unter module/. Der leere Weg ist die
 * Uebersicht und wird gesondert behandelt.
 */
export const BEREICHE = [
  {
    titel: 'Mein Bauprojekt', zeichen: '\u{1F3E0}',
    punkte: [
      { weg: '', titel: 'Projektübersicht',
        text: 'Budget, Termine, offene Mängel und was als Nächstes ansteht.' },
    ],
  },
  {
    titel: 'Baukosten', zeichen: '\u{1F4B6}',
    punkte: [
      { weg: 'baukasse', titel: 'Baukasse',
        text: 'Budget, Kostenaufstellung, DIN 276 und Rechnungen.' },
      { weg: 'angebote', titel: 'Angebote',
        text: 'Mehrere Angebote je Gewerk nebeneinander legen und vergleichen.' },
    ],
  },
  {
    titel: 'Dokumentation', zeichen: '\u{1F4D3}',
    punkte: [
      { weg: 'tagebuch', titel: 'Bauhelfertagebuch',
        text: 'Täglich festhalten, wer da war und wie lange.' },
      { weg: 'maengel', titel: 'Mängelliste',
        text: 'Jeden Schaden mit Foto, Raum, Gewerk und Status festhalten.' },
      { weg: 'raeume', titel: 'Räume',
        text: 'Jeder Raum mit Fotos, Mängeln und dem, was er gekostet hat.' },
    ],
  },
  {
    titel: 'Organisation', zeichen: '\u{1F5C2}',
    punkte: [
      { weg: 'ablauf', titel: 'Bauablauf',
        text: 'Reihenfolge der Gewerke planen, mit Terminen und Balkenplan.' },
      { weg: 'anschlussplan', titel: 'Anschlussplan',
        text: 'Steckdosen, Schalter und Leitungen auf dem Grundriss markieren.' },
    ],
  },
  {
    titel: 'Kontakte', zeichen: '\u{1F4C7}',
    punkte: [
      { weg: 'kontakte', titel: 'Kontakte',
        text: 'Firmen, Bauleiter und Helfer an einer Stelle.' },
    ],
  },
  {
    titel: 'Rechner', zeichen: '\u{1F9EE}',
    punkte: [
      { weg: 'baukosten', titel: 'Baukostenrechner',
        text: 'Was das Haus samt Grundstück und Nebenkosten wirklich kostet.' },
      { weg: 'finanzierung', titel: 'Baufinanzierung',
        text: 'Eigenkapital, Zuschüsse und Darlehen erfassen oder rechnen lassen.' },
      { weg: 'tilgung', titel: 'Tilgungsverlauf',
        text: 'Restschuld, Rate und Laufzeit Jahr für Jahr, als PDF.' },
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

