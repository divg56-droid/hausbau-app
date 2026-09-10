// Bauprojekte verwalten.
//
// Wer zwei Haeuser baut oder nach dem eigenen noch das der Tochter begleitet,
// braucht zwei getrennte Datenbestaende. Getrennt wird ueber ein Feld am
// Satz; die Regeln dazu stehen in daten.js und projekte.js.

import {
  el, feld, eingabe, knopf, karte, kopfzeile, hinweisKasten, melde, datumLang,
  anhaengen,
  geheZu,
} from '../hilfen.js';
import { projektAktiv, projektWechseln } from '../daten.js';
import { blattOeffnen } from '../blatt.js';
import {
  projekteListe, projektAnlegen, projektUmbenennen, projektLoeschen, projektBestand,
} from '../projekte.js';

export async function zeige(rahmen) {
  await zeichne(rahmen);
}

async function zeichne(rahmen) {
  rahmen.replaceChildren();
  const [liste, aktiv] = await Promise.all([projekteListe(), projektAktiv()]);
  const neu = () => zeichne(rahmen);

  const bestand = new Map();
  for (const p of liste) bestand.set(p.id, await projektBestand(p.id));

  anhaengen(
    rahmen,
    kopfzeile('Bauprojekte', 'Getrennte Bestände für getrennte Bauvorhaben.'),
    karte([
      el('ul', { klasse: 'liste' }, liste.map((p) =>
        el('li', {}, [
          el('div', { klasse: 'leitfaden-zeile' + (p.id === aktiv ? '' : '') }, [
            el('div', { klasse: 'zeilen-text' }, [
              el('span', {
                klasse: 'zeilen-titel',
                text: p.id === aktiv ? p.name + ' (offen)' : p.name,
              }),
              el('span', {
                klasse: 'zeilen-unter',
                text: [
                  p.angelegt ? 'angelegt ' + datumLang(String(p.angelegt).slice(0, 10)) : null,
                  bestand.get(p.id) + (bestand.get(p.id) === 1 ? ' Eintrag' : ' Einträge'),
                ].filter(Boolean).join(' · '),
              }),
            ]),
            el('span', { klasse: 'zeilen-aktionen' }, [
              p.id === aktiv
                ? null
                : el('button', {
                    klasse: 'knopf knopf-schmal', type: 'button', text: 'Öffnen',
                    onclick: () => wechseln(p),
                  }),
              el('button', {
                klasse: 'knopf knopf-schmal', type: 'button', text: 'Umbenennen',
                onclick: () => umbenennen(p, neu),
              }),
              liste.length > 1
                ? el('button', {
                    klasse: 'knopf knopf-schmal', type: 'button', text: 'Löschen',
                    onclick: () => loeschen(p, bestand.get(p.id), neu),
                  })
                : null,
            ]),
          ]),
        ])
      )),
    ]),
    knopf('Neues Bauprojekt', () => anlegen(neu), 'knopf-haupt'),
    hinweisKasten(
      'Jedes Projekt hat seine eigenen Kosten, Mängel, Kontakte und Dokumente. ' +
        'Gemeinsam bleiben nur die Rechner und die Darstellung. Beim Abgleich ' +
        'gehen alle Projekte mit.',
      'info'
    )
  );
}

async function wechseln(projekt) {
  await projektWechseln(projekt.id);
  melde(projekt.name + ' ist offen.');
  // Ganz neu laden: Jeder Bildschirm haelt seine Daten im Speicher, und die
  // gehoeren jetzt zu einem anderen Projekt.
  geheZu('');
  location.reload();
}

function anlegen(nachher) {
  const name = eingabe({ placeholder: 'z. B. Doppelhaus Musterweg' });
  blattOeffnen(
    'Neues Bauprojekt',
    [
      feld('Name', name, 'Erscheint in der Kopfzeile jedes PDF.'),
      el('p', {
        klasse: 'unterzeile',
        text: 'Das neue Projekt startet leer und wird sofort geöffnet. Das bisherige ' +
          'bleibt vollständig erhalten.',
      }),
    ],
    async () => {
      const wert = name.value.trim();
      if (!wert) throw new Error('Bitte einen Namen eintragen.');
      await projektAnlegen(wert);
      geheZu('');
      location.reload();
    }
  );
}

function umbenennen(projekt, nachher) {
  const name = eingabe({ value: projekt.name });
  blattOeffnen(
    'Projekt umbenennen',
    [feld('Name', name)],
    async () => {
      const wert = name.value.trim();
      if (!wert) throw new Error('Bitte einen Namen eintragen.');
      await projektUmbenennen(projekt.id, wert);
      await nachher();
    }
  );
}

async function loeschen(projekt, saetze, nachher) {
  if (!window.confirm(
    `Bauprojekt "${projekt.name}" mit ${saetze} Einträgen löschen?\n\n` +
    'Kosten, Mängel, Termine, Kontakte, Dokumente und Fotos dieses Projekts ' +
    'sind danach weg, auch auf dem zweiten Gerät. Das lässt sich nicht ' +
    'rückgängig machen.'
  )) return;
  try {
    await projektLoeschen(projekt.id);
    melde('Projekt gelöscht.');
    await nachher();
  } catch (fehler) {
    melde(fehler.message);
  }
}
