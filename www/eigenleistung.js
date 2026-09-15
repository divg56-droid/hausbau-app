// Eigenleistung: geplant gegen geleistet.
//
// Wer selbst malt, Boden verlegt oder die Aussenanlagen macht, plant mit
// einer Stundenzahl und einer Ersparnis gegenueber dem Angebot einer Firma.
// Beides wird fast immer zu guenstig angesetzt. Hier steht, wie viele
// Stunden laut Bauhelfertagebuch wirklich angefallen sind und was die
// eingesparte Summe damit je Stunde wert war.
//
// Ohne Bildschirm, damit es ohne Browser pruefbar ist (test/eigenleistung.mjs).

// Stunden eines Tageseintrags. Dieselbe Lesart wie helferVon() in
// module/tagebuch.js, hier ohne dessen Bildschirm-Abhaengigkeiten.
const stundenVon = (eintrag) => (Array.isArray(eintrag.helfer) ? eintrag.helfer : [])
  .reduce((s, h) => s + (Number(h.stunden) || 0), 0);

/**
 * @param plan      { [gewerk]: { stunden, ersparnis } } aus der Einstellung
 * @param gewerke   die als Eigenleistung markierten Gewerke
 * @param eintraege Tageseintraege des Bauhelfertagebuchs, mit Feld "gewerk"
 * @returns [{ gewerk, soll, ist, ersparnis, jeStunde, anteil, drueber }]
 */
export function eigenleistungStand(plan, gewerke, eintraege) {
  return gewerke.map((gewerk) => {
    const p = (plan || {})[gewerk] || {};
    const soll = Number(p.stunden) || 0;
    const ersparnis = Number(p.ersparnis) || 0;
    const ist = eintraege
      .filter((e) => e.gewerk === gewerk)
      .reduce((s, e) => s + stundenVon(e), 0);
    return {
      gewerk,
      soll,
      ist,
      ersparnis,
      // Was die Ersparnis je tatsaechlich geleisteter Stunde wert war.
      jeStunde: ist > 0 && ersparnis > 0 ? ersparnis / ist : null,
      anteil: soll > 0 ? ist / soll : null,
      drueber: soll > 0 && ist > soll,
    };
  });
}
