// Bauablauf: Reihenfolge der Gewerke.
//
// Der Kern ist die Terminrechnung: Eine Aufgabe hat entweder ein festes
// Startdatum oder haengt an einer Vorgaengeraufgabe. Verschiebt sich der
// Vorgaenger, wandert alles Nachfolgende mit. Ohne das waere der Plan nach
// der ersten Verzoegerung Makulatur - und Verzoegerungen gibt es immer.

import {
  el, feld, eingabe, zahlfeld, auswahl, knopf, karte, kopfzeile, hinweisKasten,
  leerzustand, zuZahl, melde, datumLang, heute,
} from '../hilfen.js';
import { daten, einstellung } from '../daten.js';
import { blattOeffnen } from '../blatt.js';
import { Blatt, pdfTeilen } from '../pdf.js';

export const PHASEN = [
  'Vorbereitung', 'Erdarbeiten', 'Rohbau', 'Dach', 'Fenster und Türen',
  'Haustechnik roh', 'Innenausbau', 'Oberflächen', 'Feininstallation',
  'Außenanlagen', 'Abnahme', 'Mängelbeseitigung',
];

// Vorlage mit den ueblichen Gewerken und Dauern eines Einfamilienhauses.
// Die Reihenfolge ist das Wesentliche: Elektro vor Putz, Estrich vor Fliesen.
const VORLAGE = [
  { titel: 'Baugenehmigung liegt vor', phase: 'Vorbereitung', dauer: 1 },
  { titel: 'Baustelle einrichten, Absteckung', phase: 'Vorbereitung', dauer: 3 },
  { titel: 'Baugrube und Erdarbeiten', phase: 'Erdarbeiten', dauer: 5 },
  { titel: 'Bodenplatte oder Keller', phase: 'Erdarbeiten', dauer: 14 },
  { titel: 'Mauerwerk Erdgeschoss', phase: 'Rohbau', dauer: 10 },
  { titel: 'Decke Erdgeschoss', phase: 'Rohbau', dauer: 5 },
  { titel: 'Mauerwerk Obergeschoss', phase: 'Rohbau', dauer: 10 },
  { titel: 'Dachstuhl aufstellen', phase: 'Dach', dauer: 4 },
  { titel: 'Dachdeckung und Klempner', phase: 'Dach', dauer: 7 },
  { titel: 'Fenster und Außentüren einbauen', phase: 'Fenster und Türen', dauer: 4 },
  { titel: 'Elektro-Rohinstallation', phase: 'Haustechnik roh', dauer: 7 },
  { titel: 'Sanitär-Rohinstallation', phase: 'Haustechnik roh', dauer: 7 },
  { titel: 'Heizung-Rohinstallation', phase: 'Haustechnik roh', dauer: 5 },
  { titel: 'Innenputz', phase: 'Innenausbau', dauer: 7 },
  { titel: 'Trockenbau und Dachgeschossausbau', phase: 'Innenausbau', dauer: 10 },
  { titel: 'Estrich einbringen', phase: 'Innenausbau', dauer: 3 },
  { titel: 'Estrich trocknen lassen', phase: 'Innenausbau', dauer: 28 },
  { titel: 'Fliesenarbeiten', phase: 'Oberflächen', dauer: 8 },
  { titel: 'Malerarbeiten', phase: 'Oberflächen', dauer: 7 },
  { titel: 'Bodenbeläge verlegen', phase: 'Oberflächen', dauer: 5 },
  { titel: 'Innentüren einbauen', phase: 'Oberflächen', dauer: 2 },
  { titel: 'Elektro-Feininstallation', phase: 'Feininstallation', dauer: 4 },
  { titel: 'Sanitärobjekte setzen', phase: 'Feininstallation', dauer: 4 },
  { titel: 'Heizung in Betrieb nehmen', phase: 'Feininstallation', dauer: 2 },
  { titel: 'Außenanlagen und Zufahrt', phase: 'Außenanlagen', dauer: 10 },
  { titel: 'Bauabnahme mit Sachverständigem', phase: 'Abnahme', dauer: 1 },
];

const TAG = 86400000;

// Durchgehend UTC rechnen. Mit Ortszeit liegt Mitternacht in Deutschland vor
// dem UTC-Tageswechsel, und toISOString() gaebe den Vortag zurueck - der Plan
// verlöre bei jedem Schritt einen Tag. Sommerzeitwechsel fallen damit auch weg.
const plusTage = (iso, tage) =>
  new Date(new Date(iso + 'T00:00:00Z').getTime() + tage * TAG).toISOString().slice(0, 10);

/**
 * Rechnet Start und Ende jeder Aufgabe aus.
 *
 * Aufgaben ohne Vorgaenger brauchen ein eigenes Startdatum. Aufgaben mit
 * Vorgaenger beginnen am Tag nach dessen Ende. Ein Zaehler bricht Ringe ab,
 * damit ein versehentlich zirkulaerer Verweis die App nicht aufhaengt.
 */
export function terminePlanen(aufgaben) {
  const nachId = new Map(aufgaben.map((a) => [a.id, a]));
  const gerechnet = new Map();

  function rechne(aufgabe, tiefe = 0) {
    if (gerechnet.has(aufgabe.id)) return gerechnet.get(aufgabe.id);
    if (tiefe > aufgaben.length) return { start: null, ende: null, ring: true };

    let start = aufgabe.start || null;

    if (aufgabe.vorgaengerId && nachId.has(aufgabe.vorgaengerId)) {
      const vorher = rechne(nachId.get(aufgabe.vorgaengerId), tiefe + 1);
      if (vorher.ende) start = plusTage(vorher.ende, 1);
    }

    const dauer = Math.max(1, aufgabe.dauer || 1);
    const ergebnis = {
      start,
      ende: start ? plusTage(start, dauer - 1) : null,
      dauer,
    };
    gerechnet.set(aufgabe.id, ergebnis);
    return ergebnis;
  }

  return aufgaben.map((a) => ({ ...a, ...rechne(a) }));
}

export async function zeige(rahmen) {
  await zeichne(rahmen);
}

async function zeichne(rahmen) {
  rahmen.replaceChildren();
  const [roh, kontakte, maengel] = await Promise.all([
    daten.alle('aufgaben'), daten.alle('kontakte'), daten.alle('maengel'),
  ]);
  const neu = () => zeichne(rahmen);

  rahmen.append(kopfzeile('Bauablauf', 'Was muss zuerst, was kann parallel, was später.'));

  if (!roh.length) {
    rahmen.append(
      karte([
        leerzustand(
          'Starte mit einer Vorlage',
          'Die Vorlage enthält die typischen Bauphasen eines Einfamilienhauses in der ' +
            'richtigen Reihenfolge, samt üblicher Dauern. Alles lässt sich danach anpassen.'
        ),
        knopf('Vorlage laden', () => vorlageLaden(neu), 'knopf-haupt'),
        knopf('Leer beginnen', () => aufgabeBearbeiten({ status: 'offen' }, [], kontakte, maengel, neu)),
      ]),
      hinweisKasten(
        'Der Nutzen liegt in der Reihenfolge: Estrich vor Fliesen, Elektro vor Putz. ' +
          'Wer das vorher durchdenkt, zahlt später keinen Rückbau.',
        'info'
      )
    );
    return;
  }

  const aufgaben = terminePlanen(roh);
  const offen = aufgaben.filter((a) => a.status !== 'fertig').length;
  const ende = aufgaben.map((a) => a.ende).filter(Boolean).sort().pop();

  rahmen.append(
    karte([
      el('h2', { text: 'Stand' }),
      el('p', {
        klasse: 'unterzeile',
        text: `${aufgaben.length} Arbeitsschritte, davon ${offen} offen.` +
          (ende ? ` Letzter berechneter Termin: ${datumLang(ende)}.` : ''),
      }),
      el('div', { klasse: 'fortschrittsbalken' }, [
        el('div', { stil: { width: Math.round(((aufgaben.length - offen) / aufgaben.length) * 100) + '%' } }),
      ]),
    ])
  );

  if (aufgaben.some((a) => a.ring)) {
    rahmen.append(hinweisKasten('Zwei Aufgaben verweisen im Kreis aufeinander. Bitte einen Vorgänger lösen.', 'warn'));
  }
  if (aufgaben.every((a) => !a.start)) {
    rahmen.append(hinweisKasten('Noch kein Startdatum gesetzt. Trage es bei der ersten Aufgabe ein, der Rest rechnet sich daraus.', 'info'));
  }

  const phasen = PHASEN.filter((p) => aufgaben.some((a) => a.phase === p));
  const rest = [...new Set(aufgaben.map((a) => a.phase).filter((p) => !PHASEN.includes(p)))];

  for (const phase of [...phasen, ...rest]) {
    const drin = aufgaben.filter((a) => a.phase === phase);
    rahmen.append(
      karte([
        el('h2', { text: phase }),
        el('ul', { klasse: 'liste' }, drin.map((a) => {
          const kontakt = kontakte.find((k) => k.id === a.kontaktId);
          const zeit = a.start
            ? `${datumLang(a.start)} – ${datumLang(a.ende)} (${a.dauer} T.)`
            : `${a.dauer} Tage, kein Termin`;
          return el('li', {}, [
            el('button', {
              klasse: 'listenzeile',
              onclick: () => aufgabeBearbeiten(a, roh, kontakte, maengel, neu),
            }, [
              el('span', { klasse: 'zeilen-text' }, [
                el('span', { klasse: 'zeilen-titel', text: a.titel }),
                el('span', {
                  klasse: 'zeilen-unter',
                  text: [zeit, kontakt ? kontakt.name : null].filter(Boolean).join(' · '),
                }),
              ]),
              el('span', {
                klasse: 'marke ' + (a.status === 'fertig' ? 'marke-fertig' : a.status === 'laeuft' ? 'marke-arbeit' : 'marke-offen'),
                text: a.status === 'fertig' ? 'Fertig' : a.status === 'laeuft' ? 'Läuft' : 'Offen',
              }),
            ]),
          ]);
        })),
      ])
    );
  }

  rahmen.append(
    knopf('Arbeitsschritt hinzufügen', () => aufgabeBearbeiten({ status: 'offen' }, roh, kontakte, maengel, neu), 'knopf-haupt'),
    knopf('Plan als PDF teilen', () => pdfErzeugen(aufgaben, kontakte))
  );
}

async function vorlageLaden(nachher) {
  const start = window.prompt('Wann geht es los? (TT.MM.JJJJ)', datumLang(heute()));
  if (start === null) return;

  const teile = start.trim().split('.');
  const startIso = teile.length === 3
    ? `${teile[2]}-${teile[1].padStart(2, '0')}-${teile[0].padStart(2, '0')}`
    : heute();

  // Die Vorlage ist eine Kette: jede Aufgabe haengt an der vorherigen.
  // Wer parallel arbeiten laesst, loest den Vorgaenger einzeln auf.
  let vorherId = null;
  for (const [i, eintrag] of VORLAGE.entries()) {
    const id = await daten.sichern('aufgaben', {
      titel: eintrag.titel,
      phase: eintrag.phase,
      dauer: eintrag.dauer,
      start: i === 0 ? startIso : null,
      vorgaengerId: vorherId,
      status: 'offen',
      kontaktId: null,
      notiz: '',
    });
    vorherId = id;
  }
  melde('Vorlage geladen.');
  await nachher();
}

function aufgabeBearbeiten(aufgabe, alleAufgaben, kontakte, maengel, nachher) {
  const titel = eingabe({ value: aufgabe.titel || '', placeholder: 'z. B. Estrich einbringen' });
  const phase = auswahl(PHASEN.map((p) => [p, p]), aufgabe.phase || 'Rohbau');
  const dauer = zahlfeld({ value: String(aufgabe.dauer || 1) });
  const status = auswahl(
    [['offen', 'Offen'], ['laeuft', 'Läuft'], ['fertig', 'Fertig']],
    aufgabe.status || 'offen'
  );

  // Sich selbst kann eine Aufgabe nicht als Vorgaenger haben.
  const moeglich = alleAufgaben.filter((a) => a.id !== aufgabe.id);
  const vorgaenger = auswahl(
    [['', '– fester Termin –'], ...moeglich.map((a) => [a.id, a.titel])],
    aufgabe.vorgaengerId ?? ''
  );
  const start = el('input', { type: 'date', value: aufgabe.start || '' });
  const startfeld = feld('Startdatum', start, 'Nur nötig, wenn kein Vorgänger gesetzt ist.');

  function startSichtbarkeit() {
    startfeld.hidden = Boolean(vorgaenger.value);
  }
  vorgaenger.addEventListener('change', startSichtbarkeit);
  startSichtbarkeit();

  const kontakt = auswahl(
    [['', '– kein Kontakt –'], ...kontakte.map((k) => [k.id, k.name + (k.gewerk ? ' (' + k.gewerk + ')' : '')])],
    aufgabe.kontaktId ?? ''
  );
  const notiz = el('textarea', {}, [aufgabe.notiz || '']);

  const verknuepfterMangel = aufgabe.mangelId ? maengel.find((m) => m.id === aufgabe.mangelId) : null;

  blattOeffnen(
    aufgabe.id ? 'Arbeitsschritt bearbeiten' : 'Arbeitsschritt anlegen',
    [
      verknuepfterMangel
        ? el('p', { klasse: 'kasten kasten-info', text: 'Gehört zum Mangel: ' + verknuepfterMangel.titel })
        : null,
      feld('Was ist zu tun?', titel),
      feld('Phase', phase),
      feld('Dauer in Tagen', dauer),
      feld('Beginnt nach', vorgaenger, 'Verschiebt sich der Vorgänger, wandert dieser Schritt mit.'),
      startfeld,
      feld('Status', status),
      feld('Wer macht es?', kontakt),
      feld('Notiz', notiz),
    ].filter(Boolean),
    async () => {
      const wert = {
        titel: titel.value.trim(),
        phase: phase.value,
        dauer: Math.max(1, Math.round(zuZahl(dauer.value))),
        vorgaengerId: vorgaenger.value || null,
        start: vorgaenger.value ? null : (start.value || null),
        status: status.value,
        kontaktId: kontakt.value || null,
        notiz: notiz.value.trim(),
        mangelId: aufgabe.mangelId ?? null,
      };
      if (!wert.titel) throw new Error('Bitte eintragen, was zu tun ist.');
      if (aufgabe.id) wert.id = aufgabe.id;
      await daten.sichern('aufgaben', wert);
      await nachher();
    },
    {
      loeschen: aufgabe.id
        ? async () => {
            // Nachfolger nicht verwaisen lassen: sie erben den Vorgaenger
            // der geloeschten Aufgabe.
            for (const andere of alleAufgaben) {
              if (andere.vorgaengerId === aufgabe.id) {
                await daten.sichern('aufgaben', { ...andere, vorgaengerId: aufgabe.vorgaengerId ?? null });
              }
            }
            await daten.loeschen('aufgaben', aufgabe.id);
            await nachher();
          }
        : null,
    }
  );
}

async function pdfErzeugen(aufgaben, kontakte) {
  const projekt = (await einstellung('projektname')) || '';
  const blatt = new Blatt({
    titel: 'Bauablaufplan',
    untertitel: (projekt ? projekt + ' · ' : '') + 'Stand ' + datumLang(heute()),
    fusszeile: 'Hausbau App · Termine gerechnet aus Dauer und Vorgänger',
  });

  blatt.tabelle(
    ['Schritt', 'Phase', 'Beginn', 'Ende', 'Wer', 'Status'],
    aufgaben.map((a) => {
      const kontakt = kontakte.find((k) => k.id === a.kontaktId);
      return [
        a.titel, a.phase,
        a.start ? datumLang(a.start) : '',
        a.ende ? datumLang(a.ende) : '',
        kontakt ? kontakt.name : '',
        a.status === 'fertig' ? 'Fertig' : a.status === 'laeuft' ? 'Läuft' : 'Offen',
      ];
    }),
    [3, 1.6, 1.2, 1.2, 1.6, 1]
  );

  try {
    await pdfTeilen(blatt.blob(), 'bauablauf.pdf', 'Bauablaufplan');
  } catch (fehler) {
    melde('PDF konnte nicht geteilt werden.');
    console.error(fehler);
  }
}
