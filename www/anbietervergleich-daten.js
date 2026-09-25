// Die Positionen, bei denen Hausangebote still unterschiedlich kalkulieren.
//
// Quelle ist Kapitel 10 des Buches "Klartext Hausbau": vierzehn Positionen in
// vier Gruppen, dazu die Vergleichsmatrix am Kapitelende. Die Reihenfolge ist
// die des Buches, damit beides nebeneinander benutzbar bleibt.
//
// Je Position steht hier, wonach zu fragen ist ("frage") und mit welchem
// Betrag zu rechnen ist, wenn die Leistung fehlt ("spanne"). Die Spanne ist
// eine Hilfe beim Ausfuellen, kein Preis: Eingetragen wird, was der eigene
// Handwerker anbietet.

/** @typedef {{ id: string, titel: string, frage: string, spanne?: [number, number] }} Position */

/** @type {{ titel: string, text: string, positionen: Position[] }[]} */
export const GRUPPEN = [
  {
    titel: 'Unter und um das Haus',
    text: 'Positionen 1 bis 4. Hier steckt das meiste Geld, das in keinem Angebot steht.',
    positionen: [
      {
        id: 'erdarbeiten',
        titel: 'Erdarbeiten: Aushub, Schotterpolster, Entsorgung',
        frage: 'Bis wohin geht die Leistung? Teilleistungen wie „Schotterpolster 15 cm“ sind keine Erdarbeiten.',
        spanne: [15000, 25000],
      },
      {
        id: 'bodenplatte',
        titel: 'Bodenplatte: Stärke in Zentimetern',
        frage: '„Nach Statik“ ist keine Angabe. Die Stärke gehört mit Zahl in die Baubeschreibung.',
      },
      {
        id: 'wu',
        titel: 'Wasserundurchlässige Bodenplatte (Mehrpreis)',
        frage: 'Als optionale Position mit Gültigkeitsdatum vereinbaren, bevor das Bodengutachten sie verlangt.',
        spanne: [2500, 4000],
      },
      {
        id: 'sockel',
        titel: 'Sockel: Abdichtung, Dämmung, Putz, Kiesstreifen',
        frage: 'Beim Fertighaus liegt der Sockel auf der Naht zwischen zwei Firmen und fehlt in beiden Angeboten.',
        spanne: [3000, 8000],
      },
      {
        id: 'kanal',
        titel: 'Kanal: Schmutz- und Regenwasser mit Graben und Schacht',
        frage: 'Bis wohin geht die Leitung? Schmutz- und Regenwasser? Mit Revisionsschacht?',
        spanne: [5000, 6000],
      },
      {
        id: 'hausanschluesse',
        titel: 'Hausanschlüsse: Strom, Wasser, Telekommunikation',
        frage: 'Nie mit dem Kanal in eine Zeile. Wer stellt die Mehrspartenhauseinführung?',
        spanne: [8000, 9000],
      },
    ],
  },
  {
    titel: 'Was du täglich benutzt',
    text: 'Positionen 5 bis 7. Hier entscheidet sich, wie fertig das Haus am Einzugstag ist.',
    positionen: [
      {
        id: 'elektro',
        titel: 'Elektro: zusätzliche Steckdosen und Netzwerkdosen',
        frage: 'Wie viele Einheiten sind je Raum vorgesehen, und was kostet jede weitere?',
        spanne: [2000, 7000],
      },
      {
        id: 'starkstrom',
        titel: 'Starkstrom im Hauswirtschaftsraum, Außenwasserhahn',
        frage: '400 Volt mit 32 Ampere, Wasserhahn frostsicher und selbstentleerend. Fehlt fast immer.',
        spanne: [500, 1200],
      },
      {
        id: 'sanitaer',
        titel: 'Sanitär: Budget, Hersteller und Serie',
        frage: 'Welche Serien liegen wirklich im Budget? Einkaufs- oder Endkundenpreis?',
        spanne: [2000, 8000],
      },
      {
        id: 'fliesen',
        titel: 'Fliesen: Preis je m², Höhe, Restflächen, Schienen',
        frage: '1,20 m hoch gefliest heißt halbfertiges Bad. Wo darfst du aussuchen?',
        spanne: [1800, 3500],
      },
      {
        id: 'boden',
        titel: 'Bodenbeläge außer Bad',
        frage: 'Estrich ja, Belag nein ist der Normalfall. Welcher Belag in welchem Raum?',
        spanne: [10000, 18000],
      },
      {
        id: 'maler',
        titel: 'Malerarbeiten komplett',
        frage: '„Verputzt und grundiert“ ist nicht gestrichen. „Im üblichen Umfang“ ist keine Antwort.',
        spanne: [10000, 15000],
      },
    ],
  },
  {
    titel: 'Was das Haus fertig macht',
    text: 'Positionen 8 bis 10. Hier steht im Angebot oft eine Gattung statt eines Geräts.',
    positionen: [
      {
        id: 'heizung',
        titel: 'Heizung: Typ, Hersteller, Leistung',
        frage: 'Enthalten, nur vorbereitet oder gar nicht vorgesehen? Hersteller und Typ nennen lassen.',
      },
      {
        id: 'lueftung',
        titel: 'Kontrollierte Wohnraumlüftung',
        frage: 'Steht selten im Preis. Zentral mit Wärmerückgewinnung oder dezentral?',
        spanne: [10000, 14000],
      },
      {
        id: 'pv',
        titel: 'Photovoltaik und Speicher',
        frage: '„Vorbereitung für PV“ heißt oft: ein Leerrohr.',
        spanne: [12000, 25000],
      },
      {
        id: 'fenster',
        titel: 'Fenster: Verglasung, Bautiefe, RC-Klasse',
        frage: 'Ug höchstens 0,6, besser 0,5. Bautiefe in Millimetern nennen lassen.',
      },
      {
        id: 'rolllaeden',
        titel: 'Rollläden elektrisch, Panzer aus Aluminium, alle Fenster',
        frage: '„Rollläden“ heißt nicht automatisch alle Fenster und nicht automatisch elektrisch.',
        spanne: [2000, 4500],
      },
      {
        id: 'haustuer',
        titel: 'Haustür: Material, Füllung, RC-Klasse',
        frage: 'Keine Kunststofftür. Aufsatzfüllung statt Einsatzfüllung, RC2 nach DIN EN 1627.',
        spanne: [1500, 4000],
      },
      {
        id: 'treppe',
        titel: 'Treppe: Material, Belag, Geländer, Wangenstärke',
        frage: 'Eine Zeile im Angebot, zwischen 3.000 und 15.000 € Unterschied.',
        spanne: [3000, 15000],
      },
    ],
  },
  {
    titel: 'Rund um die Baustelle',
    text: 'Positionen 11 bis 14. Einzeln klein, zusammen fünfstellig.',
    positionen: [
      {
        id: 'baustelle',
        titel: 'Baustelleneinrichtung: Gerüst, Bauzaun, Reinigung',
        frage: 'Wer stellt es, und wer zahlt den Verbrauch? Das sind zwei Fragen.',
        spanne: [4000, 8000],
      },
      {
        id: 'baustrom',
        titel: 'Baustrom und Bauwasser samt Verbrauch',
        frage: 'Anschluss und Verbrauch werden getrennt kalkuliert. Heizen im Bau zahlst du fast immer selbst.',
        spanne: [500, 1200],
      },
      {
        id: 'geruest',
        titel: 'Gerüst: wie oft gestellt, wann kommt der Außenputz?',
        frage: 'Ein zweites Mal Gerüst kostet Geld, und irgendjemand zahlt es.',
      },
      {
        id: 'kran',
        titel: 'Kran und Kranstellplatz, mögliche Straßensperrung',
        frage: 'Beim Fertighaus: Wer stellt die Fläche von rund 8 × 12 Metern her, wer zahlt einen größeren Kran?',
      },
      {
        id: 'planung',
        titel: 'Planung, Statik, Genehmigung, Vermessung',
        frage: 'Wer wird mein Architekt, wer mein Statiker? Namen nennen lassen, nicht Funktionen.',
        spanne: [4000, 10000],
      },
      {
        id: 'entsorgung',
        titel: 'Entsorgung von Bauschutt, Verschnitt und Verpackungen',
        frage: 'Ein Satz in die Baubeschreibung: fachgerechte Entsorgung ist Sache des Unternehmers.',
        spanne: [1000, 3000],
      },
      {
        id: 'aussenanlagen',
        titel: 'Außenanlagen: Terrasse, Zufahrt, Zaun, Stellplatz',
        frage: 'Nahezu nie enthalten. Mindestens 20.000 €, bei Hanglage deutlich mehr.',
        spanne: [20000, 30000],
      },
      {
        id: 'winterbau',
        titel: 'Winterbaumaßnahmen',
        frage: 'Wer zahlt Heizen, Abdecken und Zusatzmittel, wenn im Winter gebaut wird?',
        spanne: [2000, 4000],
      },
    ],
  },
];

/** Alle Positionen der Reihe nach, ohne Gruppen. */
export const POSITIONEN = GRUPPEN.flatMap((g) => g.positionen);

/**
 * Der vergleichbare Endpreis eines Anbieters.
 *
 * Angebotspreis plus alles, was fehlt. Genau das ist die Zahl, mit der man
 * zur Bank geht -- nicht die von Seite eins.
 *
 * @param {{ angebotspreis?: number, posten?: Record<string, {art: string, betrag?: number}> }} anbieter
 */
export function endpreis(anbieter) {
  const posten = (anbieter && anbieter.posten) || {};
  let ergaenzungen = 0;
  let offen = 0;
  for (const p of POSITIONEN) {
    const eintrag = posten[p.id] || { art: 'offen' };
    if (eintrag.art === 'betrag') ergaenzungen += Number(eintrag.betrag) || 0;
    else if (eintrag.art !== 'drin' && eintrag.art !== 'ohne') offen++;
  }
  const angebot = Number(anbieter && anbieter.angebotspreis) || 0;
  return { angebot, ergaenzungen, summe: angebot + ergaenzungen, offen };
}

/**
 * Was an offenen Positionen noch zu erwarten ist, nach den Spannen oben.
 * Dient als Warnung, nicht als Prognose: Solange Positionen ungeklärt sind,
 * ist der Vergleich unfertig.
 */
export function offeneSpanne(anbieter) {
  const posten = (anbieter && anbieter.posten) || {};
  let von = 0;
  let bis = 0;
  for (const p of POSITIONEN) {
    const art = (posten[p.id] || {}).art || 'offen';
    if (art === 'offen' && p.spanne) {
      von += p.spanne[0];
      bis += p.spanne[1];
    }
  }
  return { von, bis };
}
