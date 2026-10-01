// Abgleich zwischen Geraet und Server.
//
// Ablauf einer Runde:
//   1. eigene Aenderungen einsammeln (alles, was seit dem letzten Mal
//      angefasst wurde, samt Grabsteinen)
//   2. hinschicken und im selben Zug holen, was dort neuer ist
//   3. zusammenfuehren: je Datensatz gewinnt der neuere Zeitpunkt
//   4. Bilddateien nachziehen, in beide Richtungen
//
// Das Geraet bleibt die Arbeitskopie. Ohne Netz laeuft die App weiter, der
// Abgleich holt es beim naechsten Mal nach. Auf einer Baustelle ist das der
// Normalfall und nicht die Ausnahme.

import { daten } from './daten.js';
import { istBeispielSatz } from './beispiel.js';
import {
  ruf, angemeldet, standLesen, standSetzen, lokalLesen, lokalSetzen,
  bildHoch, bildRunter,
} from './konto.js';

// Reihenfolge ist egal, der Server nimmt alles in einem Rutsch.
const SPEICHER = [
  'einstellungen', 'projekte', 'darlehen', 'leitfaden', 'posten', 'angebote', 'anbieter', 'belege',
  'geschosse', 'raeume', 'pins', 'maengel', 'aufgaben', 'todos', 'tagebuch',
  'dokumente', 'baudoku', 'kontakte', 'bilder',
];

// So viele Bilddateien je Runde. Mehr laesst eine wacklige Verbindung
// haengen, und der Rest kommt beim naechsten Abgleich.
const BILDER_JE_RUNDE = 12;

const jetzt = () => new Date().toISOString();
const schluesselVon = (speicher) => (speicher === 'einstellungen' ? 'name' : 'id');

/**
 * Was muss hoch? Alles mit einem Zeitpunkt nach der letzten Marke.
 * Grabsteine gehoeren dazu, sonst erfaehrt der Server nie von Geloeschtem.
 */
async function eigeneAenderungen(seit) {
  const hinaus = {};
  for (const speicher of SPEICHER) {
    const alle = await daten.alleMitGrabsteinen(speicher);
    // Das Beispielprojekt bleibt auf dem Geraet. Es ist erfunden und gehoert
    // nicht auf den Server und schon gar nicht auf das zweite Geraet.
    const offen = alle.filter((s) => (!seit || String(s.geaendert || '') > seit) &&
      !istBeispielSatz(speicher, s));
    if (!offen.length) continue;

    hinaus[speicher] = offen.map((s) => {
      if (speicher !== 'bilder') return s;
      // Der Blob bleibt hier. Ueber den Abgleich gehen nur die Angaben,
      // die Datei selbst nimmt den eigenen Weg.
      const { blob, ...ohneBlob } = s;
      return ohneBlob;
    });
  }
  return hinaus;
}

/**
 * Fremde Aenderungen einarbeiten. Geschrieben wird nur, was wirklich neuer
 * ist als der eigene Stand.
 *
 * @returns {Promise<number>} wie viele Saetze uebernommen wurden
 */
async function einarbeiten(hinein) {
  let uebernommen = 0;

  for (const [speicher, liste] of Object.entries(hinein || {})) {
    if (!SPEICHER.includes(speicher) || !Array.isArray(liste)) continue;

    for (const fremd of liste) {
      const schluessel = schluesselVon(speicher);
      const kennung = fremd[schluessel];
      if (!kennung) continue;

      const eigen = await daten.holen(speicher, kennung);
      const eigenAlle = eigen || (await daten.alleMitGrabsteinen(speicher)).find(
        (s) => s[schluessel] === kennung
      );

      // Gleichstand heisst: schon bekannt. Nur echtes Neuersein zaehlt.
      if (eigenAlle && String(eigenAlle.geaendert || '') >= String(fremd.geaendert || '')) {
        continue;
      }

      let satz = fremd;

      if (speicher === 'bilder') {
        // Entscheidend: Der Server kennt den Blob nicht. Wuerde man seinen
        // Datensatz einfach uebernehmen, waere das Foto auf diesem Geraet
        // geloescht. Also nur die Angaben uebernehmen und den vorhandenen
        // Blob behalten.
        satz = { ...(eigenAlle || {}), ...fremd };
        if (eigenAlle && eigenAlle.blob && !fremd.geloescht) {
          satz.blob = eigenAlle.blob;
        }
        if (fremd.geloescht) delete satz.blob;
      }

      await daten.sichern(speicher, satz, { zeitBehalten: true });
      uebernommen++;
    }
  }
  return uebernommen;
}

/**
 * Bilddateien in beide Richtungen nachziehen.
 *
 * Hoch muss, was einen Blob hat, aber auf dem Server noch keine Groesse.
 * Runter muss, was der Server kennt, hier aber nur als Angabe vorliegt.
 */
async function bilderNachziehen(melden) {
  // Die gezeichneten Bilder des Beispielprojekts bleiben auf dem Geraet,
  // wie alles andere aus dem Beispiel.
  const alle = (await daten.alle('bilder')).filter((b) => !istBeispielSatz('bilder', b));

  const hoch = alle.filter((b) => b.blob && !b.groesse).slice(0, BILDER_JE_RUNDE);
  const runter = alle.filter((b) => !b.blob && b.groesse > 0).slice(0, BILDER_JE_RUNDE);

  let geschafft = 0;

  for (const bild of hoch) {
    melden(`Foto ${geschafft + 1} von ${hoch.length + runter.length} …`);
    try {
      const ergebnis = await bildHoch(bild.id, bild.blob);
      // groesse merken: Daran erkennt der naechste Lauf, dass es oben ist.
      await daten.sichern('bilder', { ...bild, groesse: ergebnis.groesse }, { zeitBehalten: true });
      geschafft++;
    } catch (fehler) {
      console.error('Foto ging nicht hoch', bild.id, fehler);
    }
  }

  for (const bild of runter) {
    melden(`Foto ${geschafft + 1} von ${hoch.length + runter.length} …`);
    try {
      const blob = await bildRunter(bild.id);
      if (blob) {
        await daten.sichern('bilder', { ...bild, blob }, { zeitBehalten: true });
        geschafft++;
      }
    } catch (fehler) {
      console.error('Foto kam nicht an', bild.id, fehler);
    }
  }

  return { geschafft, offen: Math.max(0, hoch.length + runter.length - geschafft) };
}

let laeuft = false;

/**
 * Einmal vollstaendig abgleichen.
 *
 * @param {(text: string) => void} melden  fuer die Anzeige waehrend des Laufs
 * @returns {Promise<{hoch:number, runter:number, bilder:number}>}
 */
export async function abgleichen(melden = () => {}) {
  if (!angemeldet()) throw new Error('Dafür musst du angemeldet sein.');
  if (laeuft) throw new Error('Der Abgleich läuft schon.');
  laeuft = true;

  // Vor dem Einsammeln stehen bleiben: Was waehrend des Laufs geaendert
  // wird, hat einen spaeteren Zeitpunkt und geht beim naechsten Mal mit.
  // Andersherum ginge es verloren.
  const angefangen = jetzt();

  try {
    melden('Änderungen werden gesammelt …');
    const hinaus = await eigeneAenderungen(lokalLesen());
    const anzahlHoch = Object.values(hinaus).reduce((s, l) => s + l.length, 0);

    let stand = standLesen();
    let anzahlRunter = 0;
    let runden = 0;

    // Der Server liefert in Portionen. Solange er "weitere" meldet, nachfragen.
    for (;;) {
      melden(runden === 0 ? 'Mit dem Server abgleichen …' : `Weitere Daten holen (${runden + 1}) …`);

      const antwort = await ruf('/abgleich.php', {
        seit: stand,
        // Nur in der ersten Runde schicken, sonst dreimal dasselbe.
        saetze: runden === 0 ? hinaus : {},
      });

      anzahlRunter += await einarbeiten(antwort.saetze);
      if (antwort.stand) {
        stand = antwort.stand;
        standSetzen(stand);
      }
      runden++;
      if (!antwort.weitere || runden > 50) break;
    }

    // Erst jetzt die Marke setzen: Bricht oben etwas ab, wird beim naechsten
    // Mal alles noch einmal geschickt. Doppelt schicken ist harmlos, etwas
    // auslassen nicht.
    lokalSetzen(angefangen);

    const bilder = await bilderNachziehen(melden);

    melden('Fertig.');
    return { hoch: anzahlHoch, runter: anzahlRunter, bilder: bilder.geschafft, offen: bilder.offen };
  } finally {
    laeuft = false;
  }
}

/**
 * Beim Start im Hintergrund abgleichen, ohne den Nutzer zu behelligen.
 * Fehler landen in der Entwicklerkonsole und nicht auf dem Bildschirm: Wer
 * gerade kein Netz hat, will keine Meldung, sondern weiterarbeiten.
 */
export async function stillAbgleichen() {
  if (!angemeldet()) return null;
  try {
    const stand = await abgleichen();
    letzterLauf = Date.now();
    return stand;
  } catch (fehler) {
    console.warn('Abgleich im Hintergrund nicht möglich:', fehler.message);
    return null;
  }
}

/* ------------------------------------------------------- Von selbst abgleichen
 *
 * Der Abgleich war bis zum 01.10.2026 ein Knopf, den man druecken musste,
 * und einmal beim Start. Wer ihn vergass, hatte seine Baustelle nur auf
 * einem Geraet -- und bei der Statistik fehlte der Ort.
 *
 * Zwei Anlaesse, mehr nicht:
 *
 *   - Zurueck in der App (visibilitychange). Das ist der Alltag: Die App
 *     liegt im Hintergrund, man holt sie wieder vor. Nur wenn der letzte
 *     Lauf eine Weile her ist, sonst gleicht jedes Umschalten ab.
 *   - Nach dem Schreiben, mit Verzug. Wer zehn Posten eintippt, soll einen
 *     Abgleich ausloesen und nicht zehn; jede weitere Aenderung stellt die
 *     Uhr zurueck.
 *
 * Kein fester Takt: Auf der Baustelle ist das Netz schlecht und der Akku
 * knapp, und ein Abgleich alle fuenf Minuten kostet beides, ohne dass sich
 * etwas geaendert haette.
 */

// Wie lange nach der letzten Aenderung gewartet wird.
const VERZUG = 30000;
// Wie lange der letzte Lauf her sein muss, damit das Zurueckkommen zaehlt.
const RUHE = 5 * 60 * 1000;
// Laeuft gerade einer, wird so lange gewartet und dann noch einmal gesehen.
const SPAETER = 10000;

let letzterLauf = 0;
let uhr = null;

function anstossen() {
  if (!angemeldet()) return;
  clearTimeout(uhr);
  uhr = setTimeout(async () => {
    uhr = null;
    // Ein laufender Abgleich wuerde werfen ("laeuft schon"). Seine eigenen
    // Schreibvorgaenge melden sich nicht, aber ein Knopfdruck kann sich mit
    // dem Verzug kreuzen -- dann einfach noch einmal anklopfen.
    if (laeuft) { anstossen(); return; }
    await stillAbgleichen();
  }, laeuft ? SPAETER : VERZUG);
}

/**
 * Haengt den Abgleich an das Geschehen. Einmal beim Start aufrufen.
 */
export async function abgleichUeberwachen() {
  const { beimSchreiben } = await import('./daten.js');
  beimSchreiben(anstossen);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - letzterLauf < RUHE) return;
    stillAbgleichen();
  });
}
