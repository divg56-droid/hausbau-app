// Die Baukosten, in vier Sichten. Jede steht einzeln in der Seitenleiste und
// kommt als Unterweg hier an: "#/baukasse/statistik" laedt diese Datei.
//
//   Budgetplanung       Wie viel habe ich, woher kommt es, was bleibt?
//   Kostenaufstellung   Was war geplant, was wurde es wirklich?
//   Statistiken         Wo steckt das Geld: Status, Gewerk, Kostengruppe?
//   Rechnungen          Was ist tatsaechlich abgeflossen?
//
// Die Kostenaufstellung ist der Kern. Bauprojekte werden selten teurer, weil
// eine Rechnung falsch war, sondern weil zwischen Planung und Auftrag eine
// Luecke klafft, die niemand zusammenrechnet.

import {
  el, eur, feld, eingabe, zahlfeld, auswahl, knopf, karte, kopfzeile,
  wertzeile, hinweisKasten, leerzustand, zuZahl, melde, datumLang, heute,
} from '../hilfen.js';
import { daten, einstellung, bildUrl, bildLoeschen } from '../daten.js';
import { blattOeffnen } from '../blatt.js';
import { finanzierungsstand } from './finanzierung.js';
import { fotofeld } from '../fotos.js';
import { gewerkeListe } from '../gewerke.js';
import { bauweise } from '../bauweise.js';
import {
  kostengruppenOptionen, kostengruppeLang, kostengruppeVorschlag, nachHauptgruppen,
} from '../din276.js';
import { csvTeilen } from '../csv.js';

// Was der Nutzer selbst setzt. Ob etwas teilweise oder ganz bezahlt ist,
// rechnet die App aus den Rechnungen aus - das kann so nicht veralten.
export const POSTEN_STATUS = {
  geplant: { name: 'Geplant', marke: 'marke-geplant' },
  beauftragt: { name: 'Beauftragt', marke: 'marke-beauftragt' },
};

/**
 * Rechnet einen Posten durch.
 *
 * "tatsaechlich" ist die Auftrags- oder Schlusssumme, nicht das schon
 * Gezahlte. Beides auseinanderzuhalten ist der ganze Witz: Eine Position kann
 * teurer geworden und trotzdem noch gar nicht bezahlt sein.
 */
export function postenRechnen(posten, belege) {
  const gezahlt = belege
    .filter((b) => b.postenId === posten.id)
    .reduce((s, b) => s + (b.betrag || 0), 0);

  const geplant = posten.geplant || 0;
  const tatsaechlich = posten.tatsaechlich || 0;
  // Solange keine echte Summe feststeht, ist die Abweichung null und nicht
  // etwa der volle Planwert im Minus.
  const differenz = tatsaechlich > 0 ? tatsaechlich - geplant : 0;
  const massgeblich = tatsaechlich > 0 ? tatsaechlich : geplant;

  const gesetzt = POSTEN_STATUS[posten.status] || POSTEN_STATUS.geplant;
  let status = posten.status || 'geplant';
  let name = gesetzt.name;
  let marke = gesetzt.marke;

  if (gezahlt > 0 && massgeblich > 0 && gezahlt + 0.005 >= massgeblich) {
    status = 'bezahlt'; name = 'Bezahlt'; marke = 'marke-fertig';
  } else if (gezahlt > 0) {
    status = 'teilgezahlt'; name = 'Teilgezahlt'; marke = 'marke-arbeit';
  }

  return {
    geplant, tatsaechlich, differenz, gezahlt, massgeblich,
    offen: Math.max(0, massgeblich - gezahlt),
    status, statusName: name, marke,
  };
}

/** Zahl mit Vorzeichen und Farbe: ueber dem Plan rot, darunter gruen. */
function abweichung(betrag) {
  if (!betrag) return el('span', { klasse: 'leise', text: '–' });
  return el('span', {
    klasse: betrag > 0 ? 'mehr' : 'weniger',
    text: (betrag > 0 ? '+' : '') + eur.format(betrag),
  });
}

export async function zeige(rahmen, unterweg) {
  await zeichne(rahmen, unterweg || 'budget');
}

async function zeichne(rahmen, ansicht) {
  rahmen.replaceChildren();

  const [posten, belege, stand, kontakte, raeume, hausdaten, gewerke, art] =
    await Promise.all([
    daten.alle('posten'),
    daten.alle('belege'),
    finanzierungsstand(),
    daten.alle('kontakte'),
    daten.alle('raeume'),
    einstellung('baukosten_eingabe'),
    gewerkeListe(),
    bauweise(),
  ]);

  const neu = () => zeichne(rahmen, ansicht);
  const gerechnet = posten.map((p) => ({ ...p, ...postenRechnen(p, belege) }));

  const summe = {
    geplant: gerechnet.reduce((s, p) => s + p.geplant, 0),
    tatsaechlich: gerechnet.reduce((s, p) => s + p.massgeblich, 0),
    gezahlt: belege.reduce((s, b) => s + (b.betrag || 0), 0),
    differenz: gerechnet.reduce((s, p) => s + p.differenz, 0),
  };

  if (ansicht === 'kosten') {
    return zeigeKostenaufstellung(rahmen, gerechnet, kontakte, raeume, gewerke, art, neu);
  }
  if (ansicht === 'statistik') {
    return zeigeStatistik(rahmen, gerechnet, summe, stand, belege, art, neu);
  }
  if (ansicht === 'rechnungen') {
    return zeigeRechnungen(rahmen, belege, posten, stand, kontakte, neu);
  }
  return zeigeBudgetplanung(rahmen, stand, summe, belege, hausdaten || {}, neu);
}

// --------------------------------------------------------------- Bausteine

/** Ein Betrag als Zeile mit Anteilsbalken. Die Statistiken bestehen daraus. */
function balkenzeile(name, betrag, gesamt, unter) {
  const anteil = gesamt > 0 ? (betrag / gesamt) * 100 : 0;
  return el('div', { klasse: 'balkenzeile' }, [
    el('div', { klasse: 'wertzeile' }, [
      el('span', { text: name }),
      el('strong', { text: eur.format(betrag) }),
    ]),
    el('div', { klasse: 'fortschrittsbalken' }, [
      el('div', { stil: { width: Math.min(100, anteil) + '%' } }),
    ]),
    el('p', {
      klasse: 'unterzeile',
      text: (unter ? unter + ', ' : '') + Math.round(anteil) + ' Prozent',
    }),
  ]);
}

/** Zahlungen je Monat, aufsteigend, mit laufender Summe. */
function zahlungsverlauf(belege) {
  const monate = new Map();
  for (const b of belege) {
    const monat = String(b.datum || '').slice(0, 7);
    if (monat.length !== 7) continue;
    monate.set(monat, (monate.get(monat) || 0) + (b.betrag || 0));
  }
  let laufend = 0;
  return [...monate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([monat, betrag]) => ({ monat, betrag, kumuliert: (laufend += betrag) }));
}

const monatLang = (monat) =>
  new Date(monat + '-01T12:00:00Z').toLocaleDateString('de-DE', {
    month: 'long', year: 'numeric',
  });

// ------------------------------------------------------------ Budgetplanung

function zeigeBudgetplanung(rahmen, stand, summe, belege, hausdaten, neu) {
  const budget = stand.gesamt;
  const rest = budget - summe.tatsaechlich;
  const flaeche = Number(hausdaten.flaeche) || 0;

  rahmen.append(kopfzeile('Budgetplanung', 'Woher das Geld kommt und wie weit es reicht.'));

  // Kein frueher Ausstieg, auch wenn noch nichts erfasst ist: Der Bildschirm
  // steht dann mit Nullen da und zeigt, was spaeter darin steht. Eine
  // Sackgasse mit einem einzigen Knopf sagt darueber nichts.
  if (!stand.posten.length) {
    rahmen.append(
      hinweisKasten(
        'Noch kein Budget. Lege in der Baufinanzierung Eigenkapital, Zuschüsse und ' +
          'Darlehen an, dann füllen sich die Zahlen hier von allein.',
        'info'
      ),
      knopf('Zur Baufinanzierung', () => { location.hash = '#/finanzierung'; }, 'knopf-haupt')
    );
  }

  // ------------------------------------------------------------ Gesamtbudget
  // Die eine Zahl, um die es geht, gross und allein. Darunter das, was sie
  // vergleichbar macht: die Flaeche und der Preis je Quadratmeter.
  const flaechenfeld = zahlfeld({
    value: flaeche ? String(flaeche) : '',
    stil: { width: '110px', textAlign: 'center' },
  });
  flaechenfeld.addEventListener('change', async () => {
    const wert = Math.min(500, Math.max(0, Math.round(zuZahl(flaechenfeld.value))));
    await einstellung('baukosten_eingabe', { ...hausdaten, flaeche: wert });
    await neu();
  });

  rahmen.append(
    karte([
      el('div', { klasse: 'grosszahl' }, [
        el('span', { klasse: 'grosszahl-name', text: 'Gesamtbudget' }),
        el('strong', { klasse: 'grosszahl-wert', text: eur.format(budget) }),
      ]),
      el('div', { klasse: 'zahlenpaar' }, [
        el('div', {}, [
          el('span', { klasse: 'paar-name', text: 'Hausgröße' }),
          flaechenfeld,
          el('span', { klasse: 'paar-einheit', text: 'm²' }),
        ]),
        el('div', {}, [
          el('span', { klasse: 'paar-name', text: 'Budget pro m²' }),
          el('span', {
            klasse: 'paar-wert',
            text: flaeche > 0 ? eur.format(budget / flaeche) : '–',
          }),
        ]),
      ]),
    ])
  );

  // --------------------------------------------------------------- Kacheln
  // Drei Zahlen nebeneinander, jede mit ihrer eigenen Aussage: Was ist
  // geplant, was ist verbindlich, und was ist dazugekommen.
  const jeQm = (betrag) => (flaeche > 0 ? eur.format(betrag / flaeche) + ' / m²' : '– / m²');
  const imBudget = (betrag) =>
    budget > 0 && betrag > budget
      ? { text: 'über Budget', marke: 'marke-offen' }
      : { text: 'im Budget', marke: 'marke-fertig' };

  rahmen.append(
    el('div', { klasse: 'kachelreihe' }, [
      budgetkachel('Geplante Kosten', eur.format(summe.geplant), imBudget(summe.geplant),
        jeQm(summe.geplant)),
      budgetkachel('Auftragssumme', eur.format(summe.tatsaechlich), imBudget(summe.tatsaechlich),
        jeQm(summe.tatsaechlich)),
      budgetkachel(
        'Mehrkosten',
        (summe.differenz > 0 ? '+' : '') + eur.format(summe.differenz),
        null,
        jeQm(summe.differenz),
        summe.differenz > 0 ? 'mehr' : 'weniger'
      ),
    ])
  );

  // ---------------------------------------------------------- Was noch bleibt
  const anteil = budget > 0 ? Math.min(100, (summe.tatsaechlich / budget) * 100) : 0;
  rahmen.append(
    karte([
      el('div', { klasse: 'fortschrittsbalken' }, [
        el('div', {
          stil: { width: anteil + '%', background: rest < 0 ? 'var(--warn)' : 'var(--akzent)' },
        }),
      ]),
      el('div', { klasse: 'wertzeile stark' }, [
        el('span', { text: rest < 0 ? 'Über dem Budget' : 'Restbudget' }),
        el('strong', { klasse: rest < 0 ? 'mehr' : null, text: eur.format(Math.abs(rest)) }),
      ]),
      wertzeile('Davon bereits bezahlt', eur.format(summe.gezahlt)),
      rest < 0
        ? hinweisKasten(
            `Das Budget ist um ${eur.format(-rest)} überschritten. Je früher das auffällt, ` +
              'desto eher lässt sich noch gegensteuern.',
            'warn'
          )
        : null,
    ])
  );

  // ------------------------------------------------------------- Geldmittel
  rahmen.append(
    el('h2', { klasse: 'abschnitt', text: 'Geldmittel' }),
    el('p', {
      klasse: 'unterzeile',
      text: 'Was schon abgeflossen ist, rechnet sich aus den Rechnungen. Dafür muss ' +
        'bei jeder Rechnung stehen, woraus sie bezahlt wurde.',
    }),
    stand.posten.length
      ? null
      : karte([
          el('p', {
            klasse: 'unterzeile leer-hinweis',
            text: 'Hier steht je Geldmittel, wie viel davon schon verwendet und wie ' +
              'viel noch offen ist.',
          }),
        ]),
    el('div', { klasse: 'kachelreihe' }, stand.posten.map((p) => {
      const verbraucht = belege
        .filter((b) => b.quelleId === p.id)
        .reduce((s, b) => s + (b.betrag || 0), 0);
      const teil = p.betrag > 0 ? Math.min(100, (verbraucht / p.betrag) * 100) : 0;
      return karte([
        el('h2', { text: p.name }),
        wertzeile('Gesamt', eur.format(p.betrag)),
        el('div', { klasse: 'fortschrittsbalken' }, [
          el('div', { stil: { width: teil + '%' } }),
        ]),
        el('p', { klasse: 'unterzeile', text: Math.round(teil) + ' Prozent verwendet' }),
        wertzeile('verwendet', eur.format(verbraucht)),
        el('div', { klasse: 'wertzeile' }, [
          el('span', { text: 'offen' }),
          el('strong', { klasse: 'weniger', text: eur.format(p.betrag - verbraucht) }),
        ]),
      ]);
    })),
    knopf('Geldmittel ändern', () => { location.hash = '#/finanzierung'; }, 'knopf-leise')
  );

  // ---------------------------------------------------------- Zahlungsverlauf
  const verlauf = zahlungsverlauf(belege);
  rahmen.append(
    el('h2', { klasse: 'abschnitt', text: 'Zahlungsverlauf' }),
    el('p', {
      klasse: 'unterzeile',
      text: verlauf.length
        ? `${eur.format(summe.gezahlt)} in ${verlauf.length} ` +
          (verlauf.length === 1 ? 'Monat' : 'Monaten') + ' geflossen.'
        : 'Sobald du Rechnungen erfasst, steht hier, wann wie viel geflossen ist.',
    })
  );

  if (verlauf.length) {
    const hoechste = Math.max(...verlauf.map((m) => m.betrag));
    rahmen.append(
      karte(verlauf.map((m) =>
        el('div', { klasse: 'balkenzeile' }, [
          el('div', { klasse: 'wertzeile' }, [
            el('span', { text: monatLang(m.monat) }),
            el('strong', { text: eur.format(m.betrag) }),
          ]),
          el('div', { klasse: 'fortschrittsbalken' }, [
            el('div', { stil: { width: (m.betrag / hoechste) * 100 + '%' } }),
          ]),
          el('p', { klasse: 'unterzeile', text: 'aufgelaufen ' + eur.format(m.kumuliert) }),
        ])
      ))
    );
  }
}

/** Eine Kachel der oberen Reihe: Zahl, Plakette, Preis je Quadratmeter. */
function budgetkachel(name, wert, plakette, jeQm, wertklasse) {
  return karte([
    el('div', { klasse: 'kachelkopf' }, [
      el('span', { klasse: 'kachelname', text: name }),
      plakette ? el('span', { klasse: 'marke ' + plakette.marke, text: plakette.text }) : null,
    ]),
    el('strong', { klasse: 'kachelwert' + (wertklasse ? ' ' + wertklasse : ''), text: wert }),
    el('span', { klasse: 'kachelfuss', text: jeQm }),
  ]);
}

// -------------------------------------------------------- Kostenaufstellung

// Sortierung und Filter halten nur waehrend der Sitzung. Sie sind eine Frage
// an die Liste, keine Eigenschaft des Projekts, und haben in der Datenbank
// nichts zu suchen.
let sortierung = { feld: 'gewerk', ab: false };
const filter = { gewerk: '', status: '' };

const SPALTEN = [
  { feld: 'name', name: 'Position' },
  { feld: 'gewerk', name: 'Gewerk' },
  { feld: 'kostengruppe', name: 'KG' },
  { feld: 'geplant', name: 'Geplant', zahl: true },
  { feld: 'massgeblich', name: 'Tatsächlich', zahl: true },
  { feld: 'differenz', name: 'Abweichung', zahl: true },
  { feld: 'gezahlt', name: 'Bezahlt', zahl: true },
  { feld: 'statusName', name: 'Status' },
];

function sortieren(liste) {
  const { feld, ab } = sortierung;
  const spalte = SPALTEN.find((s) => s.feld === feld);
  return [...liste].sort((a, b) => {
    const x = a[feld], y = b[feld];
    const v = spalte && spalte.zahl
      ? (x || 0) - (y || 0)
      : String(x || '').localeCompare(String(y || ''), 'de');
    return ab ? -v : v;
  });
}

function zeigeKostenaufstellung(rahmen, gerechnet, kontakte, raeume, gewerkeReihe, art, neu) {
  // Ohne Kostengruppen faellt die Spalte weg, statt leer mitzulaufen.
  const spalten = SPALTEN.filter((s) => art.zeigtKostengruppen || s.feld !== 'kostengruppe');
  if (!art.zeigtKostengruppen && sortierung.feld === 'kostengruppe') {
    sortierung = { feld: 'gewerk', ab: false };
  }
  rahmen.append(
    kopfzeile('Kostenaufstellung', 'Alle Positionen an einer Stelle, sortierbar und filterbar.')
  );

  if (!gerechnet.length) {
    rahmen.append(
      karte([
        leerzustand(
          'Was soll das Haus kosten?',
          'Trage die Positionen ein, die du erwartest: Notar, Erdarbeiten, Rohbau, ' +
            'Dach und so weiter. Sobald ein Angebot vorliegt, kommt die tatsächliche ' +
            'Summe daneben, und die App zeigt dir die Abweichung.'
        ),
        knopf('Erste Position anlegen', () => postenBearbeiten({}, kontakte, raeume, neu), 'knopf-haupt'),
        knopf('Übliche Positionen laden', () => vorlageLaden(art, neu)),
      ]),
      hinweisKasten(
        'Der Unterschied zu den Rechnungen: Hier steht, was etwas kosten soll ' +
          'beziehungsweise laut Auftrag kostet. Bei den Rechnungen steht, was ' +
          'schon geflossen ist.',
        'info'
      )
    );
    return;
  }

  // Nach der Reihenfolge der Gewerkeliste, also so, wie gebaut wird. Was
  // nicht mehr in der Liste steht, faellt ans Ende.
  const stelle = (g) => {
    const i = gewerkeReihe.indexOf(g);
    return i === -1 ? gewerkeReihe.length : i;
  };
  const gewerke = [...new Set(gerechnet.map((p) => p.gewerk || 'Sonstiges'))].sort(
    (a, b) => stelle(a) - stelle(b)
  );
  const zustaende = [...new Set(gerechnet.map((p) => p.statusName))];

  // Verschwundene Werte zuruecksetzen: Wird die letzte Position eines
  // Gewerks geloescht, stuende der Filter sonst auf etwas, das es nicht mehr
  // gibt, und die Tabelle waere ohne ersichtlichen Grund leer.
  if (filter.gewerk && !gewerke.includes(filter.gewerk)) filter.gewerk = '';
  if (filter.status && !zustaende.includes(filter.status)) filter.status = '';

  const gefiltert = gerechnet.filter(
    (p) =>
      (!filter.gewerk || (p.gewerk || 'Sonstiges') === filter.gewerk) &&
      (!filter.status || p.statusName === filter.status)
  );
  const zeilen = sortieren(gefiltert);

  const gewerkFeld = auswahl(
    [['', 'Alle Gewerke'], ...gewerke.map((g) => [g, g])], filter.gewerk
  );
  const statusFeld = auswahl(
    [['', 'Alle Status'], ...zustaende.map((s) => [s, s])], filter.status
  );
  gewerkFeld.addEventListener('change', () => { filter.gewerk = gewerkFeld.value; neu(); });
  statusFeld.addEventListener('change', () => { filter.status = statusFeld.value; neu(); });

  const teil = {
    geplant: zeilen.reduce((s, p) => s + p.geplant, 0),
    tatsaechlich: zeilen.reduce((s, p) => s + p.massgeblich, 0),
    differenz: zeilen.reduce((s, p) => s + p.differenz, 0),
    gezahlt: zeilen.reduce((s, p) => s + p.gezahlt, 0),
  };

  rahmen.append(
    el('div', { klasse: 'filterleiste' }, [gewerkFeld, statusFeld]),
    karte([
      el('div', { klasse: 'tabelle-rolle' }, [
        el('table', {}, [
          el('thead', {}, [
            el('tr', {}, spalten.map((s) =>
              el('th', {}, [
                el('button', {
                  type: 'button', klasse: 'sortknopf',
                  text: s.name + (sortierung.feld === s.feld ? (sortierung.ab ? ' ↓' : ' ↑') : ''),
                  onclick: () => {
                    // Zweiter Klick auf dieselbe Spalte dreht die Richtung um.
                    // Zahlen fangen absteigend an: Bei Kosten interessiert
                    // zuerst der groesste Betrag, bei Namen das A.
                    sortierung = {
                      feld: s.feld,
                      ab: sortierung.feld === s.feld ? !sortierung.ab : !!s.zahl,
                    };
                    neu();
                  },
                }),
              ])
            )),
          ]),
          el('tbody', {}, zeilen.map((p) =>
            el('tr', {
              stil: { cursor: 'pointer' },
              onclick: () => postenBearbeiten(p, kontakte, raeume, neu),
            }, [
              el('td', { text: p.name }),
              el('td', { text: p.gewerk || 'Sonstiges' }),
              art.zeigtKostengruppen ? el('td', { text: p.kostengruppe || '–' }) : null,
              el('td', { text: p.geplant ? eur.format(p.geplant) : '–' }),
              el('td', { text: p.massgeblich ? eur.format(p.massgeblich) : '–' }),
              el('td', {}, [abweichung(p.differenz)]),
              el('td', { text: p.gezahlt ? eur.format(p.gezahlt) : '–' }),
              el('td', {}, [el('span', { klasse: 'marke ' + p.marke, text: p.statusName })]),
            ])
          )),
          el('tfoot', {}, [
            el('tr', { klasse: 'bindung' }, [
              el('td', {
                text: zeilen.length === gerechnet.length
                  ? 'Zusammen'
                  : `Zusammen (${zeilen.length} von ${gerechnet.length})`,
              }),
              el('td', {}),
              art.zeigtKostengruppen ? el('td', {}) : null,
              el('td', { text: eur.format(teil.geplant) }),
              el('td', { text: eur.format(teil.tatsaechlich) }),
              el('td', {}, [abweichung(teil.differenz)]),
              el('td', { text: eur.format(teil.gezahlt) }),
              el('td', {}),
            ]),
          ]),
        ]),
      ]),
    ]),
    knopf('Position hinzufügen', () => postenBearbeiten({}, kontakte, raeume, neu), 'knopf-haupt'),
    knopf('Übliche Positionen ergänzen', () => vorlageLaden(art, neu), 'knopf-leise'),
    knopf('Als PDF', () => kostenPdf(zeilen, art)),
    knopf('Als Excel', () => kostenTabelle(zeilen, 'xlsx')),
    knopf('Als CSV', () => kostenTabelle(zeilen, 'csv'), 'knopf-leise')
  );
}

// ---------------------------------------------------------------- Statistik

// Die vier Zustaende, die eine Kostenposition durchlaeuft. Sie stehen fest
// und werden auch dann gezeigt, wenn noch nichts erfasst ist: Der Bildschirm
// soll von Anfang an sagen, was er spaeter sagen wird.
const STATUSREIHE = [
  ['geplant', 'Geplant', 'marke-geplant'],
  ['beauftragt', 'Beauftragt', 'marke-beauftragt'],
  ['teilgezahlt', 'Teilgezahlt', 'marke-arbeit'],
  ['bezahlt', 'Bezahlt', 'marke-fertig'],
];

function zeigeStatistik(rahmen, gerechnet, summe, stand, belege, art, neu) {
  rahmen.append(kopfzeile('Statistiken', 'Wo das Geld hingeht, aus vier Blickwinkeln.'));

  const gesamt = summe.tatsaechlich;

  // ------------------------------------------------------------ Nach Status
  // Zeigt, wie viel vom Bau ueberhaupt schon verbindlich ist.
  rahmen.append(
    el('h2', { klasse: 'abschnitt', text: 'Nach Status' }),
    el('div', { klasse: 'kachelreihe' }, STATUSREIHE.map(([schluessel, name, marke]) => {
      const drin = gerechnet.filter((p) => p.status === schluessel);
      const geplant = drin.reduce((s, p) => s + p.geplant, 0);
      const auftrag = drin.reduce((s, p) => s + p.massgeblich, 0);
      const mehr = drin.reduce((s, p) => s + p.differenz, 0);

      return karte([
        el('div', { klasse: 'kachelkopf' }, [
          el('span', { klasse: 'kachelname', text: 'Status' }),
          el('span', { klasse: 'marke ' + marke, text: name }),
        ]),
        wertzeile('Geplante Kosten', eur.format(geplant)),
        wertzeile('Auftragssumme', eur.format(auftrag)),
        el('div', { klasse: 'wertzeile' }, [
          el('span', { text: 'Mehrkosten' }),
          mehr ? abweichung(mehr) : el('strong', { text: eur.format(0) }),
        ]),
        el('span', {
          klasse: 'kachelfuss',
          text: drin.length === 1 ? '1 Position' : drin.length + ' Positionen',
        }),
      ]);
    }))
  );

  // ------------------------------------------------------------ Nach Gewerk
  // Die Ordnung, in der man ein Bauprojekt denkt und verhandelt.
  const gewerke = new Map();
  for (const p of gerechnet) {
    const name = p.gewerk || 'Sonstiges';
    const k = gewerke.get(name) || { summe: 0, geplant: 0 };
    k.summe += p.massgeblich;
    k.geplant += p.geplant;
    gewerke.set(name, k);
  }

  rahmen.append(
    el('h2', { klasse: 'abschnitt', text: 'Nach Gewerk' }),
    karte(
      gewerke.size
        ? [...gewerke.entries()]
            .sort((a, b) => b[1].summe - a[1].summe)
            .map(([name, k]) =>
              balkenzeile(name, k.summe, gesamt, 'geplant ' + eur.format(k.geplant))
            )
        : [nochNichts('Sobald Positionen erfasst sind, steht hier, welches Gewerk ' +
            'welchen Anteil an der Bausumme hat.')]
    )
  );

  // ------------------------------------------------------ Nach Kostengruppe
  // Beim Bautraeger steht im Vertrag eine Summe, und die gliedert niemand
  // mehr nach DIN 276. Der ganze Abschnitt entfaellt.
  if (art.zeigtKostengruppen) {
    rahmen.append(el('h2', { klasse: 'abschnitt', text: 'Nach Kostengruppe' }));
    if (gerechnet.length) {
      zeigeKostengruppen(rahmen, gerechnet, summe, neu);
    } else {
      rahmen.append(
        karte([
          nochNichts('Die Gliederung nach DIN 276 fasst die Positionen so zusammen, wie ' +
            'Banken und Architekten Baukosten rechnen.'),
        ])
      );
    }
  }

  // -------------------------------------------------------- Nach Geldmittel
  // Aus welchem Topf die Rechnungen bezahlt wurden.
  rahmen.append(
    el('h2', { klasse: 'abschnitt', text: 'Nach Geldmittel' }),
    el('p', {
      klasse: 'unterzeile',
      text: 'Verteilung der bezahlten Rechnungen auf Eigenkapital, Zuschüsse und Darlehen.',
    }),
    karte(
      stand.posten.length
        ? stand.posten.map((p) => {
            const verbraucht = belege
              .filter((b) => b.quelleId === p.id)
              .reduce((s, b) => s + (b.betrag || 0), 0);
            // Ohne Zahlungen ist der Anteil am Budget die ehrlichere Zahl:
            // Sonst stuenden vier Balken auf null und saehen aus wie ein
            // Fehler.
            return summe.gezahlt > 0
              ? balkenzeile(p.name, verbraucht, summe.gezahlt, 'von ' + eur.format(p.betrag))
              : balkenzeile(p.name, p.betrag, stand.gesamt, 'noch nichts abgeflossen');
          })
        : [nochNichts('Lege in der Baufinanzierung Eigenkapital, Zuschüsse und Darlehen ' +
            'an, dann steht hier, woraus bezahlt wurde.')]
    )
  );

  // ------------------------------------------------------- Groesste Abweichungen
  const auffaellig = gerechnet
    .filter((p) => p.differenz !== 0)
    .sort((a, b) => Math.abs(b.differenz) - Math.abs(a.differenz))
    .slice(0, 5);

  rahmen.append(
    el('h2', { klasse: 'abschnitt', text: 'Größte Abweichungen' }),
    karte(
      auffaellig.length
        ? [el('ul', { klasse: 'liste' }, auffaellig.map((p) =>
            el('li', {}, [
              el('div', { klasse: 'listenzeile', stil: { cursor: 'default' } }, [
                el('span', { klasse: 'zeilen-text' }, [
                  el('span', { klasse: 'zeilen-titel', text: p.name }),
                  el('span', {
                    klasse: 'zeilen-unter',
                    text: `geplant ${eur.format(p.geplant)}, tatsächlich ${eur.format(p.tatsaechlich)}`,
                  }),
                ]),
                el('span', { klasse: 'zeilen-wert' }, [abweichung(p.differenz)]),
              ]),
            ])
          ))]
        : [nochNichts('Hier stehen die fünf Positionen, bei denen Plan und Wirklichkeit ' +
            'am weitesten auseinanderliegen. Solange nichts abweicht, bleibt es leer — ' +
            'und das ist die gute Nachricht.')]
    )
  );

  if (!gerechnet.length) {
    rahmen.append(
      knopf('Positionen anlegen', () => { location.hash = '#/baukasse/kosten'; }, 'knopf-haupt')
    );
  }
}

/** Der Platzhalter in einem Abschnitt, der noch keine Zahlen hat. */
const nochNichts = (text) => el('p', { klasse: 'unterzeile leer-hinweis', text });

// ------------------------------------------------------------- Kostengruppen

function zeigeKostengruppen(rahmen, gerechnet, summe, neu) {
  const ohne = gerechnet.filter((p) => !p.kostengruppe);
  const gruppen = nachHauptgruppen(gerechnet, (p) => p.massgeblich);

  rahmen.append(
    karte([
      el('h2', { text: 'Kosten nach DIN 276' }),
      el('p', {
        klasse: 'unterzeile',
        text: 'Maßgeblich ist die tatsächliche Summe, solange sie feststeht, sonst die geplante.',
      }),
      ...gruppen.map((g) => {
        const anteil = summe.tatsaechlich > 0 ? (g.summe / summe.tatsaechlich) * 100 : 0;
        return el('div', {}, [
          el('div', { klasse: 'wertzeile' }, [
            el('span', { text: g.nr ? g.nr + ' ' + g.name : g.name }),
            el('strong', { text: eur.format(g.summe) }),
          ]),
          el('p', {
            klasse: 'unterzeile', stil: { margin: '-4px 0 6px' },
            text: g.saetze.length + (g.saetze.length === 1 ? ' Position' : ' Positionen') +
              (anteil >= 0.5 ? ', ' + Math.round(anteil) + ' % der Bausumme' : ''),
          }),
          el('div', { klasse: 'fortschrittsbalken' }, [
            el('div', { stil: { width: Math.min(100, anteil) + '%' } }),
          ]),
        ]);
      }),
      el('div', { klasse: 'wertzeile stark' }, [
        el('span', { text: 'Zusammen' }),
        el('strong', { text: eur.format(summe.tatsaechlich) }),
      ]),
    ])
  );

  if (ohne.length) {
    rahmen.append(
      hinweisKasten(
        ohne.length === 1
          ? 'Eine Position ist noch keiner Kostengruppe zugeordnet und fällt in der Gliederung durch.'
          : ohne.length + ' Positionen sind noch keiner Kostengruppe zugeordnet und fallen in der Gliederung durch.',
        'warn'
      ),
      knopf('Kostengruppen vorschlagen', () => gruppenVorschlagen(ohne, neu), 'knopf-haupt')
    );
  }

  // Die Einzelpositionen je Gruppe. Ohne sie ist nicht nachvollziehbar,
  // warum eine Gruppe so gross ausfaellt.
  for (const g of gruppen.filter((x) => x.nr)) {
    rahmen.append(
      karte([
        el('h2', { text: g.nr + ' ' + g.name }),
        el('ul', { klasse: 'liste' }, g.saetze
          .slice()
          .sort((a, b) => String(a.kostengruppe).localeCompare(String(b.kostengruppe)))
          .map((p) =>
            el('li', {}, [
              el('div', { klasse: 'listenzeile', stil: { cursor: 'default' } }, [
                el('span', { klasse: 'zeilen-text' }, [
                  el('span', { klasse: 'zeilen-titel', text: p.name }),
                  el('span', { klasse: 'zeilen-unter', text: kostengruppeLang(p.kostengruppe) }),
                ]),
                el('span', { klasse: 'zeilen-wert', text: eur.format(p.massgeblich) }),
              ]),
            ])
          )),
      ])
    );
  }

  rahmen.append(
    hinweisKasten(
      'Die Gliederung folgt DIN 276:2018-12. Für eine förmliche Einreichung gleiche ' +
        'die Bezeichnungen einmal mit dem Normtext ab; einzelne Untergruppen werden ' +
        'in den frei zugänglichen Quellen unterschiedlich benannt.',
      'info'
    )
  );
}

/** Setzt fuer alle noch unzugeordneten Positionen den Vorschlag. */
async function gruppenVorschlagen(ohne, nachher) {
  const treffer = ohne
    .map((p) => ({ posten: p, nr: kostengruppeVorschlag(p.name, p.gewerk) }))
    .filter((t) => t.nr);

  if (!treffer.length) {
    melde('Zu diesen Bezeichnungen gibt es keinen Vorschlag.');
    return;
  }
  if (!window.confirm(
    treffer.length + ' von ' + ohne.length + ' Positionen bekommen einen Vorschlag. ' +
    'Prüfe ihn danach, die Zuordnung bleibt deine Entscheidung.'
  )) return;

  for (const { posten, nr } of treffer) {
    // Nur die gespeicherten Felder zurueckschreiben. postenRechnen haengt
    // ausgerechnete Werte an, die nichts in der Datenbank zu suchen haben.
    const {
      differenz, gezahlt, massgeblich, offen, statusName, marke, ...rein
    } = posten;
    await daten.sichern('posten', { ...rein, kostengruppe: nr });
  }
  melde(treffer.length + ' Positionen zugeordnet.');
  await nachher();
}

async function kostenPdf(gerechnet, art) {
  const gruppen = nachHauptgruppen(gerechnet, (p) => p.massgeblich);
  const summe = { tatsaechlich: gerechnet.reduce((x, p) => x + p.massgeblich, 0) };
  melde('PDF wird erstellt …');
  const projekt = (await einstellung('projektname')) || '';
  const { Blatt, pdfTeilen } = await import('../pdf.js');
  const blatt = new Blatt({
    // Ohne Kostengruppen waere "nach DIN 276" im Titel eine Behauptung, die
    // das Blatt nicht einloest.
    titel: art.zeigtKostengruppen ? 'Kostenaufstellung nach DIN 276' : 'Kostenaufstellung',
    untertitel: (projekt ? projekt + ' · ' : '') + 'Stand ' + datumLang(heute()),
    fusszeile: 'Kostenaufstellung',
  });

  blatt.absatz(
    (art.zeigtKostengruppen ? 'Gegliedert nach DIN 276:2018-12. ' : '') +
      'Maßgeblich ist die tatsächliche Summe, solange sie feststeht, sonst die geplante.'
  );

  if (!art.zeigtKostengruppen) {
    blatt.ueberschrift('Positionen');
    blatt.tabelle(
      ['Position', 'Gewerk', 'Geplant', 'Tatsächlich', 'Bezahlt'],
      [...gerechnet].map((p) => [
        p.name, p.gewerk || '',
        p.geplant ? eur.format(p.geplant) : '',
        p.tatsaechlich ? eur.format(p.tatsaechlich) : '',
        p.gezahlt ? eur.format(p.gezahlt) : '',
      ]),
      [2.8, 1.6, 1.2, 1.3, 1.2],
      [2, 3, 4]
    );
    blatt.wertzeile('Zusammen', eur.format(summe.tatsaechlich), true);
    try {
      await pdfTeilen(blatt.blob(), 'kostenaufstellung.pdf', 'Kostenaufstellung');
    } catch (fehler) {
      melde('PDF konnte nicht geteilt werden.');
      console.error(fehler);
    }
    return;
  }

  blatt.ueberschrift('Zusammenfassung');
  blatt.tabelle(
    ['Kostengruppe', 'Positionen', 'Summe'],
    gruppen.map((g) => [
      g.nr ? g.nr + ' ' + g.name : g.name,
      String(g.saetze.length),
      eur.format(g.summe),
    ]),
    [3.4, 1, 1.4],
    [1, 2]
  );
  blatt.wertzeile('Zusammen', eur.format(summe.tatsaechlich), true);

  blatt.ueberschrift('Einzelpositionen');
  blatt.tabelle(
    ['KG', 'Position', 'Geplant', 'Tatsächlich', 'Bezahlt'],
    [...gerechnet]
      .sort((a, b) => String(a.kostengruppe || 'zzz').localeCompare(String(b.kostengruppe || 'zzz')))
      .map((p) => [
        p.kostengruppe || '',
        p.name,
        p.geplant ? eur.format(p.geplant) : '',
        p.tatsaechlich ? eur.format(p.tatsaechlich) : '',
        p.gezahlt ? eur.format(p.gezahlt) : '',
      ]),
    [0.7, 2.8, 1.2, 1.3, 1.2],
    [2, 3, 4]
  );

  try {
    await pdfTeilen(blatt.blob(), 'kostenaufstellung-din276.pdf', 'Kostenaufstellung');
  } catch (fehler) {
    melde('PDF konnte nicht geteilt werden.');
    console.error(fehler);
  }
}

/**
 * Gibt die gefilterte Aufstellung als Tabelle aus.
 *
 * Excel und CSV holen ihre Spalten aus derselben Stelle. Zwei Listen waeren
 * zwei Gelegenheiten, eine Spalte zu vergessen.
 */
async function kostenTabelle(gerechnet, art) {
  try {
    const kopf = ['Kostengruppe', 'Bezeichnung der Kostengruppe', 'Position', 'Gewerk',
      'Geplant', 'Tatsaechlich', 'Bezahlt', 'Abweichung', 'Status'];
    const zeilen = [...gerechnet]
        .sort((a, b) => String(a.kostengruppe || 'zzz').localeCompare(String(b.kostengruppe || 'zzz')))
        .map((p) => [
          p.kostengruppe || '',
          p.kostengruppe ? kostengruppeLang(p.kostengruppe).slice(4) : '',
          p.name,
          p.gewerk || '',
          p.geplant || 0,
          p.tatsaechlich || 0,
          p.gezahlt || 0,
          p.differenz || 0,
          p.statusName,
        ]);

    if (art === 'csv') {
      await csvTeilen(kopf, zeilen, 'kostenaufstellung.csv', 'Kostenaufstellung');
      return;
    }
    const { xlsxTeilen } = await import('../xlsx.js');
    await xlsxTeilen(kopf, zeilen, 'kostenaufstellung.xlsx', 'Kostenaufstellung');
  } catch (fehler) {
    melde('Die Datei konnte nicht geteilt werden.');
    console.error(fehler);
  }
}

// Wer schluesselfertig kauft, hat keine sechsundzwanzig Gewerke, sondern
// einen Vertragspreis und das, was der Vertrag nicht enthaelt. Genau das ist
// die Liste, an der solche Bauvorhaben teurer werden als gedacht.
const VORLAGE_SCHLUESSELFERTIG = [
  ['Vertragspreis laut Bau- oder Kaufvertrag', 'Sonstiges'],
  ['Grundstück', 'Sonstiges'],
  ['Grunderwerbsteuer', 'Sonstiges'],
  ['Notar und Grundbuch', 'Sonstiges'],
  ['Maklercourtage', 'Sonstiges'],
  ['Sonderwünsche aus der Bemusterung', 'Sonstiges'],
  ['Bodengutachten', 'Sonstiges'],
  ['Mehraufwand Erdarbeiten und Gründung', 'Rohbau'],
  ['Hausanschlüsse Strom, Wasser, Abwasser', 'Sonstiges'],
  ['Telekommunikationsanschluss', 'Elektro'],
  ['Baustrom und Bauwasser', 'Sonstiges'],
  ['Vermessung und Absteckung', 'Sonstiges'],
  ['Baugenehmigung und Gebühren', 'Sonstiges'],
  ['Bauherrenhaftpflicht', 'Sonstiges'],
  ['Baubegleitender Sachverständiger', 'Sonstiges'],
  ['Außenanlagen und Einfriedung', 'Außenanlagen'],
  ['Terrasse und Wege', 'Außenanlagen'],
  ['Küche', 'Sonstiges'],
  ['Bodenbeläge, soweit nicht enthalten', 'Bodenbelag'],
  ['Malerarbeiten, soweit nicht enthalten', 'Maler'],
  ['Umzug und Einrichtung', 'Sonstiges'],
  ['Puffer für Unvorhergesehenes', 'Sonstiges'],
];

// Im Bestand liegt das Geld an anderen Stellen als im Neubau. Was hier oben
// steht, entscheidet ueber alles Weitere: Wer ohne Bestandsaufnahme und ohne
// Schadstoffprobe anfaengt, rechnet spaeter noch einmal von vorn.
const VORLAGE_SANIERUNG = [
  ['Bestandsaufnahme und Aufmaß', 'Sonstiges'],
  ['Statische Prüfung des Bestands', 'Sonstiges'],
  ['Schadstoffuntersuchung (Asbest, KMF, PAK)', 'Sonstiges'],
  ['Energieberatung und Sanierungsfahrplan', 'Sonstiges'],
  ['Baugenehmigung oder Bauanzeige', 'Sonstiges'],
  ['Gerüst', 'Sonstiges'],
  ['Entkernung und Entsorgung', 'Rohbau'],
  ['Trockenlegung und Abdichtung', 'Rohbau'],
  ['Mauerwerk, Durchbrüche, Stürze', 'Rohbau'],
  ['Dach: Eindeckung und Dämmung', 'Dach'],
  ['Fenster und Außentüren', 'Fenster und Türen'],
  ['Fassadendämmung und Putz', 'Putz und Trockenbau'],
  ['Elektroinstallation erneuern', 'Elektro'],
  ['Sanitärinstallation erneuern', 'Sanitär'],
  ['Heizungstausch', 'Heizung'],
  ['Innenputz und Trockenbau', 'Putz und Trockenbau'],
  ['Estrich', 'Estrich'],
  ['Bäder', 'Fliesen'],
  ['Innentüren', 'Fenster und Türen'],
  ['Bodenbeläge', 'Bodenbelag'],
  ['Malerarbeiten', 'Maler'],
  ['Außenanlagen', 'Außenanlagen'],
  ['Zwischenmiete oder Auslagerung', 'Sonstiges'],
  ['Puffer für Überraschungen im Bestand', 'Sonstiges'],
];

// Die Posten, die bei fast jedem Neubau in Einzelvergabe vorkommen. Betraege
// bleiben leer: Zahlen zu raten waere schlimmer, als sie fehlen zu lassen.
const VORLAGE = [
  ['Grundstück', 'Sonstiges'],
  ['Grunderwerbsteuer', 'Sonstiges'],
  ['Notar und Grundbuch', 'Sonstiges'],
  ['Vermessung', 'Sonstiges'],
  ['Baugenehmigung', 'Sonstiges'],
  ['Erdarbeiten', 'Rohbau'],
  ['Bodenplatte oder Keller', 'Rohbau'],
  ['Rohbau', 'Rohbau'],
  ['Dachstuhl und Dachdeckung', 'Dach'],
  ['Fenster und Außentüren', 'Fenster und Türen'],
  ['Elektroinstallation', 'Elektro'],
  ['Sanitärinstallation', 'Sanitär'],
  ['Heizung', 'Heizung'],
  ['Innenputz', 'Putz und Trockenbau'],
  ['Estrich', 'Estrich'],
  ['Fliesenarbeiten', 'Fliesen'],
  ['Malerarbeiten', 'Maler'],
  ['Bodenbeläge', 'Bodenbelag'],
  ['Innentüren', 'Fenster und Türen'],
  ['Treppe', 'Treppe'],
  ['Küche', 'Sonstiges'],
  ['Außenanlagen', 'Außenanlagen'],
  ['Hausanschlüsse', 'Sonstiges'],
  ['Baustrom und Bauwasser', 'Sonstiges'],
  ['Bauversicherungen', 'Sonstiges'],
  ['Puffer für Unvorhergesehenes', 'Sonstiges'],
];

async function vorlageLaden(art, nachher) {
  // Je Bauweise eine Vorlage, weil es drei verschiedene Vorhaben sind. Wer
  // schluesselfertig kauft, braucht keine Liste der Gewerke, sondern die der
  // Posten neben dem Vertragspreis; wer saniert, eine dritte.
  const liste = {
    schluesselfertig: VORLAGE_SCHLUESSELFERTIG,
    sanierung: VORLAGE_SANIERUNG,
  }[art.id] || VORLAGE;
  if (!window.confirm(`${liste.length} übliche Positionen anlegen? Beträge bleiben leer.`)) return;
  const vorhanden = new Set((await daten.alle('posten')).map((p) => p.name));
  let angelegt = 0;
  for (const [name, gewerk] of liste) {
    if (vorhanden.has(name)) continue;
    await daten.sichern('posten', {
      name, gewerk, kontaktId: null, geplant: 0, tatsaechlich: 0,
      kostengruppe: art.zeigtKostengruppen
        ? kostengruppeVorschlag(name, gewerk) || null
        : null,
      status: 'geplant', notiz: '',
    });
    angelegt++;
  }
  melde(angelegt ? `${angelegt} Positionen angelegt.` : 'Alles war schon da.');
  await nachher();
}

async function postenBearbeiten(posten, kontakte, raeume, nachher) {
  const art = await bauweise();
  const name = eingabe({ value: posten.name || '', placeholder: 'z. B. Elektroinstallation' });
  const gewerke = await gewerkeListe();
  // Ein Gewerk, das aus der Liste geflogen ist, bleibt an der Position
  // waehlbar. Sonst wechselte sie beim naechsten Speichern unbemerkt.
  const bekannt = posten.gewerk && !gewerke.includes(posten.gewerk)
    ? [posten.gewerk, ...gewerke]
    : gewerke;
  const gewerk = auswahl(bekannt.map((g) => [g, g]), posten.gewerk || bekannt[0]);
  // Bei einer neuen Position gleich einen Vorschlag setzen, sonst ordnet
  // niemand sechsundzwanzig Positionen von Hand zu.
  const kostengruppe = auswahl(
    kostengruppenOptionen(),
    posten.kostengruppe ?? (posten.id ? '' : kostengruppeVorschlag(posten.name, posten.gewerk))
  );
  // Tippt jemand die Bezeichnung, wandert der Vorschlag mit - solange er die
  // Gruppe nicht selbst angefasst hat.
  let gruppeSelbst = Boolean(posten.kostengruppe);
  kostengruppe.addEventListener('change', () => { gruppeSelbst = true; });
  const geplant = zahlfeld({ value: posten.geplant ? String(posten.geplant).replace('.', ',') : '' });
  const tatsaechlich = zahlfeld({
    value: posten.tatsaechlich ? String(posten.tatsaechlich).replace('.', ',') : '',
  });
  const status = auswahl(
    Object.entries(POSTEN_STATUS).map(([w, s]) => [w, s.name]),
    posten.status || 'geplant'
  );
  const kontakt = auswahl(
    [['', '– keine Firma –'], ...kontakte
      .filter((k) => (k.art || 'firma') === 'firma')
      .map((k) => [k.id, k.firma || k.name])],
    posten.kontaktId ?? ''
  );
  const raum = auswahl(
    [['', '– kein Raum –'], ...raeume
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
      .map((r) => [r.id, r.name])],
    posten.raumId ?? ''
  );
  const notiz = el('textarea', {}, [posten.notiz || '']);

  const vorschau = el('p', { klasse: 'unterzeile' });
  function rechnen() {
    const g = zuZahl(geplant.value);
    const t = zuZahl(tatsaechlich.value);
    if (!t) {
      vorschau.textContent = 'Ohne tatsächliche Summe gibt es noch keine Abweichung.';
      return;
    }
    const d = t - g;
    vorschau.textContent = d === 0
      ? 'Genau im Plan.'
      : d > 0
        ? `${eur.format(d)} über dem Plan.`
        : `${eur.format(-d)} unter dem Plan.`;
  }
  geplant.addEventListener('input', rechnen);
  tatsaechlich.addEventListener('input', rechnen);
  rechnen();

  const gruppeVorschlagen = () => {
    if (gruppeSelbst) return;
    kostengruppe.value = kostengruppeVorschlag(name.value, gewerk.value) || '';
  };
  name.addEventListener('input', gruppeVorschlagen);
  gewerk.addEventListener('change', gruppeVorschlagen);

  blattOeffnen(
    posten.id ? 'Position bearbeiten' : 'Position anlegen',
    [
      feld('Bezeichnung', name),
      feld('Gewerk', gewerk),
      // Ohne Kostengruppen faellt das Feld weg. Ein vorhandener Wert bleibt
      // trotzdem stehen: Wer zurueckstellt, findet ihn wieder.
      art.zeigtKostengruppen
        ? feld('Kostengruppe (DIN 276)', kostengruppe,
            'Die Gliederung, nach der Banken und Architekten rechnen. Wird vorgeschlagen, lässt sich ändern.')
        : null,
      feld('Geplante Kosten in €', geplant, 'Was du erwartest, bevor ein Angebot vorliegt.'),
      feld('Tatsächliche Kosten in €', tatsaechlich,
        'Auftrags- oder Schlusssumme. Leer lassen, solange nichts feststeht.'),
      vorschau,
      feld('Status', status, 'Teilgezahlt und Bezahlt rechnet die App aus den Rechnungen.'),
      feld('Firma', kontakt),
      feld('Raum', raum, 'Damit steht die Position auch beim Raum. Für Gewerke, die das ganze Haus betreffen, leer lassen.'),
      feld('Notiz', notiz),
    ],
    async () => {
      const wert = {
        // Die Leistungsliste des Angebotsvergleichs haengt an der Position.
        // Sie wird hier nicht bearbeitet, muss aber mitgeschrieben werden,
        // sonst ist sie nach jeder Aenderung weg.
        ...(posten.leistungen ? { leistungen: posten.leistungen } : {}),
        name: name.value.trim(),
        gewerk: gewerk.value,
        kostengruppe: art.zeigtKostengruppen
          ? kostengruppe.value || null
          : posten.kostengruppe || null,
        geplant: Math.max(0, zuZahl(geplant.value)),
        tatsaechlich: Math.max(0, zuZahl(tatsaechlich.value)),
        status: status.value,
        kontaktId: kontakt.value || null,
        raumId: raum.value || null,
        notiz: notiz.value.trim(),
      };
      if (!wert.name) throw new Error('Bitte eine Bezeichnung eintragen.');
      if (posten.id) wert.id = posten.id;
      await daten.sichern('posten', wert);
      await nachher();
    },
    {
      loeschen: posten.id
        ? async () => {
            // Rechnungen bleiben, verlieren aber ihre Zuordnung. Sie zu
            // loeschen waere falsch: Das Geld ist trotzdem geflossen.
            for (const b of await daten.alle('belege')) {
              if (b.postenId === posten.id) {
                await daten.sichern('belege', { ...b, postenId: null });
              }
            }
            await daten.loeschen('posten', posten.id);
            await nachher();
          }
        : null,
    }
  );
}

// ----------------------------------------------------------------- Rechnungen

async function zeigeRechnungen(rahmen, belege, posten, stand, kontakte, neu) {
  rahmen.append(
    kopfzeile('Rechnungen', 'Was tatsächlich abgeflossen ist, mit Beleg und Zuordnung.'),
    karte([
      el('h2', { text: 'Rechnung erfassen' }),
      knopf('Rechnung hinzufügen', () =>
        belegBearbeiten({ datum: heute() }, posten, stand, kontakte, neu), 'knopf-haupt'
      ),
      el('p', {
        klasse: 'unterzeile', stil: { marginTop: '10px' },
        text:
          'Zu jeder Rechnung kannst du ein Foto des Belegs hinterlegen. Ordne sie ' +
          'einer Position zu, dann rechnet die App aus, was davon noch offen ist.',
      }),
    ])
  );

  if (!belege.length) {
    rahmen.append(karte([el('p', { klasse: 'unterzeile', text: 'Noch keine Rechnung erfasst.' })]));
    return;
  }

  const sortiert = [...belege].sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
  const zeilen = await Promise.all(sortiert.map(async (b) => {
    const kontakt = kontakte.find((k) => k.id === b.kontaktId);
    const zu = posten.find((p) => p.id === b.postenId);
    const url = b.bildId ? await bildUrl(b.bildId) : null;
    return el('li', {}, [
      el('button', {
        klasse: 'listenzeile',
        onclick: () => belegBearbeiten(b, posten, stand, kontakte, neu),
      }, [
        url ? el('img', { klasse: 'vorschau', src: url, alt: '' }) : el('span', { klasse: 'vorschau' }),
        el('span', { klasse: 'zeilen-text' }, [
          el('span', { klasse: 'zeilen-titel', text: b.beschreibung || 'Rechnung' }),
          el('span', {
            klasse: 'zeilen-unter',
            text: [
              datumLang(b.datum),
              kontakt ? (kontakt.firma || kontakt.name) : b.kontaktName,
              zu ? '→ ' + zu.name : 'ohne Position',
            ].filter(Boolean).join(' · '),
          }),
        ]),
        el('span', { klasse: 'zeilen-wert', text: eur.format(b.betrag) }),
      ]),
    ]);
  }));

  rahmen.append(karte([el('h2', { text: 'Alle Rechnungen' }), el('ul', { klasse: 'liste' }, zeilen)]));
}

function belegBearbeiten(beleg, posten, stand, kontakte, nachher) {
  const betrag = zahlfeld({ value: beleg.betrag ? String(beleg.betrag).replace('.', ',') : '' });
  const beschreibung = eingabe({ value: beleg.beschreibung || '', placeholder: 'z. B. Abschlag Rohbau' });
  const datum = el('input', { type: 'date', value: beleg.datum || heute() });

  const zuPosten = auswahl(
    [['', '– keine Position –'], ...posten.map((p) => [p.id, p.name])],
    beleg.postenId ?? ''
  );

  // Der Firmenname darf als Freitext stehen bleiben, auch ohne passenden
  // Kontakt. Gibt es einen mit gleichem Namen, wird er vorgewaehlt.
  const treffer = kontakte.find(
    (k) => beleg.kontaktName && k.name.toLowerCase() === String(beleg.kontaktName).toLowerCase()
  );
  const kontakt = auswahl(
    [['', '– kein Kontakt –'], ...kontakte.map((k) => [k.id, k.name])],
    beleg.kontaktId ?? (treffer ? treffer.id : '')
  );
  const kontaktName = eingabe({ value: beleg.kontaktName || '', placeholder: 'Firma laut Rechnung' });

  const quelle = auswahl(
    [['', '– keine Zuordnung –'], ...stand.posten.map((p) => [p.id, p.name])],
    beleg.quelleId ?? (stand.posten[0] ? stand.posten[0].id : '')
  );

  const bilder = beleg.bildId ? [beleg.bildId] : [];
  const fotos = fotofeld(bilder, () => {}, { text: 'Beleg fotografieren', mehrere: false });

  blattOeffnen(
    beleg.id ? 'Rechnung bearbeiten' : 'Rechnung erfassen',
    [
      feld('Betrag in €', betrag),
      feld('Beschreibung', beschreibung),
      feld('Rechnungsdatum', datum),
      feld('Gehört zu Position', zuPosten,
        'Damit weiß die App, was von dieser Position noch offen ist.'),
      feld('Firma laut Rechnung', kontaktName),
      feld('Zugeordneter Kontakt', kontakt),
      feld('Bezahlt aus', quelle, 'Bestimmt, von welchem Budgetposten der Betrag abgeht.'),
      el('span', { klasse: 'feld-name', text: 'Beleg' }),
      fotos,
    ],
    async () => {
      const wert = {
        betrag: Math.max(0, zuZahl(betrag.value)),
        beschreibung: beschreibung.value.trim(),
        datum: datum.value || heute(),
        postenId: zuPosten.value || null,
        kontaktName: kontaktName.value.trim(),
        kontaktId: kontakt.value || null,
        quelleId: quelle.value || null,
        bildId: bilder[0] ?? null,
      };
      if (wert.betrag <= 0) throw new Error('Bitte einen Betrag eintragen.');
      if (beleg.id) wert.id = beleg.id;
      await daten.sichern('belege', wert);
      await nachher();
    },
    {
      loeschen: beleg.id
        ? async () => {
            if (beleg.bildId) await bildLoeschen(beleg.bildId);
            await daten.loeschen('belege', beleg.id);
            await nachher();
          }
        : null,
    }
  );
}
