// Bauhelfertagebuch.
//
// Zweck ist der Nachweis. Bei Streit mit einer Firma, bei einer Bauverzoegerung
// oder gegenueber der Bauhelferversicherung zaehlt, was am selben Tag notiert
// wurde. Deshalb ist das Datum Pflicht und je Tag nur ein Eintrag moeglich.

import {
  el, feld, auswahl, knopf, karte, kopfzeile, hinweisKasten,
  leerzustand, melde, datumLang, heute,
} from '../hilfen.js';
import { daten, einstellung, bildUrl, bildLoeschen } from '../daten.js';
import { blattOeffnen } from '../blatt.js';
import { fotofeld } from '../fotos.js';
import { Blatt, pdfTeilen, bildLaden } from '../pdf.js';

export const WETTER = {
  sonnig: 'Sonnig', bewoelkt: 'Bewölkt', regen: 'Regen',
  sturm: 'Sturm', schnee: 'Schnee', frost: 'Frost',
};

// Unter diesen Bedingungen ruhen Arbeiten regelmaessig. Das ist der Grund,
// warum das Wetter ueberhaupt im Tagebuch steht.
const WETTER_STOPP = ['regen', 'sturm', 'schnee', 'frost'];

export async function zeige(rahmen) {
  await zeichne(rahmen);
}

async function zeichne(rahmen) {
  rahmen.replaceChildren();
  const [eintraege, kontakte] = await Promise.all([daten.alle('tagebuch'), daten.alle('kontakte')]);
  const helfer = kontakte.filter((k) => k.art === 'helfer');
  const neu = () => zeichne(rahmen);

  rahmen.append(kopfzeile('Bauhelfertagebuch', 'Täglich festhalten, wer da war und was passiert ist.'));

  if (!helfer.length && !eintraege.length) {
    rahmen.append(
      karte([
        leerzustand(
          'Lege zuerst deine Helfer an',
          'Wer regelmäßig auf der Baustelle mithilft, gehört in die Kontakte. ' +
            'Danach hakst du im Tageseintrag nur noch ab, wer da war.'
        ),
        knopf('Helfer anlegen', () => { location.hash = '#/kontakte'; }, 'knopf-haupt'),
        knopf('Ohne Helfer beginnen', () => eintragBearbeiten({ datum: heute() }, helfer, eintraege, neu)),
      ]),
      hinweisKasten(
        'Wichtig für die Bauhelferversicherung: Wer unentgeltlich mithilft, muss bei der ' +
          'Berufsgenossenschaft gemeldet sein. Das Tagebuch belegt, wer wann im Einsatz war.',
        'info'
      )
    );
    return;
  }

  const sortiert = [...eintraege].sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
  const stunden = eintraege.reduce((s, e) => s + (e.helferIds || []).length, 0);

  rahmen.append(
    karte([
      el('h2', { text: 'Stand' }),
      el('p', {
        klasse: 'unterzeile',
        text: `${eintraege.length} ${eintraege.length === 1 ? 'Tageseintrag' : 'Tageseinträge'}, ` +
          `${stunden} ${stunden === 1 ? 'Helfereinsatz' : 'Helfereinsätze'}.` +
          (sortiert[0] ? ` Zuletzt ${datumLang(sortiert[0].datum)}.` : ''),
      }),
      knopf('Eintrag für heute', () => {
        const vorhanden = eintraege.find((e) => e.datum === heute());
        eintragBearbeiten(vorhanden || { datum: heute() }, helfer, eintraege, neu);
      }, 'knopf-haupt'),
    ])
  );

  if (sortiert.length) {
    rahmen.append(
      karte([
        el('h2', { text: 'Einträge' }),
        el('ul', { klasse: 'liste' }, await Promise.all(sortiert.map(async (e) => {
          const url = e.bildIds && e.bildIds.length ? await bildUrl(e.bildIds[0]) : null;
          const namen = (e.helferIds || [])
            .map((id) => (kontakte.find((k) => k.id === id) || {}).name)
            .filter(Boolean);
          return el('li', {}, [
            el('button', {
              klasse: 'listenzeile',
              onclick: () => eintragBearbeiten(e, helfer, eintraege, neu),
            }, [
              url ? el('img', { klasse: 'vorschau', src: url, alt: '' }) : el('span', { klasse: 'vorschau' }),
              el('span', { klasse: 'zeilen-text' }, [
                el('span', { klasse: 'zeilen-titel', text: datumLang(e.datum) }),
                el('span', {
                  klasse: 'zeilen-unter',
                  text: [
                    e.wetter ? WETTER[e.wetter] : null,
                    namen.length ? namen.join(', ') : 'niemand erfasst',
                    e.gemacht ? e.gemacht.slice(0, 40) : null,
                  ].filter(Boolean).join(' · '),
                }),
              ]),
              (e.bildIds || []).length
                ? el('span', { klasse: 'marke', text: (e.bildIds || []).length + ' Fotos' })
                : null,
            ]),
          ]);
        }))),
      ]),
      knopf('Tagebuch als PDF teilen', () => pdfErzeugen(sortiert, kontakte))
    );
  }
}

function eintragBearbeiten(eintrag, helfer, alleEintraege, nachher) {
  const datum = el('input', { type: 'date', value: eintrag.datum || heute() });
  const wetter = auswahl(
    [['', '– keine Angabe –'], ...Object.entries(WETTER)],
    eintrag.wetter || ''
  );
  const temperatur = el('input', {
    type: 'text', inputmode: 'numeric',
    value: eintrag.temperatur ?? '', placeholder: 'z. B. 4',
  });
  const gemacht = el('textarea', {}, [eintrag.gemacht || '']);
  const offen = el('textarea', {}, [eintrag.offen || '']);

  const gewaehlt = new Set(eintrag.helferIds || []);
  const helferliste = helfer.length
    ? el('div', {}, helfer.map((k) =>
        el('label', {
          stil: { display: 'flex', gap: '10px', alignItems: 'center', minHeight: '44px' },
        }, [
          el('input', {
            type: 'checkbox',
            checked: gewaehlt.has(k.id),
            onchange: (ereignis) => {
              if (ereignis.target.checked) gewaehlt.add(k.id);
              else gewaehlt.delete(k.id);
            },
          }),
          el('span', { text: k.name }),
        ])
      ))
    : el('p', { klasse: 'unterzeile', text: 'Noch keine Helfer in den Kontakten angelegt.' });

  const bilder = [...(eintrag.bildIds || [])];
  const fotos = fotofeld(bilder, () => {}, { text: 'Foto vom Baufortschritt' });

  blattOeffnen(
    eintrag.id ? 'Eintrag bearbeiten' : 'Tageseintrag',
    [
      feld('Tag', datum),
      feld('Wetter', wetter, 'Wichtig als Beleg, wenn Arbeiten warten mussten.'),
      feld('Temperatur in °C', temperatur),
      el('span', { klasse: 'feld-name', text: 'Wer war da?' }),
      helferliste,
      feld('Was wurde gemacht?', gemacht),
      feld('Was ist liegengeblieben?', offen),
      el('span', { klasse: 'feld-name', text: 'Fotos' }),
      fotos,
    ],
    async () => {
      const tag = datum.value || heute();
      const doppelt = alleEintraege.find((e) => e.datum === tag && e.id !== eintrag.id);
      if (doppelt) throw new Error('Für diesen Tag gibt es schon einen Eintrag.');

      const wert = {
        datum: tag,
        wetter: wetter.value || null,
        temperatur: temperatur.value.trim() || null,
        helferIds: [...gewaehlt],
        gemacht: gemacht.value.trim(),
        offen: offen.value.trim(),
        bildIds: bilder,
      };
      if (!wert.gemacht && !wert.helferIds.length && !bilder.length) {
        throw new Error('Bitte wenigstens eintragen, was gemacht wurde.');
      }
      if (eintrag.id) wert.id = eintrag.id;
      await daten.sichern('tagebuch', wert);

      if (WETTER_STOPP.includes(wert.wetter) && !wert.offen) {
        melde('Tipp: Bei diesem Wetter gehört ins Feld "liegengeblieben", was deshalb wartet.');
      }
      await nachher();
    },
    {
      loeschen: eintrag.id
        ? async () => {
            for (const bildId of eintrag.bildIds || []) await bildLoeschen(bildId);
            await daten.loeschen('tagebuch', eintrag.id);
            await nachher();
          }
        : null,
    }
  );
}

async function pdfErzeugen(eintraege, kontakte) {
  melde('PDF wird erstellt …');
  const projekt = (await einstellung('projektname')) || '';
  const blatt = new Blatt({
    titel: 'Bauhelfertagebuch',
    untertitel: (projekt ? projekt + ' · ' : '') + 'Stand ' + datumLang(heute()),
    fusszeile: 'Hausbau App · Bauhelfertagebuch',
  });

  // Aelteste zuerst: ein Nachweis liest sich chronologisch.
  const chronologisch = [...eintraege].sort((a, b) => String(a.datum).localeCompare(String(b.datum)));

  // Fotos vorab laden; der Schreiber braucht die Maße für den Seitenumbruch.
  const fotos = new Map();
  for (const e of chronologisch) {
    const geladen = [];
    for (const bildId of e.bildIds || []) {
      const eintrag = await daten.holen('bilder', bildId);
      const bild = eintrag ? await bildLaden(eintrag.blob) : null;
      if (bild) geladen.push(bild);
    }
    fotos.set(e.id, geladen);
  }

  const einsaetze = chronologisch.reduce((s, e) => s + (e.helferIds || []).length, 0);
  blatt.absatz(
    `${chronologisch.length} Tage dokumentiert, ${einsaetze} Helfereinsätze erfasst. ` +
    'Die Fotos stehen bei dem Tag, an dem sie aufgenommen wurden.'
  );

  for (const e of chronologisch) {
    const namen = (e.helferIds || [])
      .map((id) => (kontakte.find((k) => k.id === id) || {}).name)
      .filter(Boolean);

    blatt.ueberschrift(datumLang(e.datum));
    blatt.wertzeile(
      'Wetter',
      [e.wetter ? WETTER[e.wetter] : 'keine Angabe', e.temperatur ? e.temperatur + ' °C' : null]
        .filter(Boolean).join(', ')
    );
    blatt.wertzeile('Anwesend', namen.length ? namen.join(', ') : 'keine Helfer erfasst');
    if (e.gemacht) blatt.absatz('Ausgeführt: ' + e.gemacht, 9.5);
    if (e.offen) blatt.absatz('Liegengeblieben: ' + e.offen, 9.5);

    const bilder = fotos.get(e.id) || [];
    if (bilder.length) blatt.bilderreihe(bilder, { hoehe: 108 });
  }

  try {
    await pdfTeilen(blatt.blob(), 'bauhelfertagebuch.pdf', 'Bauhelfertagebuch');
  } catch (fehler) {
    melde('PDF konnte nicht geteilt werden.');
    console.error(fehler);
  }
}
