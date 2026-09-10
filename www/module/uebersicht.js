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
  el, eur, knopf, karte, kopfzeile, hinweisKasten, datumLang, heute, zahl, fuellen,
  anhaengen,
} from '../hilfen.js';
import { daten, einstellung } from '../daten.js';
import { finanzierungsstand } from './finanzierung.js';
import { postenRechnen } from './baukasse.js';
import { terminePlanen } from './ablauf.js';
import { STATUS } from './maengel.js';
import { leitfadenStand } from '../leitfaden-daten.js';
import { bauweise } from '../bauweise.js';
import { zeichen, wetterZeichen } from '../zeichen.js';
import { todoStand, todosSortieren } from './todos.js';

export async function zeige(rahmen) {
  const [projekt, stand, posten, belege, aufgaben, maengel, tagebuch, haken, todos, art] =
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
  ]);
  const leitfaden = leitfadenStand(haken, art.id);

  const gerechnet = posten.map((p) => ({ ...p, ...postenRechnen(p, belege) }));
  const geplant = gerechnet.reduce((s, p) => s + p.geplant, 0);
  const auftrag = gerechnet.reduce((s, p) => s + p.massgeblich, 0);
  const gezahlt = belege.reduce((s, b) => s + (b.betrag || 0), 0);
  const mehr = gerechnet.reduce((s, p) => s + p.differenz, 0);
  const rest = stand.gesamt - auftrag;

  anhaengen(
    rahmen,
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
    anhaengen(
      rahmen,
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
      ),
      wetterkarte()
    );
    return;
  }

  anhaengen(
    rahmen,
    el('div', { klasse: 'kennzahlen' }, [
      kennzahl('Budget', eur.format(stand.gesamt)),
      kennzahl('Geplante Kosten', eur.format(geplant)),
      kennzahl('Auftragssumme', eur.format(auftrag)),
      kennzahl('Mehrkosten', (mehr > 0 ? '+' : '') + eur.format(mehr),
        mehr > 0 ? 'mehr' : mehr < 0 ? 'weniger' : null),
    ])
  );

  anhaengen(rahmen, wetterkarte());

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
    anhaengen(
      rahmen,
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
        knopf('Zur Mängelliste', () => { location.hash = '#/maengel'; }, 'knopf-leise'),
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
        knopf('Eintrag für heute', () => { location.hash = '#/tagebuch'; }, 'knopf-leise'),
      ])
    );
  }
}

// ------------------------------------------------------------------ Wetter
//
// Das Wetter auf der Baustelle, nicht am Wohnort. Es entscheidet, ob heute
// betoniert, gedeckt oder geputzt wird, und ob ein Kran stillsteht.
//
// Die Karte steht auch dann da, wenn keine Adresse hinterlegt ist -- dann
// sagt sie, was sie zeigen wuerde. Ein Bildschirm, auf dem etwas fehlt,
// erklaert besser als einer, auf dem nichts steht.

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
function wetterkarte() {
  const inhalt = el('div');
  const karteInhalt = karte([el('h2', { text: 'Wetter auf der Baustelle' }), inhalt]);

  inhalt.append(el('p', { klasse: 'unterzeile', text: 'Wird geholt …' }));

  (async () => {
    const ort = (await einstellung('baustelle')) || {};

    if (!ort.lat || !ort.lon) {
      inhalt.replaceChildren(
        el('p', {
          klasse: 'unterzeile',
          text: 'Trage die Adresse deiner Baustelle ein, dann siehst du hier das ' +
            'aktuelle Wetter — und im Bautagebuch trägt es sich von allein ein.',
        }),
        knopf('Projektadresse eintragen', () => { location.hash = '#/einstellungen'; }, 'knopf-haupt')
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

    fuellen(
      inhalt,
      el('div', { klasse: 'wetterkopf' }, [
        el('span', { klasse: 'wetterzeichen' }, [zeichen(wetterZeichen(w.wetter), { groesse: 46 })]),
        el('div', {}, [
          el('span', { klasse: 'wettergrad', text: zahl(w.temperatur, 0) + ' °C' }),
          el('span', { klasse: 'wetterlage', text: WETTERNAMEN[w.wetter] || w.wetter }),
        ]),
      ]),
      el('p', {
        klasse: 'unterzeile',
        text: [
          w.min !== null && w.max !== null ? `${zahl(w.min, 0)} bis ${zahl(w.max, 0)} °C` : null,
          w.niederschlag ? `${zahl(w.niederschlag, 1)} mm Niederschlag` : 'kein Niederschlag',
          w.wind ? `Wind bis ${zahl(w.wind, 0)} km/h` : null,
        ].filter(Boolean).join(' · '),
      }),
      el('p', {
        klasse: 'unterzeile leise',
        text: [
          ort.name || ort.ort,
          w.station ? 'Station ' + w.station : null,
          stand.alt ? 'Stand ' + stand.alt : null,
        ].filter(Boolean).join(' · '),
      }),
      hinweis ? hinweisKasten(hinweis, 'warn') : null,
      knopf('Ins Bautagebuch übernehmen', () => { location.hash = '#/tagebuch'; }, 'knopf-leise')
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
