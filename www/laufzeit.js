// Wie lange das Konto noch laeuft, und wie ein Buchcode aussieht.
//
// Reine Rechnung, kein DOM und kein Netz: Damit laesst sich der Text ohne
// Browser pruefen (test/laufzeit.mjs). Die Zahlen kommen vom Server, nicht
// von der Uhr des Geraets -- auf der Baustelle steht sie schon mal falsch,
// und eine falsche Uhr darf keine Laufzeit verlaengern.

/**
 * Bringt eine Eingabe auf die Form, in der der Code verglichen wird:
 * Grossbuchstaben, keine Bindestriche, keine Leerzeichen.
 *
 * Dasselbe macht konto.php auf dem Server. Hier steht es nur, damit die App
 * gar nicht erst mit "qakr tzk9" losschickt.
 */
export const codeNormalisieren = (text) =>
  String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const tageWort = (n) => (n === 1 ? '1 Tag' : n + ' Tage');

/**
 * Der Satz fuer die Kontoseite.
 *
 * @param {{tage_frei?: number, buchcode?: boolean, frei_bis?: string}} w  Antwort von "wer".
 * @param {string} bisText  Das Datum aus frei_bis, schon lesbar gemacht.
 */
export function laufzeitText(w, bisText) {
  if (!w || !w.frei_bis) return 'Die Laufzeit steht noch nicht fest.';

  const tage = Number(w.tage_frei || 0);

  if (tage <= 0) {
    return 'Die kostenlose Zeit ist am ' + bisText + ' abgelaufen. Sobald es eine '
      + 'Bezahlmöglichkeit gibt, kannst du hier verlängern.';
  }
  if (w.buchcode) {
    return 'Mit dem Code aus dem Buch freigeschaltet: noch ' + tageWort(tage)
      + ', bis ' + bisText + '.';
  }
  return 'Kostenlos bis ' + bisText + ': noch ' + tageWort(tage) + '.';
}
