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

/* Wechselt der Bildschirm, gehen offene Blaetter zu.
 *
 * Ein Blatt gehoert zu dem Bereich, aus dem es aufgegangen ist. Bleibt es
 * stehen, waehrend dahinter etwas anderes gezeichnet wird, sichert man
 * gleich in den falschen Bildschirm hinein.
 *
 * Das ist zugleich der Rueckhalt fuer die Zuruecktaste. zurueck.js faengt sie
 * ab und schliesst das oberste Blatt -- aber nur, wenn Capacitor das
 * Ereignis auch liefert. Tut es das nicht, macht die Bruecke ihr
 * Standardverhalten, also history.back(): Dann wechselt der Bereich, und das
 * Blatt blieb bisher im Vordergrund stehen. Genau so sah es auf dem Telefon
 * aus. Hier haengt es an der Navigation selbst und nicht an einer Taste,
 * deren Ereignis ankommen muss. */
/* Der Wachposten laeuft nur im Browser. test.mjs laedt dieselben Module in
   Node, um die Rechenkerne zu pruefen -- dort gibt es kein window, und ohne
   diese Abfrage bricht die ganze Suite beim Import ab. */
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    while (offene.length) offene[offene.length - 1](true);
  });
}

/* Die Zuruecktaste soll das Blatt schliessen und sonst nichts.
 *
 * Dafuer legt jedes Blatt beim Aufgehen einen Eintrag in den Verlauf. Die
 * Taste verbraucht ihn, popstate meldet sich, das Blatt geht zu -- und der
 * Bereich dahinter bleibt, wo er war. Ohne diesen Eintrag gaebe es nichts zu
 * verbrauchen, und die Bruecke ginge eine Ebene hoch: Blatt zu, aber man
 * steht auf der Uebersicht statt in der Mangelliste.
 *
 * Der Weg ueber den Verlauf und nicht ueber das Ereignis der Bruecke: Er
 * haengt an nichts, was erst ankommen muss. Auf dem Telefon kam es nicht an,
 * und die Ursache dafuer laesst sich vom Rechner aus nicht finden. */
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    const oben = offene[offene.length - 1];
    if (oben) oben(true);
  });
}

/**
 * @param {string} titel
 * @param {Node[]} felder      fertige Formularfelder
 * @param {Function} beimSichern  wird beim Klick auf Sichern gerufen; wirft
 *                                die Funktion, bleibt das Blatt offen
 * @param {object} optionen    { sicherText, loeschen }
 */
export function blattOeffnen(titel, felder, beimSichern, optionen = {}) {
  const { sicherText = 'Sichern', loeschen = null } = optionen;

  /* Der Eintrag, den die Zuruecktaste verbrauchen soll. Ohne Adresswechsel:
     pushState mit derselben URL erzeugt keinen hashchange und laesst den
     Router in Ruhe.

     Steht hier oben, weil schliessen() ihn liest. Eine Deklaration unterhalb
     ihrer Verwendung ist genau die Falle, die heute schon zweimal
     zugeschnappt ist -- zuletzt bei "Rechnung erfassen". */
  let eigenerEintrag = false;

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

  /* @param {boolean} vonZurueck  true, wenn der Verlauf uns hierher gebracht
   *   hat -- dann ist der eigene Eintrag schon verbraucht und darf nicht
   *   noch einmal abgeraeumt werden. */
  function schliessen(vonZurueck = false) {
    document.removeEventListener('keydown', beiTaste);
    ueberlagerung.remove();
    const stelle = offene.indexOf(schliessen);
    if (stelle !== -1) offene.splice(stelle, 1);

    // Beim Schliessen ueber Abbrechen, Sichern oder den dunklen Rand bleibt
    // der eigene Eintrag sonst im Verlauf liegen, und die Zuruecktaste
    // braeuchte danach zwei Tipps fuer einen Schritt.
    if (eigenerEintrag && !vonZurueck) {
      eigenerEintrag = false;
      history.back();
    }
    eigenerEintrag = false;
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

  try {
    history.pushState({ bauzeugeBlatt: true }, '');
    eigenerEintrag = true;
  } catch {
    // Manche eingebetteten Ansichten verbieten pushState. Dann bleibt es
    // beim Schliessen ueber die Knoepfe und den hashchange.
  }

  const erstes = blatt.querySelector('input, select, textarea');
  if (erstes) erstes.focus();

  return { schliessen };
}
