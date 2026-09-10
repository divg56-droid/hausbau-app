// Projektuebersicht: der erste Bildschirm nach dem Start.
//
// Die Frage, die er beantwortet, ist nicht "was kann die App", sondern "wie
// steht mein Bau gerade". Deshalb steht oben, in welcher Phase das Vorhaben
// ist und was als Naechstes ansteht, und erst darunter die Zahlen.
//
// Die Reihenfolge ist die Reihenfolge der Dringlichkeit, nicht die der
// Funktionen: Projektstand, Geld, naechste Schritte, dann die Bereiche,
// zuletzt das Wetter. Wer noch gar nichts erfasst hat, sieht statt aller
// Kennzahlen einen einzigen Weg hinein -- vier Nullen nebeneinander sagen
// nichts, ausser dass hier noch nichts passiert ist.
//
// Alles hier ist abgeleitet und wird nirgends gespeichert. Der Bildschirm
// rechnet bei jedem Aufruf neu; bei den Datenmengen eines Einfamilienhauses
// kostet das nichts und kann dafuer nicht veralten.

import {
  el, eur, feld, eingabe, knopf, karte, kopfzeile, hinweisKasten, datumLang,
  heute, zahl, fuellen,
  anhaengen,
  geheZu,
} from '../hilfen.js';
import { blattOeffnen } from '../blatt.js';
import { daten, einstellung } from '../daten.js';
import { projekteListe, projektAnlegen } from '../projekte.js';
import { finanzierungsstand } from './finanzierung.js';
import { postenRechnen } from './baukasse.js';
import { terminePlanen } from './ablauf.js';
import { STATUS } from './maengel.js';
import { leitfadenStand } from '../leitfaden-daten.js';
import {
  bauweise, bauweiseSetzen, bauphaseSetzen, BAUPHASEN, SANIERUNG,
} from '../bauweise.js';
import { zeichen, wetterZeichen } from '../zeichen.js';
import { todoStand, todosSortieren } from './todos.js';

export async function zeige(rahmen) {
  const [projekt, stand, posten, belege, aufgaben, maengel, tagebuch, haken, todos, art,
    projekte, ort, baubeginn] =
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
    bauweise(),
    projekteListe(),
    einstellung('baustelle'),
    einstellung('baubeginn'),
  ]);
  const leitfaden = leitfadenStand(haken, art.id);

  const gerechnet = posten.map((p) => ({ ...p, ...postenRechnen(p, belege) }));
  const geplant = gerechnet.reduce((s, p) => s + p.geplant, 0);
  const auftrag = gerechnet.reduce((s, p) => s + p.massgeblich, 0);
  const gezahlt = belege.reduce((s, b) => s + (b.betrag || 0), 0);
  const mehr = gerechnet.reduce((s, p) => s + p.differenz, 0);
  const rest = stand.gesamt - auftrag;

  // Ganz am Anfang: nichts erfasst, nichts abgehakt, kein Name vergeben.
  const nochNichts = !stand.posten.length && !posten.length && !aufgaben.length &&
    !maengel.length && !todos.length && !leitfaden.erledigt;

  if (nochNichts) {
    anhaengen(
      rahmen,
      willkommen(),
      hinweisKasten(
        'Links in der Leiste stehen alle Bereiche. Auf dem Telefon öffnest du sie ' +
          'oben links über das Menü.',
        'info'
      ),
      wetterkarte(true)
    );
    return;
  }

  anhaengen(
    rahmen,
    kopfzeile(projekt || 'Dein Bauprojekt', null),
    projektkopf(art, leitfaden, todos, ort || {}, baubeginn),
    projektaktionen(projekte.length)
  );

  // ------------------------------------------------------------- Kennzahlen
  // Eine Null ist keine Zahl, sondern eine Luecke. Wo nichts steht, steht
  // deshalb der Weg dorthin und nicht "0 €".
  anhaengen(
    rahmen,
    el('div', { klasse: 'kennzahlen' }, [
      stand.gesamt > 0
        ? kennzahl('Budget', eur.format(stand.gesamt))
        : kennzahlLeer('Budget', 'Noch nicht festgelegt', 'Budget anlegen', '#/finanzierung'),
      posten.length
        ? kennzahl('Geplante Kosten', eur.format(geplant))
        : kennzahlLeer('Geplante Kosten', 'Noch keine Position',
            'Kosten erfassen', '#/baukasse/kosten'),
      posten.length
        ? kennzahl('Auftragssumme', eur.format(auftrag))
        : kennzahlLeer('Auftragssumme', 'Noch nichts beauftragt',
            'Angebote vergleichen', '#/angebote'),
      posten.length
        ? kennzahl('Mehrkosten', (mehr > 0 ? '+' : '') + eur.format(mehr),
            mehr > 0 ? 'mehr' : mehr < 0 ? 'weniger' : null)
        : kennzahlLeer('Mehrkosten', 'Nichts zu vergleichen',
            'Baukosten schätzen', '#/baukosten'),
    ])
  );

  if (stand.gesamt > 0) {
    const anteil = Math.min(100, (auftrag / stand.gesamt) * 100);
    anhaengen(
      rahmen,
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
        knopf('Zur Budgetplanung', () => { geheZu('#/baukasse'); }, 'knopf-leise'),
      ])
    );
  }

  // -------------------------------------------------- Die naechsten Schritte
  const todoZahlen = todoStand(todos, heute());
  const offeneTodos = todosSortieren(todos.filter((t) => !t.erledigt));
  const offeneMaengel = maengel.filter((m) => m.status !== 'behoben');
  const geplantTermine = terminePlanen(aufgaben);
  const naechsterSchritt = geplantTermine
    .filter((a) => a.status !== 'fertig' && a.start)
    .sort((a, b) => a.start.localeCompare(b.start))[0];

  const schritte = naechsteSchritte({
    leitfaden, offeneTodos, offeneMaengel, naechsterSchritt, stand, posten,
  });
  if (schritte.length) {
    anhaengen(
      rahmen,
      karte([
        el('h2', { text: 'Deine nächsten Schritte' }),
        el('p', {
          klasse: 'unterzeile',
          text: 'Aus dem Bauleitfaden, deinen To-Dos und den offenen Mängeln, nach ' +
            'Dringlichkeit sortiert.',
        }),
        ...schritte.map((s) =>
          el('button', { klasse: 'listenzeile', onclick: () => { geheZu(s.ziel); } }, [
            el('span', { klasse: 'zeilen-text' }, [
              el('span', { klasse: 'zeilen-titel', text: s.titel }),
              el('span', { klasse: 'zeilen-unter' + (s.dringend ? ' mehr' : ''), text: s.warum }),
            ]),
            el('span', { klasse: 'marke', text: s.wo }),
          ])
        ),
      ])
    );
  }

  // -------------------------------------------------------------- Bauleitfaden
  const lfAnteil = Math.round((leitfaden.erledigt / leitfaden.gesamt) * 100);
  anhaengen(
    rahmen,
    karte([
      el('h2', { text: 'Bauleitfaden' }),
      el('p', {
        klasse: 'unterzeile',
        text: `${leitfaden.laufend.titel} · ${leitfaden.erledigt} von ${leitfaden.gesamt} Punkten erledigt.`,
      }),
      el('div', { klasse: 'fortschrittsbalken' }, [
        el('div', { stil: { width: lfAnteil + '%' } }),
      ]),
      phasenband(leitfaden),
      leitfaden.naechster
        ? el('p', {
            klasse: 'unterzeile',
            text: 'Nächster Schritt: ' + leitfaden.naechster.titel +
              (leitfaden.naechster.text ? ' – ' + leitfaden.naechster.text : ''),
          })
        : null,
      knopf(
        leitfaden.naechster ? 'Zum Leitfaden' : 'Leitfaden ansehen',
        () => { geheZu('#/leitfaden'); },
        'knopf-leise'
      ),
    ])
  );

  // ------------------------------------------------------------------ To-Dos
  // Vor dem Bauablauf: Ein ueberfaelliger Anruf ist dringender als ein
  // Gewerk, das erst in drei Wochen anfaengt.
  if (todoZahlen.offen) {
    anhaengen(
      rahmen,
      karte([
        el('h2', { text: 'Offene To-Dos' }),
        el('p', {
          klasse: 'unterzeile',
          text: `${todoZahlen.offen} offen, ${todoZahlen.erledigt} erledigt.`,
        }),
        ...offeneTodos.slice(0, 4).map((t) => {
          const spaet = t.faellig && t.faellig < heute();
          return el('div', { klasse: 'listenzeile', stil: { cursor: 'default' } }, [
            el('span', { klasse: 'zeilen-text' }, [
              el('span', { klasse: 'zeilen-titel', text: t.titel }),
              // "Warum" und "Was jetzt" stehen an der Aufgabe, wenn die
              // Vorlage sie mitgebracht hat. Ein Satz wie "Abnahme ist
              // foermlich geregelt" ist fachlich richtig und sagt einem
              // Bauherrn trotzdem nicht, was er tun soll.
              t.tun ? el('span', { klasse: 'zeilen-tun', text: 'Jetzt: ' + t.tun }) : null,
              el('span', {
                klasse: 'zeilen-unter' + (spaet ? ' mehr' : ''),
                text: [
                  t.faellig
                    ? (spaet ? 'überfällig seit ' : 'fällig ') + datumLang(t.faellig)
                    : 'ohne Frist',
                  t.warum || t.liste || null,
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
        knopf('Zu den To-Dos', () => { geheZu('#/todos'); }, 'knopf-leise'),
      ])
    );
  }

  // ------------------------------------------------------------- Was ansteht
  const fertig = geplantTermine.filter((a) => a.status === 'fertig').length;

  if (aufgaben.length) {
    anhaengen(
      rahmen,
      karte([
        el('h2', { text: 'Bauablauf' }),
        el('p', {
          klasse: 'unterzeile',
          text: `${fertig} von ${aufgaben.length} Arbeitsschritten erledigt.`,
        }),
        el('div', { klasse: 'fortschrittsbalken' }, [
          el('div', { stil: { width: Math.round((fertig / aufgaben.length) * 100) + '%' } }),
        ]),
        naechsterSchritt
          ? el('div', { klasse: 'wertzeile' }, [
              el('span', { text: 'Als Nächstes' }),
              el('strong', { text: naechsterSchritt.titel }),
            ])
          : null,
        naechsterSchritt
          ? el('p', {
              klasse: 'unterzeile',
              text: `ab ${datumLang(naechsterSchritt.start)}, ${naechsterSchritt.dauer} Tage`,
            })
          : null,
        knopf('Zum Bauablauf', () => { geheZu('#/ablauf'); }, 'knopf-leise'),
      ])
    );
  }

  // -------------------------------------------------------------- Offene Maengel
  if (maengel.length) {
    const mitFrist = offeneMaengel
      .filter((m) => m.frist)
      .sort((a, b) => a.frist.localeCompare(b.frist));
    const ueberfaellig = mitFrist.filter((m) => m.frist < heute());

    anhaengen(
      rahmen,
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
        knopf('Zur Mängelliste', () => { geheZu('#/maengel'); }, 'knopf-leise'),
      ])
    );
  }

  // ------------------------------------------------------------------ Tagebuch
  if (tagebuch.length) {
    const letzter = [...tagebuch].sort((a, b) => String(b.datum).localeCompare(String(a.datum)))[0];
    const stunden = tagebuch.reduce(
      (s, e) => s + (e.helfer || []).reduce((x, h) => x + (Number(h.stunden) || 0), 0), 0);
    anhaengen(
      rahmen,
      karte([
        el('h2', { text: 'Bauhelfertagebuch' }),
        el('p', {
          klasse: 'unterzeile',
          text: `${tagebuch.length} Tage dokumentiert, ${zahl(stunden, stunden % 1 ? 1 : 0)} ` +
            `Helferstunden. Zuletzt ${datumLang(letzter.datum)}.`,
        }),
        knopf('Eintrag für heute', () => { geheZu('#/tagebuch'); }, 'knopf-leise'),
      ])
    );
  }

  // ------------------------------------------------------------------- Wetter
  // Zuletzt und klein, solange geplant wird. Erst wenn wirklich gebaut wird,
  // entscheidet das Wetter ueber den Tag -- dann steht die Karte gross da.
  anhaengen(rahmen, wetterkarte(art.phase !== 'bau'));
}

// -------------------------------------------------------------- Willkommen

/**
 * Der erste Bildschirm, wenn noch nichts da ist.
 *
 * Genau eine Handlung, gross und farbig, und drei Wege hinein statt einer
 * Kachelwand. Wer hier laenger als drei Sekunden ueberlegen muss, was er
 * tun soll, kommt nicht wieder.
 */
function willkommen() {
  const einstiege = [
    {
      titel: 'Hausbau planen',
      text: 'Noch nichts gebaut: Budget, Grundstück, Angebote und Verträge stehen an.',
      phase: 'planung', sanierung: false,
    },
    {
      titel: 'Bau läuft bereits',
      text: 'Die Baustelle ist offen: Rechnungen, Mängel, Bautagebuch und Termine.',
      phase: 'bau', sanierung: false,
    },
    {
      titel: 'Modernisierung oder Sanierung',
      text: 'Am Haus, das schon steht: Bestand, Förderung und die richtige Reihenfolge.',
      phase: 'planung', sanierung: true,
    },
  ];

  return karte([
    el('p', { klasse: 'willkommen-marke', text: 'Willkommen bei BauZeuge.de' }),
    el('h2', { klasse: 'willkommen-titel', text: 'Dein Bauvorhaben an einer Stelle' }),
    el('p', {
      klasse: 'willkommen-text',
      text: 'Erstelle dein Projekt und behalte Kosten, Termine, Dokumente und Aufgaben ' +
        'an einem Ort im Blick – von der ersten Schätzung bis zur Abnahme.',
    }),
    knopf('+ Bauprojekt anlegen', () => projektBlatt(), 'knopf-haupt knopf-gross'),
    el('p', { klasse: 'unterzeile', text: 'Oder wähle, wo du gerade stehst:' }),
    el('div', { klasse: 'einstiege' }, einstiege.map((e) =>
      el('button', { klasse: 'einstieg', type: 'button', onclick: () => projektBlatt(e) }, [
        el('span', { klasse: 'einstieg-titel', text: e.titel }),
        el('span', { klasse: 'einstieg-text', text: e.text }),
      ])
    )),
    el('p', {
      klasse: 'unterzeile leise',
      text: 'Deine Projektdaten bleiben lokal auf diesem Gerät – ohne Konto und ohne ' +
        'Übertragung an uns. Ein Konto brauchst du erst, wenn App und Internetseite ' +
        'dieselben Daten zeigen sollen.',
    }),
  ], 'willkommenskarte');
}

/** Legt ein Projekt an, auf Wunsch schon mit Bauweise und Phase. */
function projektBlatt(einstieg) {
  const name = eingabe({ placeholder: 'z. B. Haus Musterweg 3' });
  blattOeffnen(
    einstieg ? einstieg.titel : 'Neues Bauprojekt',
    [
      feld('Name des Projekts', name,
        'Jedes Projekt hat eigene Kosten, Mängel und Dokumente. Nichts vermischt sich.'),
      einstieg
        ? el('p', { klasse: 'unterzeile', text: einstieg.text })
        : null,
    ].filter(Boolean),
    async () => {
      const wert = name.value.trim();
      if (!wert) throw new Error('Bitte einen Namen eintragen.');
      await projektAnlegen(wert);
      if (einstieg) {
        if (einstieg.sanierung) await bauweiseSetzen(SANIERUNG);
        await bauphaseSetzen(einstieg.phase);
      }
      // Ganz neu laden: Jeder Bildschirm haelt seine Daten im Speicher, und
      // die gehoeren jetzt zu einem anderen Projekt.
      location.reload();
    }
  );
}

// ------------------------------------------------------------- Projektkopf

/**
 * Wo das Vorhaben steht, in einer Zeile.
 *
 * Bauweise, Phase, Fortschritt und was noch offen ist. Der Fortschritt kommt
 * aus dem Bauleitfaden: Der hat die Phasen ohnehin, und eine zweite,
 * daneben gefuehrte Einteilung waere eine, die irgendwann widerspricht.
 */
function projektkopf(art, leitfaden, todos, ort, baubeginn) {
  const anteil = leitfaden.gesamt
    ? Math.round((leitfaden.erledigt / leitfaden.gesamt) * 100) : 0;
  const offen = todos.filter((t) => !t.erledigt).length +
    (leitfaden.laufend.gesamt - leitfaden.laufend.fertig);
  const phase = BAUPHASEN.find((p) => p.id === art.phase);

  return el('div', { klasse: 'projektkopf' }, [
    el('span', { klasse: 'projektzeichen' }, [
      zeichen(art.id === SANIERUNG ? 'kelle' : 'haus', { groesse: 34 }),
    ]),
    el('div', { klasse: 'projektkopf-text' }, [
      el('span', {
        klasse: 'projektkopf-zeile',
        text: [
          art.name,
          phase ? phase.name : null,
          ort.ort || ort.name || null,
          baubeginn ? baubeginnText(baubeginn) : null,
        ].filter(Boolean).join(' · '),
      }),
      el('span', {
        klasse: 'projektkopf-unter',
        text: [
          leitfaden.laufend.titel,
          `${anteil} % des Bauleitfadens erledigt`,
          offen ? offen + (offen === 1 ? ' offene Entscheidung' : ' offene Entscheidungen') : null,
        ].filter(Boolean).join(' · '),
      }),
    ]),
    el('span', { klasse: 'projektkopf-stand', text: 'Stand ' + datumLang(heute()) }),
  ]);
}

/**
 * "Baubeginn Mai 2027 (in 8 Monaten)".
 *
 * Der Abstand steht dabei, weil das Datum allein wenig sagt: Ob bis dahin
 * acht Monate oder acht Wochen sind, aendert alles an dem, was jetzt dran
 * ist. Liegt der Monat zurueck, zaehlt es aufwaerts.
 */
function baubeginnText(monat) {
  const [jahr, m] = String(monat).split('-').map(Number);
  if (!jahr || !m) return '';
  const name = new Date(Date.UTC(jahr, m - 1, 1))
    .toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const jetzt = new Date();
  const abstand = (jahr - jetzt.getFullYear()) * 12 + (m - 1 - jetzt.getMonth());
  const wie = abstand === 0 ? 'dieser Monat'
    : abstand === 1 ? 'nächster Monat'
    : abstand > 1 ? 'in ' + abstand + ' Monaten'
    : abstand === -1 ? 'seit einem Monat'
    : 'seit ' + Math.abs(abstand) + ' Monaten';
  return `Baubeginn ${name} (${wie})`;
}

/** Die Phasen des Leitfadens als Band: wo man war, ist und hinwill. */
function phasenband(leitfaden) {
  return el('div', { klasse: 'phasenband' }, leitfaden.phasen
    .filter((p) => p.gesamt > 0)
    .map((p) => {
      const zustand = p.fertig >= p.gesamt ? 'fertig'
        : p.id === leitfaden.laufend.id ? 'laufend' : 'offen';
      return el('span', { klasse: 'phasenstueck phase-' + zustand, title: p.titel }, [
        el('span', { klasse: 'phasenname', text: p.titel }),
        el('span', { klasse: 'phasenzahl', text: p.fertig + '/' + p.gesamt }),
      ]);
    }));
}

/**
 * Die drei Dinge, die als Naechstes anstehen.
 *
 * Zusammengezogen aus dem, was ohnehin da ist: der offene Leitfadenpunkt,
 * die dringendste Aufgabe, der Mangel mit ablaufender Frist. Erfunden wird
 * nichts -- eine Liste, die sich Schritte ausdenkt, verliert man nach dem
 * zweiten Mal aus den Augen.
 */
function naechsteSchritte({ leitfaden, offeneTodos, offeneMaengel, naechsterSchritt, stand, posten }) {
  const schritte = [];

  if (!stand.gesamt) {
    schritte.push({
      titel: 'Budget festlegen',
      warum: 'Ohne Finanzrahmen rechnet nichts anderes mit: Restbudget, Abweichung, Puffer.',
      wo: 'Finanzierung', ziel: '#/finanzierung',
    });
  } else if (!posten.length) {
    schritte.push({
      titel: 'Erste Kostenpositionen anlegen',
      warum: 'Erst mit Positionen zeigt die App, wo das Budget hingeht.',
      wo: 'Kosten', ziel: '#/baukasse/kosten',
    });
  }

  const dringend = offeneTodos.find((t) => t.faellig && t.faellig < heute()) || offeneTodos[0];
  if (dringend) {
    schritte.push({
      titel: dringend.titel,
      warum: dringend.tun
        ? dringend.tun
        : dringend.faellig
          ? (dringend.faellig < heute()
              ? 'Überfällig seit ' + datumLang(dringend.faellig)
              : 'Fällig ' + datumLang(dringend.faellig))
          : 'Ohne Frist notiert.',
      wo: 'To-Do', ziel: '#/todos',
      dringend: Boolean(dringend.faellig && dringend.faellig < heute()),
    });
  }

  const mangel = offeneMaengel
    .filter((m) => m.frist)
    .sort((a, b) => a.frist.localeCompare(b.frist))[0];
  if (mangel) {
    schritte.push({
      titel: mangel.titel,
      warum: mangel.frist < heute()
        ? 'Frist abgelaufen am ' + datumLang(mangel.frist) + '. Jetzt schriftlich nachfassen.'
        : 'Frist bis ' + datumLang(mangel.frist) + '.',
      wo: 'Mangel', ziel: '#/maengel',
      dringend: mangel.frist < heute(),
    });
  }

  if (leitfaden.naechster) {
    schritte.push({
      titel: leitfaden.naechster.titel,
      warum: leitfaden.naechster.text || leitfaden.laufend.titel,
      wo: 'Leitfaden', ziel: '#/leitfaden',
    });
  }

  if (naechsterSchritt && schritte.length < 3) {
    schritte.push({
      titel: naechsterSchritt.titel,
      warum: 'Ab ' + datumLang(naechsterSchritt.start) + ', ' + naechsterSchritt.dauer + ' Tage.',
      wo: 'Ablauf', ziel: '#/ablauf',
    });
  }

  // Drei sind genug. Wer fuenf naechste Schritte sieht, hat keinen naechsten.
  return schritte.slice(0, 3);
}

// ------------------------------------------------------------------ Wetter
//
// Das Wetter auf der Baustelle, nicht am Wohnort. Es entscheidet, ob heute
// betoniert, gedeckt oder geputzt wird, und ob ein Kran stillsteht.
//
// Die Karte steht auch dann da, wenn keine Adresse hinterlegt ist -- dann
// sagt sie, was sie zeigen wuerde. Ein Bildschirm, auf dem etwas fehlt,
// erklaert besser als einer, auf dem nichts steht.
//
// "kompakt" ist die Fassung fuer die Planungsphase: eine Zeile statt einer
// halben Bildschirmhoehe. Wer noch keine Baustelle hat, muss nicht wissen,
// wie viel Regen heute faellt -- wer eine hat, sehr wohl.

const WETTERNAMEN = {
  sonnig: 'Sonnig', bewoelkt: 'Bewölkt', regen: 'Regen',
  sturm: 'Sturm', schnee: 'Schnee', frost: 'Frost',
};

// Einmal je Stunde reicht. Der Deutsche Wetterdienst misst stuendlich, und
// oefter zu fragen belastet nur einen fremden Dienst, den wir umsonst nutzen.
const HALTBAR = 60 * 60 * 1000;

/**
 * Baut die Wetterkarte und traegt die Werte nach, sobald sie da sind.
 *
 * Die Karte wird sofort zurueckgegeben und fuellt sich danach: Der ganze
 * Bildschirm auf eine fremde Netzantwort warten zu lassen waere der falsche
 * Tausch, gerade auf der Baustelle mit einem Balken Empfang.
 */
function wetterkarte(kompakt) {
  const inhalt = el('div');
  const karteInhalt = karte(
    [el('h2', { text: 'Wetter auf der Baustelle' }), inhalt],
    'wetterkarte' + (kompakt ? ' wetterkarte-klein' : '')
  );

  inhalt.append(el('p', { klasse: 'unterzeile', text: 'Wird geholt …' }));

  (async () => {
    const ort = (await einstellung('baustelle')) || {};

    if (!ort.lat || !ort.lon) {
      inhalt.replaceChildren(
        el('p', {
          klasse: 'unterzeile',
          text: 'Trage die Adresse deiner Baustelle ein, dann siehst du hier das ' +
            'aktuelle Wetter. Im Bautagebuch trägt es sich danach von allein ein.',
        }),
        knopf('Projektadresse eintragen', () => { geheZu('#/einstellungen'); }, 'knopf-leise')
      );
      return;
    }

    const stand = await wetterStand(ort);
    if (!stand) {
      inhalt.replaceChildren(
        el('p', {
          klasse: 'unterzeile',
          text: 'Der Wetterdienst ist gerade nicht erreichbar. Ohne Empfang auf der ' +
            'Baustelle ist das normal.',
        })
      );
      return;
    }

    const w = stand.wetter;
    const hinweis = wetterHinweisText(w);

    // Die Farbe der Karte folgt der Lage: Sie sagt im Vorbeigehen, ob
    // draussen gearbeitet werden kann, bevor irgendetwas gelesen ist.
    karteInhalt.classList.add('wetter-' + w.wetter);

    // Klein: Zeichen, Grad, Lage und der eine Satz, der zaehlt. Alles
    // andere steht im Bautagebuch.
    if (kompakt) {
      fuellen(
        inhalt,
        el('div', { klasse: 'wetterzeile' }, [
          el('span', { klasse: 'wetterzeichen' }, [
            zeichen(wetterZeichen(w.wetter), { groesse: 32 }),
          ]),
          el('span', { klasse: 'wettergrad-klein', text: zahl(w.temperatur, 0) + ' °C' }),
          el('span', {
            klasse: 'wetterlage-klein',
            text: [WETTERNAMEN[w.wetter] || w.wetter, ort.ort || ort.name || null]
              .filter(Boolean).join(' · '),
          }),
          el('button', {
            klasse: 'knopf knopf-schmal', type: 'button', text: 'Ins Bautagebuch',
            onclick: () => { geheZu('#/tagebuch'); },
          }),
        ]),
        hinweis ? el('p', { klasse: 'unterzeile mehr', text: hinweis }) : null
      );
      return;
    }

    fuellen(
      inhalt,
      el('div', { klasse: 'wetterkopf' }, [
        el('span', { klasse: 'wetterzeichen' }, [zeichen(wetterZeichen(w.wetter), { groesse: 60 })]),
        el('div', {}, [
          el('span', { klasse: 'wettergrad', text: zahl(w.temperatur, 0) + ' °C' }),
          el('span', { klasse: 'wetterlage', text: WETTERNAMEN[w.wetter] || w.wetter }),
        ]),
      ]),
      // Vier Zahlen als Kaesten statt als Satz mit Trennpunkten: So findet
      // das Auge die eine, die es sucht.
      el('div', { klasse: 'wetterwerte' }, [
        wetterwert(
          w.min !== null && w.max !== null ? `${zahl(w.min, 0)}/${zahl(w.max, 0)} °C` : '–',
          'tiefste/höchste'
        ),
        wetterwert(zahl(w.niederschlag, 1) + ' mm', 'Niederschlag'),
        wetterwert(zahl(w.wind, 0) + ' km/h', 'Wind in Spitzen'),
      ]),
      el('p', {
        klasse: 'unterzeile leise',
        text: [
          ort.name || ort.ort,
          w.station ? 'Station ' + w.station : null,
          stand.alt ? 'Stand ' + stand.alt : null,
        ].filter(Boolean).join(' · '),
      }),
      hinweis
        ? hinweisKasten(hinweis, 'warn')
        : hinweisKasten('Nichts spricht gegen Arbeiten im Freien.', 'gut'),
      knopf('Ins Bautagebuch übernehmen', () => { geheZu('#/tagebuch'); }, 'knopf-leise')
    );
  })();

  return karteInhalt;
}

/**
 * Holt das Wetter, hoechstens einmal je Stunde.
 *
 * Der letzte Wert bleibt gespeichert. Ohne Netz ist ein Wert von vorhin
 * besser als keiner -- er steht dann mit seinem Alter da, damit niemand ihn
 * fuer den jetzigen haelt.
 */
async function wetterStand(ort) {
  const gemerkt = (await einstellung('wetter_stand')) || null;
  const jetzt = Date.now();
  const passt = gemerkt
    && gemerkt.lat === ort.lat && gemerkt.lon === ort.lon
    && gemerkt.datum === heute();

  if (passt && jetzt - gemerkt.geholt < HALTBAR) {
    return { wetter: gemerkt.wetter, alt: null };
  }

  try {
    const { wetterHolen } = await import('../wetter.js');
    const wetter = await wetterHolen(ort.lat, ort.lon, heute());
    await einstellung('wetter_stand', {
      lat: ort.lat, lon: ort.lon, datum: heute(), geholt: jetzt, wetter,
    });
    return { wetter, alt: null };
  } catch {
    // Ohne Netz der letzte bekannte Wert, mit seinem Alter davor.
    if (!gemerkt) return null;
    const stunden = Math.round((jetzt - gemerkt.geholt) / 3600000);
    return {
      wetter: gemerkt.wetter,
      alt: gemerkt.datum === heute() && stunden < 24
        ? (stunden < 1 ? 'von eben' : 'von vor ' + stunden + ' Stunden')
        : 'vom ' + datumLang(gemerkt.datum),
    };
  }
}

/** Eine Zahl des Tages als kleiner Kasten. */
const wetterwert = (wert, name) =>
  el('div', { klasse: 'wetterwert' }, [
    el('strong', { text: wert }),
    el('span', { text: name }),
  ]);

/** Der Satz, der auf der Baustelle zaehlt: Ruht die Arbeit? */
function wetterHinweisText(w) {
  if (w.wetter === 'sturm') {
    return `Böen bis ${zahl(w.wind, 0)} km/h. Kran- und Gerüstarbeiten ruhen üblicherweise.`;
  }
  if (w.wetter === 'frost') {
    return `Frost bis ${zahl(w.min, 0)} °C. Beton, Mörtel und Putz brauchen Schutz oder Pause.`;
  }
  if (w.wetter === 'schnee') return 'Schnee. Zufahrt und Gerüst prüfen, bevor jemand kommt.';
  if (w.wetter === 'regen' && w.niederschlag >= 5) {
    return `${zahl(w.niederschlag, 1)} mm Regen. Estrich, Putz und Malerarbeiten im Freien warten.`;
  }
  return '';
}

function kennzahl(name, wert, klasse) {
  return el('div', { klasse: 'kennzahl' }, [
    el('span', { klasse: 'wert' + (klasse ? ' ' + klasse : ''), text: wert }),
    el('span', { klasse: 'name', text: name }),
  ]);
}

/**
 * Dieselbe Kachel, solange es nichts zu zeigen gibt.
 *
 * "0 €" ist keine Auskunft, sondern eine Luecke mit Waehrungszeichen. Hier
 * steht stattdessen, was fehlt und wo man es eintraegt.
 */
function kennzahlLeer(name, text, aktion, ziel) {
  return el('button', {
    klasse: 'kennzahl kennzahl-leer', type: 'button', onclick: () => { geheZu(ziel); },
  }, [
    el('span', { klasse: 'wert-leer', text }),
    el('span', { klasse: 'name', text: name }),
    el('span', { klasse: 'kennzahl-aktion', text: aktion + ' →' }),
  ]);
}

/**
 * Ein zweites Bauvorhaben anlegen, und der Weg zur Verwaltung.
 *
 * Steht hier oben statt in der Seitenleiste: Die meisten bauen einmal. Wer
 * ein zweites Projekt braucht, sucht es genau dann, wenn er auf die
 * Uebersicht schaut -- und nicht jeden Tag daneben.
 */
function projektaktionen(anzahl) {
  return el('div', { klasse: 'knopf-reihe kopfaktionen' }, [
    knopf('Neues Projekt anlegen', () => projektBlatt(), 'knopf-leise'),
    anzahl > 1
      ? knopf('Bauprojekte verwalten', () => { geheZu('#/projekte'); }, 'knopf-leise')
      : null,
  ]);
}
