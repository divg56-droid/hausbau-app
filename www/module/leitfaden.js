// Bauleitfaden: was in welcher Reihenfolge zu tun ist.
//
// Zwei Ansichten, weil es zwei Fragen sind:
//
//   Wizard        Was ist jetzt dran? Genau ein Punkt, gross, mit Begruendung
//                 und einem Weg vor und zurueck. Daneben die Phasenliste,
//                 damit man weiss, wo man im Ganzen steht.
//   Alle Phasen   Wo stehe ich insgesamt? Sechs Phasen zum Aufklappen.
//
// Die Stelle, an der man steht, wird gemerkt. Ohne das landet man nach jedem
// Wechsel wieder beim ersten offenen Punkt, auch wenn man gerade drei weiter
// gelesen hat.
//
// Gespeichert wird sonst nur der Haken, nicht der Text. Die Vorlage steht in
// leitfaden-daten.js; waechst sie, taucht ein neuer Punkt einfach auf.

import {
  el, feld, auswahl, knopf, karte, kartengitter, kopfzeile, hinweisKasten, melde,
  datumLang, heute, zahl, anhaengen,
} from '../hilfen.js';
import { daten, einstellung } from '../daten.js';
import { leitfadenStand } from '../leitfaden-daten.js';
import { bauweise } from '../bauweise.js';

export async function zeige(rahmen) {
  await zeichne(rahmen);
}

async function ansichtLesen() {
  return (await einstellung('leitfaden_ansicht')) === 'alle' ? 'alle' : 'wizard';
}

async function zeichne(rahmen) {
  rahmen.replaceChildren();
  const [gespeichert, ansicht, stelle, art] = await Promise.all([
    daten.alle('leitfaden'), ansichtLesen(), einstellung('leitfaden_punkt'), bauweise(),
  ]);
  // Der Leitfaden zeigt nur, was zur Bauweise passt. Haken zu Punkten, die
  // hier nicht gelten, bleiben gespeichert und zaehlen nur nicht mit.
  const stand = leitfadenStand(gespeichert, art.id);
  const neu = () => zeichne(rahmen);

  const anteil = stand.gesamt ? Math.round((stand.erledigt / stand.gesamt) * 100) : 0;

  anhaengen(
    rahmen,
    kopfzeile(
      'Bauleitfaden',
      'Die Reihenfolge ist der Inhalt: Fast jeder teure Fehler kommt zu spät. ' +
        'Zugeschnitten auf: ' + art.name + '.'
    ),
    el('div', { klasse: 'geschossleiste' }, [
      ['wizard', 'Schritt für Schritt'],
      ['alle', 'Alle Phasen'],
    ].map(([wert, text]) =>
      el('button', {
        type: 'button', text,
        klasse: ansicht === wert ? 'aktiv' : null,
        onclick: async () => { await einstellung('leitfaden_ansicht', wert); await neu(); },
      })
    )),
    karte([
      el('div', { klasse: 'kachelkopf' }, [
        el('span', { klasse: 'kachelname', text: 'Gesamtfortschritt' }),
        el('strong', { text: anteil + ' %' }),
      ]),
      el('div', { klasse: 'fortschrittsbalken' }, [
        el('div', { stil: { width: anteil + '%' } }),
      ]),
      el('p', {
        klasse: 'unterzeile',
        stil: { textAlign: 'center', margin: '0' },
        text: `${stand.erledigt} von ${stand.gesamt} abgeschlossen`,
      }),
    ])
  );

  if (ansicht === 'alle') zeigeAllePhasen(rahmen, stand, neu);
  else zeigeWizard(rahmen, stand, stelle, neu);
}

// ------------------------------------------------------------------ Wizard

/** Alle Punkte in einer Reihe, jeder weiss, zu welcher Phase er gehoert. */
const flachLegen = (stand) =>
  stand.phasen.flatMap((phase) => phase.punkte.map((punkt) => ({ ...punkt, phase })));

/** Merkt sich, wo man steht. Nur ein Zeiger, keine Bewertung. */
const stelleMerken = (id) => einstellung('leitfaden_punkt', id);

function zeigeWizard(rahmen, stand, gemerkt, neu) {
  const flach = flachLegen(stand);
  // Eine Phase, aus der die Bauweise alles herausgefiltert hat, taucht nicht
  // auf. Sonst stuende sie in der Wahl und fuehrte beim Anklicken ins Leere.
  const phasen = stand.phasen.filter((p) => p.gesamt > 0);

  // Wo man zuletzt war. Ist der Punkt aus der Vorlage verschwunden oder war
  // man noch nie hier, faengt man beim naechsten offenen an.
  let stelle = flach.findIndex((p) => p.id === gemerkt);
  if (stelle < 0) {
    stelle = stand.naechster ? flach.findIndex((p) => p.id === stand.naechster.id) : 0;
  }
  if (stelle < 0) stelle = 0;

  const punkt = flach[stelle];
  const phase = punkt.phase;
  const inPhase = phase.punkte.findIndex((p) => p.id === punkt.id);
  const anteilPhase = Math.round((phase.fertig / phase.gesamt) * 100);

  const springen = async (ziel) => {
    await stelleMerken(flach[ziel].id);
    await neu();
  };

  // ---------------------------------------------------------- Linke Spalte
  const phasenwahl = auswahl(
    phasen.map((p, i) => [
      p.id,
      `Phase ${i + 1}: ${p.titel}`,
    ]),
    phase.id
  );
  phasenwahl.addEventListener('change', async () => {
    const ziel = phasen.find((p) => p.id === phasenwahl.value);
    // In eine Phase springt man auf ihren ersten offenen Punkt: Das ist das,
    // was dort ansteht.
    const offen = ziel.punkte.find((p) => !p.erledigt) || ziel.punkte[0];
    await stelleMerken(offen.id);
    await neu();
  });

  const aufgabe = karte([
    el('div', { klasse: 'wizard-kopf' }, [
      phasenwahl,
      el('span', {
        klasse: 'marke',
        text: `Aufgabe ${inPhase + 1} von ${phase.gesamt}`,
      }),
    ]),
    el('p', { klasse: 'unterzeile', stil: { margin: '10px 0 4px' }, text: 'Phase-Fortschritt' }),
    el('div', { klasse: 'fortschrittsbalken' }, [
      el('div', { stil: { width: anteilPhase + '%' } }),
    ]),
    el('p', {
      klasse: 'unterzeile',
      text: `${phase.fertig} von ${phase.gesamt} in dieser Phase erledigt.`,
    }),

    el('h2', { klasse: 'wizard-titel', text: punkt.titel }),
    punkt.erledigt && punkt.am
      ? el('p', { klasse: 'unterzeile', text: 'Erledigt am ' + datumLang(punkt.am) })
      : null,
    el('p', { klasse: 'wizard-text', text: punkt.text }),
    punkt.ziel
      ? knopf('Dort hin', () => { location.hash = punkt.ziel; }, 'knopf-leise')
      : null,

    el('div', { klasse: 'wizard-fuss' }, [
      el('button', {
        klasse: 'knopf', type: 'button', text: '‹ Vorherige Aufgabe',
        disabled: stelle === 0,
        onclick: () => springen(stelle - 1),
      }),
      knopf(
        punkt.erledigt ? 'Haken entfernen' : 'Als erledigt markieren',
        () => abhaken(punkt, !punkt.erledigt, flach, stelle, neu),
        punkt.erledigt ? 'knopf' : 'knopf-haupt'
      ),
      el('button', {
        klasse: 'knopf', type: 'button', text: 'Nächste Aufgabe ›',
        disabled: stelle >= flach.length - 1,
        onclick: () => springen(stelle + 1),
      }),
    ]),
  ]);

  // ---------------------------------------------------------- Rechte Spalte
  const uebersicht = karte([
    el('h2', { text: 'Phasen-Übersicht' }),
    el('ul', { klasse: 'liste phasenliste' }, phasen.map((p, i) => {
      const fertig = p.fertig === p.gesamt;
      return el('li', {}, [
        el('button', {
          klasse: 'listenzeile' + (p.id === phase.id ? ' aktiv' : ''),
          type: 'button',
          onclick: async () => {
            const offen = p.punkte.find((x) => !x.erledigt) || p.punkte[0];
            await stelleMerken(offen.id);
            await neu();
          },
        }, [
          el('span', {
            klasse: 'phasen-zeichen' + (fertig ? ' fertig' : ''),
            text: fertig ? '✓' : String(i + 1),
          }),
          el('span', { klasse: 'zeilen-text' }, [
            el('span', { klasse: 'zeilen-titel', text: p.titel }),
          ]),
          el('span', { klasse: 'phasen-zahl', text: p.fertig + ' / ' + p.gesamt }),
        ]),
      ]);
    })),
  ]);

  anhaengen(rahmen, el('div', { klasse: 'wizard' }, [aufgabe, uebersicht]));

  if (!stand.naechster) {
    anhaengen(
      rahmen,
      hinweisKasten(
        'Alle Punkte des Leitfadens sind erledigt. Was jetzt noch kommt, steht in ' +
          'der Mängelliste und in den Gewährleistungsfristen.',
        'gut'
      )
    );
  }
}

// --------------------------------------------------------------- Alle Phasen

function zeigeAllePhasen(rahmen, stand, neu) {
  // Sechs Bloecke untereinander sind auf einem Bildschirm eine Kolonne mit
  // viel Luft daneben. In zwei Spalten sieht man den ganzen Bau auf einmal.
  const gitter = kartengitter([]);
  anhaengen(rahmen, gitter);

  for (const phase of stand.phasen) {
    const anteil = Math.round((phase.fertig / phase.gesamt) * 100);
    const offen = phase.gesamt - phase.fertig;

    anhaengen(
      gitter,
      el('details', {
        klasse: 'karte phasenblock',
        // Die laufende Phase steht offen, die anderen zugeklappt. Sechs
        // aufgeklappte Phasen mit vierundsechzig Punkten sind eine Wand.
        open: phase.id === stand.laufend.id,
      }, [
        el('summary', {}, [
          el('span', { klasse: 'phasen-titel', text: phase.titel }),
          el('span', {
            klasse: 'phasen-zahl',
            text: `${phase.fertig} / ${phase.gesamt}`,
          }),
        ]),
        el('div', { klasse: 'fortschrittsbalken' }, [
          el('div', { stil: { width: anteil + '%' } }),
        ]),
        el('p', { klasse: 'unterzeile', text: phase.text }),
        el('ul', { klasse: 'liste' }, phase.punkte.map((p) => zeile(p, neu))),
        offen === 0
          ? hinweisKasten('Diese Phase ist vollständig abgehakt.', 'gut')
          : null,
      ])
    );
  }
}

// ------------------------------------------------------------------- Bausteine

function zeile(punkt, neu) {
  const haken = el('input', {
    type: 'checkbox',
    checked: punkt.erledigt,
    'aria-label': punkt.titel,
    onchange: (e) => abhaken(punkt, e.target.checked, null, 0, neu),
  });

  return el('li', {}, [
    el('div', { klasse: 'leitfaden-zeile' + (punkt.erledigt ? ' erledigt' : '') }, [
      haken,
      el('div', { klasse: 'zeilen-text' }, [
        el('span', { klasse: 'zeilen-titel', text: punkt.titel }),
        el('span', { klasse: 'zeilen-unter', text: punkt.text }),
        punkt.erledigt && punkt.am
          ? el('span', { klasse: 'zeilen-unter', text: 'erledigt am ' + datumLang(punkt.am) })
          : null,
      ]),
      punkt.ziel
        ? el('button', {
            klasse: 'knopf knopf-schmal', type: 'button', text: 'Öffnen',
            onclick: () => { location.hash = punkt.ziel; },
          })
        : null,
    ]),
  ]);
}

/**
 * Setzt oder entfernt den Haken.
 *
 * Die Kennung des Punktes ist zugleich die Kennung des Satzes. Damit gibt es
 * je Punkt genau einen Datensatz, auch wenn zwei Geraete ihn gleichzeitig
 * abhaken; der Abgleich fuehrt sie ueber dieselbe Kennung zusammen.
 *
 * Im Wizard rueckt der Haken zugleich eine Aufgabe weiter: Abhaken heisst
 * dort "fertig, was kommt jetzt".
 */
async function abhaken(punkt, erledigt, flach, stelle, nachher) {
  await daten.sichern('leitfaden', {
    id: punkt.id,
    erledigt,
    am: erledigt ? heute() : null,
    notiz: punkt.notiz || '',
  });
  if (erledigt) melde('Abgehakt.');
  if (erledigt && flach && stelle < flach.length - 1) {
    await stelleMerken(flach[stelle + 1].id);
  }
  await nachher();
}
