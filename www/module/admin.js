// Verwaltung: wer nutzt die App, und wie viel.
//
// Steht nicht in der Leiste und taucht nur auf, wenn die angemeldete Adresse
// in geheim.php unter "admins" steht. Diese Pruefung hier ist die Anzeige;
// das Schloss sitzt in server/admin.php, das jedem anderen mit 404 antwortet.
//
// Alle Adressen kommen schon verkuerzt vom Server ("an…as@example.de"). Die
// vollen stehen in der Datenbank und haben in einem Browserfenster nichts zu
// suchen -- auch nicht in meinem.

import {
  el, karte, kopfzeile, hinweisKasten, leerzustand, anhaengen, zahl, datumLang,
} from '../hilfen.js';
import { adminUeberblick, angemeldet } from '../konto.js';

const FENSTER = [
  { tage: 7, titel: '7 Tage' },
  { tage: 30, titel: '30 Tage' },
  { tage: 90, titel: '90 Tage' },
  { tage: 365, titel: '1 Jahr' },
];

/** Byte in etwas, das man vorlesen kann. */
function menge(bytes) {
  const b = Number(bytes) || 0;
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return zahl(b / 1024, 0) + ' kB';
  if (b < 1024 * 1024 * 1024) return zahl(b / 1024 / 1024, 1) + ' MB';
  return zahl(b / 1024 / 1024 / 1024, 2) + ' GB';
}

let gewaehlt = 30;

export async function zeige(rahmen) {
  await zeichne(rahmen);
}

async function zeichne(rahmen) {
  rahmen.replaceChildren();
  anhaengen(rahmen, kopfzeile('Verwaltung', 'Nutzung der App, nach Konto aufgeschlüsselt.'));

  if (!angemeldet()) {
    anhaengen(rahmen, leerzustand(
      'Nicht angemeldet',
      'Die Verwaltung liest vom Server. Melde dich unter Konto an.'
    ));
    return;
  }

  const laden = el('p', { klasse: 'unterzeile', text: 'Zahlen werden geholt …' });
  anhaengen(rahmen, laden);

  let daten;
  try {
    daten = await adminUeberblick(gewaehlt);
  } catch (fehler) {
    laden.remove();
    anhaengen(rahmen, leerzustand(
      'Keine Zahlen',
      // Der Server antwortet absichtlich mit "Nicht vorhanden", wenn die
      // Adresse nicht auf der Liste steht. Das hier nicht als Panne
      // ausgeben -- es ist die richtige Antwort auf die falsche Frage.
      fehler.message.includes('Nicht vorhanden')
        ? 'Dieses Konto darf die Verwaltung nicht sehen. Die Liste steht auf dem Server in daten/geheim.php unter "admins".'
        : fehler.message
    ));
    return;
  }
  laden.remove();

  anhaengen(
    rahmen,
    zeitraum(rahmen),
    kennzahlen(daten),
    verlauf(daten),
    nutzertabelle(daten),
    hinweisKasten(
      'Gezählt wird je Anfrage an die Schnittstelle, als Tagessumme pro Konto — ' +
        'nicht jede einzelne Anfrage einzeln. Die Aufrufe des öffentlichen ' +
        'Bautagebuchs stehen getrennt daneben: die kommen von Fremden, nicht vom Konto.',
      'info'
    )
  );
}

function zeitraum(rahmen) {
  // Dieselbe Pille wie der Hell-Dunkel-Schalter, nur mit Text statt Zeichen.
  return el('div', { klasse: 'thema-schalter mit-text' }, FENSTER.map((f) =>
    el('button', {
      type: 'button',
      klasse: 'thema-taste' + (f.tage === gewaehlt ? ' aktiv' : ''),
      text: f.titel,
      onclick: () => {
        gewaehlt = f.tage;
        zeichne(rahmen);
      },
    })
  ));
}

function kennzahl(name, wert, unter) {
  return el('div', { klasse: 'kennzahl' }, [
    el('span', { klasse: 'wert', text: wert }),
    el('span', { klasse: 'name', text: name }),
    unter ? el('span', { klasse: 'zusatz', text: unter }) : null,
  ]);
}

function kennzahlen({ gesamt, tage }) {
  return el('div', { klasse: 'kennzahlen' }, [
    kennzahl('Konten', zahl(gesamt.nutzer), gesamt.neu + ' neu in ' + tage + ' Tagen'),
    kennzahl('Davon aktiv', zahl(gesamt.aktiv), 'mit mindestens einer Anfrage'),
    kennzahl('Anfragen', zahl(gesamt.anfragen), 'in ' + tage + ' Tagen'),
    kennzahl('Datenverkehr', menge(gesamt.bytes), 'hin und zurück'),
    kennzahl('Datensätze', zahl(gesamt.saetze), 'auf dem Server'),
    kennzahl('Fotos und PDF', zahl(gesamt.bilder), menge(gesamt.bilder_bytes) + ' abgelegt'),
    kennzahl('Bautagebücher', zahl(gesamt.freigaben),
      zahl(gesamt.freigabe_aufrufe) + ' Aufrufe insgesamt'),
  ]);
}

/*
 * Tagesverlauf als Balken.
 *
 * Ein Jahr sind 365 Saeulen; auf einem Telefon ist jede davon ein halbes
 * Pixel. Deshalb rollt der Block quer, statt die Saeulen plattzudruecken --
 * dieselbe Loesung wie beim Bauablauf.
 */
function verlauf({ verlauf: tage, tage: fenster }) {
  const hoechst = Math.max(1, ...tage.map((t) => t.anfragen));
  const breit = fenster > 90 ? 3 : fenster > 30 ? 6 : 14;

  return karte([
    el('h2', { text: 'Anfragen je Tag' }),
    el('div', { klasse: 'tabelle-rolle' }, [
      el('div', {
        klasse: 'balkenblock',
        stil: { minWidth: tage.length * (breit + 2) + 'px' },
      }, tage.map((t) =>
        el('div', {
          klasse: 'saeule',
          title: datumLang(t.tag) + ': ' + zahl(t.anfragen) + ' Anfragen, '
            + menge(t.bytes) + ', ' + t.nutzer + ' Konten',
        }, [
          el('div', {
            klasse: 'anteil-zins',
            stil: t.anfragen === 0
              // Ein Tag ohne Verkehr braucht trotzdem einen Strich. Nur Luft
              // liest sich wie ein Loch in den Daten, und das ist es nicht.
              ? { height: '0', minHeight: '1px', opacity: '.3' }
              : { height: Math.round((t.anfragen / hoechst) * 100) + '%', minHeight: '2px' },
          }),
        ])
      )),
    ]),
    el('p', {
      klasse: 'unterzeile',
      text: datumLang(tage[0].tag) + ' bis ' + datumLang(tage[tage.length - 1].tag)
        + ' · Höchstwert ' + zahl(hoechst) + ' Anfragen an einem Tag',
    }),
  ]);
}

function nutzertabelle({ nutzer, tage }) {
  if (!nutzer.length) {
    return karte([leerzustand('Noch keine Konten', 'Sobald sich jemand anmeldet, steht er hier.')]);
  }

  const spalten = [
    ['Konto', 'links'], ['Angelegt', 'links'], ['Zuletzt', 'links'],
    ['Geräte', 'rechts'], ['Anfragen', 'rechts'], ['Verkehr', 'rechts'],
    ['Sätze', 'rechts'], ['Fotos', 'rechts'], ['Tagebuch', 'rechts'],
  ];

  return karte([
    el('h2', { text: 'Konten' }),
    el('div', { klasse: 'tabellenrahmen' }, [
      el('table', {}, [
        el('thead', {}, [
          el('tr', {}, spalten.map(([name, seite]) =>
            el('th', { text: name, stil: seite === 'rechts' ? { textAlign: 'right' } : null })
          )),
        ]),
        el('tbody', {}, nutzer.map((n) => {
          const zahlen = (wert) => el('td', { text: wert, stil: { textAlign: 'right' } });
          return el('tr', {}, [
            el('td', {}, [
              el('span', { klasse: 'zeilen-titel', text: n.epost }),
              el('span', {
                klasse: 'zeilen-unter',
                text: '#' + n.id + (n.passwort ? ' · mit Passwort' : ' · nur per Anmeldelink'),
              }),
            ]),
            el('td', { text: datumLang(n.angelegt) }),
            el('td', {
              text: n.zuletzt ? datumLang(n.zuletzt) : '—',
              // Ein Konto, das im Fenster nichts gemacht hat, soll man beim
              // Ueberfliegen erkennen, ohne die Zahlen zu lesen.
              stil: n.zuletzt ? null : { color: 'var(--tinte-leise)' },
            }),
            zahlen(n.geraete ? String(n.geraete) : '—'),
            zahlen(zahl(n.anfragen)),
            zahlen(n.bytes ? menge(n.bytes) : '—'),
            zahlen(zahl(n.saetze)),
            zahlen(n.bilder ? zahl(n.bilder) + ' · ' + menge(n.bilder_bytes) : '—'),
            zahlen(n.freigabe_aufrufe ? zahl(n.freigabe_aufrufe) : '—'),
          ]);
        })),
      ]),
    ]),
    el('p', {
      klasse: 'unterzeile',
      text: 'Anfragen, Verkehr und "Zuletzt" beziehen sich auf die letzten '
        + tage + ' Tage. Sätze, Fotos und Tagebuch-Aufrufe sind Gesamtstände.',
    }),
  ]);
}
