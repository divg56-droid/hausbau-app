// Baudokumentation: Fotos nach Bauabschnitt.
//
// Getrennt vom Bauhelfertagebuch, weil es einen anderen Zweck hat. Das
// Tagebuch weist nach, wer wann wie lange da war; hier wird festgehalten, wie
// das Haus zu einem Zeitpunkt aussah.
//
// Der wichtigste Fall ist immer derselbe: Was unter Putz und Estrich
// verschwindet, ist danach nur noch mit Stemmen zu erreichen. Wer vor dem
// Verschliessen jede Wand fotografiert hat, findet die Leitung in zehn Jahren
// wieder. Wer nicht, bohrt hinein.
//
// Die Bauabschnitte sind dieselben wie im Bauablauf. Eine zweite Liste waere
// eine zweite Wahrheit darueber, in welcher Reihenfolge gebaut wird.

import {
  el, feld, eingabe, auswahl, knopf, karte, kopfzeile, hinweisKasten,
  leerzustand, melde, datumLang, heute,
  anhaengen,
  kartengitter,
} from '../hilfen.js';
import { daten, bildUrl, bildLoeschen, einstellung } from '../daten.js';
import { blattOeffnen } from '../blatt.js';
import { fotofeld } from '../fotos.js';
import { PHASEN } from './ablauf.js';
import { Blatt, pdfTeilen, bildLaden } from '../pdf.js';

export async function zeige(rahmen) {
  await zeichne(rahmen);
}

async function zeichne(rahmen) {
  rahmen.replaceChildren();
  const eintraege = await daten.alle('baudoku');
  const neu = () => zeichne(rahmen);

  const bilder = eintraege.reduce((s, e) => s + (e.bildIds || []).length, 0);

  anhaengen(
    rahmen,
    kopfzeile('Baudokumentation', 'Wie das Haus aussah, Bauabschnitt für Bauabschnitt.')
  );

  if (!eintraege.length) {
    anhaengen(
      rahmen,
      karte([
        leerzustand(
          'Noch keine Aufnahme',
          'Fotografiere jede Wand und jeden Boden, bevor Putz und Estrich darüber ' +
            'gehen, mit einem Zollstock im Bild. Das ist die eine Dokumentation, ' +
            'die sich später garantiert auszahlt.'
        ),
        knopf('Erste Aufnahme anlegen', () => bearbeiten({}, neu), 'knopf-haupt'),
      ]),
      hinweisKasten(
        'Ein Eintrag ist ein Termin: ein Bauabschnitt, ein Datum, beliebig viele ' +
          'Fotos. Was du hier ablegst, taucht nicht im öffentlichen Bautagebuch auf.',
        'info'
      )
    );
    return;
  }

  anhaengen(
    rahmen,
    karte([
      el('h2', { text: 'Stand' }),
      el('p', {
        klasse: 'unterzeile',
        text: `${bilder} ${bilder === 1 ? 'Aufnahme' : 'Aufnahmen'} in ${eintraege.length} ` +
          (eintraege.length === 1 ? 'Eintrag' : 'Einträgen') + '.',
      }),
      knopf('Aufnahme hinzufügen', () => bearbeiten({}, neu), 'knopf-haupt'),
    ])
  );

  // Nach Bauabschnitt, in der Reihenfolge des Bauablaufs. Was zu einem
  // Abschnitt gehoert, den es nicht mehr gibt, faellt ans Ende.
  const reihe = [...PHASEN, 'Ohne Bauabschnitt'];
  const gruppen = new Map(reihe.map((p) => [p, []]));
  for (const e of eintraege) {
    const phase = gruppen.has(e.phase) ? e.phase : 'Ohne Bauabschnitt';
    gruppen.get(phase).push(e);
  }

  const gitter = kartengitter([]);
  anhaengen(rahmen, gitter);

  for (const [phase, drin] of gruppen) {
    if (!drin.length) continue;
    drin.sort((a, b) => String(b.datum || '').localeCompare(String(a.datum || '')));

    anhaengen(
      gitter,
      el('details', { klasse: 'karte phasenblock', open: true }, [
        el('summary', {}, [
          el('span', { klasse: 'phasen-titel', text: phase }),
          el('span', {
            klasse: 'phasen-zahl',
            text: String(drin.reduce((s, e) => s + (e.bildIds || []).length, 0)),
          }),
        ]),
        ...drin.map((e) => eintragsblock(e, neu)),
      ])
    );
  }

  anhaengen(
    rahmen,
    knopf('Baudokumentation als PDF', () => pdfErzeugen(eintraege), 'knopf-leise')
  );
}

const fotoZahl = (n) => n + (n === 1 ? ' Foto' : ' Fotos');

function eintragsblock(eintrag, neu) {
  const reihe = el('div', { klasse: 'fotoreihe' });
  // Die Bild-Adressen kommen asynchron; der Block steht sofort und fuellt
  // sich nach. Sonst wartet der ganze Bildschirm auf die Bilder.
  (async () => {
    for (const id of eintrag.bildIds || []) {
      const url = await bildUrl(id);
      if (!url) continue;
      reihe.append(
        el('a', { href: url, target: '_blank', rel: 'noopener' }, [
          el('img', { src: url, alt: eintrag.titel || 'Aufnahme' }),
        ])
      );
    }
  })();

  return el('div', { klasse: 'doku-eintrag' }, [
    el('div', { klasse: 'leitfaden-zeile' }, [
      el('div', { klasse: 'zeilen-text' }, [
        el('span', { klasse: 'zeilen-titel', text: eintrag.titel || 'Ohne Bezeichnung' }),
        el('span', {
          klasse: 'zeilen-unter',
          text: [
            eintrag.datum ? datumLang(eintrag.datum) : null,
            fotoZahl((eintrag.bildIds || []).length),
            eintrag.notiz || null,
          ].filter(Boolean).join(' · '),
        }),
      ]),
      el('button', {
        klasse: 'knopf knopf-schmal', type: 'button', text: 'Ändern',
        onclick: () => bearbeiten(eintrag, neu),
      }),
    ]),
    reihe,
  ]);
}

function bearbeiten(eintrag, nachher) {
  const titel = eingabe({
    value: eintrag.titel || '', placeholder: 'z. B. Elektroleitungen Erdgeschoss',
  });
  const phase = auswahl(PHASEN.map((p) => [p, p]), eintrag.phase || PHASEN[0]);
  const datum = el('input', { type: 'date', value: eintrag.datum || heute() });
  const notiz = el('textarea', {}, [eintrag.notiz || '']);

  const bilder = [...(eintrag.bildIds || [])];
  const fotos = fotofeld(bilder, () => {}, { text: 'Foto aufnehmen', mehrere: true });

  blattOeffnen(
    eintrag.id ? 'Aufnahme bearbeiten' : 'Aufnahme anlegen',
    [
      feld('Was ist zu sehen', titel),
      feld('Bauabschnitt', phase),
      feld('Aufnahmedatum', datum),
      feld('Notiz', notiz, 'Raum, Wand, Höhe: was das Foto allein nicht sagt.'),
      el('span', { klasse: 'feld-name', text: 'Fotos' }),
      fotos,
    ],
    async () => {
      const wert = {
        titel: titel.value.trim(),
        phase: phase.value,
        datum: datum.value || null,
        notiz: notiz.value.trim(),
        bildIds: bilder,
      };
      if (!wert.titel) throw new Error('Bitte eine Bezeichnung eintragen.');
      if (eintrag.id) wert.id = eintrag.id;
      await daten.sichern('baudoku', wert);
      await nachher();
    },
    {
      loeschen: eintrag.id
        ? async () => {
            for (const id of eintrag.bildIds || []) await bildLoeschen(id);
            await daten.loeschen('baudoku', eintrag.id);
            await nachher();
          }
        : null,
    }
  );
}

async function pdfErzeugen(eintraege) {
  melde('PDF wird erstellt …');
  const projekt = (await einstellung('projektname')) || '';
  const blatt = new Blatt({
    titel: 'Baudokumentation',
    untertitel: (projekt ? projekt + ' · ' : '') + 'Stand ' + datumLang(heute()),
    fusszeile: 'Baudokumentation',
  });

  blatt.absatz(
    'Aufnahmen nach Bauabschnitt, in der Reihenfolge des Bauablaufs. Die ' +
      'Bilder sind für den Ausdruck verkleinert; die Aufnahmen in voller ' +
      'Auflösung bleiben in der App.'
  );

  const reihe = [...PHASEN, 'Ohne Bauabschnitt'];
  for (const phase of reihe) {
    const drin = eintraege
      .filter((e) => (PHASEN.includes(e.phase) ? e.phase : 'Ohne Bauabschnitt') === phase)
      .sort((a, b) => String(a.datum || '').localeCompare(String(b.datum || '')));
    if (!drin.length) continue;

    blatt.ueberschrift(phase);
    for (const e of drin) {
      blatt.wertzeile(e.titel || 'Ohne Bezeichnung', e.datum ? datumLang(e.datum) : '');
      if (e.notiz) blatt.absatz(e.notiz, 9);

      const geladen = [];
      for (const id of e.bildIds || []) {
        const eintrag = await daten.holen('bilder', id);
        const bild = eintrag ? await bildLaden(eintrag.blob) : null;
        if (bild) geladen.push(bild);
      }
      if (geladen.length) blatt.bilderreihe(geladen, { hoehe: 108 });
    }
  }

  try {
    await pdfTeilen(blatt.blob(), 'baudokumentation.pdf', 'Baudokumentation');
  } catch (fehler) {
    melde('PDF konnte nicht geteilt werden.');
    console.error(fehler);
  }
}
