// Angebotsvergleich.
//
// Ein Angebot allein sagt nichts. Erst das zweite und dritte zeigen, ob der
// Preis stimmt. Deshalb ist die Spanne zwischen teuerstem und guenstigstem
// Angebot hier die wichtigste Zahl und nicht der Einzelbetrag.
//
// Angebote haengen an einer Kostenposition der Baukasse. Wird eines
// beauftragt, wandert sein Betrag als tatsaechliche Kosten in die Position.
// Damit steht die Auftragssumme genau einmal in der App und kann nicht
// zwischen zwei Bildschirmen auseinanderlaufen.

import {
  el, eur, feld, eingabe, zahlfeld, auswahl, knopf, karte, kopfzeile,
  hinweisKasten, leerzustand, zuZahl, melde, datumLang, heute, zahl,
} from '../hilfen.js';
import { daten, bildUrl, bildLoeschen, einstellung } from '../daten.js';
import { blattOeffnen } from '../blatt.js';
import { fotofeld } from '../fotos.js';
import { Blatt, pdfTeilen } from '../pdf.js';
import { csvTeilen } from '../csv.js';

export const ANGEBOT_STATUS = {
  offen: { name: 'Offen', marke: 'marke-offen' },
  beauftragt: { name: 'Beauftragt', marke: 'marke-fertig' },
  abgelehnt: { name: 'Abgelehnt', marke: 'marke-geplant' },
};

/**
 * Wertet die Angebote einer Position aus.
 *
 * Abgelehnte zaehlen beim Vergleich nicht mit: Wer ein Angebot verworfen hat,
 * will die Spanne der ernsthaften Bewerber sehen und nicht die des
 * Ausreissers, den er schon aussortiert hat. Sie bleiben trotzdem gespeichert,
 * damit spaeter nachvollziehbar ist, wer angefragt wurde.
 *
 * @returns {{
 *   anzahl: number, guenstigstes: object|null, teuerstes: object|null,
 *   beauftragt: object|null, spanne: number, spanneProzent: number,
 *   ersparnis: number
 * }}
 */
export function angeboteRechnen(angebote) {
  const zaehlend = angebote.filter((a) => a.status !== 'abgelehnt' && a.betrag > 0);
  const beauftragt = angebote.find((a) => a.status === 'beauftragt') || null;

  if (!zaehlend.length) {
    return {
      anzahl: 0, guenstigstes: null, teuerstes: null, beauftragt,
      spanne: 0, spanneProzent: 0, ersparnis: 0,
    };
  }

  const sortiert = [...zaehlend].sort((a, b) => a.betrag - b.betrag);
  const guenstigstes = sortiert[0];
  const teuerstes = sortiert[sortiert.length - 1];
  const spanne = teuerstes.betrag - guenstigstes.betrag;

  return {
    anzahl: zaehlend.length,
    guenstigstes,
    teuerstes,
    beauftragt,
    spanne,
    // Bezugsgroesse ist das guenstigste Angebot: "das teuerste liegt 30 %
    // darueber" ist die Aussage, die man beim Verhandeln braucht.
    spanneProzent: guenstigstes.betrag > 0 ? (spanne / guenstigstes.betrag) * 100 : 0,
    // Was der Vergleich gebracht hat, sobald beauftragt wurde.
    ersparnis: beauftragt ? teuerstes.betrag - beauftragt.betrag : spanne,
  };
}

export async function zeige(rahmen) {
  await zeichne(rahmen);
}

async function zeichne(rahmen) {
  rahmen.replaceChildren();

  const [posten, angebote, kontakte] = await Promise.all([
    daten.alle('posten'), daten.alle('angebote'), daten.alle('kontakte'),
  ]);
  const neu = () => zeichne(rahmen);

  rahmen.append(kopfzeile('Angebote', 'Mehrere Angebote je Position nebeneinander legen.'));

  if (!posten.length) {
    rahmen.append(
      karte([
        leerzustand(
          'Erst die Positionen, dann die Angebote',
          'Ein Angebot gehört immer zu einer Kostenposition, etwa Rohbau oder Elektro. ' +
            'Lege die Positionen in der Baukasse an, danach hängst du hier die Angebote daran.'
        ),
        knopf('Zur Baukasse', () => { location.hash = '#/baukasse'; }, 'knopf-haupt'),
      ])
    );
    return;
  }

  // Nur Positionen zeigen, zu denen es Angebote gibt, plus einen Weg, welche
  // anzulegen. Alle 26 Vorlagepositionen mit "0 Angebote" waeren nur Rauschen.
  const jePosten = posten
    .map((p) => {
      const drin = angebote.filter((a) => a.postenId === p.id);
      return { posten: p, angebote: drin, ...angeboteRechnen(drin) };
    })
    .filter((g) => g.angebote.length)
    .sort((a, b) => b.spanne - a.spanne);

  const ohneZuordnung = angebote.filter((a) => !posten.some((p) => p.id === a.postenId));

  rahmen.append(
    karte([
      el('h2', { text: 'Angebot erfassen' }),
      knopf('Angebot hinzufügen', () =>
        angebotBearbeiten({ datum: heute(), status: 'offen' }, posten, kontakte, neu), 'knopf-haupt'),
      el('p', {
        klasse: 'unterzeile', stil: { marginTop: '10px' },
        text: 'Fotografiere das Angebot gleich mit. Beim Verhandeln willst du die ' +
          'Positionen zur Hand haben, nicht nur die Endsumme.',
      }),
    ])
  );

  if (!jePosten.length) {
    rahmen.append(
      hinweisKasten(
        'Noch kein Angebot erfasst. Hol dir je Gewerk mindestens drei. Die Spanne ' +
          'zwischen dem günstigsten und dem teuersten Angebot liegt am Bau ' +
          'regelmäßig im zweistelligen Prozentbereich.',
        'info'
      )
    );
    return;
  }

  const gesamtErsparnis = jePosten.reduce((s, g) => s + g.ersparnis, 0);
  const einzeln = jePosten.filter((g) => g.anzahl === 1);

  rahmen.append(
    karte([
      el('h2', { text: 'Stand' }),
      el('p', {
        klasse: 'unterzeile',
        text: `${angebote.length} Angebote zu ${jePosten.length} Positionen.`,
      }),
      gesamtErsparnis > 0
        ? el('div', { klasse: 'wertzeile stark' }, [
            el('span', { text: 'Abstand zum teuersten Angebot' }),
            el('strong', { klasse: 'weniger', text: eur.format(gesamtErsparnis) }),
          ])
        : null,
    ])
  );

  if (einzeln.length) {
    rahmen.append(
      hinweisKasten(
        `Zu ${einzeln.length} ${einzeln.length === 1 ? 'Position liegt' : 'Positionen liegt'} ` +
          'nur ein Angebot vor: ' + einzeln.map((g) => g.posten.name).join(', ') +
          '. Ein Angebot ist kein Vergleich.',
        'warn'
      )
    );
  }

  for (const gruppe of jePosten) {
    rahmen.append(gruppenkarte(gruppe, posten, kontakte, neu));
  }

  if (ohneZuordnung.length) {
    rahmen.append(
      hinweisKasten(
        `${ohneZuordnung.length} Angebote hängen an einer gelöschten Position. ` +
          'Öffne sie und ordne sie neu zu.',
        'warn'
      ),
      karte([
        el('h2', { text: 'Ohne Position' }),
        el('ul', { klasse: 'liste' }, ohneZuordnung.map((a) =>
          el('li', {}, [
            el('button', {
              klasse: 'listenzeile',
              onclick: () => angebotBearbeiten(a, posten, kontakte, neu),
            }, [
              el('span', { klasse: 'zeilen-text' }, [
                el('span', { klasse: 'zeilen-titel', text: a.firma || 'Angebot' }),
                el('span', { klasse: 'zeilen-unter', text: datumLang(a.datum) }),
              ]),
              el('span', { klasse: 'zeilen-wert', text: eur.format(a.betrag) }),
            ]),
          ])
        )),
      ])
    );
  }

  rahmen.append(
    knopf('Vergleich als PDF teilen', () => pdfErzeugen(jePosten, kontakte)),
    knopf('Angebote als CSV', () => csvErzeugen(angebote, posten, kontakte), 'knopf-leise')
  );
}

function gruppenkarte(gruppe, posten, kontakte, neu) {
  const { posten: p, angebote, guenstigstes, spanne, spanneProzent, beauftragt } = gruppe;
  const sortiert = [...angebote].sort((a, b) => (a.betrag || 0) - (b.betrag || 0));

  return karte([
    el('h2', { text: p.name }),
    el('p', {
      klasse: 'unterzeile',
      // Wenn Angebote abgelehnt wurden, stehen mehr in der Liste als im
      // Vergleich. Ohne diesen Zusatz wirkt die Zahl darueber falsch.
      text: [
        gruppe.anzahl === angebote.length
          ? `${gruppe.anzahl} ${gruppe.anzahl === 1 ? 'Angebot' : 'Angebote im Vergleich'}`
          : `${gruppe.anzahl} von ${angebote.length} Angeboten im Vergleich`,
        p.geplant ? `geplant ${eur.format(p.geplant)}` : null,
      ].filter(Boolean).join(' · '),
    }),

    spanne > 0
      ? el('div', { klasse: 'wertzeile' }, [
          el('span', { text: 'Spanne' }),
          el('strong', {}, [
            eur.format(spanne) + '  ',
            el('span', { klasse: 'mehr', text: '+' + zahl(spanneProzent, 0) + ' %' }),
          ]),
        ])
      : null,

    el('ul', { klasse: 'liste' }, sortiert.map((a) => {
      const kontakt = kontakte.find((k) => k.id === a.kontaktId);
      const zustand = ANGEBOT_STATUS[a.status] || ANGEBOT_STATUS.offen;
      const istGuenstigstes = guenstigstes && a.id === guenstigstes.id;
      const ueber = guenstigstes && a.betrag > guenstigstes.betrag
        ? a.betrag - guenstigstes.betrag
        : 0;

      return el('li', {}, [
        el('button', {
          klasse: 'listenzeile',
          onclick: () => angebotBearbeiten(a, posten, kontakte, neu),
        }, [
          el('span', { klasse: 'zeilen-text' }, [
            el('span', {
              klasse: 'zeilen-titel',
              text: (istGuenstigstes && a.status !== 'abgelehnt' ? '★ ' : '') +
                (a.firma || (kontakt ? kontakt.firma || kontakt.name : 'Angebot')),
            }),
            el('span', {
              klasse: 'zeilen-unter',
              text: [
                datumLang(a.datum),
                a.gueltigBis ? 'gültig bis ' + datumLang(a.gueltigBis) : null,
                ueber ? '+' + eur.format(ueber) + ' gegenüber dem günstigsten' : null,
              ].filter(Boolean).join(' · '),
            }),
          ]),
          el('span', { klasse: 'zeilen-wert', stil: { textAlign: 'right' } }, [
            eur.format(a.betrag),
            el('br'),
            el('span', { klasse: 'marke ' + zustand.marke, text: zustand.name }),
          ]),
        ]),
      ]);
    })),

    beauftragt
      ? el('p', {
          klasse: 'unterzeile',
          text: 'Beauftragt: ' + (beauftragt.firma || 'ohne Firmenangabe') +
            ' für ' + eur.format(beauftragt.betrag) +
            '. Der Betrag steht als tatsächliche Kosten in der Baukasse.',
        })
      : knopf('Günstigstes beauftragen', () => beauftragen(guenstigstes, angebote, p, neu), 'knopf-leise'),
  ]);
}

/**
 * Traegt den Auftrag ein: Das gewaehlte Angebot wird beauftragt, die anderen
 * derselben Position abgelehnt, und der Betrag wandert in die Position.
 */
async function beauftragen(angebot, geschwister, posten, nachher) {
  if (!angebot) return;
  const firma = angebot.firma || 'diese Firma';
  if (!window.confirm(
    `${firma} für ${eur.format(angebot.betrag)} beauftragen?\n\n` +
    'Der Betrag wird als tatsächliche Kosten in die Position "' + posten.name + '" ' +
    'übernommen. Die übrigen Angebote werden als abgelehnt markiert.'
  )) return;

  for (const a of geschwister) {
    const status = a.id === angebot.id ? 'beauftragt' : 'abgelehnt';
    if (a.status === status) continue;
    await daten.sichern('angebote', { ...a, status });
  }

  await daten.sichern('posten', {
    ...posten,
    tatsaechlich: angebot.betrag,
    status: 'beauftragt',
    kontaktId: angebot.kontaktId || posten.kontaktId || null,
  });

  melde('Beauftragt und in die Baukasse übernommen.');
  await nachher();
}

// -------------------------------------------------------------------- Eingabe

function angebotBearbeiten(angebot, posten, kontakte, nachher) {
  const zuPosten = auswahl(
    [['', '– bitte wählen –'], ...posten
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
      .map((p) => [p.id, p.name])],
    angebot.postenId ?? ''
  );
  const firma = eingabe({ value: angebot.firma || '', placeholder: 'Firma laut Angebot' });
  const kontakt = auswahl(
    [['', '– kein Kontakt –'], ...kontakte
      .filter((k) => (k.art || 'firma') === 'firma')
      .map((k) => [k.id, k.firma || k.name])],
    angebot.kontaktId ?? ''
  );
  const betrag = zahlfeld({ value: angebot.betrag ? String(angebot.betrag).replace('.', ',') : '' });
  const datum = el('input', { type: 'date', value: angebot.datum || heute() });
  const gueltig = el('input', { type: 'date', value: angebot.gueltigBis || '' });
  const status = auswahl(
    Object.entries(ANGEBOT_STATUS).map(([w, z]) => [w, z.name]),
    angebot.status || 'offen'
  );
  const notiz = el('textarea', {}, [angebot.notiz || '']);

  const bilder = angebot.bildId ? [angebot.bildId] : [];
  const fotos = fotofeld(bilder, () => {}, { text: 'Angebot fotografieren', mehrere: false });

  blattOeffnen(
    angebot.id ? 'Angebot bearbeiten' : 'Angebot erfassen',
    [
      feld('Gehört zu Position', zuPosten, 'Nur zusammen mit einer Position lässt sich vergleichen.'),
      feld('Firma', firma),
      feld('Zugeordneter Kontakt', kontakt, 'Wird beim Beauftragen in die Position übernommen.'),
      feld('Angebotssumme in €', betrag, 'Brutto, damit die Angebote vergleichbar bleiben.'),
      feld('Datum des Angebots', datum),
      feld('Gültig bis', gueltig, 'Steht meist im Angebot. Danach ist der Preis nicht mehr bindend.'),
      feld('Status', status),
      feld('Notiz', notiz, 'Was ist enthalten, was fehlt? Genau daran scheitern Vergleiche.'),
      el('span', { klasse: 'feld-name', text: 'Angebot als Foto oder PDF' }),
      fotos,
    ],
    async () => {
      const wert = {
        postenId: zuPosten.value || null,
        firma: firma.value.trim(),
        kontaktId: kontakt.value || null,
        betrag: Math.max(0, zuZahl(betrag.value)),
        datum: datum.value || heute(),
        gueltigBis: gueltig.value || null,
        status: status.value,
        notiz: notiz.value.trim(),
        bildId: bilder[0] ?? null,
      };
      if (!wert.postenId) throw new Error('Bitte eine Position wählen.');
      if (wert.betrag <= 0) throw new Error('Bitte die Angebotssumme eintragen.');
      if (!wert.firma && !wert.kontaktId) throw new Error('Bitte eintragen, von wem das Angebot ist.');
      if (angebot.id) wert.id = angebot.id;
      await daten.sichern('angebote', wert);
      await nachher();
    },
    {
      loeschen: angebot.id
        ? async () => {
            if (angebot.bildId) await bildLoeschen(angebot.bildId);
            await daten.loeschen('angebote', angebot.id);
            await nachher();
          }
        : null,
    }
  );
}

// -------------------------------------------------------------------- Ausgabe

async function pdfErzeugen(jePosten, kontakte) {
  melde('PDF wird erstellt …');
  const projekt = (await einstellung('projektname')) || '';
  const blatt = new Blatt({
    titel: 'Angebotsvergleich',
    untertitel: (projekt ? projekt + ' · ' : '') + 'Stand ' + datumLang(heute()),
    fusszeile: 'Angebotsvergleich',
  });

  const gesamt = jePosten.reduce((s, g) => s + g.ersparnis, 0);
  blatt.absatz(
    `${jePosten.length} Positionen mit Angeboten. Die Spanne ist der Abstand zwischen ` +
      'dem günstigsten und dem teuersten Angebot einer Position. Abgelehnte Angebote ' +
      'zählen dabei nicht mit.'
  );
  if (gesamt > 0) {
    blatt.wertzeile('Abstand zum jeweils teuersten Angebot', eur.format(gesamt), true);
  }

  for (const g of jePosten) {
    blatt.ueberschrift(g.posten.name);
    if (g.spanne > 0) {
      blatt.wertzeile(
        'Spanne',
        eur.format(g.spanne) + ' (' + zahl(g.spanneProzent, 0) + ' % über dem günstigsten)'
      );
    }
    blatt.tabelle(
      ['Firma', 'Datum', 'Gültig bis', 'Status', 'Summe'],
      [...g.angebote]
        .sort((a, b) => (a.betrag || 0) - (b.betrag || 0))
        .map((a) => {
          const kontakt = kontakte.find((k) => k.id === a.kontaktId);
          return [
            a.firma || (kontakt ? kontakt.firma || kontakt.name : ''),
            datumLang(a.datum),
            a.gueltigBis ? datumLang(a.gueltigBis) : '',
            (ANGEBOT_STATUS[a.status] || ANGEBOT_STATUS.offen).name,
            eur.format(a.betrag),
          ];
        }),
      [2.6, 1.2, 1.2, 1.2, 1.4],
      [4]
    );
  }

  blatt.absatz(
    'Angebote sind nur vergleichbar, wenn sie denselben Leistungsumfang haben. ' +
      'Prüfe vor der Entscheidung, was im günstigsten Angebot fehlt.',
    9
  );

  try {
    await pdfTeilen(blatt.blob(), 'angebotsvergleich.pdf', 'Angebotsvergleich');
  } catch (fehler) {
    melde('PDF konnte nicht geteilt werden.');
    console.error(fehler);
  }
}

async function csvErzeugen(angebote, posten, kontakte) {
  try {
    await csvTeilen(
      ['Position', 'Firma', 'Kontakt', 'Summe', 'Datum', 'Gültig bis', 'Status', 'Notiz'],
      [...angebote]
        .sort((a, b) => String(a.datum).localeCompare(String(b.datum)))
        .map((a) => {
          const p = posten.find((x) => x.id === a.postenId);
          const kontakt = kontakte.find((k) => k.id === a.kontaktId);
          return [
            p ? p.name : '',
            a.firma || '',
            kontakt ? kontakt.firma || kontakt.name : '',
            a.betrag || 0,
            a.datum || '',
            a.gueltigBis || '',
            (ANGEBOT_STATUS[a.status] || ANGEBOT_STATUS.offen).name,
            a.notiz || '',
          ];
        }),
      'angebote.csv',
      'Angebote'
    );
  } catch (fehler) {
    melde('CSV konnte nicht geteilt werden.');
    console.error(fehler);
  }
}
