// Helles und dunkles Design.
//
// Drei Zustaende, nicht zwei:
//
//   'auto'    folgt der Geraeteeinstellung. So startet die App, und dabei
//             bleibt sie, solange niemand den Schalter anfasst.
//   'hell'    feste Wahl, unabhaengig vom Geraet
//   'dunkel'  feste Wahl, unabhaengig vom Geraet
//
// Der Schalter im Kopf zeigt alle drei nebeneinander: Geraet, Sonne, Mond.
// Ein Kippschalter mit zwei Stellungen kann "automatisch" nicht darstellen --
// er zeigt, was gerade zu sehen ist, und verschweigt, warum. Drei Zeichen
// nebeneinander zeigen beides: was gewaehlt ist und was es sonst gibt.
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
/* Uhr, Akku und Netz in der Statusleiste.
 *
 * Seit Android 15 zeichnet die App bis unter die Systemleisten. Der Kopf
 * liegt also hinter diesen Zeichen, und ihre Farbe bestimmt nicht mehr das
 * System allein: Auf dunklem Kopf braucht es helle Zeichen, auf hellem
 * dunkle. Ohne das waere die Uhr im Dunkelmodus unlesbar -- dunkelgrau auf
 * anthrazit.
 *
 * "Style.Light" heisst bei Capacitor: heller Untergrund, also dunkle
 * Zeichen. Der Name beschreibt die Flaeche, nicht die Schrift; wer das
 * verwechselt, dreht es genau falsch herum.
 *
 * Laeuft nur im Paket und stoert im Browser nicht: Dort gibt es das Plugin
 * nicht, der Import scheitert, und die Farbe kommt ohnehin aus theme-color.
 */
function statusleisteFaerben() {
  const bruecke = window.Capacitor;
  if (!bruecke?.isNativePlatform?.()) return;
  const leiste = bruecke.Plugins?.StatusBar;
  if (!leiste) return;
  // Die Zeichenkette statt Style.Dark: Ohne Bundler gibt es den Aufzaehlungs-
  // typ nicht, und die Bruecke nimmt ohnehin nur den Text entgegen.
  leiste.setStyle({ style: themaWirksam() === 'dunkel' ? 'DARK' : 'LIGHT' })
    .catch(() => { /* Ohne Plugin bleibt es beim Standard des Systems. */ });
}

function anwenden() {
  const wahl = lies();
  const wurzel = document.documentElement;
  if (wahl === 'auto') wurzel.removeAttribute('data-thema');
  else wurzel.setAttribute('data-thema', wahl);

  // Die Farbe der Statusleiste mitziehen, sonst steht ueber der dunklen App
  // ein heller Balken.
  const marke = document.querySelector('meta[name="theme-color"]');
  if (marke) marke.setAttribute('content', themaWirksam() === 'dunkel' ? '#10171a' : '#f5f7f6');
  statusleisteFaerben();

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

/** Die drei Stellungen, in der Reihenfolge, in der sie im Schalter stehen. */
export const THEMEN = [
  { id: 'auto', zeichen: 'bildschirm', name: 'Wie das Gerät' },
  { id: 'hell', zeichen: 'sonnig', name: 'Immer hell' },
  { id: 'dunkel', zeichen: 'mond', name: 'Immer dunkel' },
];

function schalterZeichnen(schalter) {
  const wahl = lies();
  schalter.dataset.modus = themaWirksam();
  for (const knopf of schalter.querySelectorAll('[data-thema]')) {
    const aktiv = knopf.dataset.thema === wahl;
    knopf.classList.toggle('aktiv', aktiv);
    knopf.setAttribute('aria-pressed', String(aktiv));
  }
}

/**
 * Baut den Schalter in einen vorhandenen Knoten.
 *
 * Drei Knoepfe, kein Kippschalter: "automatisch" ist eine eigene Stellung
 * und keine Zwischenstufe. Wer eines der beiden festen Zeichen waehlt,
 * verlaesst damit die Geraeteeinstellung -- das ist gewollt.
 */
export async function schalterAnbinden(schalter) {
  if (!schalter) return;
  const { zeichen } = await import('./zeichen.js');

  schalter.replaceChildren(...THEMEN.map((th) => {
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'thema-taste';
    knopf.dataset.thema = th.id;
    knopf.title = th.name;
    knopf.setAttribute('aria-label', th.name);
    knopf.append(zeichen(th.zeichen, { groesse: 16 }));
    knopf.addEventListener('click', () => themaSetzen(th.id));
    return knopf;
  }));

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
