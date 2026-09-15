// Regeln fuer den Bauablauf: was vorher fotografiert werden muss, was in
// welcher Reihenfolge kommt und bei welchem Wetter ein Schritt heikel ist.
//
// Reine Daten und Rechnungen, kein Bildschirm. So laesst sich alles ohne
// Browser pruefen (test/baustellenregeln.mjs), und Bauablauf und
// Uebersicht fragen dieselben Regeln.
//
// Erkannt wird ein Arbeitsschritt an seinem Titel, nicht an einer Kennung:
// Die Vorlage liefert "Estrich einbringen", aber wer den Plan selbst anlegt,
// schreibt "Estrich EG" oder "Fließestrich". Die Muster sind deshalb breit,
// und jede Regel sagt, wofuer sie NICHT gilt (etwa "Estrich trocknen").

// Kleinschreibung und Umlaute vereinheitlicht, damit "Außenputz" und
// "Aussenputz" dasselbe treffen.
export const norm = (text) => String(text || '').toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');

const hat = (titel, ...muster) => muster.some((m) => m.test(norm(titel)));

// ------------------------------------------------------------ Fotoaufgaben
//
// Je Regel ein Schritt, der etwas unwiderruflich verdeckt, und die Stellen,
// die davor ins Bild gehoeren. Die Punkte sind bewusst kurz: Sie werden auf
// der Baustelle gelesen, mit dem Telefon in der anderen Hand.

export const FOTOREGELN = [
  {
    id: 'bodenplatte',
    verdeckt: 'Bodenplatte oder Keller',
    passt: (t) => hat(t, /bodenplatte/, /keller/, /fundament/) && !hat(t, /aushaert/),
    fotos: [
      'Grundleitungen und Hausanschluss, bevor sie verfüllt werden',
      'Fundamenterder mit seinen Anschlussfahnen',
      'Dämmung unter der Platte und Abdichtung am Keller',
      'Bewehrung und Abstandhalter vor dem Betonieren',
    ],
  },
  {
    id: 'decke',
    verdeckt: 'Decke betonieren',
    // "Dachdecker" enthaelt "decke" -- deshalb das Dach ausdruecklich ausnehmen.
    passt: (t) => hat(t, /decke/) && !hat(t, /dach/, /abgehaengt/, /streich/, /maler/),
    fotos: [
      'Leerrohre und Lüftungsrohre auf der Deckenplatte',
      'Lage von Durchbrüchen und Aussparungen',
      'Bewehrung über Öffnungen',
    ],
  },
  {
    id: 'dachdeckung',
    verdeckt: 'Dacheindeckung',
    passt: (t) => hat(t, /dachdeck/, /eindeck/, /dachdeckung/),
    fotos: [
      'Unterdeckbahn mit ihren Überlappungen',
      'Anschlüsse an Kamin, Dachfenster und Durchführungen',
    ],
  },
  {
    id: 'innenputz',
    verdeckt: 'Innenputz',
    passt: (t) => hat(t, /putz/) && !hat(t, /aussen/, /fassade/, /sockel/),
    fotos: [
      'Jede Wand mit Schlitzen und Leitungen, Zollstock im Bild',
      'Lage aller Dosen und der Verteilernische',
      'Wasser- und Heizungsleitungen in den Wänden',
      'Fensteranschlüsse innen, bevor sie überputzt werden',
    ],
  },
  {
    id: 'trockenbau',
    verdeckt: 'Trockenbau schließen',
    passt: (t) => hat(t, /trockenbau/, /beplank/, /dachgeschossausbau/, /rigips/, /gipskarton/),
    fotos: [
      'Dampfbremse mit allen Anschlüssen und Klebestellen',
      'Dämmung zwischen den Sparren oder Ständern',
      'Leitungen im Ständerwerk',
      'Verstärkungen für Hängeschränke und schwere Lasten',
    ],
  },
  {
    id: 'estrich',
    verdeckt: 'Estrich',
    passt: (t) => hat(t, /estrich/) && !hat(t, /trockn/, /heiz/, /schleif/, /messung/),
    fotos: [
      'Heizrohre mit Verteiler und Heizkreisen',
      'Leitungen auf der Rohdecke',
      'Randdämmstreifen umlaufend, auch an Türzargen',
      'Druckprobe von Heizung und Wasser, Protokoll mitfotografieren',
    ],
  },
  {
    id: 'fliesen',
    verdeckt: 'Fliesen',
    passt: (t) => hat(t, /fliese/),
    fotos: [
      'Abdichtung in Dusche und Bad, besonders Ecken und Durchführungen',
      'Leitungen in Vorwand und Installationswand',
    ],
  },
  {
    id: 'fassade',
    verdeckt: 'Fassade und Außenputz',
    passt: (t) => hat(t, /fassade/, /aussenputz/, /wdvs/, /waermedaemm/),
    fotos: [
      'Sockelabdichtung und Perimeterdämmung',
      'Dichtbänder und Anschlüsse an Fenstern und Türen',
      'Armierung, bevor der Oberputz kommt',
    ],
  },
  {
    id: 'aussenanlagen',
    verdeckt: 'Außenanlagen',
    passt: (t) => hat(t, /aussenanlage/, /pflaster/, /zufahrt/, /terrasse/),
    fotos: [
      'Leitungen, Drainage und Revisionsschächte vor dem Verfüllen',
      'Lage von Zisterne, Versickerung und Leerrohren im Garten',
    ],
  },
];

/** Die Fotoregel, die auf einen Arbeitsschritt passt, oder null. */
export function fotoregelFuer(aufgabe) {
  return FOTOREGELN.find((r) => r.passt(aufgabe.titel)) || null;
}

const TAG = 86400000;
const tageBis = (von, bis) =>
  Math.round((new Date(bis + 'T00:00:00Z') - new Date(von + 'T00:00:00Z')) / TAG);

/**
 * Welche Fotos jetzt faellig sind.
 *
 * Faellig ist eine Regel, sobald ihr Schritt in hoechstens `vorlauf` Tagen
 * beginnt oder schon laeuft, solange er nicht fertig ist und die Fotos nicht
 * abgehakt sind. Frueher waere zu frueh: Die Leitungen liegen noch nicht.
 *
 * @param aufgaben  Arbeitsschritte mit gerechnetem start (terminePlanen)
 * @returns [{ aufgabe, regel, inTagen }] nach Beginn sortiert
 */
export function faelligeFotos(aufgaben, heute, vorlauf = 7) {
  return aufgaben
    .filter((a) => a.status !== 'fertig' && !a.fotosErledigt)
    .map((a) => ({ aufgabe: a, regel: fotoregelFuer(a) }))
    .filter((x) => x.regel && (x.aufgabe.status === 'laeuft' ||
      (x.aufgabe.start && tageBis(heute, x.aufgabe.start) <= vorlauf)))
    .map((x) => ({ ...x, inTagen: x.aufgabe.start ? tageBis(heute, x.aufgabe.start) : 0 }))
    .sort((a, b) => a.inTagen - b.inTagen);
}

// --------------------------------------------------------- Reihenfolge
//
// Paare, bei denen der zweite Schritt erst beginnen soll, wenn der erste
// fertig ist. Gewarnt wird nur, wenn der Plan es anders rechnet -- nicht,
// wenn einer der beiden fehlt. Die Saetze sagen, was sonst passiert.

export const REIHENFOLGE = [
  {
    vorher: (t) => hat(t, /elektro/) && hat(t, /roh/),
    nachher: (t) => hat(t, /putz/) && !hat(t, /aussen/, /fassade/),
    text: 'Elektro-Rohinstallation vor dem Innenputz: Schlitze, Dosen und Verteilernische müssen vorher fertig sein, sonst wird der Putz wieder aufgestemmt.',
  },
  {
    vorher: (t) => hat(t, /sanitaer/) && hat(t, /roh/),
    nachher: (t) => hat(t, /putz/) && !hat(t, /aussen/, /fassade/),
    text: 'Sanitär-Rohinstallation vor dem Innenputz: Leitungen in den Wänden gehören vorher verlegt und geprüft.',
  },
  {
    vorher: (t) => hat(t, /fenster/),
    nachher: (t) => hat(t, /putz/) && !hat(t, /aussen/, /fassade/),
    text: 'Fenster vor dem Innenputz: Der Putz schließt an den Fensteranschluss an.',
  },
  {
    vorher: (t) => hat(t, /heizung/) && hat(t, /roh/),
    nachher: (t) => hat(t, /estrich/) && !hat(t, /trockn/),
    text: 'Heizung-Rohinstallation vor dem Estrich: Heizrohre und Druckprobe müssen fertig sein, bevor sie im Estrich verschwinden.',
  },
  {
    vorher: (t) => hat(t, /putz/) && !hat(t, /aussen/, /fassade/),
    nachher: (t) => hat(t, /estrich/) && !hat(t, /trockn/),
    text: 'Innenputz vor dem Estrich: Sonst liegt Putz auf dem frischen Estrich, und die Randfuge wird verschmutzt.',
  },
  {
    vorher: (t) => hat(t, /estrich/),
    nachher: (t) => hat(t, /bodenbela/, /parkett/, /laminat/, /vinyl/, /boden verleg/),
    text: 'Bodenbelag erst nach der Estrichtrocknung: Auf zu feuchtem Estrich wölbt sich der Belag. Die Belegreife vorher messen lassen.',
  },
  {
    vorher: (t) => hat(t, /estrich/),
    nachher: (t) => hat(t, /fliese/),
    text: 'Fliesen erst auf trockenem Estrich: Restfeuchte führt zu Rissen und losen Fliesen.',
  },
  {
    vorher: (t) => hat(t, /fliese/),
    nachher: (t) => hat(t, /maler/, /streich/),
    text: 'Fliesen vor den Malerarbeiten: Sonst wird nach dem Fliesen noch einmal gestrichen.',
  },
  {
    vorher: (t) => hat(t, /bodenbela/, /parkett/, /laminat/, /vinyl/),
    nachher: (t) => hat(t, /innentuer/, /tueren einbau/, /zargen/),
    text: 'Innentüren nach dem Bodenbelag: Erst dann steht die Fußbodenhöhe fest, sonst schleift die Tür oder der Spalt ist zu groß.',
  },
  {
    vorher: (t) => hat(t, /dachdeck/, /eindeck/),
    nachher: (t) => hat(t, /putz/, /trockenbau/, /estrich/) && !hat(t, /aussen/, /fassade/),
    text: 'Dach dicht vor dem Innenausbau: Regen im Rohbau verlängert die Trocknung und schadet Putz, Dämmung und Estrich.',
  },
];

/**
 * Paare, die der Plan in der falschen Reihenfolge rechnet.
 *
 * Falsch heisst: Der spaetere Schritt beginnt, bevor der fruehere endet.
 * Schritte ohne Termin zaehlen nicht, sie lassen sich nicht vergleichen.
 * Fertige Paare auch nicht: Was gebaut ist, laesst sich nicht mehr umordnen.
 */
export function reihenfolgeWarnungen(aufgaben) {
  const warnungen = [];
  for (const regel of REIHENFOLGE) {
    for (const vorher of aufgaben.filter((a) => regel.vorher(a.titel) && a.ende)) {
      for (const nachher of aufgaben.filter((a) => regel.nachher(a.titel) && a.start)) {
        if (vorher.id === nachher.id) continue;
        if (vorher.status === 'fertig' && nachher.status === 'fertig') continue;
        if (nachher.start <= vorher.ende) {
          warnungen.push({ text: regel.text, vorher, nachher });
        }
      }
    }
  }
  // Je Satz nur einmal: Zwei Estrich-Schritte sollen dieselbe Warnung nicht
  // doppelt ausloesen.
  const gesehen = new Set();
  return warnungen.filter((w) => !gesehen.has(w.text) && gesehen.add(w.text));
}

// ----------------------------------------------------------------- Wetter
//
// Richtwerte, keine Normwerte: Unter etwa +5 °C und ueber etwa +30 °C
// brauchen Beton, Estrich und Putz besondere Massnahmen, Regen und Sturm
// stoppen Dach- und Fassadenarbeiten. Die Warnung sagt deshalb "mit der Firma
// absprechen" und nicht "verboten".

export const WETTERREGELN = [
  {
    id: 'beton',
    passt: (t) => hat(t, /bodenplatte/, /keller/, /fundament/, /decke/, /betonier/) && !hat(t, /dach/, /abgehaengt/),
    art: 'Betonieren',
    kalt: 5, heiss: 30,
  },
  {
    id: 'estrich',
    passt: (t) => hat(t, /estrich/) && !hat(t, /trockn/),
    art: 'Estrich',
    kalt: 5, heiss: 30,
  },
  {
    id: 'putz',
    passt: (t) => hat(t, /putz/, /fassade/, /wdvs/),
    art: 'Putzen',
    kalt: 5, heiss: 30,
  },
  {
    id: 'dach',
    passt: (t) => hat(t, /dachstuhl/, /dachdeck/, /eindeck/),
    art: 'Dacharbeiten',
    regen: 5, sturm: 62,
  },
];

/**
 * Warnungen fuer Schritte, deren Tage in der Vorhersage liegen.
 *
 * @param aufgaben  mit gerechnetem start und ende
 * @param tage      { 'JJJJ-MM-TT': { min, max, niederschlag, wind } }
 */
export function wetterWarnungen(aufgaben, tage) {
  const warnungen = [];
  for (const a of aufgaben.filter((x) => x.status !== 'fertig' && x.start)) {
    const regel = WETTERREGELN.find((r) => r.passt(a.titel));
    if (!regel) continue;
    for (const [datum, w] of Object.entries(tage)) {
      if (datum < a.start || (a.ende && datum > a.ende)) continue;
      let grund = null;
      if (regel.kalt !== undefined && w.min !== null && w.min < regel.kalt) {
        grund = `bis ${Math.round(w.min)} °C`;
      } else if (regel.heiss !== undefined && w.max !== null && w.max > regel.heiss) {
        grund = `bis ${Math.round(w.max)} °C`;
      } else if (regel.regen !== undefined && w.niederschlag >= regel.regen) {
        grund = `${Math.round(w.niederschlag)} mm Regen`;
      } else if (regel.sturm !== undefined && w.wind >= regel.sturm) {
        grund = `Böen bis ${Math.round(w.wind)} km/h`;
      }
      if (grund) {
        warnungen.push({ aufgabe: a, datum, grund, art: regel.art });
        break; // je Schritt der erste kritische Tag reicht
      }
    }
  }
  return warnungen;
}
