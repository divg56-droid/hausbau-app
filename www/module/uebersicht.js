// Projektuebersicht: der erste Bildschirm nach dem Start.
//
// Die Frage, die er beantwortet, ist nicht "was kann die App", sondern "wie
// steht mein Bau gerade". Deshalb Zahlen und offene Punkte statt einer
// Kachelwand. Wohin man gehen kann, sagt die Seitenleiste.
//
// Alles hier ist abgeleitet und wird nirgends gespeichert. Der Bildschirm
// rechnet bei jedem Aufruf neu; bei den Datenmengen eines Einfamilienhauses
// kostet das nichts und kann dafuer nicht veralten.

import {
  el, eur, knopf, karte, kopfzeile, hinweisKasten, datumLang, heute, zahl,
} from '../hilfen.js';
import { daten, einstellung } from '../daten.js';
import { finanzierungsstand } from './finanzierung.js';
import { postenRechnen } from './baukasse.js';
import { terminePlanen } from './ablauf.js';
import { STATUS } from './maengel.js';
import { leitfadenStand } from '../leitfaden-daten.js';
import { todoStand, todosSortieren } from './todos.js';

export async function zeige(rahmen) {
  const [projekt, stand, posten, belege, aufgaben, maengel, tagebuch, haken, todos] =
    await Promise.all([
    einstellung('projektname'),
    finanzierungsstand(),
    daten.alle('posten'),
    daten.alle('belege'),
    daten.alle('aufgaben'),
    daten.alle('maengel'),
    daten.alle('tagebuch'),
    daten.alle('leitfaden'),
    daten.alle('todos'),
  ]);
  const leitfaden = leitfadenStand(haken);

  const gerechnet = posten.map((p) => ({ ...p, ...postenRechnen(p, belege) }));
  const geplant = gerechnet.reduce((s, p) => s + p.geplant, 0);
  const auftrag = gerechnet.reduce((s, p) => s + p.massgeblich, 0);
  const gezahlt = belege.reduce((s, b) => s + (b.betrag || 0), 0);
  const mehr = gerechnet.reduce((s, p) => s + p.differenz, 0);
  const rest = stand.gesamt - auftrag;

  rahmen.append(
    kopfzeile(
      projekt || 'Dein Bauprojekt',
      stand.gesamt > 0 || posten.length
        ? 'Stand ' + datumLang(heute())
        : 'Alle Daten bleiben auf diesem Gerät. Kein Konto, keine Übertragung.'
    )
  );

  // Erst gar nichts erfasst: Dann hilft keine Kennzahl, sondern ein Weg hinein.
  if (!stand.posten.length && !posten.length && !aufgaben.length && !maengel.length &&
      !todos.length) {
    rahmen.append(
      karte([
        el('h2', { text: 'Fang mit dem Geld an' }),
        el('p', {
          klasse: 'unterzeile',
          text: 'Aus Eigenkapital und Darlehen entsteht dein Budget. Alles Weitere, ' +
            'von der Kostenaufstellung bis zum Restbudget, rechnet sich daraus.',
        }),
        knopf('Budget anlegen', () => { location.hash = '#/finanzierung'; }, 'knopf-haupt'),
        knopf('Erst einmal Baukosten schätzen', () => { location.hash = '#/baukosten'; }),
        knopf('Oder dem Bauleitfaden folgen', () => { location.hash = '#/leitfaden'; }, 'knopf-leise'),
      ]),
      hinweisKasten(
        'Links in der Leiste stehen alle Bereiche. Auf dem Telefon öffnest du sie ' +
          'oben links über das Menü.',
        'info'
      )
    );
    return;
  }

  rahmen.append(
    el('div', { klasse: 'kennzahlen' }, [
      kennzahl('Budget', eur.format(stand.gesamt)),
      kennzahl('Geplante Kosten', eur.format(geplant)),
      kennzahl('Auftragssumme', eur.format(auftrag)),
      kennzahl('Mehrkosten', (mehr > 0 ? '+' : '') + eur.format(mehr),
        mehr > 0 ? 'mehr' : mehr < 0 ? 'weniger' : null),
    ])
  );

  const lfAnteil = Math.round((leitfaden.erledigt / leitfaden.gesamt) * 100);
  rahmen.append(
    karte([
      el('h2', { text: 'Bauleitfaden' }),
      el('p', {
        klasse: 'unterzeile',
        text: `${leitfaden.laufend.titel} · ${leitfaden.erledigt} von ${leitfaden.gesamt} Punkten erledigt.`,
      }),
      el('div', { klasse: 'fortschrittsbalken' }, [
        el('div', { stil: { width: lfAnteil + '%' } }),
      ]),
      leitfaden.naechster
        ? el('div', { klasse: 'wertzeile' }, [
            el('span', { text: 'Als Nächstes' }),
            el('strong', { text: leitfaden.naechster.titel }),
          ])
        : null,
      knopf(
        leitfaden.naechster ? 'Zum Leitfaden' : 'Leitfaden ansehen',
        () => { location.hash = '#/leitfaden'; },
        'knopf-leise'
      ),
    ])
  );

  if (stand.gesamt > 0) {
    const anteil = Math.min(100, (auftrag / stand.gesamt) * 100);
    rahmen.append(
      karte([
        el('h2', { text: 'Restbudget' }),
        el('div', { klasse: 'fortschrittsbalken' }, [
          el('div', {
            stil: { width: anteil + '%', background: rest < 0 ? 'var(--warn)' : 'var(--akzent)' },
          }),
        ]),
        el('div', { klasse: 'wertzeile stark' }, [
          el('span', { text: rest < 0 ? 'Über dem Budget' : 'Noch frei' }),
          el('strong', { klasse: rest < 0 ? 'mehr' : null, text: eur.format(Math.abs(rest)) }),
        ]),
        el('p', {
          klasse: 'unterzeile',
          text: `Davon bereits bezahlt ${eur.format(gezahlt)}.`,
        }),
        knopf('Zur Budgetplanung', () => { location.hash = '#/baukasse'; }, 'knopf-leise'),
      ])
    );
  }

  // ------------------------------------------------------------------ To-Dos
  // Vor dem Bauablauf: Ein ueberfaelliger Anruf ist dringender als ein
  // Gewerk, das erst in drei Wochen anfaengt.
  const todoZahlen = todoStand(todos, heute());
  if (todoZahlen.offen) {
    const naechsteTodos = todosSortieren(todos.filter((t) => !t.erledigt)).slice(0, 4);
    rahmen.append(
      karte([
        el('h2', { text: 'Offene To-Dos' }),
        el('p', {
          klasse: 'unterzeile',
          text: `${todoZahlen.offen} offen, ${todoZahlen.erledigt} erledigt.`,
        }),
        ...naechsteTodos.map((t) => {
          const spaet = t.faellig && t.faellig < heute();
          return el('div', { klasse: 'listenzeile', stil: { cursor: 'default' } }, [
            el('span', { klasse: 'zeilen-text' }, [
              el('span', { klasse: 'zeilen-titel', text: t.titel }),
              el('span', {
                klasse: 'zeilen-unter' + (spaet ? ' mehr' : ''),
                text: [
                  t.faellig
                    ? (spaet ? 'überfällig seit ' : 'fällig ') + datumLang(t.faellig)
                    : 'ohne Frist',
                  t.liste || null,
                ].filter(Boolean).join(' · '),
              }),
            ]),
          ]);
        }),
        todoZahlen.ueberfaellig
          ? hinweisKasten(
              todoZahlen.ueberfaellig === 1
                ? 'Eine Aufgabe ist überfällig.'
                : `${todoZahlen.ueberfaellig} Aufgaben sind überfällig.`,
              'warn'
            )
          : null,
        knopf('Zu den To-Dos', () => { location.hash = '#/todos'; }, 'knopf-leise'),
      ])
    );
  }

  // ------------------------------------------------------------- Was ansteht
  const geplantTermine = terminePlanen(aufgaben);
  const naechste = geplantTermine
    .filter((a) => a.status !== 'fertig' && a.start)
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  const fertig = geplantTermine.filter((a) => a.status === 'fertig').length;

  if (aufgaben.length) {
    rahmen.append(
      karte([
        el('h2', { text: 'Bauablauf' }),
        el('p', {
          klasse: 'unterzeile',
          text: `${fertig} von ${aufgaben.length} Arbeitsschritten erledigt.`,
        }),
        el('div', { klasse: 'fortschrittsbalken' }, [
          el('div', { stil: { width: Math.round((fertig / aufgaben.length) * 100) + '%' } }),
        ]),
        naechste
          ? el('div', { klasse: 'wertzeile' }, [
              el('span', { text: 'Als Nächstes' }),
              el('strong', { text: naechste.titel }),
            ])
          : null,
        naechste
          ? el('p', {
              klasse: 'unterzeile',
              text: `ab ${datumLang(naechste.start)}, ${naechste.dauer} Tage`,
            })
          : null,
        knopf('Zum Bauablauf', () => { location.hash = '#/ablauf'; }, 'knopf-leise'),
      ])
    );
  }

  // -------------------------------------------------------------- Offene Maengel
  const offeneMaengel = maengel.filter((m) => m.status !== 'behoben');
  if (maengel.length) {
    const mitFrist = offeneMaengel
      .filter((m) => m.frist)
      .sort((a, b) => a.frist.localeCompare(b.frist));
    const ueberfaellig = mitFrist.filter((m) => m.frist < heute());

    rahmen.append(
      karte([
        el('h2', { text: 'Offene Mängel' }),
        el('p', {
          klasse: 'unterzeile',
          text: offeneMaengel.length
            ? `${offeneMaengel.length} offen, ${maengel.length - offeneMaengel.length} behoben.`
            : 'Alle behoben.',
        }),
        ...offeneMaengel.slice(0, 4).map((m) => {
          const zustand = STATUS[m.status] || STATUS.offen;
          return el('div', { klasse: 'listenzeile', stil: { cursor: 'default' } }, [
            el('span', { klasse: 'zeilen-text' }, [
              el('span', { klasse: 'zeilen-titel', text: m.titel }),
              el('span', {
                klasse: 'zeilen-unter',
                text: [m.raum, m.gewerk, m.frist ? 'Frist ' + datumLang(m.frist) : null]
                  .filter(Boolean).join(' · '),
              }),
            ]),
            el('span', { klasse: 'marke ' + zustand.marke, text: zustand.kurz }),
          ]);
        }),
        ueberfaellig.length
          ? hinweisKasten(
              ueberfaellig.length === 1
                ? 'Bei einem Mangel ist die Frist abgelaufen. Jetzt nachfassen, schriftlich.'
                : `Bei ${ueberfaellig.length} Mängeln ist die Frist abgelaufen. Jetzt nachfassen, schriftlich.`,
              'warn'
            )
          : null,
        knopf('Zur Mängelliste', () => { location.hash = '#/maengel'; }, 'knopf-leise'),
      ])
    );
  }

  // ------------------------------------------------------------------ Tagebuch
  if (tagebuch.length) {
    const letzter = [...tagebuch].sort((a, b) => String(b.datum).localeCompare(String(a.datum)))[0];
    const stunden = tagebuch.reduce(
      (s, e) => s + (e.helfer || []).reduce((x, h) => x + (Number(h.stunden) || 0), 0), 0);
    rahmen.append(
      karte([
        el('h2', { text: 'Bauhelfertagebuch' }),
        el('p', {
          klasse: 'unterzeile',
          text: `${tagebuch.length} Tage dokumentiert, ${zahl(stunden, stunden % 1 ? 1 : 0)} ` +
            `Helferstunden. Zuletzt ${datumLang(letzter.datum)}.`,
        }),
        knopf('Eintrag für heute', () => { location.hash = '#/tagebuch'; }, 'knopf-leise'),
      ])
    );
  }
}

function kennzahl(name, wert, klasse) {
  return el('div', { klasse: 'kennzahl' }, [
    el('span', { klasse: 'wert' + (klasse ? ' ' + klasse : ''), text: wert }),
    el('span', { klasse: 'name', text: name }),
  ]);
}
