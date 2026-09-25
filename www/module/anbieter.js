// Anbietervergleich: drei Angebote vergleichbar machen.
//
// Beim schluesselfertigen Bauen faellt die wichtigste Entscheidung vor dem
// Vertrag, und sie faellt fast immer an der falschen Zahl: an der Summe auf
// Seite eins. Die sagt nichts, solange nicht feststeht, was darin steckt.
//
// Deshalb steht hier nicht der Preis im Mittelpunkt, sondern die Liste. Je
// Position und Anbieter gibt es genau vier Antworten: ungeklaert, im Preis
// enthalten, fehlt (dann mit Betrag) oder nicht notwendig. Unten steht, was
// daraus wird -- Angebotspreis plus Ergaenzungen ist der vergleichbare
// Endpreis, und genau der gehoert zur Bank.
//
// Die Liste stammt aus Kapitel 10 des Buches "Klartext Hausbau" und steht in
// anbietervergleich-daten.js. Wer sie aendert, aendert sie dort.
//
// Gespeichert wird je Anbieter ein Satz mit einer Tabelle seiner Positionen.
// Nicht ein Satz je Zelle: Die Zellen gehoeren zum Anbieter, werden zusammen
// bearbeitet und waeren einzeln nur Streugut im Abgleich.

import {
  el, eingabe, zahlfeld, knopf, karte, kopfzeile, hinweisKasten, leerzustand,
  anhaengen, frage, eur, zuZahl, geheZu,
} from '../hilfen.js';
import { daten } from '../daten.js';
import { GRUPPEN, endpreis, offeneSpanne } from '../anbietervergleich-daten.js';

// Mehr als vier Spalten liest niemand mehr, und drei Angebote sind die
// uebliche Zahl. Die Grenze steht hier, damit die Tabelle lesbar bleibt.
const HOECHSTENS = 4;

const ARTEN = [
  ['offen', 'ungeklärt'],
  ['drin', 'im Preis'],
  ['betrag', 'fehlt: Betrag'],
  ['ohne', 'nicht nötig'],
];

export async function zeige(rahmen) {
  await zeichne(rahmen);
}

async function zeichne(rahmen) {
  rahmen.replaceChildren();
  const liste = (await daten.alle('anbieter')).sort(
    (a, b) => (a.angelegt || '').localeCompare(b.angelegt || '')
  );
  const neu = () => zeichne(rahmen);

  anhaengen(
    rahmen,
    kopfzeile('Anbietervergleich', 'Angebote Position für Position vergleichbar machen.')
  );

  if (!liste.length) {
    anhaengen(
      rahmen,
      karte([
        leerzustand(
          'Noch kein Anbieter',
          'Trag die Anbieter ein, von denen du ein Angebot hast. Danach gehst du die Liste '
            + 'einmal durch und siehst, welches Angebot wirklich das günstigste ist.',
          neufeld(neu)
        ),
      ]),
      erklaerung()
    );
    return;
  }

  anhaengen(
    rahmen,
    kopfkarte(liste, neu),
    ...GRUPPEN.map((g) => gruppenkarte(g, liste, neu)),
    summenkarte(liste),
    erklaerung()
  );
}

/* ------------------------------------------------------------- Kopfbereich */

function kopfkarte(liste, neu) {
  return karte([
    el('h2', { text: 'Die Angebote' }),
    el('div', { klasse: 'tabelle-rolle' }, [
      el('table', { klasse: 'vergleich' }, [
        el('tbody', {}, [
          el('tr', {}, [
            el('th', { klasse: 'vergleich-kopf', text: 'Anbieter' }),
            ...liste.map((a) =>
              el('td', {}, [
                eingabe({
                  value: a.name || '',
                  placeholder: 'z. B. Bauträger Müller',
                  'aria-label': 'Name des Anbieters',
                  onchange: async (e) => {
                    await daten.sichern('anbieter', { ...a, name: e.target.value.trim() });
                  },
                }),
                knopf('Entfernen', async () => {
                  if (!frage('„' + (a.name || 'Anbieter') + '“ mit allen Einträgen entfernen?')) return;
                  await daten.entfernen('anbieter', a.id);
                  neu();
                }, 'knopf knopf-schmal knopf-leise'),
              ])
            ),
          ]),
          el('tr', {}, [
            el('th', { klasse: 'vergleich-kopf', text: 'Angebotspreis' }),
            ...liste.map((a) =>
              el('td', {}, [
                zahlfeld({
                  value: a.angebotspreis || '',
                  placeholder: '0',
                  'aria-label': 'Angebotspreis',
                  onchange: async (e) => {
                    await daten.sichern('anbieter', { ...a, angebotspreis: zuZahl(e.target.value) });
                    neu();
                  },
                }),
              ])
            ),
          ]),
        ]),
      ]),
    ]),
    el('div', { klasse: 'anbieter-neu' }, [
      liste.length < HOECHSTENS ? neufeld(neu) : hinweisKasten(
        'Mehr als ' + HOECHSTENS + ' Angebote nebeneinander werden unübersichtlich.', 'info'
      ),
    ]),
  ]);
}

/** Feld und Knopf zum Anlegen. Kein Eingabefenster: Die App öffnet keine. */
function neufeld(neu) {
  const feldname = eingabe({ placeholder: 'Name des nächsten Anbieters', 'aria-label': 'Name des Anbieters' });
  const hinzu = async () => {
    const name = feldname.value.trim();
    if (!name) {
      feldname.focus();
      return;
    }
    await daten.sichern('anbieter', {
      name, angebotspreis: 0, posten: {}, angelegt: new Date().toISOString(),
    });
    neu();
  };
  feldname.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') hinzu();
  });
  return el('div', { klasse: 'zeilen-aktionen' }, [
    feldname,
    knopf('Hinzufügen', hinzu, 'knopf knopf-schmal'),
  ]);
}

/* ---------------------------------------------------------------- Positionen */

function gruppenkarte(gruppe, liste, neu) {
  return karte([
    el('h2', { text: gruppe.titel }),
    el('p', { klasse: 'unterzeile', text: gruppe.text }),
    el('div', { klasse: 'tabelle-rolle' }, [
      el('table', { klasse: 'vergleich' }, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', { klasse: 'vergleich-kopf', text: 'Position' }),
            ...liste.map((a) => el('th', { text: a.name || 'Anbieter' })),
          ]),
        ]),
        el('tbody', {}, gruppe.positionen.map((p) =>
          el('tr', {}, [
            el('th', { klasse: 'vergleich-kopf' }, [
              el('span', { klasse: 'zeilen-titel', text: p.titel }),
              el('span', { klasse: 'zeilen-unter', text: p.frage }),
              p.spanne
                ? el('span', {
                    klasse: 'zeilen-unter',
                    text: 'Wenn es fehlt: ' + eur.format(p.spanne[0]) + ' bis ' + eur.format(p.spanne[1]),
                  })
                : null,
            ]),
            ...liste.map((a) => el('td', {}, zelle(a, p, neu))),
          ])
        )),
      ]),
    ]),
  ]);
}

/**
 * Eine Zelle: die Auswahl und, wenn etwas fehlt, das Feld für den Betrag.
 *
 * Das Betragsfeld erscheint erst bei "fehlt". Ein Feld, in das man nichts
 * eintragen soll, lädt sonst genau dazu ein.
 */
function zelle(anbieter, position, neu) {
  const eintrag = (anbieter.posten || {})[position.id] || { art: 'offen' };

  const betragsfeld = zahlfeld({
    value: eintrag.betrag || '',
    placeholder: position.spanne ? String(position.spanne[0]) : '0',
    'aria-label': 'Betrag für ' + position.titel,
    onchange: async (e) => {
      await setzen(anbieter, position, 'betrag', zuZahl(e.target.value));
      neu();
    },
  });
  betragsfeld.hidden = eintrag.art !== 'betrag';

  const wahl = el('select', {
    'aria-label': position.titel + ' bei ' + (anbieter.name || 'Anbieter'),
    klasse: 'vergleich-wahl art-' + eintrag.art,
    onchange: async (e) => {
      await setzen(anbieter, position, e.target.value, zuZahl(betragsfeld.value));
      neu();
    },
  }, ARTEN.map(([id, name]) =>
    el('option', { value: id, text: name, selected: id === eintrag.art })
  ));

  return [wahl, betragsfeld];
}

async function setzen(anbieter, position, art, betrag) {
  const posten = { ...(anbieter.posten || {}) };
  if (art === 'betrag') posten[position.id] = { art, betrag: betrag || 0 };
  else posten[position.id] = { art };
  await daten.sichern('anbieter', { ...anbieter, posten });
}

/* ------------------------------------------------------------------ Summen */

function summenkarte(liste) {
  const stand = liste.map((a) => ({ anbieter: a, ...endpreis(a), offenSpanne: offeneSpanne(a) }));
  const fertig = stand.filter((s) => s.offen === 0 && s.summe > 0);
  const guenstigster = fertig.length
    ? fertig.reduce((a, b) => (b.summe < a.summe ? b : a))
    : null;
  const guenstigstesAngebot = stand
    .filter((s) => s.angebot > 0)
    .reduce((a, b) => (!a || b.angebot < a.angebot ? b : a), null);

  const zeile = (name, werte, stark = false) =>
    el('tr', { klasse: stark ? 'vergleich-summe' : '' }, [
      el('th', { klasse: 'vergleich-kopf', text: name }),
      ...werte.map((w) => el('td', { klasse: 'zahl', text: w })),
    ]);

  return karte([
    el('h2', { text: 'Vergleichbarer Endpreis' }),
    el('div', { klasse: 'tabelle-rolle' }, [
      el('table', { klasse: 'vergleich' }, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', { klasse: 'vergleich-kopf', text: '' }),
            ...stand.map((s) => el('th', { text: s.anbieter.name || 'Anbieter' })),
          ]),
        ]),
        el('tbody', {}, [
          zeile('Angebotspreis', stand.map((s) => eur.format(s.angebot))),
          zeile('Ergänzungen', stand.map((s) => (s.ergaenzungen ? '+ ' + eur.format(s.ergaenzungen) : '–'))),
          zeile('Vergleichbarer Endpreis', stand.map((s) => eur.format(s.summe)), true),
          zeile('Noch ungeklärt', stand.map((s) => (s.offen ? s.offen + ' Positionen' : 'nichts'))),
          zeile(
            'Darin könnten stecken',
            stand.map((s) =>
              s.offenSpanne.bis
                ? eur.format(s.offenSpanne.von) + ' bis ' + eur.format(s.offenSpanne.bis)
                : '–'
            )
          ),
        ]),
      ]),
    ]),
    ...ergebnis(guenstigster, guenstigstesAngebot, stand),
  ]);
}

function ergebnis(guenstigster, guenstigstesAngebot, stand) {
  if (stand.length < 2) {
    return [hinweisKasten(
      'Ein Angebot allein lässt sich nicht vergleichen. Zwei sagen wenig, drei sind die übliche Zahl.',
      'info'
    )];
  }
  if (!guenstigster) {
    return [hinweisKasten(
      'Solange Positionen ungeklärt sind, ist der Vergleich unfertig. Geh die Liste je Anbieter '
        + 'einmal durch und trag ein, was fehlt – erst dann steht unten eine Zahl, die etwas wert ist.',
      'warn'
    )];
  }
  const name = guenstigster.anbieter.name || 'Der Anbieter';
  if (guenstigstesAngebot && guenstigstesAngebot.anbieter.id !== guenstigster.anbieter.id) {
    const unterschied = guenstigstesAngebot.summe - guenstigster.summe;
    return [hinweisKasten(
      'Auf Seite eins war ' + (guenstigstesAngebot.anbieter.name || 'ein anderer') + ' günstiger. '
        + 'Vergleichbar gerechnet liegt ' + name + ' um ' + eur.format(unterschied) + ' vorn. '
        + 'Genau dafür ist diese Liste da.',
      'gut'
    )];
  }
  return [hinweisKasten(
    name + ' bleibt auch vergleichbar gerechnet vorn. Finanziere den Endpreis, nicht den Angebotspreis.',
    'gut'
  )];
}

/* ------------------------------------------------------------- Erklärung */

function erklaerung() {
  return karte([
    el('h2', { text: 'So gehst du vor' }),
    el('ol', { klasse: 'schritte' }, [
      el('li', { text: 'Alle Anbieter bekommen dieselben Unterlagen und dieselben Vorgaben. Sonst bekommst du drei Preise für drei verschiedene Häuser.' }),
      el('li', { text: 'Lass dir die Bau- und Leistungsbeschreibung vor dem Vertrag geben. Darauf hast du ein Recht (§ 650j BGB).' }),
      el('li', { text: 'Geh diese Liste bei jedem Angebot durch. Was fehlt, ergänzt du mit einem realistischen Marktpreis.' }),
      el('li', { text: 'Erst die Summe unten ist vergleichbar. Mit ihr gehst du zur Bank.' }),
    ]),
    el('p', {
      klasse: 'unterzeile',
      text: 'Die Positionen und die Spannen stammen aus Kapitel 10 von „Klartext Hausbau“.',
    }),
    el('div', { klasse: 'zeilen-aktionen' }, [
      knopf('Weiter zur Kostenaufstellung', () => geheZu('#/baukasse/kosten'), 'knopf knopf-schmal'),
    ]),
  ]);
}
