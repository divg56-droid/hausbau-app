// Raeume als eigene Einheit.
//
// Bisher war ein Raum nur ein Wort im Mangel. Als eigener Datensatz wird er
// die Stelle, an der alles zusammenlaeuft: Fotos vom Zustand, offene Maengel,
// und was der Raum gekostet hat.
//
// Der Nutzen kommt spaeter: Bei einer Renovierung in zehn Jahren steht hier,
// wie es hinter dem Putz aussah und wer was gemacht hat.

import {
  el, eur, feld, eingabe, zahlfeld, auswahl, knopf, karte, kopfzeile,
  wertzeile, hinweisKasten, leerzustand, zuZahl, melde, datumLang, zahl,
  anhaengen,
} from '../hilfen.js';
import { daten, bildUrl, bildLoeschen } from '../daten.js';
import { blattOeffnen } from '../blatt.js';
import { fotofeld } from '../fotos.js';
import { zeichen, raumZeichen } from '../zeichen.js';
import { STATUS } from './maengel.js';
import { postenRechnen } from './baukasse.js';

// Was in fast jedem Haus vorkommt. Nur ein Vorschlag beim Anlegen.
export const RAUM_VORSCHLAEGE = [
  'Wohnzimmer', 'Küche', 'Esszimmer', 'Flur', 'Bad', 'Gäste-WC',
  'Schlafzimmer', 'Kinderzimmer 1', 'Kinderzimmer 2', 'Arbeitszimmer',
  'Hauswirtschaftsraum', 'Technikraum', 'Keller', 'Dachboden',
  'Garage', 'Treppenhaus', 'Terrasse', 'Außenanlage',
];

/**
 * Zieht Raeume aus den Maengeln nach.
 *
 * Frueher stand der Raum als Wort im Mangel. Damit vorhandene Daten nicht
 * verloren gehen, wird daraus beim ersten Oeffnen ein richtiger Raum, und der
 * Mangel bekommt die Kennung dazu. Laeuft beliebig oft, ohne Schaden.
 *
 * @returns {Promise<number>} wie viele Raeume neu entstanden sind
 */
export async function raeumeNachziehen() {
  const [raeume, maengel] = await Promise.all([daten.alle('raeume'), daten.alle('maengel')]);
  const nachName = new Map(raeume.map((r) => [r.name.toLowerCase(), r]));
  let angelegt = 0;

  for (const m of maengel) {
    const name = String(m.raum || '').trim();
    if (!name || m.raumId) continue;

    let raum = nachName.get(name.toLowerCase());
    if (!raum) {
      const id = await daten.sichern('raeume', {
        name, geschossId: null, flaeche: 0, notiz: '', bildIds: [],
      });
      raum = { id, name };
      nachName.set(name.toLowerCase(), raum);
      angelegt++;
    }
    await daten.sichern('maengel', { ...m, raumId: raum.id });
  }
  return angelegt;
}

/** Findet einen Raum nach Namen oder legt ihn an. Fuer die Mängelmaske. */
export async function raumHolen(name) {
  const sauber = String(name || '').trim();
  if (!sauber) return null;
  const raeume = await daten.alle('raeume');
  const treffer = raeume.find((r) => r.name.toLowerCase() === sauber.toLowerCase());
  if (treffer) return treffer.id;
  return daten.sichern('raeume', {
    name: sauber, geschossId: null, flaeche: 0, notiz: '', bildIds: [],
  });
}

export async function zeige(rahmen) {
  // #/raeume/<kennung> zeigt einen einzelnen Raum.
  const teile = location.hash.replace(/^#\/?/, '').split('/');
  if (teile[1]) return zeigeRaum(rahmen, teile[1]);
  await zeichne(rahmen);
}

// ------------------------------------------------------------------- Liste

async function zeichne(rahmen) {
  rahmen.replaceChildren();

  const nachgezogen = await raeumeNachziehen();
  const [raeume, maengel, posten, belege, geschosse] = await Promise.all([
    daten.alle('raeume'), daten.alle('maengel'), daten.alle('posten'),
    daten.alle('belege'), daten.alle('geschosse'),
  ]);

  const neu = () => zeichne(rahmen);

  anhaengen(rahmen, kopfzeile('Räume', 'Fotos, Mängel und Kosten je Raum.'));

  if (nachgezogen) {
    anhaengen(
      rahmen,
      hinweisKasten(
        `${nachgezogen} Raum/Räume aus deinen Mängeln übernommen. Die Zuordnung bleibt erhalten.`,
        'gut'
      )
    );
  }

  if (!raeume.length) {
    anhaengen(
      rahmen,
      karte([
        leerzustand(
          'Noch keine Räume',
          'Lege die Räume deines Hauses an. Danach hängen Mängel, Kosten und Fotos ' +
            'daran, und du siehst je Raum, was passiert ist und was er gekostet hat.'
        ),
        knopf('Übliche Räume anlegen', () => vorlageLaden(neu), 'knopf-haupt'),
        knopf('Einzelnen Raum anlegen', () => raumBearbeiten({}, geschosse, neu)),
      ]),
      hinweisKasten(
        'Der Nutzen kommt später: Bei einer Renovierung in zehn Jahren steht hier, ' +
          'wie es hinter dem Putz aussah und wer was gemacht hat.',
        'info'
      )
    );
    return;
  }

  // Nach Geschoss gruppieren, wenn welche angelegt sind.
  const gruppen = geschosse.length
    ? [...geschosse, { id: null, name: 'Ohne Geschoss' }]
    : [{ id: null, name: null }];

  for (const g of gruppen) {
    const drin = raeume.filter((r) => (r.geschossId || null) === g.id);
    if (!drin.length) continue;

    const zeilen = await Promise.all(
      drin.sort((a, b) => a.name.localeCompare(b.name, 'de')).map(async (r) => {
        const url = (r.bildIds || []).length ? await bildUrl(r.bildIds[0]) : null;
        const offen = maengel.filter((m) => m.raumId === r.id && m.status !== 'behoben').length;
        const kosten = posten
          .filter((p) => p.raumId === r.id)
          .reduce((s, p) => s + postenRechnen(p, belege).massgeblich, 0);

        // Die Zeile oeffnet den Raum, die Knoepfe rechts aendern ihn. Beides
        // in einer Schaltflaeche waere ein Klick, der zweierlei tut.
        return el('li', {}, [
          el('div', { klasse: 'raumzeile' }, [
            el('button', {
              klasse: 'listenzeile',
              onclick: () => { location.hash = '#/raeume/' + r.id; },
            }, [
              // Ein Foto sagt mehr als ein Zeichen, ein Zeichen mehr als ein
              // leeres graues Kaestchen.
              url
                ? el('img', { klasse: 'vorschau', src: url, alt: '' })
                : el('span', { klasse: 'vorschau vorschau-zeichen' }, [
                    zeichen(raumZeichen(r.name), { groesse: 26 }),
                  ]),
              el('span', { klasse: 'zeilen-text' }, [
                el('span', { klasse: 'zeilen-titel', text: r.name }),
                el('span', {
                  klasse: 'zeilen-unter',
                  text: [
                    r.flaeche ? zahl(r.flaeche, 1) + ' m²' : null,
                    (r.bildIds || []).length ? (r.bildIds || []).length + ' Fotos' : null,
                    kosten ? eur.format(kosten) : null,
                  ].filter(Boolean).join(' · ') || 'noch nichts erfasst',
                }),
              ]),
              offen
                ? el('span', { klasse: 'marke marke-offen', text: offen + ' offen' })
                : null,
            ]),
            el('span', { klasse: 'zeilen-aktionen' }, [
              el('button', {
                klasse: 'knopf knopf-schmal', type: 'button', text: 'Öffnen',
                onclick: () => { location.hash = '#/raeume/' + r.id; },
              }),
              el('button', {
                klasse: 'knopf knopf-schmal', type: 'button', text: 'Ändern',
                onclick: () => raumBearbeiten(r, geschosse, neu),
              }),
            ]),
          ]),
        ]);
      })
    );

    anhaengen(rahmen, karte([
      g.name ? el('h2', { text: g.name }) : null,
      el('ul', { klasse: 'liste' }, zeilen),
    ].filter(Boolean)));
  }

  const gesamtflaeche = raeume.reduce((s, r) => s + (r.flaeche || 0), 0);
  if (gesamtflaeche) {
    anhaengen(
      rahmen,
      karte([
        wertzeile('Erfasste Fläche', zahl(gesamtflaeche, 1) + ' m²', true),
        el('p', {
          klasse: 'unterzeile',
          text: 'Summe der eingetragenen Räume. Nicht zu verwechseln mit der ' +
                'Wohnfläche nach Wohnflächenverordnung; die rechnet Dachschrägen ' +
                'und Balkone anders.',
        }),
      ])
    );
  }

  anhaengen(
    rahmen,
    knopf('Raum hinzufügen', () => raumBearbeiten({}, geschosse, neu), 'knopf-haupt'),
    knopf('Übliche Räume ergänzen', () => vorlageLaden(neu), 'knopf-leise')
  );
}

async function vorlageLaden(nachher) {
  if (!window.confirm(`${RAUM_VORSCHLAEGE.length} übliche Räume anlegen?`)) return;
  const vorhanden = new Set((await daten.alle('raeume')).map((r) => r.name.toLowerCase()));
  let angelegt = 0;
  for (const name of RAUM_VORSCHLAEGE) {
    if (vorhanden.has(name.toLowerCase())) continue;
    await daten.sichern('raeume', { name, geschossId: null, flaeche: 0, notiz: '', bildIds: [] });
    angelegt++;
  }
  melde(angelegt ? `${angelegt} Räume angelegt.` : 'Alles war schon da.');
  await nachher();
}

// ------------------------------------------------------------- Einzelansicht

async function zeigeRaum(rahmen, kennung) {
  rahmen.replaceChildren();

  const raum = await daten.holen('raeume', kennung);
  if (!raum) {
    anhaengen(
      rahmen,
      karte([leerzustand('Diesen Raum gibt es nicht mehr', 'Vielleicht wurde er gelöscht.',
        knopf('Zur Übersicht', () => { location.hash = '#/raeume'; }, 'knopf-haupt'))]),
    );
    return;
  }

  const [maengel, posten, belege, geschosse, kontakte] = await Promise.all([
    daten.alle('maengel'), daten.alle('posten'), daten.alle('belege'),
    daten.alle('geschosse'), daten.alle('kontakte'),
  ]);

  const neu = () => zeigeRaum(rahmen, kennung);
  const geschoss = geschosse.find((g) => g.id === raum.geschossId);
  const eigeneMaengel = maengel.filter((m) => m.raumId === raum.id);
  const eigenePosten = posten.filter((p) => p.raumId === raum.id)
    .map((p) => ({ ...p, ...postenRechnen(p, belege) }));

  anhaengen(
    rahmen,
    kopfzeile(raum.name, [
      geschoss ? geschoss.name : null,
      raum.flaeche ? zahl(raum.flaeche, 1) + ' m²' : null,
    ].filter(Boolean).join(' · ') || 'ohne weitere Angaben')
  );

  // Fotos: der eigentliche Grund fuer diese Ansicht.
  const bilder = [...(raum.bildIds || [])];
  anhaengen(
    rahmen,
    karte([
      el('h2', { text: 'Fotos' }),
      el('p', {
        klasse: 'unterzeile',
        text: 'Vor dem Verputzen fotografieren lohnt sich am meisten. Was dann ' +
              'verschwindet, sieht man sonst nie wieder.',
      }),
      fotofeld(bilder, async (ids) => {
        await daten.sichern('raeume', { ...raum, bildIds: [...ids] });
      }, { text: 'Foto vom Raum' }),
    ])
  );

  if (raum.notiz) {
    anhaengen(rahmen, karte([el('h2', { text: 'Notiz' }), el('p', { text: raum.notiz })]));
  }

  // Maengel in diesem Raum
  anhaengen(
    rahmen,
    karte([
      el('h2', { text: `Mängel (${eigeneMaengel.length})` }),
      eigeneMaengel.length
        ? el('ul', { klasse: 'liste' }, eigeneMaengel
            .sort((a, b) => String(b.angelegt).localeCompare(String(a.angelegt)))
            .map((m) => {
              const kontakt = kontakte.find((k) => k.id === m.kontaktId);
              return el('li', {}, [
                el('div', { klasse: 'listenzeile', stil: { cursor: 'default' } }, [
                  el('span', { klasse: 'zeilen-text' }, [
                    el('span', { klasse: 'zeilen-titel', text: m.titel }),
                    el('span', {
                      klasse: 'zeilen-unter',
                      text: [m.gewerk, kontakt ? kontakt.name : null, datumLang(m.angelegt)]
                        .filter(Boolean).join(' · '),
                    }),
                  ]),
                  el('span', { klasse: 'marke ' + STATUS[m.status].marke, text: STATUS[m.status].kurz }),
                ]),
              ]);
            }))
        : el('p', { klasse: 'unterzeile', text: 'Kein Mangel in diesem Raum.' }),
      knopf('Zur Mängelliste', () => { location.hash = '#/maengel'; }, 'knopf-leise'),
    ])
  );

  // Kosten dieses Raums
  const summe = eigenePosten.reduce((s, p) => s + p.massgeblich, 0);
  anhaengen(
    rahmen,
    karte([
      el('h2', { text: 'Kosten' }),
      eigenePosten.length
        ? el('div', {}, [
            ...eigenePosten.map((p) => wertzeile(p.name, eur.format(p.massgeblich))),
            wertzeile('Zusammen', eur.format(summe), true),
            raum.flaeche
              ? el('p', {
                  klasse: 'unterzeile',
                  text: `entspricht ${eur.format(summe / raum.flaeche)} je m²`,
                })
              : null,
          ].filter(Boolean))
        : el('p', {
            klasse: 'unterzeile',
            text: 'Keine Kostenposition diesem Raum zugeordnet. In der '  +
                  'Kostenaufstellung lässt sich das bei der Position einstellen.',
          }),
      knopf('Zur Kostenaufstellung', () => { location.hash = '#/baukasse/kosten'; }, 'knopf-leise'),
    ])
  );

  anhaengen(
    rahmen,
    knopf('Raum bearbeiten', () => raumBearbeiten(raum, geschosse, neu), 'knopf-haupt'),
    knopf('Zurück zur Übersicht', () => { location.hash = '#/raeume'; })
  );
}

// ----------------------------------------------------------------- Bearbeiten

function raumBearbeiten(raum, geschosse, nachher) {
  const name = el('input', {
    type: 'text', value: raum.name || '', list: 'raumnamen', placeholder: 'z. B. Wohnzimmer',
  });
  const liste = el('datalist', { id: 'raumnamen' },
    RAUM_VORSCHLAEGE.map((r) => el('option', { value: r })));
  const geschoss = auswahl(
    [['', '– kein Geschoss –'], ...geschosse.map((g) => [g.id, g.name])],
    raum.geschossId ?? ''
  );
  const flaeche = zahlfeld({ value: raum.flaeche ? String(raum.flaeche).replace('.', ',') : '' });
  const notiz = el('textarea', {}, [raum.notiz || '']);

  blattOeffnen(
    raum.id ? 'Raum bearbeiten' : 'Raum anlegen',
    [
      feld('Name', name),
      liste,
      feld('Geschoss', geschoss, 'Geschosse legst du im Anschlussplan an.'),
      feld('Fläche in m²', flaeche),
      feld('Notiz', notiz, 'Was man später wissen will: Wandaufbau, Besonderheiten, Wünsche.'),
    ],
    async () => {
      const wert = {
        name: name.value.trim(),
        geschossId: geschoss.value || null,
        flaeche: Math.max(0, zuZahl(flaeche.value)),
        notiz: notiz.value.trim(),
        bildIds: raum.bildIds || [],
      };
      if (!wert.name) throw new Error('Bitte einen Namen eintragen.');
      if (raum.id) wert.id = raum.id;
      await daten.sichern('raeume', wert);
      await nachher();
    },
    {
      loeschen: raum.id
        ? async () => {
            // Maengel und Kosten bleiben, verlieren nur die Zuordnung. Sie
            // mitzuloeschen waere falsch: Der Mangel ist ja nicht behoben,
            // nur weil der Raum aus der Liste verschwindet.
            for (const m of await daten.alle('maengel')) {
              if (m.raumId === raum.id) await daten.sichern('maengel', { ...m, raumId: null });
            }
            for (const p of await daten.alle('posten')) {
              if (p.raumId === raum.id) await daten.sichern('posten', { ...p, raumId: null });
            }
            for (const bildId of raum.bildIds || []) await bildLoeschen(bildId);
            await daten.loeschen('raeume', raum.id);
            location.hash = '#/raeume';
          }
        : null,
    }
  );
}
