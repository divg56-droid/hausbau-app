// Bauleitfaden: was in welcher Reihenfolge zu tun ist.
//
// Zwei Ansichten, weil es zwei Fragen sind:
//
//   Schritt fuer Schritt   Was ist als Naechstes dran? Zeigt genau einen
//                          Punkt samt Begruendung und den Weg dorthin.
//   Alle Phasen            Wo stehe ich insgesamt? Sechs Phasen zum
//                          Aufklappen mit Fortschritt.
//
// Gespeichert wird nur der Haken, nicht der Text. Die Vorlage steht in
// leitfaden-daten.js; waechst sie, taucht ein neuer Punkt einfach auf.

import {
  el, knopf, karte, kopfzeile, hinweisKasten, melde, datumLang, heute,
} from '../hilfen.js';
import { daten, einstellung } from '../daten.js';
import { PHASEN, leitfadenStand } from '../leitfaden-daten.js';

export async function zeige(rahmen) {
  await zeichne(rahmen);
}

async function ansichtLesen() {
  return (await einstellung('leitfaden_ansicht')) === 'alle' ? 'alle' : 'schritt';
}

async function zeichne(rahmen) {
  rahmen.replaceChildren();
  const [gespeichert, ansicht] = await Promise.all([
    daten.alle('leitfaden'), ansichtLesen(),
  ]);
  const stand = leitfadenStand(gespeichert);
  const neu = () => zeichne(rahmen);

  const anteil = stand.gesamt ? Math.round((stand.erledigt / stand.gesamt) * 100) : 0;

  rahmen.append(
    kopfzeile('Bauleitfaden', 'Die Reihenfolge ist der Inhalt: Fast jeder teure Fehler kommt zu spät.'),
    el('div', { klasse: 'geschossleiste' }, [
      ['schritt', 'Schritt für Schritt'],
      ['alle', 'Alle Phasen'],
    ].map(([wert, text]) =>
      el('button', {
        type: 'button', text,
        klasse: ansicht === wert ? 'aktiv' : null,
        onclick: async () => { await einstellung('leitfaden_ansicht', wert); await neu(); },
      })
    )),
    karte([
      el('h2', { text: 'Gesamtfortschritt' }),
      el('p', {
        klasse: 'unterzeile',
        text: `${stand.erledigt} von ${stand.gesamt} Punkten erledigt, ${anteil} Prozent.`,
      }),
      el('div', { klasse: 'fortschrittsbalken' }, [
        el('div', { stil: { width: anteil + '%' } }),
      ]),
    ])
  );

  if (ansicht === 'alle') zeigeAllePhasen(rahmen, stand, neu);
  else zeigeSchritt(rahmen, stand, neu);
}

// -------------------------------------------------------- Schritt fuer Schritt

function zeigeSchritt(rahmen, stand, neu) {
  const phase = stand.laufend;
  const punkt = stand.naechster;

  if (!punkt) {
    rahmen.append(
      karte([
        el('h2', { text: 'Alles abgehakt' }),
        el('p', {
          klasse: 'unterzeile',
          text: 'Alle Punkte des Leitfadens sind erledigt. Was jetzt noch kommt, ' +
            'steht in der Mängelliste und in den Gewährleistungsfristen.',
        }),
        knopf('Zur Mängelliste', () => { location.hash = '#/maengel'; }, 'knopf-leise'),
      ])
    );
    return;
  }

  const anteil = Math.round((phase.fertig / phase.gesamt) * 100);

  rahmen.append(
    karte([
      el('p', {
        klasse: 'unterzeile', stil: { textTransform: 'uppercase', letterSpacing: '.06em' },
        text: 'Aktueller Bauabschnitt',
      }),
      el('h2', { text: phase.titel }),
      el('p', { klasse: 'unterzeile', text: phase.text }),
      el('div', { klasse: 'fortschrittsbalken' }, [
        el('div', { stil: { width: anteil + '%' } }),
      ]),
      el('p', {
        klasse: 'unterzeile',
        text: `${phase.fertig} von ${phase.gesamt} in dieser Phase erledigt.`,
      }),
    ]),

    karte([
      el('p', { klasse: 'unterzeile', text: 'Als Nächstes' }),
      el('h2', { text: punkt.titel }),
      el('p', { text: punkt.text }),
      el('div', { klasse: 'knopf-reihe' }, [
        knopf('Erledigt', () => abhaken(punkt, true, neu), 'knopf-haupt'),
        punkt.ziel
          ? knopf('Dort hin', () => { location.hash = punkt.ziel; })
          : null,
      ].filter(Boolean)),
    ]),

    // Der Rest der Phase, damit man sieht, was noch kommt, ohne die
    // Gesamtliste aufmachen zu muessen.
    karte([
      el('h2', { text: 'Noch in dieser Phase' }),
      el('ul', { klasse: 'liste' }, phase.punkte
        .filter((p) => p.id !== punkt.id)
        .map((p) => zeile(p, neu))),
    ])
  );
}

// --------------------------------------------------------------- Alle Phasen

function zeigeAllePhasen(rahmen, stand, neu) {
  for (const phase of stand.phasen) {
    const anteil = Math.round((phase.fertig / phase.gesamt) * 100);
    const offen = phase.gesamt - phase.fertig;

    rahmen.append(
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
    onchange: (e) => abhaken(punkt, e.target.checked, neu),
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
 */
async function abhaken(punkt, erledigt, nachher) {
  await daten.sichern('leitfaden', {
    id: punkt.id,
    erledigt,
    am: erledigt ? heute() : null,
    notiz: punkt.notiz || '',
  });
  if (erledigt) melde('Abgehakt.');
  await nachher();
}
