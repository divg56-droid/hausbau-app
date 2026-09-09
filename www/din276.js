// Kostengruppen nach DIN 276:2018-12.
//
// Wozu das gut ist: Jede Bank, jeder Architekt und jeder Gutachter gliedert
// Baukosten nach dieser Norm. Wer seine Positionen einmal zuordnet, kann
// seine Aufstellung ohne Umsortieren weiterreichen und mit
// Baukostenkennwerten vergleichen, die es nur je Kostengruppe gibt.
//
// Zur Verlaesslichkeit: Der Normtext ist kostenpflichtig und liegt hier nicht
// vor. Die erste Ebene und die Gliederung sind mehrfach belegt. Bei einzelnen
// Bezeichnungen der zweiten Ebene, vor allem 450, 470, 490 und der ganzen
// Gruppe 800, weichen die zugaenglichen Quellen im Wortlaut voneinander ab.
// Fuer die Zuordnung eigener Kosten reicht das; wer die Aufstellung
// foermlich einreicht, gleicht die Bezeichnungen einmal mit dem Normtext ab.
//
// Was sich gegenueber der Fassung 2008 geaendert hat, ist unten vermerkt: Wer
// eine aeltere Aufstellung danebenlegt, findet sonst die Gruppe nicht wieder.

export const KOSTENGRUPPEN = [
  {
    nr: '100', name: 'Grundstück',
    unter: [
      { nr: '110', name: 'Grundstückswert' },
      { nr: '120', name: 'Grundstücksnebenkosten' },
      // 2008 hiess diese Gruppe "Freimachen".
      { nr: '130', name: 'Rechte Dritter' },
    ],
  },
  {
    // 2008: "Herrichten und Erschließen".
    nr: '200', name: 'Vorbereitende Maßnahmen',
    unter: [
      { nr: '210', name: 'Herrichten' },
      { nr: '220', name: 'Öffentliche Erschließung' },
      { nr: '230', name: 'Nichtöffentliche Erschließung' },
      { nr: '240', name: 'Ausgleichsmaßnahmen und -abgaben' },
      { nr: '250', name: 'Übergangsmaßnahmen' },
    ],
  },
  {
    nr: '300', name: 'Bauwerk – Baukonstruktionen',
    unter: [
      { nr: '310', name: 'Baugrube, Erdbau' },
      { nr: '320', name: 'Gründung, Unterbau' },
      { nr: '330', name: 'Außenwände' },
      { nr: '340', name: 'Innenwände' },
      { nr: '350', name: 'Decken' },
      { nr: '360', name: 'Dächer' },
      // 2018 neu, betrifft vor allem den Ingenieurbau.
      { nr: '370', name: 'Infrastrukturanlagen' },
      { nr: '380', name: 'Baukonstruktive Einbauten' },
      { nr: '390', name: 'Sonstige Maßnahmen für Baukonstruktionen' },
    ],
  },
  {
    nr: '400', name: 'Bauwerk – Technische Anlagen',
    unter: [
      { nr: '410', name: 'Abwasser-, Wasser-, Gasanlagen' },
      { nr: '420', name: 'Wärmeversorgungsanlagen' },
      { nr: '430', name: 'Raumlufttechnische Anlagen' },
      // 2008: "Starkstromanlagen".
      { nr: '440', name: 'Elektrische Anlagen' },
      { nr: '450', name: 'Kommunikations- und sicherheitstechnische Anlagen' },
      { nr: '460', name: 'Förderanlagen' },
      { nr: '470', name: 'Nutzungsspezifische und verfahrenstechnische Anlagen' },
      // 2008: "Gebäudeautomation".
      { nr: '480', name: 'Gebäude- und Anlagenautomation' },
      { nr: '490', name: 'Sonstige Maßnahmen für technische Anlagen' },
    ],
  },
  {
    // 2008: "Außenanlagen", und mit vollstaendig anderer Untergliederung.
    nr: '500', name: 'Außenanlagen und Freiflächen',
    unter: [
      { nr: '510', name: 'Erdbau' },
      { nr: '520', name: 'Gründung, Unterbau' },
      { nr: '530', name: 'Oberbau, Deckschichten' },
      { nr: '540', name: 'Baukonstruktionen' },
      { nr: '550', name: 'Technische Anlagen' },
      { nr: '560', name: 'Einbauten in Außenanlagen' },
      { nr: '570', name: 'Vegetationsflächen' },
      { nr: '580', name: 'Wasserflächen' },
      { nr: '590', name: 'Sonstige Maßnahmen für Außenanlagen' },
    ],
  },
  {
    nr: '600', name: 'Ausstattung und Kunstwerke',
    unter: [
      { nr: '610', name: 'Allgemeine Ausstattung' },
      { nr: '620', name: 'Besondere Ausstattung' },
      { nr: '630', name: 'Informationstechnische Ausstattung' },
      { nr: '640', name: 'Künstlerische Ausstattung' },
      { nr: '690', name: 'Sonstige Ausstattung' },
    ],
  },
  {
    nr: '700', name: 'Baunebenkosten',
    unter: [
      { nr: '710', name: 'Bauherrenaufgaben' },
      { nr: '720', name: 'Vorbereitung der Objektplanung' },
      // 2008: "Architekten- und Ingenieurleistungen".
      { nr: '730', name: 'Objektplanung' },
      { nr: '740', name: 'Fachplanung' },
      { nr: '750', name: 'Künstlerische Leistungen' },
      { nr: '760', name: 'Allgemeine Baunebenkosten' },
      // 770 und 780 gibt es nicht, die Gruppe springt auf 790.
      { nr: '790', name: 'Sonstige Baunebenkosten' },
    ],
  },
  {
    // Mit der Fassung 2018 neu in der Reihe. Genau hier landen Zinsen und
    // Bereitstellungskosten, die private Bauherren regelmaessig vergessen.
    nr: '800', name: 'Finanzierung',
    unter: [
      { nr: '810', name: 'Finanzierungsnebenkosten' },
      { nr: '820', name: 'Fremdkapitalzinsen' },
      { nr: '830', name: 'Eigenkapitalzinsen' },
      { nr: '840', name: 'Bürgschaften' },
      { nr: '890', name: 'Sonstige Finanzierungskosten' },
    ],
  },
];

/** Flache Karte Nummer -> Bezeichnung, erste und zweite Ebene zusammen. */
const NAMEN = new Map();
for (const haupt of KOSTENGRUPPEN) {
  NAMEN.set(haupt.nr, haupt.name);
  for (const unter of haupt.unter) NAMEN.set(unter.nr, unter.name);
}

export const kostengruppeName = (nr) => NAMEN.get(String(nr || '')) || '';

/** "330 Außenwände", die Form, in der man Kostengruppen liest und sucht. */
export function kostengruppeLang(nr) {
  const name = kostengruppeName(nr);
  return name ? `${nr} ${name}` : '';
}

/** Die Hauptgruppe einer beliebigen Kostengruppe: 330 gehoert zu 300. */
export const hauptgruppe = (nr) => (String(nr || '')[0] || '') + '00';

/** Auswahlliste fuers Formular, zweite Ebene unter ihrer Hauptgruppe. */
export function kostengruppenOptionen() {
  const liste = [['', '– keine Kostengruppe –']];
  for (const haupt of KOSTENGRUPPEN) {
    liste.push([haupt.nr, `${haupt.nr} ${haupt.name}`]);
    for (const unter of haupt.unter) {
      liste.push([unter.nr, `   ${unter.nr} ${unter.name}`]);
    }
  }
  return liste;
}

/**
 * Vorschlag anhand des Gewerks und der Bezeichnung einer Position.
 *
 * Nur ein Vorschlag: Die Zuordnung bleibt beim Nutzer, weil dieselbe
 * Bezeichnung je nach Bauvorhaben in verschiedenen Gruppen landen kann. Ein
 * Vorschlag ist trotzdem sinnvoll, denn ohne ihn ordnet niemand
 * sechsundzwanzig Positionen von Hand zu.
 */
const SCHLAGWORTE = [
  [/grundst(ü|ue)ck/i, '110'],
  [/grunderwerb|notar|grundbuch|makler/i, '120'],
  [/vermessung|absteck/i, '710'],
  [/erschlie(ß|ss)ung|hausanschl(ü|ue)ss|baustrom|bauwasser/i, '220'],
  [/abriss|rodung|herricht/i, '210'],
  [/erdarbeit|baugrube|aushub/i, '310'],
  [/bodenplatte|keller|gr(ü|ue)ndung|fundament/i, '320'],
  [/rohbau|mauerwerk|au(ß|ss)enwand|fassade|putz au(ß|ss)en/i, '330'],
  [/innenwand|trockenbau|innenputz/i, '340'],
  [/decke|estrich|treppe/i, '350'],
  [/dach|dachstuhl|dachdeck|klempner/i, '360'],
  [/fenster|au(ß|ss)ent(ü|ue)r|innent(ü|ue)r|rollladen/i, '330'],
  [/sanit(ä|ae)r|abwasser|wasserinstallation|gas/i, '410'],
  [/heizung|w(ä|ae)rmepumpe|fu(ß|ss)bodenheizung|kamin|ofen/i, '420'],
  [/l(ü|ue)ftung|klima/i, '430'],
  [/elektro|starkstrom|photovoltaik|blitzschutz/i, '440'],
  [/netzwerk|telefon|alarm|rauchmelder|klingel|gegensprech/i, '450'],
  [/aufzug|lift/i, '460'],
  [/smart\s?home|geb(ä|ae)udeautomation|kn(x)?\b/i, '480'],
  [/au(ß|ss)enanlage|zufahrt|pflaster|terrasse|einfahrt/i, '530'],
  [/zaun|carport|garage|gartenhaus|mauer/i, '540'],
  [/garten|bepflanzung|rasen|hecke/i, '570'],
  [/k(ü|ue)che|einbauschrank|m(ö|oe)bel|ausstattung/i, '610'],
  [/architekt|planung|statik|bauleitung|objekt(ü|ue)berwachung/i, '730'],
  [/energieberat|schallschutz|w(ä|ae)rmeschutz|gutachter|sachverst(ä|ae)ndig/i, '740'],
  [/baugenehmigung|geb(ü|ue)hr|beh(ö|oe)rde|pr(ü|ue)fstatik/i, '760'],
  [/versicherung/i, '760'],
  [/zins|bereitstellung|finanzierung|damnum|disagio/i, '820'],
  [/fliesen|maler|bodenbelag|tapete|anstrich/i, '340'],
  [/puffer|unvorhergesehen|reserve/i, '790'],
];

export function kostengruppeVorschlag(name = '', gewerk = '') {
  const text = `${name} ${gewerk}`;
  for (const [muster, nr] of SCHLAGWORTE) {
    if (muster.test(text)) return nr;
  }
  return '';
}

/**
 * Fasst Betraege je Hauptgruppe zusammen.
 *
 * @param {Array<{kostengruppe?: string}>} saetze
 * @param {(satz: any) => number} betragVon
 * @returns {Array<{nr, name, summe, saetze}>} nur Gruppen mit Inhalt,
 *          plus einen Eintrag ohne Nummer fuer alles Unzugeordnete.
 */
export function nachHauptgruppen(saetze, betragVon) {
  const koerbe = new Map();
  for (const satz of saetze) {
    const nr = satz.kostengruppe ? hauptgruppe(satz.kostengruppe) : '';
    if (!koerbe.has(nr)) koerbe.set(nr, { nr, name: NAMEN.get(nr) || 'Ohne Kostengruppe', summe: 0, saetze: [] });
    const korb = koerbe.get(nr);
    korb.summe += betragVon(satz) || 0;
    korb.saetze.push(satz);
  }
  // Unzugeordnetes ans Ende, sonst nach Nummer.
  return [...koerbe.values()].sort((a, b) => (a.nr || '999').localeCompare(b.nr || '999'));
}
