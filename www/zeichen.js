// Zeichen fuer Räume, Gewerke und Dokumente.
//
// Ein leeres graues Kaestchen sagt nichts. Ein Zeichen sagt in einem
// Augenblick, worum es geht -- und auf der Baustelle, mit einer Hand am
// Telefon, ist genau das der Unterschied.
//
// Bewusst Strichzeichnungen, keine Bildchen: Sie erben die Schriftfarbe,
// funktionieren im hellen wie im dunklen Design, bleiben bei jeder Groesse
// scharf und wiegen zusammen weniger als ein einziges Foto.
//
// Jedes Zeichen ist ein Feld von Pfaden in einem Raster von 24 mal 24. Wer
// eines ergaenzt, haelt sich an dieselbe Strichstaerke, sonst faellt es aus
// der Reihe.

const RASTER = 24;

// -------------------------------------------------------------- Die Zeichen

const ZEICHEN = {
  // Räume
  bett: ['M3 18v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5', 'M3 18h18', 'M7 11V8h5v3'],
  bad: ['M4 11h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z', 'M7 11V6a2 2 0 0 1 4 0', 'M6 20l-1 1', 'M18 20l1 1'],
  kueche: ['M4 9h16v11H4z', 'M4 13h16', 'M8 4v3', 'M12 4v3', 'M16 4v3'],
  sofa: ['M4 12a2 2 0 0 1 4 0v3h8v-3a2 2 0 0 1 4 0v6H4z', 'M6 18v2', 'M18 18v2', 'M8 12V8h8v4'],
  tisch: ['M12 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M4 4v5a2 2 0 0 0 2 2', 'M20 4v5a2 2 0 0 1-2 2', 'M6 11v9', 'M18 11v9'],
  schreibtisch: ['M3 15h18', 'M5 15v5', 'M19 15v5', 'M7 5h10v7H7z', 'M12 12v3'],
  tuer: ['M6 3h12v18H6z', 'M14 12h1.5'],
  treppe: ['M3 20h4v-4h4v-4h4V8h4V4', 'M3 20v-4'],
  keller: ['M3 9h18', 'M5 9v11h14V9', 'M12 12v5', 'M9.5 14.5 12 17l2.5-2.5'],
  dach: ['M3 13 12 4l9 9', 'M5 20h14', 'M7 20v-7', 'M17 20v-7', 'M12 14.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3'],
  garage: ['M3 10 12 4l9 6', 'M5 10v10h14V10', 'M8 13h8', 'M8 16h8', 'M8 19h8'],
  waschen: ['M5 3h14v18H5z', 'M5 8h14', 'M8 5.5h2', 'M12 10.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'],
  technik: ['M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z', 'M12 2v3', 'M12 19v3', 'M2 12h3', 'M19 12h3', 'M5 5l2 2', 'M17 17l2 2', 'M19 5l-2 2', 'M7 17l-2 2'],
  garten: ['M12 21v-6', 'M12 15a5 5 0 0 1-5-5 5 5 0 0 1 10 0 5 5 0 0 1-5 5z', 'M7 21h10'],
  lager: ['M4 6h16v12H4z', 'M4 10h16', 'M4 14h16', 'M10 6v12'],
  haus: ['M3 11 12 4l9 7', 'M5 11v9h14v-9', 'M10 20v-6h4v6'],

  // Gewerke
  mauer: ['M3 6h18v12H3z', 'M3 12h18', 'M9 6v6', 'M15 6v6', 'M6 12v6', 'M12 12v6', 'M18 12v6'],
  fenster: ['M4 4h16v16H4z', 'M12 4v16', 'M4 12h16'],
  blitz: ['M13 2 5 14h6l-2 8 8-12h-6z'],
  tropfen: ['M12 3s6 6.5 6 10a6 6 0 0 1-12 0c0-3.5 6-10 6-10z'],
  flamme: ['M12 3c4 4 6 6.5 6 9.5a6 6 0 0 1-12 0C6 10 8 8 12 3z', 'M12 20a2.5 2.5 0 0 1-2.5-2.5c0-1.5 2.5-3.5 2.5-3.5s2.5 2 2.5 3.5A2.5 2.5 0 0 1 12 20z'],
  kelle: ['M4 4h9l-4.5 9z', 'M9 14l9 6', 'M17 18l3 3'],
  fliese: ['M4 4h16v16H4z', 'M4 10h16', 'M4 16h16', 'M10 4v16', 'M16 4v16'],
  pinsel: ['M7 3h10v6H7z', 'M9 9v3h6V9', 'M11 12v9h2v-9'],
  dielen: ['M3 6h18v12H3z', 'M3 10h18', 'M3 14h18', 'M8 6v4', 'M14 10v4', 'M9 14v4'],
  werkzeug: ['M14 4a4 4 0 0 0 5 5l-9 9-5-5z', 'M5 18l-1 2 2-1'],

  // Wetter. Dieselbe Einteilung wie im Bautagebuch, damit dasselbe Wetter
  // nicht an zwei Stellen verschieden aussieht.
  sonnig: ['M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z', 'M12 1v3', 'M12 20v3',
    'M1 12h3', 'M20 12h3', 'M4.2 4.2 6.3 6.3', 'M17.7 17.7l2.1 2.1',
    'M19.8 4.2 17.7 6.3', 'M6.3 17.7 4.2 19.8'],
  bewoelkt: ['M7 18h9.5a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.6A3.5 3.5 0 0 0 7 18z'],
  regen: ['M7 15h9.5a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.6A3.5 3.5 0 0 0 7 15z',
    'M8 18l-1 3', 'M12 18l-1 3', 'M16 18l-1 3'],
  schnee: ['M7 15h9.5a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.6A3.5 3.5 0 0 0 7 15z',
    'M8 19h.01', 'M12 21h.01', 'M16 19h.01', 'M10 21h.01', 'M14 19h.01'],
  sturm: ['M4 9h11a3 3 0 1 0-3-3', 'M4 13h13a3 3 0 1 1-3 3', 'M4 17h6'],
  frost: ['M12 3v18', 'M4.5 7.5l15 9', 'M19.5 7.5l-15 9', 'M12 7l-2.5-2.5',
    'M12 7l2.5-2.5', 'M12 17l-2.5 2.5', 'M12 17l2.5 2.5'],

  // Kontakte
  firma: ['M3 21h18', 'M5 21V6l7-3 7 3v15', 'M9 9h2', 'M13 9h2', 'M9 13h2', 'M13 13h2', 'M10 21v-4h4v4'],
  person: ['M12 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z', 'M5 21v-1a7 7 0 0 1 14 0v1'],

  // Dokumente
  blatt: ['M6 3h8l4 4v14H6z', 'M14 3v4h4'],
  stempel: ['M8 3h8v5l2 4H6l2-4z', 'M4 16h16v5H4z', 'M4 16h16'],
  feder: ['M20 4C11 5 7 10 5 19', 'M5 19c6 1 11-3 12-9', 'M4 20h6'],
  plan: ['M3 5h18v14H3z', 'M7 5v14', 'M3 12h4', 'M11 9h6', 'M11 13h4'],
  siegel: ['M12 3l2.5 1.8 3-.3 1 2.9 2.4 1.8-1.3 2.8 1.3 2.8-2.4 1.8-1 2.9-3-.3L12 21l-2.5-1.8-3 .3-1-2.9L3.1 15l1.3-2.8L3.1 9.4l2.4-1.8 1-2.9 3 .3z', 'M9 12l2 2 4-4'],
  klemmbrett: ['M8 4h8v3H8z', 'M6 5h2', 'M16 5h2v16H6V5', 'M9 11h6', 'M9 15h6'],
  euro: ['M6 3h8l4 4v14H6z', 'M14 3v4h4', 'M14 11a3 3 0 1 0 0 5', 'M9 12h4', 'M9 14h4'],
  buch: ['M4 4h7v16H4z', 'M13 4h7v16h-7z', 'M11 4v16', 'M13 4v16'],

  // Design: Geraet, Sonne, Mond. Die Sonne steht schon oben beim Wetter.
  bildschirm: ['M3 5h18v11H3z', 'M9 20h6', 'M12 16v4'],
  mond: ['M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z'],
};

// ------------------------------------------------------------- Die Zuordnung
//
// Gesucht wird nach Wortteilen, nicht nach ganzen Namen: "Kinderzimmer 2",
// "Bad oben" und "Gäste-WC" sollen alle etwas finden. Die Reihenfolge
// entscheidet, deshalb steht das Genauere oben -- "Hauswirtschaftsraum" vor
// "Haus", "Gästezimmer" vor "Gäste-WC".

const RAEUME = [
  [['hauswirtschaft', 'waschk', 'hwr'], 'waschen'],
  [['technik', 'heizungsraum', 'hausanschluss'], 'technik'],
  [['gästezimmer', 'gaestezimmer', 'gästeschlaf'], 'bett'],
  [['bad', 'wc', 'dusche', 'sanitär', 'sanitaer'], 'bad'],
  [['küche', 'kueche', 'kochen', 'speis', 'vorrat'], 'kueche'],
  [['wohn'], 'sofa'],
  [['ess'], 'tisch'],
  [['arbeit', 'büro', 'buero', 'homeoffice'], 'schreibtisch'],
  [['schlaf', 'kinder', 'jugend', 'eltern'], 'bett'],
  [['flur', 'diele', 'windfang', 'eingang'], 'tuer'],
  [['treppe', 'stiege'], 'treppe'],
  [['keller', 'untergeschoss'], 'keller'],
  [['dach', 'spitzboden'], 'dach'],
  [['garage', 'carport', 'stellplatz'], 'garage'],
  [['garten', 'außen', 'aussen', 'terrasse', 'balkon', 'hof'], 'garten'],
  [['abstell', 'lager', 'kammer', 'schrank'], 'lager'],
];

const GEWERKE = [
  [['rohbau', 'mauer', 'beton', 'erdarbeit', 'gründ', 'gruend'], 'mauer'],
  [['dach', 'klempner', 'spengler'], 'dach'],
  [['fenster', 'tür', 'tuer'], 'fenster'],
  [['elektro', 'blitz', 'strom', 'photovoltaik', 'pv'], 'blitz'],
  [['sanitär', 'sanitaer', 'wasser', 'abwasser'], 'tropfen'],
  [['heizung', 'wärme', 'waerme', 'kamin', 'ofen'], 'flamme'],
  [['estrich', 'putz', 'trockenbau', 'stuck'], 'kelle'],
  [['fliese', 'platten', 'naturstein'], 'fliese'],
  [['maler', 'anstrich', 'tapete', 'lack'], 'pinsel'],
  [['boden', 'parkett', 'laminat', 'teppich'], 'dielen'],
  [['treppe'], 'treppe'],
  [['außen', 'aussen', 'garten', 'zaun', 'pflaster'], 'garten'],
];

const DOKUMENTE = [
  [['genehmig', 'bauantrag', 'behörde', 'behoerde'], 'stempel'],
  [['vertrag', 'auftrag'], 'feder'],
  [['plan', 'zeichnung', 'grundriss', 'statik'], 'plan'],
  [['nachweis', 'gutachten', 'zertifikat', 'energieausweis'], 'siegel'],
  [['protokoll', 'abnahme', 'messung'], 'klemmbrett'],
  [['rechnung', 'quittung', 'beleg'], 'euro'],
  [['anleitung', 'wartung', 'handbuch', 'bedienung'], 'buch'],
];

/** Sucht in einer Zuordnungsliste nach dem ersten passenden Wortteil. */
function suche(liste, name, rueckfall) {
  const text = String(name || '').toLowerCase();
  for (const [worte, zeichen] of liste) {
    if (worte.some((w) => text.includes(w))) return zeichen;
  }
  return rueckfall;
}

export const raumZeichen = (name) => suche(RAEUME, name, 'haus');
export const gewerkZeichen = (name) => suche(GEWERKE, name, 'werkzeug');
export const dokumentZeichen = (art) => suche(DOKUMENTE, art, 'blatt');

/**
 * Das Zeichen eines Kontakts.
 *
 * Steht ein Gewerk dabei, sagt dessen Zeichen mehr als ein Haus oder ein
 * Kopf: In einer Liste von zwanzig Firmen sucht man den Elektriker.
 */
/**
 * Das Zeichen zu einer Wetterlage.
 *
 * Die Lagen sind dieselben wie im Bautagebuch. Eine eigene Einteilung waere
 * eine zweite Wahrheit darueber, was gerade draussen los ist.
 */
export const wetterZeichen = (lage) =>
  ({ sonnig: 'sonnig', bewoelkt: 'bewoelkt', regen: 'regen',
    schnee: 'schnee', sturm: 'sturm', frost: 'frost' }[lage] || 'bewoelkt');

export const kontaktZeichen = (kontakt) => {
  if (kontakt && kontakt.gewerk) return gewerkZeichen(kontakt.gewerk);
  return kontakt && kontakt.art === 'helfer' ? 'person' : 'firma';
};

/**
 * Baut das Zeichen als SVG.
 *
 * Die Farbe kommt aus der Schrift ringsum ("currentColor"), damit dasselbe
 * Zeichen im hellen und im dunklen Design richtig steht und in einer
 * markierten Zeile mitwechselt.
 *
 * @param {string} name    Kennung aus ZEICHEN
 * @param {object} optionen  { klasse, groesse }
 */
export function zeichen(name, { klasse = 'zeichen', groesse = 24 } = {}) {
  const pfade = ZEICHEN[name] || ZEICHEN.haus;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${RASTER} ${RASTER}`);
  svg.setAttribute('width', String(groesse));
  svg.setAttribute('height', String(groesse));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', klasse);
  svg.innerHTML = pfade.map((d) => `<path d="${d}"></path>`).join('');
  return svg;
}

/** Nur fuer die Pruefung: welche Zeichen es gibt und worauf verwiesen wird. */
export const ZEICHENNAMEN = Object.keys(ZEICHEN);
export const ZUORDNUNGEN = { RAEUME, GEWERKE, DOKUMENTE };
