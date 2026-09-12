// Eingabeblatt, das von unten hereinfaehrt. Jedes Modul, das Datensaetze
// anlegt oder bearbeitet, benutzt dieses eine.

import { el, knopf } from './hilfen.js';

/* Die offenen Blaetter, das oberste zuletzt.
 *
 * Gebraucht von der Android-Zurücktaste: Sie muss ein offenes Blatt
 * schliessen und nicht die App. Ohne diese Liste kaeme sie an das
 * schliessen() eines Blattes nicht heran -- das ist eine oertliche Funktion,
 * und das Blatt einfach aus dem Dokument zu nehmen liesse seinen
 * Tastaturzuhoerer haengen.
 *
 * Ein Stapel und keine einzelne Marke: Ein Blatt kann ein zweites oeffnen. */
const offene = [];

/** Schliesst das oberste Blatt. Gibt false, wenn keines offen war. */
export function blattSchliessen() {
  const oben = offene[offene.length - 1];
  if (!oben) return false;
  oben();
  return true;
}

export const blattOffen = () => offene.length > 0;

/**
 * @param {string} titel
 * @param {Node[]} felder      fertige Formularfelder
 * @param {Function} beimSichern  wird beim Klick auf Sichern gerufen; wirft
 *                                die Funktion, bleibt das Blatt offen
 * @param {object} optionen    { sicherText, loeschen }
 */
export function blattOeffnen(titel, felder, beimSichern, optionen = {}) {
  const { sicherText = 'Sichern', loeschen = null } = optionen;

  const blatt = el('div', { klasse: 'blatt' }, [
    el('h2', { text: titel }),
    ...felder,
    el('div', { klasse: 'knopf-reihe', stil: { marginTop: '6px' } }, [
      knopf('Abbrechen', () => schliessen()),
      knopf(sicherText, sichern, 'knopf-haupt'),
    ]),
    loeschen
      ? knopf('Löschen', async () => {
          if (!window.confirm('Wirklich löschen?')) return;
          await loeschen();
          schliessen();
        }, 'knopf-warn')
      : null,
  ]);

  const ueberlagerung = el('div', { klasse: 'ueberlagerung' }, [blatt]);

  // Klick auf den dunklen Rand schliesst, Klick im Blatt nicht.
  ueberlagerung.addEventListener('click', (ereignis) => {
    if (ereignis.target === ueberlagerung) schliessen();
  });

  function schliessen() {
    document.removeEventListener('keydown', beiTaste);
    ueberlagerung.remove();
    const stelle = offene.indexOf(schliessen);
    if (stelle !== -1) offene.splice(stelle, 1);
  }

  function beiTaste(ereignis) {
    if (ereignis.key === 'Escape') schliessen();
  }

  async function sichern() {
    try {
      await beimSichern();
      schliessen();
    } catch (fehler) {
      // Fehlertext ueber dem Blatt zeigen und offen lassen, damit die
      // Eingabe nicht verloren geht.
      const alt = blatt.querySelector('.kasten-warn');
      if (alt) alt.remove();
      blatt.insertBefore(
        el('p', { klasse: 'kasten kasten-warn', text: fehler.message || String(fehler) }),
        blatt.querySelector('h2').nextSibling
      );
    }
  }

  document.addEventListener('keydown', beiTaste);
  document.body.append(ueberlagerung);
  offene.push(schliessen);

  const erstes = blatt.querySelector('input, select, textarea');
  if (erstes) erstes.focus();

  return { schliessen };
}
