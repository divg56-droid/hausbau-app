// CSV-Ausgabe fuer Tabellenprogramme.
//
// Drei Entscheidungen, die alle denselben Grund haben: Die Datei soll sich in
// einem deutschen Excel per Doppelklick oeffnen und richtig aussehen.
//
//   Semikolon statt Komma  Deutsche Zahlen benutzen das Komma als
//                          Dezimaltrennzeichen. Mit Komma als Trenner
//                          zerfaellt 1.250,50 in zwei Spalten.
//   BOM am Anfang          Ohne die Bytefolge liest Excel die Datei als
//                          Westeuropaeisch und macht aus "Mängel" "MÃ¤ngel".
//   CRLF als Zeilenende    Aeltere Excel-Fassungen brechen sonst nicht um.
//
// Zahlen gehen mit Komma hinaus, ohne Tausenderpunkt und ohne Waehrungszeichen.
// So bleiben sie in Excel rechenbar; ein "1.250,50 €" waere dort Text.

const TRENNER = ';';
const ZEILENENDE = '\r\n';
const BOM = '﻿';

/**
 * Setzt ein einzelnes Feld. In Anfuehrungszeichen kommt nur, was es braucht,
 * sonst wird die Datei unnoetig unleserlich.
 */
export function zelle(wert) {
  if (wert === null || wert === undefined) return '';
  if (typeof wert === 'number') {
    return Number.isFinite(wert) ? String(wert).replace('.', ',') : '';
  }
  const text = String(wert);
  if (!/[";\r\n]/.test(text)) return text;
  return '"' + text.replace(/"/g, '""') + '"';
}

/**
 * @param {string[]} kopf   Spaltenueberschriften
 * @param {Array[]} zeilen  je Zeile ein Feld mit Werten in Spaltenreihenfolge
 * @returns {string}        vollstaendiger Dateiinhalt samt BOM
 */
export function csvText(kopf, zeilen) {
  const alle = [kopf, ...zeilen];
  return BOM + alle.map((z) => z.map(zelle).join(TRENNER)).join(ZEILENENDE) + ZEILENENDE;
}

export function csvBlob(kopf, zeilen) {
  // charset im Typ, damit auch Programme ohne BOM-Erkennung richtig liegen.
  return new Blob([csvText(kopf, zeilen)], { type: 'text/csv;charset=utf-8' });
}

/**
 * Erzeugt die Datei und reicht sie ans Teilen-Menue weiter. Nutzt denselben
 * Weg wie die PDFs, damit es im Paket und im Browser gleich funktioniert.
 */
export async function csvTeilen(kopf, zeilen, dateiname, titel) {
  const { pdfTeilen } = await import('./pdf.js');
  await pdfTeilen(csvBlob(kopf, zeilen), dateiname, titel || dateiname);
}
