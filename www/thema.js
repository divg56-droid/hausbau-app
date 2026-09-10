// Helles und dunkles Design.
//
// Drei Zustaende, nicht zwei:
//
//   'auto'    folgt der Geraeteeinstellung. So startet die App, und dabei
//             bleibt sie, solange niemand den Schalter anfasst.
//   'hell'    feste Wahl, unabhaengig vom Geraet
//   'dunkel'  feste Wahl, unabhaengig vom Geraet
//
// Der Schalter im Kopf hat nur zwei Stellungen, weil er zeigt, was gerade zu
// sehen ist. Ein Schalter mit drei Stellungen waere im Kopf einer App nicht
// zu bedienen. Wer zurueck auf "automatisch" will, findet die Wahl in den
// Einstellungen; dort stehen alle drei nebeneinander.
//
// Die Wahl liegt in localStorage und nicht in der Datenbank. Sie gehoert dem
// Geraet: Wer am Telefon dunkel liest und am Rechner hell, will das so, und
// der Abgleich hat damit nichts zu tun.

const SCHLUESSEL = 'hausbau.thema';

/** Die Geraeteeinstellung, falls der Browser sie kennt. */
const geraetDunkel = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

function lies() {
  try {
    const wert = localStorage.getItem(SCHLUESSEL);
    return wert === 'hell' || wert === 'dunkel' ? wert : 'auto';
  } catch {
    return 'auto';
  }
}

function schreib(wert) {
  try {
    if (wert === 'auto') localStorage.removeItem(SCHLUESSEL);
    else localStorage.setItem(SCHLUESSEL, wert);
  } catch {
    /* Ohne Ablage gilt die Wahl eben nur bis zum Neuladen. */
  }
}

/** Die gewaehlte Einstellung: 'auto', 'hell' oder 'dunkel'. */
export const themaLesen = lies;

/** Was tatsaechlich zu sehen ist: 'hell' oder 'dunkel'. */
export function themaWirksam() {
  const wahl = lies();
  if (wahl !== 'auto') return wahl;
  return geraetDunkel() ? 'dunkel' : 'hell';
}

/**
 * Traegt die Wahl ins Dokument ein.
 *
 * Bei 'auto' wird das Merkmal entfernt, statt 'hell' oder 'dunkel'
 * hineinzuschreiben. Nur dann greift die Medienabfrage im Stylesheet, und nur
 * dann wandert die App mit, wenn das Telefon abends von selbst umschaltet.
 */
function anwenden() {
  const wahl = lies();
  const wurzel = document.documentElement;
  if (wahl === 'auto') wurzel.removeAttribute('data-thema');
  else wurzel.setAttribute('data-thema', wahl);

  // Die Farbe der Statusleiste mitziehen, sonst steht ueber der dunklen App
  // ein heller Balken.
  const marke = document.querySelector('meta[name="theme-color"]');
  if (marke) marke.setAttribute('content', themaWirksam() === 'dunkel' ? '#10171a' : '#f5f7f6');

  for (const schalter of document.querySelectorAll('.thema-schalter')) {
    schalterZeichnen(schalter);
  }
  document.dispatchEvent(new CustomEvent('thema-gewechselt', {
    detail: { wahl, wirksam: themaWirksam() },
  }));
}

/** Setzt die Wahl und wendet sie sofort an. */
export function themaSetzen(wahl) {
  schreib(wahl === 'hell' || wahl === 'dunkel' ? wahl : 'auto');
  anwenden();
}

function schalterZeichnen(schalter) {
  const wirksam = themaWirksam();
  schalter.dataset.modus = wirksam;
  const nach = wirksam === 'dunkel' ? 'Helles' : 'Dunkles';
  schalter.title = nach + ' Design einschalten';
  schalter.setAttribute('aria-label', schalter.title);
  schalter.setAttribute('aria-pressed', String(wirksam === 'dunkel'));
  const kugel = schalter.querySelector('.kugel');
  if (kugel) kugel.textContent = wirksam === 'dunkel' ? '\u{1F319}' : '☀️';
}

/**
 * Haengt das Verhalten an einen vorhandenen Schalter im Kopf.
 *
 * Ein Druck waehlt fest das Gegenteil dessen, was gerade zu sehen ist. Damit
 * verlaesst man "automatisch" - das ist gewollt: Wer den Schalter drueckt,
 * will genau diese Einstellung und nicht, dass sie sich abends wieder aendert.
 */
export function schalterAnbinden(schalter) {
  if (!schalter) return;
  schalter.addEventListener('click', () => {
    themaSetzen(themaWirksam() === 'dunkel' ? 'hell' : 'dunkel');
  });
  schalterZeichnen(schalter);
}

/**
 * Einmal beim Start aufrufen.
 *
 * Horcht ausserdem auf die Geraeteeinstellung. Ohne das bliebe die App hell
 * stehen, wenn das Telefon um sieben Uhr abends auf dunkel umschaltet,
 * solange man sie nicht neu laedt.
 */
export function themaStarten() {
  anwenden();
  if (typeof matchMedia !== 'function') return;
  const abfrage = matchMedia('(prefers-color-scheme: dark)');
  const beiWechsel = () => { if (lies() === 'auto') anwenden(); };
  if (typeof abfrage.addEventListener === 'function') abfrage.addEventListener('change', beiWechsel);
  else if (typeof abfrage.addListener === 'function') abfrage.addListener(beiWechsel);
}
