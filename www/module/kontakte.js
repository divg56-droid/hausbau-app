// Kontakte: Firmen und Helfer.
//
// Eine Liste fuer beide, unterschieden ueber das Feld "art". Maengel und
// Bauablauf haengen ihre Zustaendigkeiten hier ein, das Tagebuch hakt die
// Helfer ab.

import {
  el, feld, eingabe, auswahl, knopf, karte, kopfzeile, leerzustand,
} from '../hilfen.js';
import { daten } from '../daten.js';
import { blattOeffnen } from '../blatt.js';
import { GEWERKE } from './maengel.js';

export async function zeige(rahmen) {
  await zeichne(rahmen);
}

async function zeichne(rahmen) {
  rahmen.replaceChildren();
  const kontakte = await daten.alle('kontakte');
  const neu = () => zeichne(rahmen);

  rahmen.append(kopfzeile('Kontakte', 'Handwerker, Bauleiter und Helfer an einer Stelle.'));

  if (!kontakte.length) {
    rahmen.append(
      karte([
        leerzustand(
          'Noch keine Kontakte',
          'Trage Firmen ein, damit du Mängel und Arbeitsschritte zuordnen kannst. ' +
            'Helfer brauchst du für das Bauhelfertagebuch.'
        ),
        el('div', { klasse: 'knopf-reihe' }, [
          knopf('Firma', () => bearbeiten({ art: 'firma' }, neu), 'knopf-haupt'),
          knopf('Helfer', () => bearbeiten({ art: 'helfer' }, neu)),
        ]),
      ])
    );
    return;
  }

  for (const [art, ueberschrift, leer] of [
    ['firma', 'Firmen und Ansprechpartner', 'Noch keine Firma erfasst.'],
    ['helfer', 'Bauhelfer', 'Noch keine Helfer erfasst.'],
  ]) {
    const drin = kontakte
      .filter((k) => (k.art || 'firma') === art)
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));

    rahmen.append(
      karte([
        el('h2', { text: ueberschrift }),
        drin.length
          ? el('ul', { klasse: 'liste' }, drin.map((k) =>
              el('li', {}, [
                el('button', { klasse: 'listenzeile', onclick: () => bearbeiten(k, neu) }, [
                  el('span', { klasse: 'zeilen-text' }, [
                    el('span', { klasse: 'zeilen-titel', text: k.name }),
                    el('span', {
                      klasse: 'zeilen-unter',
                      text: [k.firma, k.gewerk, k.telefon].filter(Boolean).join(' · ') || 'ohne weitere Angaben',
                    }),
                  ]),
                  // tel: und mailto: oeffnen im WebView die passende App.
                  k.telefon
                    ? el('a', {
                        klasse: 'marke', href: 'tel:' + k.telefon.replace(/\s/g, ''),
                        'aria-label': 'Anrufen',
                        onclick: (ereignis) => ereignis.stopPropagation(),
                      }, ['Anrufen'])
                    : null,
                ]),
              ])
            ))
          : el('p', { klasse: 'unterzeile', text: leer }),
        knopf(
          art === 'firma' ? 'Firma hinzufügen' : 'Helfer hinzufügen',
          () => bearbeiten({ art }, neu),
          'knopf-leise'
        ),
      ])
    );
  }
}

function bearbeiten(kontakt, nachher) {
  const art = auswahl([['firma', 'Firma / Ansprechpartner'], ['helfer', 'Bauhelfer']], kontakt.art || 'firma');
  const name = eingabe({ value: kontakt.name || '', placeholder: 'Vor- und Nachname' });
  const firma = eingabe({ value: kontakt.firma || '', placeholder: 'Betrieb' });
  const gewerk = auswahl([['', '– kein Gewerk –'], ...GEWERKE.map((g) => [g, g])], kontakt.gewerk || '');
  const telefon = el('input', { type: 'tel', value: kontakt.telefon || '', placeholder: '01512 3456789' });
  const epost = el('input', { type: 'email', value: kontakt.epost || '', placeholder: 'name@betrieb.de' });
  const notiz = el('textarea', {}, [kontakt.notiz || '']);

  blattOeffnen(
    kontakt.id ? 'Kontakt bearbeiten' : 'Kontakt anlegen',
    [
      feld('Art', art),
      feld('Name', name),
      feld('Betrieb', firma),
      feld('Gewerk', gewerk),
      feld('Telefon', telefon),
      feld('E-Mail', epost),
      feld('Notiz', notiz),
    ],
    async () => {
      const wert = {
        art: art.value,
        name: name.value.trim(),
        firma: firma.value.trim(),
        gewerk: gewerk.value,
        telefon: telefon.value.trim(),
        epost: epost.value.trim(),
        notiz: notiz.value.trim(),
      };
      if (!wert.name) throw new Error('Bitte einen Namen eintragen.');
      if (kontakt.id) wert.id = kontakt.id;
      await daten.sichern('kontakte', wert);
      await nachher();
    },
    {
      loeschen: kontakt.id
        ? async () => {
            await daten.loeschen('kontakte', kontakt.id);
            await nachher();
          }
        : null,
    }
  );
}
