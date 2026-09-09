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
import { Blatt, pdfTeilen, bildLaden } from '../pdf.js';
import { einstellung } from '../daten.js';

export const STATUS = {
  // kurz steht in den PDF-Tabellen, wo die Spalte schmal ist.
  offen: { name: 'Offen', kurz: 'Offen', marke: 'marke-offen' },
  arbeit: { name: 'In Bearbeitung', kurz: 'In Arbeit', marke: 'marke-arbeit' },
  behoben: { name: 'Behoben', kurz: 'Behoben', marke: 'marke-fertig' },
};

export const GEWERKE = [
  'Rohbau', 'Dach', 'Fenster und Türen', 'Elektro', 'Sanitär', 'Heizung',
  'Estrich', 'Putz und Trockenbau', 'Fliesen', 'Maler', 'Bodenbelag',
  'Treppe', 'Außenanlagen', 'Sonstiges',
];

// Die Vorschlaege stehen im Raum-Modul; hier wird die dortige Liste um die
// schon angelegten Raeume ergaenzt, sobald das Blatt aufgeht.

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
    knopf('Liste als PDF teilen', () => pdfErzeugen(maengel, kontakte)),
    knopf('Mängelrüge an eine Firma', () => ruegeBlatt(maengel, kontakte))
  );
}

function mangelBearbeiten(mangel, kontakte, nachher) {
  const titel = eingabe({ value: mangel.titel || '', placeholder: 'z. B. Kratzer in der Fensterbank' });
  const raum = el('input', {
    type: 'text', value: mangel.raum || '', list: 'raumliste', placeholder: 'z. B. Wohnzimmer',
  });
  const raumliste = el('datalist', { id: 'raumliste' });
  // Erst die schon angelegten Raeume, danach die Vorschlaege. So tippt man
  // nichts doppelt an und legt nicht versehentlich "Bad " neben "Bad" an.
  (async () => {
    const { RAUM_VORSCHLAEGE } = await import('./raeume.js');
    const vorhanden = (await daten.alle('raeume')).map((r) => r.name);
    const alle = [...new Set([...vorhanden, ...RAUM_VORSCHLAEGE])];
    raumliste.replaceChildren(...alle.map((r) => el('option', { value: r })));
  })();
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
      // Aus dem Namen wird ein richtiger Raum, falls es ihn noch nicht gibt.
      // Der Name bleibt zusaetzlich stehen: Die Maengelliste gruppiert danach
      // und muss dafuer nicht jedes Mal nachschlagen.
      const { raumHolen } = await import('./raeume.js');
      const raumId = await raumHolen(raum.value);

      const wert = {
        titel: titel.value.trim(),
        raum: raum.value.trim(),
        raumId,
        gewerk: gewerk.value,
        status: status.value,
        beschreibung: beschreibung.value.trim(),
        kontaktId: kontakt.value || null,
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

/**
 * Fragt ab, an wen die Ruege geht und bis wann.
 *
 * Aufgenommen werden nur offene Punkte dieser Firma. Behobenes anzumahnen
 * waere peinlich und schwaecht das Schreiben.
 */
function ruegeBlatt(maengel, kontakte) {
  const firmen = kontakte.filter((k) => (k.art || 'firma') === 'firma');

  if (!firmen.length) {
    melde('Erst eine Firma in den Kontakten anlegen.');
    return;
  }

  const empfaenger = auswahl(
    firmen.map((k) => [k.id, k.name + (k.firma ? ' (' + k.firma + ')' : '')]),
    firmen[0].id
  );

  // Zwei Wochen sind die uebliche Groessenordnung fuer eine Nachbesserung.
  const vorgabe = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const frist = el('input', { type: 'date', value: vorgabe });
  const zaehler = el('p', { klasse: 'unterzeile' });

  function zaehlen() {
    const offen = maengel.filter(
      (m) => m.kontaktId === empfaenger.value && m.status !== 'behoben'
    );
    zaehler.textContent = offen.length === 1
      ? 'Ein offener Mangel dieser Firma kommt in das Schreiben.'
      : offen.length
        ? `${offen.length} offene Mängel dieser Firma kommen in das Schreiben.`
        : 'Dieser Firma ist kein offener Mangel zugeordnet.';
    return offen;
  }
  empfaenger.addEventListener('change', zaehlen);
  zaehlen();

  blattOeffnen(
    'Mängelrüge erstellen',
    [
      feld('An welche Firma?', empfaenger, 'Zuordnung erfolgt beim einzelnen Mangel.'),
      feld('Frist zur Beseitigung', frist),
      zaehler,
      el('p', {
        klasse: 'kasten kasten-info',
        text:
          'Das Schreiben ist eine Vorlage und keine Rechtsberatung. Lies es vor ' +
          'dem Versand durch und schick es so, dass du den Zugang belegen kannst.',
      }),
    ],
    async () => {
      const offen = zaehlen();
      if (!offen.length) throw new Error('Ohne offenen Mangel gibt es nichts zu rügen.');
      const firma = firmen.find((k) => k.id === empfaenger.value);
      await ruegeErzeugen(firma, offen, frist.value);
    },
    { sicherText: 'PDF erstellen' }
  );
}

async function ruegeErzeugen(firma, maengel, frist) {
  melde('Schreiben wird erstellt …');
  const absender = (await einstellung('absender')) || {};
  const projekt = (await einstellung('projektname')) || '';

  const blatt = new Blatt({
    ohneKopf: true,
    fusszeile: 'Mängelrüge' + (projekt ? ' · ' + projekt : ''),
  });

  blatt.briefkopf(
    [absender.name, absender.strasse, absender.plzOrt],
    [
      firma.firma || firma.name,
      firma.firma && firma.name !== firma.firma ? 'z. Hd. ' + firma.name : null,
      firma.strasse || null,
      firma.plzOrt || null,
    ],
    datumLang(heute())
  );

  const vorhaben = absender.vorhaben || projekt;
  blatt.betreff('Mängelrüge' + (vorhaben ? ' – Bauvorhaben ' + vorhaben : ''));

  blatt.absatz('Sehr geehrte Damen und Herren,', 10.5);
  blatt.absatz(
    'bei der Abnahme beziehungsweise der Begehung der von Ihnen ausgeführten Arbeiten ' +
    'habe ich die nachstehend aufgeführten Mängel festgestellt. Ich zeige Ihnen diese ' +
    'hiermit an und fordere Sie auf, sie bis zum ' + datumLang(frist) + ' zu beseitigen.',
    10.5
  );

  blatt.tabelle(
    ['Nr.', 'Ort', 'Mangel', 'Festgestellt'],
    maengel.map((m, i) => [
      String(i + 1),
      m.raum || 'ohne Angabe',
      m.titel,
      datumLang(m.angelegt),
    ]),
    [0.5, 1.6, 4, 1.3]
  );

  // Beschreibungen, soweit vorhanden. Ein Satz mehr im Schreiben erspart
  // spaeter die Rueckfrage, was genau gemeint war.
  const mitText = maengel.filter((m) => m.beschreibung);
  if (mitText.length) {
    blatt.zwischentitel('Einzelheiten zu den Mängeln');
    for (const m of mitText) {
      const nummer = maengel.indexOf(m) + 1;
      blatt.absatz(nummer + '. ' + m.titel + ': ' + m.beschreibung, 10);
    }
  }

  const mitFoto = maengel.filter((m) => (m.bildIds || []).length).length;
  blatt.absatz(
    (mitFoto
      ? 'Zu ' + mitFoto + ' der aufgeführten Punkte liegen Lichtbilder mit Aufnahmedatum vor, ' +
        'die ich Ihnen auf Wunsch übersende. '
      : '') +
    'Bitte bestätigen Sie mir den Erhalt dieses Schreibens und teilen Sie mir mit, ' +
    'wann Sie die Arbeiten ausführen. Sollte die Frist fruchtlos verstreichen, ' +
    'behalte ich mir die mir zustehenden Rechte vor.',
    10.5
  );

  blatt.absatz('Mit freundlichen Grüßen', 10.5);
  blatt.y -= 34;
  blatt.absatz(absender.name || '', 10.5);

  try {
    await pdfTeilen(blatt.blob(), 'maengelruege.pdf', 'Mängelrüge');
  } catch (fehler) {
    melde('PDF konnte nicht geteilt werden.');
    console.error(fehler);
  }
}

async function pdfErzeugen(maengel, kontakte) {
  melde('PDF wird erstellt …');
  const projekt = (await einstellung('projektname')) || '';
  const blatt = new Blatt({
    titel: 'Mängelliste',
    untertitel: (projekt ? projekt + ' · ' : '') + 'Stand ' + datumLang(heute()),
    fusszeile: 'Hausbau App · Mängelliste',
  });

  // Nach Raum sortieren und durchnummerieren: die Nummer verbindet die
  // Übersicht vorn mit dem Nachweisblock hinten.
  const sortiert = [...maengel].sort((a, b) => {
    const raum = (a.raum || 'Ohne Raum').localeCompare(b.raum || 'Ohne Raum', 'de');
    return raum !== 0 ? raum : String(a.angelegt).localeCompare(String(b.angelegt));
  });
  sortiert.forEach((m, i) => { m.nummer = i + 1; });

  const offen = maengel.filter((m) => m.status !== 'behoben').length;
  blatt.absatz(
    `${maengel.length} Einträge, davon ${offen} noch nicht behoben. ` +
    'Die Übersicht nennt jeden Mangel einmal, danach folgt zu jedem Eintrag ' +
    'die Beschreibung mit den Fotos, die am Erfassungstag aufgenommen wurden.'
  );

  blatt.ueberschrift('Übersicht');
  blatt.tabelle(
    ['Nr.', 'Raum', 'Mangel', 'Gewerk', 'Frist', 'Status'],
    sortiert.map((m) => {
      return [
        String(m.nummer),
        m.raum || 'ohne Raum',
        m.titel,
        m.gewerk || '',
        m.frist ? datumLang(m.frist) : '',
        STATUS[m.status].kurz,
      ];
    }),
    [0.45, 1.4, 2.5, 1.7, 0.95, 1.1]
  );

  // Alle Fotos vorab laden. Erst danach kann gezeichnet werden, weil der
  // Schreiber die Bildmaße für den Seitenumbruch braucht.
  const fotos = new Map();
  for (const m of sortiert) {
    const geladen = [];
    for (const bildId of m.bildIds || []) {
      const eintrag = await daten.holen('bilder', bildId);
      const bild = eintrag ? await bildLaden(eintrag.blob) : null;
      if (bild) geladen.push(bild);
    }
    fotos.set(m.id, geladen);
  }

  for (const m of sortiert) {
    const kontakt = kontakte.find((k) => k.id === m.kontaktId);
    const bilder = fotos.get(m.id) || [];

    blatt.ueberschrift(`${m.nummer}. ${m.titel}`);
    blatt.wertzeile('Raum', m.raum || 'ohne Angabe');
    blatt.wertzeile('Gewerk', m.gewerk || 'ohne Angabe');
    blatt.wertzeile('Erfasst am', datumLang(m.angelegt));
    if (kontakt) blatt.wertzeile('Zuständig', [kontakt.name, kontakt.firma].filter(Boolean).join(', '));
    if (m.frist) blatt.wertzeile('Frist', datumLang(m.frist));
    blatt.wertzeile('Status', STATUS[m.status].name, true);
    if (m.beschreibung) blatt.absatz(m.beschreibung, 9.5);
    if (bilder.length) blatt.bilderreihe(bilder, { hoehe: 108 });
  }

  try {
    await pdfTeilen(blatt.blob(), 'maengelliste.pdf', 'Mängelliste');
  } catch (fehler) {
    melde('PDF konnte nicht geteilt werden.');
    console.error(fehler);
  }
}
