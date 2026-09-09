// Maengelliste.
//
// "Mangel" ist auch juristisch der richtige Begriff: Was hier mit Datum und
// Foto steht, ist bei Abnahme und Nachbesserung das Beweismittel. Deshalb
// wird ein Eintrag nie stillschweigend veraendert, sondern behaelt sein
// Anlagedatum.

import {
  el, feld, eingabe, auswahl, knopf, karte, kopfzeile, hinweisKasten,
  leerzustand, melde, datumLang, heute,
} from '../hilfen.js';
import { daten, bildUrl, bildLoeschen } from '../daten.js';
import { blattOeffnen } from '../blatt.js';
import { fotofeld } from '../fotos.js';
import { Blatt, pdfTeilen } from '../pdf.js';
import { einstellung } from '../daten.js';

export const STATUS = {
  offen: { name: 'Offen', marke: 'marke-offen' },
  arbeit: { name: 'In Bearbeitung', marke: 'marke-arbeit' },
  behoben: { name: 'Behoben', marke: 'marke-fertig' },
};

export const GEWERKE = [
  'Rohbau', 'Dach', 'Fenster und Türen', 'Elektro', 'Sanitär', 'Heizung',
  'Estrich', 'Putz und Trockenbau', 'Fliesen', 'Maler', 'Bodenbelag',
  'Treppe', 'Außenanlagen', 'Sonstiges',
];

const RAUM_VORSCHLAEGE = [
  'Wohnzimmer', 'Küche', 'Esszimmer', 'Flur', 'Bad', 'Gäste-WC',
  'Schlafzimmer', 'Kinderzimmer', 'Arbeitszimmer', 'Keller', 'Dachboden',
  'Garage', 'Treppenhaus', 'Außen',
];

export async function zeige(rahmen) {
  await zeichne(rahmen);
}

async function zeichne(rahmen, filter = 'alle') {
  rahmen.replaceChildren();
  const [maengel, kontakte] = await Promise.all([daten.alle('maengel'), daten.alle('kontakte')]);
  const neu = () => zeichne(rahmen, filter);

  rahmen.append(kopfzeile('Mängelliste', 'Jeder Schaden mit Foto, Raum, Gewerk und Status.'));

  if (!maengel.length) {
    rahmen.append(
      karte([
        leerzustand(
          'Halte den ersten Mangel fest',
          'Erfasse den wichtigsten offenen Punkt mit Foto, Raum und Gewerk. ' +
            'Ordne ihn danach einem Kontakt oder einem Schritt im Bauablauf zu.'
        ),
        knopf('Mangel erfassen', () => mangelBearbeiten({ status: 'offen' }, kontakte, neu), 'knopf-haupt'),
      ]),
      hinweisKasten(
        'Bei der Bauabnahme zählt, was dokumentiert ist. Ein Foto mit Datum wiegt ' +
          'mehr als jede Erinnerung an ein Gespräch.',
        'info'
      )
    );
    return;
  }

  const zahlen = {
    alle: maengel.length,
    offen: maengel.filter((m) => m.status === 'offen').length,
    arbeit: maengel.filter((m) => m.status === 'arbeit').length,
    behoben: maengel.filter((m) => m.status === 'behoben').length,
  };

  rahmen.append(
    el('div', { klasse: 'geschossleiste' }, [
      ['alle', `Alle (${zahlen.alle})`],
      ['offen', `Offen (${zahlen.offen})`],
      ['arbeit', `In Arbeit (${zahlen.arbeit})`],
      ['behoben', `Behoben (${zahlen.behoben})`],
    ].map(([wert, text]) =>
      el('button', {
        type: 'button', text,
        klasse: filter === wert ? 'aktiv' : null,
        onclick: () => zeichne(rahmen, wert),
      })
    ))
  );

  const sichtbar = maengel
    .filter((m) => filter === 'alle' || m.status === filter)
    .sort((a, b) => String(b.angelegt).localeCompare(String(a.angelegt)));

  // Nach Raum gruppieren: so geht man bei der Begehung auch tatsaechlich vor.
  const raeume = [...new Set(sichtbar.map((m) => m.raum || 'Ohne Raum'))].sort((a, b) => a.localeCompare(b, 'de'));

  if (!sichtbar.length) {
    rahmen.append(karte([el('p', { klasse: 'unterzeile', text: 'In dieser Ansicht ist nichts.' })]));
  }

  for (const raum of raeume) {
    const drin = sichtbar.filter((m) => (m.raum || 'Ohne Raum') === raum);
    rahmen.append(
      karte([
        el('h2', { text: raum }),
        el('ul', { klasse: 'liste' }, await Promise.all(drin.map(async (m) => {
          const url = m.bildIds && m.bildIds.length ? await bildUrl(m.bildIds[0]) : null;
          const kontakt = kontakte.find((k) => k.id === m.kontaktId);
          return el('li', {}, [
            el('button', { klasse: 'listenzeile', onclick: () => mangelBearbeiten(m, kontakte, neu) }, [
              url ? el('img', { klasse: 'vorschau', src: url, alt: '' }) : el('span', { klasse: 'vorschau' }),
              el('span', { klasse: 'zeilen-text' }, [
                el('span', { klasse: 'zeilen-titel', text: m.titel }),
                el('span', {
                  klasse: 'zeilen-unter',
                  text: [m.gewerk, kontakt ? kontakt.name : null, datumLang(m.angelegt)]
                    .filter(Boolean).join(' · '),
                }),
              ]),
              el('span', { klasse: 'marke ' + STATUS[m.status].marke, text: STATUS[m.status].name }),
            ]),
          ]);
        }))),
      ])
    );
  }

  rahmen.append(
    knopf('Mangel erfassen', () => mangelBearbeiten({ status: 'offen' }, kontakte, neu), 'knopf-haupt'),
    knopf('Liste als PDF teilen', () => pdfErzeugen(maengel, kontakte))
  );
}

function mangelBearbeiten(mangel, kontakte, nachher) {
  const titel = eingabe({ value: mangel.titel || '', placeholder: 'z. B. Kratzer in der Fensterbank' });
  const raum = el('input', {
    type: 'text', value: mangel.raum || '', list: 'raumliste', placeholder: 'z. B. Wohnzimmer',
  });
  const raumliste = el('datalist', { id: 'raumliste' }, RAUM_VORSCHLAEGE.map((r) => el('option', { value: r })));
  const gewerk = auswahl(GEWERKE.map((g) => [g, g]), mangel.gewerk || 'Sonstiges');
  const status = auswahl(Object.entries(STATUS).map(([w, s]) => [w, s.name]), mangel.status || 'offen');
  const beschreibung = el('textarea', {}, [mangel.beschreibung || '']);
  const kontakt = auswahl(
    [['', '– kein Kontakt –'], ...kontakte.map((k) => [k.id, k.name + (k.gewerk ? ' (' + k.gewerk + ')' : '')])],
    mangel.kontaktId ?? ''
  );
  const frist = el('input', { type: 'date', value: mangel.frist || '' });

  const bilder = [...(mangel.bildIds || [])];
  const fotos = fotofeld(bilder, () => {}, { text: 'Foto hinzufügen' });

  blattOeffnen(
    mangel.id ? 'Mangel bearbeiten' : 'Mangel erfassen',
    [
      feld('Was ist der Mangel?', titel),
      feld('Raum oder Bereich', raum),
      raumliste,
      feld('Gewerk', gewerk),
      feld('Status', status),
      feld('Beschreibung', beschreibung, 'Auch versteckte Schäden festhalten, die man später nicht mehr sieht.'),
      feld('Zuständig', kontakt),
      feld('Frist zur Beseitigung', frist),
      el('span', { klasse: 'feld-name', text: 'Fotos' }),
      fotos,
    ],
    async () => {
      const wert = {
        titel: titel.value.trim(),
        raum: raum.value.trim(),
        gewerk: gewerk.value,
        status: status.value,
        beschreibung: beschreibung.value.trim(),
        kontaktId: kontakt.value ? +kontakt.value : null,
        frist: frist.value || null,
        bildIds: bilder,
        angelegt: mangel.angelegt || heute(),
      };
      if (!wert.titel) throw new Error('Bitte beschreiben, worum es geht.');
      if (mangel.id) wert.id = mangel.id;
      const id = await daten.sichern('maengel', wert);

      // Aus einem Mangel wird oft eine Aufgabe. Das Anbieten spart den Weg
      // ueber das Menue und haelt beide Listen beieinander.
      if (!mangel.id && window.confirm('Als Aufgabe in den Bauablauf übernehmen?')) {
        await daten.sichern('aufgaben', {
          titel: 'Mangel: ' + wert.titel,
          phase: 'Mängelbeseitigung',
          start: null,
          ende: wert.frist,
          status: 'offen',
          kontaktId: wert.kontaktId,
          mangelId: id,
          notiz: wert.beschreibung,
        });
        melde('Mangel und Aufgabe angelegt.');
      }
      await nachher();
    },
    {
      loeschen: mangel.id
        ? async () => {
            for (const bildId of mangel.bildIds || []) await bildLoeschen(bildId);
            await daten.loeschen('maengel', mangel.id);
            await nachher();
          }
        : null,
    }
  );
}

async function pdfErzeugen(maengel, kontakte) {
  const projekt = (await einstellung('projektname')) || '';
  const blatt = new Blatt({
    titel: 'Mängelliste',
    untertitel: (projekt ? projekt + ' · ' : '') + 'Stand ' + datumLang(heute()),
    fusszeile: 'Hausbau App · Fotos liegen in der App zum jeweiligen Eintrag',
  });

  const offen = maengel.filter((m) => m.status !== 'behoben').length;
  blatt.absatz(
    `${maengel.length} Einträge, davon ${offen} noch nicht behoben. ` +
    'Zu jedem Eintrag sind in der App Fotos mit Aufnahmedatum hinterlegt.'
  );

  const raeume = [...new Set(maengel.map((m) => m.raum || 'Ohne Raum'))].sort((a, b) => a.localeCompare(b, 'de'));

  for (const raum of raeume) {
    const drin = maengel.filter((m) => (m.raum || 'Ohne Raum') === raum);
    blatt.ueberschrift(raum);
    blatt.tabelle(
      ['Mangel', 'Gewerk', 'Zuständig', 'Frist', 'Status'],
      drin.map((m) => {
        const kontakt = kontakte.find((k) => k.id === m.kontaktId);
        return [
          m.titel,
          m.gewerk || '',
          kontakt ? kontakt.name : '',
          m.frist ? datumLang(m.frist) : '',
          STATUS[m.status].name,
        ];
      }),
      [3.4, 1.5, 1.7, 1, 1.2]
    );
  }

  try {
    await pdfTeilen(blatt.blob(), 'maengelliste.pdf', 'Mängelliste');
  } catch (fehler) {
    melde('PDF konnte nicht geteilt werden.');
    console.error(fehler);
  }
}
