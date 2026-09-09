// Baukasse: alles zum Geld an einer Stelle.
//
// Drei Ansichten, weil es drei Fragen sind:
//   Übersicht    Wie viel habe ich, wie viel kostet es, was bleibt?
//   Positionen   Was war geplant, was wurde es wirklich?
//   Rechnungen   Was ist tatsaechlich abgeflossen?
//
// Die mittlere ist der Kern. Bauprojekte werden selten teurer, weil eine
// Rechnung falsch war, sondern weil zwischen Planung und Auftrag eine Luecke
// klafft, die niemand zusammenrechnet.

import {
  el, eur, feld, eingabe, zahlfeld, auswahl, knopf, karte, kopfzeile,
  wertzeile, hinweisKasten, leerzustand, zuZahl, melde, datumLang, heute,
} from '../hilfen.js';
import { daten, bildUrl, bildLoeschen } from '../daten.js';
import { blattOeffnen } from '../blatt.js';
import { finanzierungsstand } from './finanzierung.js';
import { fotofeld } from '../fotos.js';
import { GEWERKE } from './maengel.js';

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

export async function zeige(rahmen) {
  await zeichne(rahmen);
}

async function zeichne(rahmen, ansicht = 'uebersicht') {
  rahmen.replaceChildren();

  const [posten, belege, stand, kontakte, raeume] = await Promise.all([
    daten.alle('posten'),
    daten.alle('belege'),
    finanzierungsstand(),
    daten.alle('kontakte'),
    daten.alle('raeume'),
  ]);

  const neu = () => zeichne(rahmen, ansicht);
  const gerechnet = posten.map((p) => ({ ...p, ...postenRechnen(p, belege) }));

  const summe = {
    geplant: gerechnet.reduce((s, p) => s + p.geplant, 0),
    tatsaechlich: gerechnet.reduce((s, p) => s + p.massgeblich, 0),
    gezahlt: belege.reduce((s, b) => s + (b.betrag || 0), 0),
    differenz: gerechnet.reduce((s, p) => s + p.differenz, 0),
  };

  rahmen.append(
    kopfzeile('Baukasse', 'Budget, geplante Kosten und was daraus wurde.'),
    el('div', { klasse: 'geschossleiste' }, [
      ['uebersicht', 'Übersicht'],
      ['posten', `Positionen (${posten.length})`],
      ['rechnungen', `Rechnungen (${belege.length})`],
    ].map(([wert, text]) =>
      el('button', {
        type: 'button', text,
        klasse: ansicht === wert ? 'aktiv' : null,
        onclick: () => zeichne(rahmen, wert),
      })
    ))
  );

  if (ansicht === 'posten') return zeigePosten(rahmen, gerechnet, kontakte, raeume, neu);
  if (ansicht === 'rechnungen') return zeigeRechnungen(rahmen, belege, posten, stand, kontakte, neu);
  return zeigeUebersicht(rahmen, stand, summe, gerechnet, belege);
}

// ------------------------------------------------------------------ Übersicht

function zeigeUebersicht(rahmen, stand, summe, gerechnet, belege) {
  const budget = stand.gesamt;
  const rest = budget - summe.tatsaechlich;

  if (!stand.posten.length) {
    rahmen.append(
      karte([
        leerzustand(
          'Erst das Budget, dann die Kosten',
          'Die Baukasse zieht ihr Budget aus der Baufinanzierung. Lege dort ' +
            'Eigenkapital und Darlehen an, danach rechnet sich alles Weitere von allein.'
        ),
        knopf('Zur Baufinanzierung', () => { location.hash = '#/finanzierung'; }, 'knopf-haupt'),
      ])
    );
  } else {
    const anteil = budget > 0 ? Math.min(100, (summe.tatsaechlich / budget) * 100) : 0;
    rahmen.append(
      karte([
        el('h2', { text: 'Stand' }),
        wertzeile('Budget', eur.format(budget)),
        wertzeile('Geplante Kosten', eur.format(summe.geplant)),
        el('div', { klasse: 'wertzeile' }, [
          el('span', { text: 'Tatsächliche Kosten' }),
          el('strong', {}, [
            eur.format(summe.tatsaechlich) + '  ',
            abweichung(summe.differenz),
          ]),
        ]),
        wertzeile('Davon bezahlt', eur.format(summe.gezahlt)),
        el('div', { klasse: 'fortschrittsbalken' }, [
          el('div', {
            stil: { width: anteil + '%', background: rest < 0 ? 'var(--warn)' : 'var(--akzent)' },
          }),
        ]),
        el('div', { klasse: 'wertzeile stark' }, [
          el('span', { text: 'Restbudget' }),
          el('strong', { klasse: rest < 0 ? 'mehr' : null, text: eur.format(rest) }),
        ]),
        rest < 0
          ? hinweisKasten(
              `Das Budget ist um ${eur.format(-rest)} überschritten. Je früher das auffällt, ` +
                'desto eher lässt sich noch gegensteuern.',
              'warn'
            )
          : null,
      ])
    );

    rahmen.append(
      karte([
        el('h2', { text: 'Woher das Geld kommt' }),
        ...stand.posten.map((p) => {
          const verbraucht = belege
            .filter((b) => b.quelleId === p.id)
            .reduce((s, b) => s + (b.betrag || 0), 0);
          return el('div', {}, [
            wertzeile(p.name, eur.format(p.betrag)),
            el('p', {
              klasse: 'unterzeile', stil: { margin: '-4px 0 8px' },
              text: `davon abgeflossen ${eur.format(verbraucht)}, frei ${eur.format(p.betrag - verbraucht)}`,
            }),
          ]);
        }),
        knopf('Budget in der Baufinanzierung ändern', () => { location.hash = '#/finanzierung'; }, 'knopf-leise'),
      ])
    );
  }

  // Die groessten Abweichungen zuerst: Wer nachsteuern will, faengt oben an.
  const auffaellig = gerechnet
    .filter((p) => p.differenz !== 0)
    .sort((a, b) => Math.abs(b.differenz) - Math.abs(a.differenz))
    .slice(0, 5);

  if (auffaellig.length) {
    rahmen.append(
      karte([
        el('h2', { text: 'Größte Abweichungen' }),
        el('ul', { klasse: 'liste' }, auffaellig.map((p) =>
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
        )),
      ])
    );
  }
}

// ----------------------------------------------------------------- Positionen

function zeigePosten(rahmen, gerechnet, kontakte, raeume, neu) {
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
        knopf('Übliche Positionen laden', () => vorlageLaden(neu)),
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

  // Nach Gewerk gruppieren, das ist die Ordnung, in der man ein Bauprojekt denkt.
  const gewerke = [...new Set(gerechnet.map((p) => p.gewerk || 'Sonstiges'))]
    .sort((a, b) => GEWERKE.indexOf(a) - GEWERKE.indexOf(b));

  for (const gewerk of gewerke) {
    const drin = gerechnet.filter((p) => (p.gewerk || 'Sonstiges') === gewerk);
    const summeGeplant = drin.reduce((s, p) => s + p.geplant, 0);
    const summeEcht = drin.reduce((s, p) => s + p.massgeblich, 0);

    rahmen.append(
      karte([
        el('h2', { text: gewerk }),
        el('p', {
          klasse: 'unterzeile',
          text: `geplant ${eur.format(summeGeplant)}, tatsächlich ${eur.format(summeEcht)}`,
        }),
        el('ul', { klasse: 'liste' }, drin.map((p) => {
          const kontakt = kontakte.find((k) => k.id === p.kontaktId);
          return el('li', {}, [
            el('button', { klasse: 'listenzeile', onclick: () => postenBearbeiten(p, kontakte, raeume, neu) }, [
              el('span', { klasse: 'zeilen-text' }, [
                el('span', { klasse: 'zeilen-titel', text: p.name }),
                el('span', {
                  klasse: 'zeilen-unter',
                  text: [
                    kontakt ? (kontakt.firma || kontakt.name) : null,
                    `geplant ${eur.format(p.geplant)}`,
                    p.tatsaechlich ? `tatsächlich ${eur.format(p.tatsaechlich)}` : null,
                    p.gezahlt ? `bezahlt ${eur.format(p.gezahlt)}` : null,
                  ].filter(Boolean).join(' · '),
                }),
              ]),
              el('span', { klasse: 'zeilen-wert', stil: { textAlign: 'right' } }, [
                abweichung(p.differenz),
                el('br'),
                el('span', { klasse: 'marke ' + p.marke, text: p.statusName }),
              ]),
            ]),
          ]);
        })),
      ])
    );
  }

  rahmen.append(
    knopf('Position hinzufügen', () => postenBearbeiten({}, kontakte, raeume, neu), 'knopf-haupt'),
    knopf('Übliche Positionen ergänzen', () => vorlageLaden(neu), 'knopf-leise')
  );
}

// Die Posten, die bei fast jedem Neubau vorkommen. Betraege bleiben leer:
// Zahlen zu raten waere schlimmer, als sie fehlen zu lassen.
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

async function vorlageLaden(nachher) {
  if (!window.confirm(`${VORLAGE.length} übliche Positionen anlegen? Beträge bleiben leer.`)) return;
  const vorhanden = new Set((await daten.alle('posten')).map((p) => p.name));
  let angelegt = 0;
  for (const [name, gewerk] of VORLAGE) {
    if (vorhanden.has(name)) continue;
    await daten.sichern('posten', {
      name, gewerk, kontaktId: null, geplant: 0, tatsaechlich: 0,
      status: 'geplant', notiz: '',
    });
    angelegt++;
  }
  melde(angelegt ? `${angelegt} Positionen angelegt.` : 'Alles war schon da.');
  await nachher();
}

function postenBearbeiten(posten, kontakte, raeume, nachher) {
  const name = eingabe({ value: posten.name || '', placeholder: 'z. B. Elektroinstallation' });
  const gewerk = auswahl(GEWERKE.map((g) => [g, g]), posten.gewerk || 'Sonstiges');
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

  blattOeffnen(
    posten.id ? 'Position bearbeiten' : 'Position anlegen',
    [
      feld('Bezeichnung', name),
      feld('Gewerk', gewerk),
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
        name: name.value.trim(),
        gewerk: gewerk.value,
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
