// Dokumentenablage.
//
// Am Bau sammeln sich Papiere schneller als Rechnungen: Baugenehmigung,
// Statik, Protokolle, Nachweise, Bedienungsanleitungen. Sie liegen sonst in
// drei Ordnern, zwei Postfaechern und einer Schublade, und beim Termin fehlt
// genau das eine.
//
// Deshalb eine Ablage mit zwei Eigenschaften, die der Aktenordner nicht hat:
// Sie ist dabei, wenn man auf der Baustelle steht, und jedes Dokument kann
// sagen, wozu es gehoert -- zu einem Mangel, einer Kostenposition oder einer
// Firma.
//
// Die Datei selbst liegt im Bilderspeicher, wie jedes Foto der App. Der
// Eintrag hier haelt nur die Kennung. So wandert sie beim Abgleich denselben
// Weg wie ein Mangelfoto und braucht keinen zweiten.

import {
  el, feld, eingabe, auswahl, knopf, karte, kopfzeile, hinweisKasten,
  leerzustand, melde, datumLang, heute,
  anhaengen,
} from '../hilfen.js';
import { daten, bildLoeschen } from '../daten.js';
import { blattOeffnen } from '../blatt.js';
import { fotofeld } from '../fotos.js';
import { zeichen, dokumentZeichen } from '../zeichen.js';
// pdfTeilen schiebt einen beliebigen Blob nach draussen: auf dem Telefon
// ueber das Teilen-Menue, im Browser als Download. Fuer ein Dokument ist das
// genau der richtige Weg, auch wenn der Name nach PDF klingt.
import { pdfTeilen } from '../pdf.js';

// Die Ordnung, in der man am Bau nach Papier sucht. "Sonstiges" bleibt am
// Ende, alles andere steht in der Reihenfolge, in der es anfaellt.
export const ARTEN = [
  'Genehmigung', 'Vertrag', 'Plan und Zeichnung', 'Nachweis und Gutachten',
  'Protokoll', 'Rechnung', 'Anleitung und Wartung', 'Sonstiges',
];

// Was ein Dokument mit dem Rest der App verbindet. Feld, Speicher, Aufschrift.
const BEZUEGE = [
  ['mangelId', 'maengel', 'Mangel'],
  ['postenId', 'posten', 'Kostenposition'],
  ['kontaktId', 'kontakte', 'Firma oder Person'],
];

const filter = { art: '', bezug: '' };

export async function zeige(rahmen) {
  await zeichne(rahmen);
}

async function zeichne(rahmen) {
  rahmen.replaceChildren();
  const [dokumente, maengel, posten, kontakte] = await Promise.all([
    daten.alle('dokumente'),
    daten.alle('maengel'),
    daten.alle('posten'),
    daten.alle('kontakte'),
  ]);
  const bezugsdaten = { maengel, posten, kontakte };
  const neu = () => zeichne(rahmen);

  anhaengen(
    rahmen,
    kopfzeile('Dokumente', 'Alles, was auf Papier kam, an einer Stelle und dabei.')
  );

  if (!dokumente.length) {
    anhaengen(
      rahmen,
      karte([
        leerzustand(
          'Noch kein Dokument',
          'Fotografiere die Baugenehmigung, häng die Statik als PDF an, leg das ' +
            'Abnahmeprotokoll dazu. Jedes Dokument kann sagen, wozu es gehört, ' +
            'und steht dann auch dort.'
        ),
        knopf('Erstes Dokument ablegen', () => bearbeiten({}, bezugsdaten, neu), 'knopf-haupt'),
      ]),
      hinweisKasten(
        'Bilder werden verkleinert, PDF-Dateien bleiben, wie sie sind. Beides ' +
          'geht beim Abgleich auf das andere Gerät mit.',
        'info'
      )
    );
    return;
  }

  // Verschwundene Filterwerte zuruecksetzen, sonst steht die Liste ohne
  // ersichtlichen Grund leer da.
  const vorhandeneArten = ARTEN.filter((a) => dokumente.some((d) => (d.art || 'Sonstiges') === a));
  if (filter.art && !vorhandeneArten.includes(filter.art)) filter.art = '';

  const artFeld = auswahl(
    [['', 'Alle Arten'], ...vorhandeneArten.map((a) => [a, a])], filter.art
  );
  const bezugFeld = auswahl(
    [
      ['', 'Alle Zuordnungen'],
      ['ohne', 'Ohne Zuordnung'],
      ...BEZUEGE.map(([f, , name]) => [f, 'Zu einer ' + name.split(' ')[0]]),
    ],
    filter.bezug
  );
  artFeld.addEventListener('change', () => { filter.art = artFeld.value; neu(); });
  bezugFeld.addEventListener('change', () => { filter.bezug = bezugFeld.value; neu(); });

  const hatBezug = (d) => BEZUEGE.some(([f]) => d[f]);
  const gefiltert = dokumente.filter((d) => {
    if (filter.art && (d.art || 'Sonstiges') !== filter.art) return false;
    if (filter.bezug === 'ohne') return !hatBezug(d);
    if (filter.bezug) return !!d[filter.bezug];
    return true;
  });

  anhaengen(rahmen, el('div', { klasse: 'filterleiste' }, [artFeld, bezugFeld]));

  if (!gefiltert.length) {
    anhaengen(
      rahmen,
      karte([
        el('p', {
          klasse: 'unterzeile',
          text: 'Kein Dokument passt zu dieser Auswahl. ' + dokumente.length +
            ' sind insgesamt abgelegt.',
        }),
      ])
    );
  }

  for (const art of ARTEN) {
    const drin = gefiltert
      .filter((d) => (d.art || 'Sonstiges') === art)
      .sort((a, b) => String(b.datum || '').localeCompare(String(a.datum || '')));
    if (!drin.length) continue;

    anhaengen(
      rahmen,
      karte([
        el('h2', { klasse: 'mit-zeichen' }, [
          zeichen(dokumentZeichen(art), { groesse: 20 }),
          el('span', { text: art }),
        ]),
        el('ul', { klasse: 'liste' }, drin.map((d) =>
          el('li', {}, [
            el('div', { klasse: 'leitfaden-zeile' }, [
              el('span', { klasse: 'zeilenzeichen' }, [
                zeichen(dokumentZeichen(art)),
              ]),
              el('div', { klasse: 'zeilen-text' }, [
                el('span', { klasse: 'zeilen-titel', text: d.titel }),
                el('span', {
                  klasse: 'zeilen-unter',
                  text: [
                    d.datum ? datumLang(d.datum) : null,
                    dateienText(d),
                    bezugText(d, bezugsdaten),
                    d.notiz || null,
                  ].filter(Boolean).join(' · '),
                }),
              ]),
              el('span', { klasse: 'zeilen-aktionen' }, [
                (d.bildIds || []).length
                  ? el('button', {
                      klasse: 'knopf knopf-schmal', type: 'button', text: 'Öffnen',
                      onclick: () => oeffnen(d),
                    })
                  : null,
                el('button', {
                  klasse: 'knopf knopf-schmal', type: 'button', text: 'Ändern',
                  onclick: () => bearbeiten(d, bezugsdaten, neu),
                }),
              ]),
            ]),
          ])
        )),
      ])
    );
  }

  anhaengen(
    rahmen,
    knopf('Dokument ablegen', () => bearbeiten({}, bezugsdaten, neu), 'knopf-haupt')
  );
}

const dateienText = (d) => {
  const anzahl = (d.bildIds || []).length;
  if (!anzahl) return 'ohne Datei';
  return anzahl === 1 ? '1 Datei' : anzahl + ' Dateien';
};

/** "gehört zu Rohbau" -- oder nichts, wenn das Dokument freisteht. */
function bezugText(dokument, bezugsdaten) {
  for (const [feldname, speicher, aufschrift] of BEZUEGE) {
    if (!dokument[feldname]) continue;
    const satz = bezugsdaten[speicher].find((s) => s.id === dokument[feldname]);
    if (satz) return aufschrift + ': ' + (satz.titel || satz.name || 'ohne Bezeichnung');
  }
  return null;
}

/**
 * Gibt die Dateien eines Dokuments nach draussen.
 *
 * Auf dem Telefon oeffnet das Teilen-Menue die passende App, im Browser
 * landet die Datei im Download-Ordner. Ein eigener Betrachter waere ein
 * zweiter PDF-Anzeiger im Programm, und der Browser hat schon einen.
 */
async function oeffnen(dokument) {
  for (const id of dokument.bildIds || []) {
    const eintrag = await daten.holen('bilder', id);
    if (!eintrag || !eintrag.blob) {
      melde('Diese Datei fehlt. Vielleicht ist der Abgleich noch nicht durch.');
      continue;
    }
    await pdfTeilen(eintrag.blob, eintrag.name || dokument.titel, dokument.titel);
  }
}

function bearbeiten(dokument, bezugsdaten, nachher) {
  const titel = eingabe({ value: dokument.titel || '', placeholder: 'z. B. Baugenehmigung' });
  const art = auswahl(ARTEN.map((a) => [a, a]), dokument.art || 'Sonstiges');
  const datum = el('input', { type: 'date', value: dokument.datum || heute() });
  const notiz = el('textarea', {}, [dokument.notiz || '']);

  const bilder = [...(dokument.bildIds || [])];
  const dateien = fotofeld(bilder, () => {}, {
    text: 'Datei oder Foto anhängen', mehrere: true, pdfErlaubt: true,
  });

  // Genau eine Zuordnung: Ein Dokument, das gleichzeitig zu einem Mangel,
  // einer Position und einer Firma gehoert, findet man nachher nirgends
  // wieder. Wer beides braucht, legt es zweimal ab.
  const wahl = [['', '– keine Zuordnung –']];
  for (const [feldname, speicher, aufschrift] of BEZUEGE) {
    for (const satz of bezugsdaten[speicher]) {
      wahl.push([feldname + ':' + satz.id, aufschrift + ': ' + (satz.titel || satz.name)]);
    }
  }
  const gesetzt = BEZUEGE
    .filter(([f]) => dokument[f])
    .map(([f]) => f + ':' + dokument[f])[0] || '';
  const bezug = auswahl(wahl, gesetzt);

  blattOeffnen(
    dokument.id ? 'Dokument bearbeiten' : 'Dokument ablegen',
    [
      feld('Bezeichnung', titel),
      feld('Art', art),
      feld('Datum', datum, 'Das Datum auf dem Papier, nicht das von heute.'),
      feld('Gehört zu', bezug, 'Damit steht das Dokument auch beim Mangel oder bei der Position.'),
      feld('Notiz', notiz),
      el('span', { klasse: 'feld-name', text: 'Dateien' }),
      dateien,
    ],
    async () => {
      const wert = {
        titel: titel.value.trim(),
        art: art.value,
        datum: datum.value || null,
        notiz: notiz.value.trim(),
        bildIds: bilder,
        mangelId: null, postenId: null, kontaktId: null,
      };
      if (bezug.value) {
        const [feldname, id] = bezug.value.split(':');
        wert[feldname] = id;
      }
      if (!wert.titel) throw new Error('Bitte eine Bezeichnung eintragen.');
      if (dokument.id) wert.id = dokument.id;
      await daten.sichern('dokumente', wert);
      await nachher();
    },
    {
      loeschen: dokument.id
        ? async () => {
            // Die Dateien gehen mit: Sie haengen an nichts anderem, und ohne
            // ihren Eintrag waeren sie nicht mehr erreichbar.
            for (const id of dokument.bildIds || []) await bildLoeschen(id);
            await daten.loeschen('dokumente', dokument.id);
            await nachher();
          }
        : null,
    }
  );
}
