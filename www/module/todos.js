// To-Dos und Checklisten. Zwei Sichten auf denselben Speicher:
//
//   To-Dos        Was ist offen, was ist faellig? Eine Liste, nach Datum.
//   Checklisten   Wo stehe ich? Nach Liste gruppiert, mit Fortschritt.
//
// Beides sind Aufgaben mit einem Haken. Der Unterschied ist nur das Feld
// "liste": Steht dort nichts, ist es eine freie Aufgabe; steht dort ein Name,
// gehoert sie zu einer Checkliste. Zwei Speicher dafuer waeren zwei Wege,
// dieselbe Zahl auszurechnen, und einer davon waere irgendwann falsch.
//
// Nicht zu verwechseln mit dem Bauablauf: Dort geht es um Termine und
// Reihenfolgen ganzer Gewerke, hier um einzelne Handgriffe.

import {
  el, feld, eingabe, auswahl, knopf, karte, kopfzeile, hinweisKasten,
  leerzustand, melde, datumLang, heute,
  anhaengen,
  kartengitter,
  geheZu,
} from '../hilfen.js';
import { daten } from '../daten.js';
import { blattOeffnen } from '../blatt.js';
import { VORLAGEN } from '../checklisten-daten.js';

/**
 * Sortiert Aufgaben so, wie man sie abarbeitet.
 *
 * Faelliges zuerst und darin das aelteste, dann alles ohne Frist. Ohne Frist
 * ans Ende, weil eine Aufgabe ohne Datum nie draengt: Wer sie zuerst sehen
 * wollte, haette ihr eines gegeben.
 */
export function todosSortieren(todos) {
  return [...todos].sort((a, b) => {
    if (!a.faellig && !b.faellig) return String(a.titel).localeCompare(String(b.titel), 'de');
    if (!a.faellig) return 1;
    if (!b.faellig) return -1;
    return a.faellig.localeCompare(b.faellig);
  });
}

/** Zaehlt, was offen, faellig und erledigt ist. */
export function todoStand(todos, stichtag) {
  const offen = todos.filter((t) => !t.erledigt);
  return {
    gesamt: todos.length,
    offen: offen.length,
    erledigt: todos.length - offen.length,
    ueberfaellig: offen.filter((t) => t.faellig && t.faellig < stichtag).length,
    heute: offen.filter((t) => t.faellig === stichtag).length,
  };
}

export async function zeige(rahmen, unterweg) {
  await zeichne(rahmen, unterweg === 'checklisten' ? 'checklisten' : 'todos');
}

async function zeichne(rahmen, ansicht) {
  rahmen.replaceChildren();
  const [todos, raeume] = await Promise.all([daten.alle('todos'), daten.alle('raeume')]);
  const neu = () => zeichne(rahmen, ansicht);

  if (ansicht === 'checklisten') return zeigeChecklisten(rahmen, todos, raeume, neu);
  return zeigeTodos(rahmen, todos, raeume, neu);
}

// ------------------------------------------------------------------- To-Dos

function zeigeTodos(rahmen, todos, raeume, neu) {
  const stand = todoStand(todos, heute());
  const offen = todosSortieren(todos.filter((t) => !t.erledigt));
  const erledigt = todos
    .filter((t) => t.erledigt)
    .sort((a, b) => String(b.am || '').localeCompare(String(a.am || '')));

  anhaengen(rahmen, kopfzeile('To-Dos', 'Alles, was offen ist, nach Fälligkeit.'));

  // Schnelleingabe steht oben: Eine Aufgabe schreibt man auf, waehrend man
  // noch auf der Baustelle steht, nicht in einem Formular mit acht Feldern.
  const feldNeu = eingabe({ placeholder: 'Was ist zu tun?' });
  const anlegen = async () => {
    const titel = feldNeu.value.trim();
    if (!titel) return;
    await daten.sichern('todos', {
      titel, notiz: '', liste: '', erledigt: false, am: null, faellig: null,
    });
    await neu();
  };
  feldNeu.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); anlegen(); }
  });

  anhaengen(
    rahmen,
    karte([
      el('div', { klasse: 'filterleiste' }, [
        feldNeu,
        // Nicht "leise": Ein Knopf ohne Rahmen neben einem Eingabefeld sieht
        // aus wie eine Beschriftung. Wer etwas eintraegt, sucht danach etwas
        // zum Antippen.
        knopf('Hinzufügen', anlegen, 'knopf-haupt'),
      ]),
      el('p', {
        klasse: 'unterzeile',
        text: 'Frist, Notiz und Zuordnung kannst du danach durch Antippen ergänzen.',
      }),
    ])
  );

  if (!todos.length) {
    anhaengen(
      rahmen,
      karte([
        leerzustand(
          'Noch nichts offen',
          'Schreib auf, was zu tun ist: nachfragen, nachmessen, nachbestellen. ' +
            'Was hier steht, geht auf der Baustelle nicht unter.'
        ),
        knopf('Checklisten ansehen', () => { geheZu('#/todos/checklisten'); }, 'knopf-leise'),
      ])
    );
    return;
  }

  if (stand.ueberfaellig) {
    anhaengen(
      rahmen,
      hinweisKasten(
        stand.ueberfaellig === 1
          ? 'Eine Aufgabe ist überfällig.'
          : `${stand.ueberfaellig} Aufgaben sind überfällig.`,
        'warn'
      )
    );
  }

  anhaengen(
    rahmen,
    karte([
      el('h2', { text: offen.length ? 'Offen (' + offen.length + ')' : 'Alles erledigt' }),
      offen.length
        ? el('ul', { klasse: 'liste liste-punkte' }, offen.map((t) => zeile(t, raeume, neu, true)))
        : el('p', {
            klasse: 'unterzeile',
            text: 'Kein offener Punkt. Das kommt am Bau selten vor, genieß es.',
          }),
    ])
  );

  if (erledigt.length) {
    anhaengen(
      rahmen,
      el('details', { klasse: 'karte phasenblock' }, [
        el('summary', {}, [
          el('span', { klasse: 'phasen-titel', text: 'Erledigt' }),
          el('span', { klasse: 'phasen-zahl', text: String(erledigt.length) }),
        ]),
        el('ul', { klasse: 'liste liste-punkte' }, erledigt.slice(0, 50).map((t) => zeile(t, raeume, neu, true))),
      ])
    );
  }

  if (todos.length) {
    anhaengen(rahmen, knopf('Alle To-Dos als PDF', () => pdfErzeugen(todos, raeume), 'knopf-leise'));
  }
}

/**
 * Die ganze Liste auf Papier.
 *
 * Offen zuerst und nach Frist, weil man das Blatt mit auf die Baustelle
 * nimmt und nicht ins Archiv legt. Das Erledigte steht darunter, damit man
 * beim Bautraeger nachweisen kann, was wann abgehakt war.
 */
async function pdfErzeugen(todos, raeume) {
  const { Blatt, pdfTeilen } = await import('../pdf.js');
  const { einstellung } = await import('../daten.js');
  const projekt = (await einstellung('projektname')) || '';
  const stichtag = heute();

  const raumVon = (t) => (raeume.find((r) => r.id === t.raumId) || {}).name || '';
  const offen = todosSortieren(todos.filter((t) => !t.erledigt));
  const erledigt = todos
    .filter((t) => t.erledigt)
    .sort((a, b) => String(b.am || '').localeCompare(String(a.am || '')));

  const blatt = new Blatt({ titel: 'To-Dos', untertitel: projekt, fusszeile: 'To-Dos' });

  blatt.ueberschrift(`Offen (${offen.length})`);
  if (offen.length) {
    blatt.tabelle(
      ['Aufgabe', 'Fällig', 'Raum', 'Liste'],
      offen.map((t) => [
        t.titel,
        t.faellig ? datumLang(t.faellig) + (t.faellig < stichtag ? ' (überfällig)' : '') : '',
        raumVon(t),
        t.liste || '',
      ]),
      [3, 1.4, 1.3, 1.5]
    );
  } else {
    blatt.absatz('Kein offener Punkt.');
  }

  if (erledigt.length) {
    blatt.ueberschrift(`Erledigt (${erledigt.length})`);
    blatt.tabelle(
      ['Aufgabe', 'Erledigt am', 'Raum', 'Liste'],
      erledigt.map((t) => [t.titel, t.am ? datumLang(t.am) : '', raumVon(t), t.liste || '']),
      [3, 1.4, 1.3, 1.5]
    );
  }

  try {
    await pdfTeilen(blatt.blob(), 'todos.pdf', 'To-Dos');
  } catch (fehler) {
    melde('PDF konnte nicht geteilt werden.');
    console.error(fehler);
  }
}

// -------------------------------------------------------------- Checklisten

function zeigeChecklisten(rahmen, todos, raeume, neu) {
  const listen = [...new Set(todos.map((t) => t.liste).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, 'de')
  );

  /* Der Knopf steht oben, nicht unter den Listen.
   *
   * Unten fand ihn niemand: Wer sechs Vorlagen geladen hat, scrollt an
   * sechs Karten vorbei, bevor er sieht, dass es eine eigene Liste gibt --
   * und wer noch keine hat, sucht ihn genau dort, wo er anfaengt zu lesen. */
  anhaengen(
    rahmen,
    kopfzeile('Checklisten', 'Listen für einen Termin: abarbeiten, abhaken, weglegen.'),
    knopf('Eigene Liste anlegen', () => listeAnlegen(listen, neu), 'knopf-haupt')
  );

  if (!listen.length) {
    anhaengen(
      rahmen,
      karte([
        leerzustand(
          'Noch keine Checkliste',
          'Sechs Vorlagen stehen bereit, vom Bauvertrag über die Unterlagen für den ' +
            'Bauantrag bis zu dem, was man zur Abnahme mitnimmt. Geladen gehört die ' +
            'Liste dir: ' +
            'Punkte streichen, umbenennen und eigene dazuschreiben geht danach.'
        ),
      ])
    );
  }

  const gitter = kartengitter([]);
  anhaengen(rahmen, gitter);

  for (const name of listen) {
    const drin = todos.filter((t) => t.liste === name);
    const fertig = drin.filter((t) => t.erledigt).length;
    const anteil = Math.round((fertig / drin.length) * 100);

    anhaengen(
      gitter,
      el('details', {
        klasse: 'karte phasenblock',
        // Fertige Listen zugeklappt: Sie sind erledigt, sie sollen nur noch
        // nachweisen, dass sie es sind.
        open: fertig < drin.length,
      }, [
        el('summary', {}, [
          el('span', { klasse: 'phasen-titel', text: name }),
          el('span', { klasse: 'phasen-zahl', text: fertig + ' / ' + drin.length }),
        ]),
        el('div', { klasse: 'fortschrittsbalken' }, [
          el('div', { stil: { width: anteil + '%' } }),
        ]),
        el('ul', { klasse: 'liste liste-punkte' }, todosSortieren(drin).map((t) => zeile(t, raeume, neu, false))),
        el('div', { klasse: 'filterleiste' }, [
          knopf('Punkt ergänzen', () =>
            bearbeiten({ liste: name }, raeume, neu), 'knopf-leise'),
          knopf('Liste löschen', () => listeLoeschen(name, drin, neu), 'knopf-leise'),
        ]),
      ])
    );
  }

  const offeneVorlagen = VORLAGEN.filter((v) => !listen.includes(v.titel));
  if (offeneVorlagen.length) {
    anhaengen(
      rahmen,
      karte([
        el('h2', { text: 'Vorlagen' }),
        el('ul', { klasse: 'liste' }, offeneVorlagen.map((v) =>
          el('li', {}, [
            el('button', { klasse: 'listenzeile', onclick: () => vorlageLaden(v, neu) }, [
              el('span', { klasse: 'zeilen-text' }, [
                el('span', { klasse: 'zeilen-titel', text: v.titel }),
                el('span', { klasse: 'zeilen-unter', text: v.text }),
              ]),
              el('span', { klasse: 'zeilen-wert', text: v.punkte.length + ' Punkte' }),
            ]),
          ])
        )),
      ])
    );
  }

}

async function vorlageLaden(vorlage, nachher) {
  if (!window.confirm(
    `Checkliste „${vorlage.titel}“ mit ${vorlage.punkte.length} Punkten anlegen?`
  )) return;
  // Ein Punkt ist entweder ein Satz oder ein Satz mit Begruendung und
  // naechstem Schritt. Beides kommt vor, beides wird gleich gespeichert.
  for (const punkt of vorlage.punkte) {
    const p = typeof punkt === 'string' ? { titel: punkt } : punkt;
    await daten.sichern('todos', {
      titel: p.titel, warum: p.warum || '', tun: p.tun || '',
      notiz: '', liste: vorlage.titel, erledigt: false, am: null, faellig: null,
    });
  }
  melde(vorlage.punkte.length + ' Punkte angelegt.');
  await nachher();
}

function listeAnlegen(listen, nachher) {
  const name = eingabe({ placeholder: 'z. B. Rohbauabnahme' });
  const punkte = el('textarea', { placeholder: 'Ein Punkt je Zeile' });
  blattOeffnen(
    'Eigene Checkliste',
    [
      feld('Name der Liste', name),
      feld('Punkte', punkte, 'Ein Punkt je Zeile. Leere Zeilen werden übersprungen.'),
    ],
    async () => {
      const titel = name.value.trim();
      if (!titel) throw new Error('Bitte einen Namen eintragen.');
      if (listen.includes(titel)) throw new Error('Diese Liste gibt es schon.');
      const zeilen = punkte.value.split('\n').map((z) => z.trim()).filter(Boolean);
      if (!zeilen.length) throw new Error('Bitte mindestens einen Punkt eintragen.');
      for (const z of zeilen) {
        await daten.sichern('todos', {
          titel: z, notiz: '', liste: titel, erledigt: false, am: null, faellig: null,
        });
      }
      await nachher();
    }
  );
}

async function listeLoeschen(name, drin, nachher) {
  if (!window.confirm(
    `Checkliste "${name}" mit ${drin.length} Punkten löschen? Das lässt sich nicht ` +
    'rückgängig machen.'
  )) return;
  for (const t of drin) await daten.loeschen('todos', t.id);
  await nachher();
}

// ---------------------------------------------------------------- Bausteine

function zeile(todo, raeume, neu, mitListe) {
  const spaet = !todo.erledigt && todo.faellig && todo.faellig < heute();

  return el('li', {}, [
    el('div', {
      klasse: 'leitfaden-zeile punktzeile' + (todo.erledigt ? ' erledigt' : ''),
    }, [
      el('input', {
        type: 'checkbox',
        checked: todo.erledigt,
        'aria-label': todo.titel,
        onchange: (e) => abhaken(todo, e.target.checked, neu),
      }),
      // Der Text ist der Knopf zum Aendern. Ein eigener Knopf daneben
      // haengt in einer breiten Karte weit rechts, mit einem Loch dazwischen
      // -- und die Zeile anzutippen erwartet man ohnehin.
      el('button', {
        klasse: 'zeilen-knopf', type: 'button',
        onclick: () => bearbeiten(todo, raeume, neu),
      }, [
        el('span', { klasse: 'zeilen-titel', text: todo.titel }),
        // Was jetzt zu tun ist, steht vor allem anderen. Der Titel sagt,
        // worum es geht; diese Zeile sagt, womit man anfaengt.
        todo.tun && !todo.erledigt
          ? el('span', { klasse: 'zeilen-tun', text: 'Jetzt: ' + todo.tun })
          : null,
        el('span', {
          klasse: 'zeilen-unter' + (spaet ? ' mehr' : ''),
          text: [
            todo.faellig
              ? (spaet ? 'überfällig seit ' : 'fällig ') + datumLang(todo.faellig)
              : null,
            todo.warum || null,
            (raeume.find((r) => r.id === todo.raumId) || {}).name || null,
            mitListe && todo.liste ? todo.liste : null,
            todo.erledigt && todo.am ? 'erledigt am ' + datumLang(todo.am) : null,
            todo.notiz || null,
          ].filter(Boolean).join(' · ') || 'ohne Frist',
        }),
      ]),
      // Die beiden Knoepfe stehen sichtbar daneben. Dass sich die Zeile
      // antippen laesst, sieht man ihr nicht an -- und eine Vorlage bringt
      // Punkte mit, die auf das eigene Vorhaben nicht passen: Die will man
      // streichen und umschreiben, nicht abhaken.
      el('span', { klasse: 'zeilen-aktionen punktknoepfe' }, [
        el('button', {
          klasse: 'punktknopf', type: 'button', text: 'Umbenennen',
          onclick: () => bearbeiten(todo, raeume, neu),
        }),
        el('button', {
          klasse: 'punktknopf', type: 'button', text: 'Löschen',
          onclick: async () => {
            if (!window.confirm(`„${todo.titel}“ löschen?`)) return;
            await daten.loeschen('todos', todo.id);
            await neu();
          },
        }),
      ]),
    ]),
  ]);
}

async function abhaken(todo, erledigt, nachher) {
  await daten.sichern('todos', { ...todo, erledigt, am: erledigt ? heute() : null });
  await nachher();
}

function bearbeiten(todo, raeume, nachher) {
  const titel = eingabe({ value: todo.titel || '', placeholder: 'Was ist zu tun?' });
  const faellig = el('input', { type: 'date', value: todo.faellig || '' });
  const notiz = el('textarea', {}, [todo.notiz || '']);
  const liste = eingabe({ value: todo.liste || '', placeholder: 'leer = freie Aufgabe' });
  const raum = auswahl(
    [['', '– kein Raum –'], ...raeume
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'de'))
      .map((r) => [r.id, r.name])],
    todo.raumId || ''
  );

  blattOeffnen(
    todo.id ? 'Aufgabe bearbeiten' : 'Aufgabe anlegen',
    [
      feld('Aufgabe', titel),
      feld('Fällig am', faellig, 'Leer lassen, wenn es nicht drängt.'),
      feld('Checkliste', liste, 'Steht hier ein Name, gehört die Aufgabe zu dieser Liste.'),
      feld('Raum', raum,
        'Damit steht die Aufgabe auch beim Raum. Für Arbeiten am ganzen Haus leer lassen.'),
      feld('Notiz', notiz),
    ],
    async () => {
      const wert = {
        // Warum und Jetzt kommen aus der Vorlage und werden hier nicht
        // bearbeitet. Sie muessen trotzdem mitgeschrieben werden, sonst
        // sind sie nach der ersten Aenderung weg.
        ...(todo.warum ? { warum: todo.warum } : {}),
        ...(todo.tun ? { tun: todo.tun } : {}),
        titel: titel.value.trim(),
        faellig: faellig.value || null,
        liste: liste.value.trim(),
        raumId: raum.value || null,
        notiz: notiz.value.trim(),
        erledigt: !!todo.erledigt,
        am: todo.am || null,
      };
      if (!wert.titel) throw new Error('Bitte eine Aufgabe eintragen.');
      if (todo.id) wert.id = todo.id;
      await daten.sichern('todos', wert);
      await nachher();
    },
    {
      loeschen: todo.id
        ? async () => {
            await daten.loeschen('todos', todo.id);
            await nachher();
          }
        : null,
    }
  );
}
