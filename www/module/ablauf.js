// Bauablauf: Reihenfolge der Gewerke.
//
// Der Kern ist die Terminrechnung: Eine Aufgabe hat entweder ein festes
// Startdatum oder haengt an einer Vorgaengeraufgabe. Verschiebt sich der
// Vorgaenger, wandert alles Nachfolgende mit. Ohne das waere der Plan nach
// der ersten Verzoegerung Makulatur - und Verzoegerungen gibt es immer.

import {
  el, feld, eingabe, zahlfeld, auswahl, knopf, karte, kopfzeile, hinweisKasten,
  leerzustand, zuZahl, melde, datumLang, heute, kontaktName, kontaktLang,
  anhaengen,
} from '../hilfen.js';
import { daten, einstellung } from '../daten.js';
import { blattOeffnen } from '../blatt.js';
import { Blatt, pdfTeilen, A4, RAND, INNEN } from '../pdf.js';

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

const MONATSNAMEN = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

/** Tage von a bis b, beide als ISO-Datum. Durchgehend UTC, wie plusTage. */
export function tageZwischen(a, b) {
  return Math.round(
    (new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / TAG
  );
}

/**
 * Rechnet den Balkenplan aus: eine gemeinsame Zeitachse und je Aufgabe die
 * Lage darauf.
 *
 * Alle Masse stehen in Tagen ab dem ersten Tag des Plans. Erst der Zeichner
 * macht daraus Prozente oder Punkte. So rechnet der Bildschirm und das PDF
 * dasselbe, und die Rechnung laesst sich ohne Browser pruefen.
 *
 * Aufgaben ohne Termin haben keinen Balken. Sie fallen nicht unter den Tisch,
 * sondern kommen als eigene Liste zurueck - ein Plan, der die Haelfte
 * verschweigt, waere schlimmer als keiner.
 */
export function balkenPlan(aufgaben) {
  const mitTermin = aufgaben.filter((a) => a.start && a.ende);
  const ohneTermin = aufgaben.filter((a) => !a.start || !a.ende);

  if (!mitTermin.length) {
    return { von: null, bis: null, tage: 0, zeilen: [], monate: [], ohneTermin };
  }

  const von = mitTermin.map((a) => a.start).sort()[0];
  const bis = mitTermin.map((a) => a.ende).sort().pop();
  const tage = tageZwischen(von, bis) + 1;

  const zeilen = mitTermin
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start) || a.titel.localeCompare(b.titel, 'de'))
    .map((a) => ({
      id: a.id,
      titel: a.titel,
      phase: a.phase,
      status: a.status || 'offen',
      start: a.start,
      ende: a.ende,
      ab: tageZwischen(von, a.start),
      dauer: tageZwischen(a.start, a.ende) + 1,
    }));

  // Monatsraster. Der erste Abschnitt beginnt am Planbeginn, nicht am
  // Monatsersten, sonst laege er links ausserhalb der Achse.
  const monate = [];
  let lauf = von;
  while (lauf <= bis) {
    const [j, m] = lauf.split('-').map(Number);
    const naechster = m === 12 ? `${j + 1}-01-01` : `${j}-${String(m + 1).padStart(2, '0')}-01`;
    const ende = naechster > bis ? bis : plusTage(naechster, -1);
    monate.push({
      name: MONATSNAMEN[m - 1],
      jahr: j,
      ab: tageZwischen(von, lauf),
      tage: tageZwischen(lauf, ende) + 1,
    });
    lauf = naechster;
  }

  return { von, bis, tage, zeilen, monate, ohneTermin };
}

// Dieselben drei Zustandsfarben wie auf dem Bildschirm: gruen fertig,
// bernstein laeuft, grau offen. Bewusst nicht die Markenfarbe, sonst waere
// "laeuft" von "fertig" kaum zu unterscheiden.
const BALKENFARBE = {
  fertig: [46, 125, 79],
  laeuft: [201, 138, 26],
  offen: [150, 158, 170],
};

export async function zeige(rahmen) {
  await zeichne(rahmen);
}

async function zeichne(rahmen, ansicht = 'liste') {
  rahmen.replaceChildren();
  const [roh, kontakte, maengel] = await Promise.all([
    daten.alle('aufgaben'), daten.alle('kontakte'), daten.alle('maengel'),
  ]);
  const neu = () => zeichne(rahmen, ansicht);

  anhaengen(rahmen, kopfzeile('Bauablauf', 'Was muss zuerst, was kann parallel, was später.'));

  if (!roh.length) {
    anhaengen(
      rahmen,
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

  anhaengen(
    rahmen,
    el('div', { klasse: 'geschossleiste' }, [
      ['liste', 'Liste'],
      ['balken', 'Balkenplan'],
    ].map(([wert, text]) =>
      el('button', {
        type: 'button', text,
        klasse: ansicht === wert ? 'aktiv' : null,
        onclick: () => zeichne(rahmen, wert),
      })
    ))
  );

  anhaengen(
    rahmen,
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
    anhaengen(rahmen, hinweisKasten('Zwei Aufgaben verweisen im Kreis aufeinander. Bitte einen Vorgänger lösen.', 'warn'));
  }
  if (aufgaben.every((a) => !a.start)) {
    anhaengen(rahmen, hinweisKasten('Noch kein Startdatum gesetzt. Trage es bei der ersten Aufgabe ein, der Rest rechnet sich daraus.', 'info'));
  }

  if (ansicht === 'balken') {
    zeigeBalken(rahmen, aufgaben, roh, kontakte, maengel, neu);
    return;
  }

  const phasen = PHASEN.filter((p) => aufgaben.some((a) => a.phase === p));
  const rest = [...new Set(aufgaben.map((a) => a.phase).filter((p) => !PHASEN.includes(p)))];

  for (const phase of [...phasen, ...rest]) {
    const drin = aufgaben.filter((a) => a.phase === phase);
    anhaengen(
      rahmen,
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
                  text: [zeit, kontakt ? kontaktName(kontakt) : null].filter(Boolean).join(' · '),
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

  anhaengen(
    rahmen,
    knopf('Arbeitsschritt hinzufügen', () => aufgabeBearbeiten({ status: 'offen' }, roh, kontakte, maengel, neu), 'knopf-haupt'),
    knopf('Plan als PDF teilen', () => pdfErzeugen(aufgaben, kontakte))
  );
}

// --------------------------------------------------------------- Balkenplan

// Punkte je Tag auf dem Bildschirm. Ein Bauplan laeuft ueber Monate; bei
// voller Breite waere ein Viertagesbalken ein Strich. Lieber breiter zeichnen
// und seitlich schieben lassen.
const PX_JE_TAG = 6;
const TITELSPALTE = 132;

function zeigeBalken(rahmen, aufgaben, roh, kontakte, maengel, neu) {
  const plan = balkenPlan(aufgaben);

  if (!plan.zeilen.length) {
    anhaengen(
      rahmen,
      karte([
        leerzustand(
          'Noch keine Termine',
          'Der Balkenplan braucht wenigstens ein Startdatum. Trage es beim ersten ' +
            'Arbeitsschritt ein, alles Weitere rechnet sich aus Dauer und Vorgänger.'
        ),
      ])
    );
    return;
  }

  const breite = Math.max(plan.tage * PX_JE_TAG, 280);
  const heuteAb = tageZwischen(plan.von, heute());
  const imZeitraum = heuteAb >= 0 && heuteAb < plan.tage;

  // Monatsköpfe
  const monatszeile = el('div', { klasse: 'balken-monate', stil: { width: breite + 'px' } },
    plan.monate.map((m) =>
      el('span', {
        klasse: 'balken-monat',
        stil: { left: m.ab * PX_JE_TAG + 'px', width: m.tage * PX_JE_TAG + 'px' },
        text: m.tage * PX_JE_TAG > 54 ? m.name : m.name.slice(0, 3),
        title: m.name + ' ' + m.jahr,
      })
    )
  );

  const zeilen = plan.zeilen.map((z) => {
    const kontakt = kontakte.find((k) => k.id === (roh.find((a) => a.id === z.id) || {}).kontaktId);
    const balken = el('span', {
      klasse: 'balken balken-' + z.status,
      stil: { left: z.ab * PX_JE_TAG + 'px', width: Math.max(z.dauer * PX_JE_TAG, 4) + 'px' },
      title: `${z.titel}: ${datumLang(z.start)} bis ${datumLang(z.ende)}`,
    });
    return el('button', {
      klasse: 'balken-zeile',
      onclick: () => aufgabeBearbeiten(roh.find((a) => a.id === z.id), roh, kontakte, maengel, neu),
    }, [
      el('span', { klasse: 'balken-titel' }, [
        el('strong', { text: z.titel }),
        el('span', {
          klasse: 'zeilen-unter',
          text: [`${z.dauer} T.`, kontakt ? kontaktName(kontakt) : null].filter(Boolean).join(' · '),
        }),
      ]),
      el('span', { klasse: 'balken-bahn', stil: { width: breite + 'px' } }, [balken]),
    ]);
  });

  // Das Raster liegt als eigene Ebene hinter den Zeilen, nicht in ihnen: So
  // laufen die Monatsstriche und die Heute-Linie ohne Unterbrechung durch.
  const raster = el('div', {
    klasse: 'balken-raster',
    stil: { left: TITELSPALTE + 'px', width: breite + 'px' },
  }, [
    ...plan.monate.slice(1).map((m) =>
      el('span', { klasse: 'balken-strich', stil: { left: m.ab * PX_JE_TAG + 'px' } })
    ),
    imZeitraum
      ? el('span', { klasse: 'balken-heute', stil: { left: heuteAb * PX_JE_TAG + 'px' } })
      : null,
  ]);

  anhaengen(
    rahmen,
    karte([
      el('h2', { text: 'Balkenplan' }),
      el('p', {
        klasse: 'unterzeile',
        text: `${datumLang(plan.von)} bis ${datumLang(plan.bis)}, ${plan.tage} Tage.` +
          (imZeitraum ? ' Die senkrechte Linie ist heute.' : ''),
      }),
      el('div', { klasse: 'balken-flaeche' }, [
        el('div', {
          klasse: 'balken-innen',
          stil: { width: (TITELSPALTE + breite) + 'px' },
        }, [
          el('div', { klasse: 'balken-kopf', stil: { marginLeft: TITELSPALTE + 'px' } }, [monatszeile]),
          raster,
          el('div', { klasse: 'balken-zeilen' }, zeilen),
        ]),
      ]),
      el('div', { klasse: 'legende' }, [
        el('span', {}, [el('i', { klasse: 'balken-offen' }), 'Offen']),
        el('span', {}, [el('i', { klasse: 'balken-laeuft' }), 'Läuft']),
        el('span', {}, [el('i', { klasse: 'balken-fertig' }), 'Fertig']),
      ]),
    ])
  );

  if (plan.ohneTermin.length) {
    anhaengen(
      rahmen,
      hinweisKasten(
        (plan.ohneTermin.length === 1
          ? 'Ein Arbeitsschritt hat keinen Termin und steht deshalb nicht im Balken: '
          : `${plan.ohneTermin.length} Arbeitsschritte haben keinen Termin und stehen deshalb nicht im Balken: `) +
          plan.ohneTermin.map((a) => a.titel).join(', ') + '.',
        'info'
      )
    );
  }

  anhaengen(
    rahmen,
    knopf('Balkenplan als PDF teilen', () => balkenPdf(plan), 'knopf-haupt'),
    knopf('Plan als Tabelle teilen', () => pdfErzeugen(aufgaben, kontakte), 'knopf-leise')
  );
}

/**
 * Der Balkenplan quer auf A4. Hochkant blieben je Monat sieben Millimeter,
 * darauf ist nichts mehr zu erkennen.
 */
async function balkenPdf(plan) {
  melde('PDF wird erstellt …');
  const projekt = (await einstellung('projektname')) || '';
  const blatt = new Blatt({
    titel: 'Balkenplan',
    untertitel: (projekt ? projekt + ' · ' : '') +
      `${datumLang(plan.von)} bis ${datumLang(plan.bis)}`,
    fusszeile: 'Termine gerechnet aus Dauer und Vorgänger',
  });

  const TITEL_PT = 150;
  const achseX = RAND + TITEL_PT;
  const achseBreite = INNEN - TITEL_PT;
  const proTag = achseBreite / plan.tage;
  const ZEILE = 15;

  blatt.absatz(
    `${plan.zeilen.length} Arbeitsschritte mit Termin über ${plan.tage} Tage. ` +
      'Die Balken zeigen Beginn und Ende, die Farbe den Stand.',
    9
  );

  const monatsKopf = () => {
    blatt.platz(ZEILE + 6);
    for (const m of plan.monate) {
      // Nur beschriften, wo das Wort auch hinpasst.
      if (m.tage * proTag < 26) continue;
      blatt.schreibe(m.name.slice(0, 3) + ' ' + String(m.jahr).slice(2), {
        groesse: 7.5, x: achseX + m.ab * proTag + 1, farbe: [95, 103, 114],
      });
    }
    blatt.y -= 4;
    blatt.linie(0.6, 0.75);
    blatt.y -= 3;
  };

  monatsKopf();

  for (const z of plan.zeilen) {
    if (blatt.y - ZEILE < RAND + 26) {
      blatt.neueSeite();
      monatsKopf();
    }
    blatt.schreibe(z.titel, { groesse: 8.5, x: RAND });

    // Monatsraster hinter dem Balken, damit sich die Lage ablesen laesst.
    for (const m of plan.monate.slice(1)) {
      blatt.senkrechte(achseX + m.ab * proTag, blatt.y - 3, blatt.y + 9, 0.9, 0.3);
    }

    blatt.flaeche(
      achseX + z.ab * proTag,
      blatt.y - 2,
      Math.max(z.dauer * proTag, 1.2),
      8,
      BALKENFARBE[z.status] || BALKENFARBE.offen
    );
    blatt.y -= ZEILE;
  }

  blatt.y -= 6;
  blatt.absatz(
    'Farben: grün fertig, violett läuft, grau offen.' +
      (plan.ohneTermin.length
        ? ' Ohne Termin und deshalb nicht abgebildet: ' +
          plan.ohneTermin.map((a) => a.titel).join(', ') + '.'
        : ''),
    8.5
  );

  try {
    await pdfTeilen(blatt.blob(), 'balkenplan.pdf', 'Balkenplan');
  } catch (fehler) {
    melde('PDF konnte nicht geteilt werden.');
    console.error(fehler);
  }
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
    [['', '– kein Kontakt –'], ...kontakte.map((k) => [k.id, kontaktLang(k, k.gewerk)])],
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
    fusszeile: 'Termine gerechnet aus Dauer und Vorgänger',
  });

  blatt.tabelle(
    ['Schritt', 'Phase', 'Beginn', 'Ende', 'Wer', 'Status'],
    aufgaben.map((a) => {
      const kontakt = kontakte.find((k) => k.id === a.kontaktId);
      return [
        a.titel, a.phase,
        a.start ? datumLang(a.start) : '',
        a.ende ? datumLang(a.ende) : '',
        kontakt ? kontaktName(kontakt) : '',
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
