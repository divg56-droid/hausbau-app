// Verwaltung: wer nutzt die App, und wie viel.
//
// Steht nicht in der Leiste und taucht nur auf, wenn die angemeldete Adresse
// in geheim.php unter "admins" steht. Diese Pruefung hier ist die Anzeige;
// das Schloss sitzt in server/admin.php, das jedem anderen mit 404 antwortet.
//
// Die Liste kommt verkuerzt vom Server ("an…as@example.de"). Wer eine volle
// Adresse braucht, holt sie mit dem Knopf in der Zeile einzeln nach; der
// Server schreibt jeden dieser Einblicke mit und zeigt das Datum daneben.

import {
  el, karte, kopfzeile, hinweisKasten, leerzustand, anhaengen, zahl, datumLang,
} from '../hilfen.js';
import { adminAdresse, adminUeberblick, adminWebsite, angemeldet } from '../konto.js';

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
// Welche der beiden Auswertungen offen ist: die App oder die Website.
let bereich = 'app';

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

  anhaengen(rahmen, bereichswahl(rahmen));

  const laden = el('p', { klasse: 'unterzeile', text: 'Zahlen werden geholt …' });
  anhaengen(rahmen, laden);

  let daten;
  try {
    daten = bereich === 'website'
      ? await adminWebsite(gewaehlt)
      : await adminUeberblick(gewaehlt);
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

  if (bereich === 'website') {
    anhaengen(
      rahmen,
      zeitraum(rahmen),
      webKennzahlen(daten),
      daten.verlauf.length ? webVerlauf(daten) : null,
      webSeiten(daten),
      webRegionen(daten),
      webLeads(daten),
      hinweisKasten(
        'Gezählt wird eine Zeile je Tag und Seite, ohne IP-Adresse, ohne Keks und ohne '
          + 'Kennung — es gibt hier niemanden wiederzuerkennen. Die Postleitzahl-Region '
          + 'sind die ersten zwei Ziffern; eine ganze Postleitzahl wäre ein Dorf.',
        'info'
      )
    );
    return;
  }

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

/** App oder Website. Dieselbe Pille wie der Zeitraum darunter. */
function bereichswahl(rahmen) {
  return el('div', { klasse: 'thema-schalter mit-text' }, [
    ['app', 'App'],
    ['website', 'Website'],
  ].map(([id, titel]) =>
    el('button', {
      type: 'button',
      klasse: 'thema-taste' + (bereich === id ? ' aktiv' : ''),
      text: titel,
      onclick: () => {
        bereich = id;
        zeichne(rahmen);
      },
    })
  ));
}

// ------------------------------------------------------------------ Website

function webKennzahlen({ gesamt, tage, leads_gesamt: leads, regionen }) {
  return el('div', { klasse: 'kennzahlen' }, [
    kennzahl('Seitenaufrufe', zahl(gesamt.aufrufe), 'in ' + tage + ' Tagen'),
    kennzahl('Seiten gelesen', zahl(gesamt.seiten), 'verschiedene Adressen'),
    kennzahl('Anfragen aus Rechnern', zahl(leads || 0), 'mit E-Mail-Adresse'),
    kennzahl('Gegenden', zahl(regionen.length), 'Postleitzahl-Regionen'),
  ]);
}

/** Aufrufe je Tag, als Balken -- wie der Verlauf der App daneben. */
function webVerlauf({ verlauf: tage, tage: fenster }) {
  const hoechst = Math.max(1, ...tage.map((t) => Number(t.aufrufe)));
  const breit = fenster > 90 ? 3 : fenster > 30 ? 6 : 14;

  return karte([
    el('h2', { text: 'Aufrufe je Tag' }),
    el('div', { klasse: 'tabelle-rolle' }, [
      el('div', {
        klasse: 'balkenblock',
        stil: { minWidth: tage.length * (breit + 2) + 'px' },
      }, tage.map((t) =>
        el('div', {
          klasse: 'saeule',
          title: datumLang(t.tag) + ': ' + zahl(t.aufrufe) + ' Aufrufe',
        }, [
          el('div', {
            klasse: 'anteil-zins',
            stil: { height: Math.round((Number(t.aufrufe) / hoechst) * 100) + '%', minHeight: '2px' },
          }),
        ])
      )),
    ]),
    el('p', {
      klasse: 'unterzeile',
      text: datumLang(tage[0].tag) + ' bis ' + datumLang(tage[tage.length - 1].tag)
        + ' · Höchstwert ' + zahl(hoechst) + ' Aufrufe an einem Tag',
    }),
  ]);
}

/**
 * Welche Seite wie oft.
 *
 * Mit Balken unter dem Pfad statt nur der Zahl: Die Rangfolge sieht man so
 * ohne zu rechnen, und genau darum geht es bei dieser Tabelle.
 */
function webSeiten({ seiten }) {
  if (!seiten.length) {
    return karte([
      el('h2', { text: 'Seiten' }),
      el('p', { klasse: 'unterzeile', text: 'Noch keine Aufrufe gezählt.' }),
    ]);
  }
  const hoechst = Math.max(1, ...seiten.map((z) => Number(z.aufrufe)));
  return karte([
    el('h2', { text: 'Meistgelesene Seiten' }),
    el('div', { klasse: 'tabellenrahmen' }, [
      el('table', {}, [
        el('thead', {}, [el('tr', {}, [
          el('th', { text: 'Seite' }),
          el('th', { text: 'Aufrufe' }),
        ])]),
        el('tbody', {}, seiten.map((z) =>
          el('tr', {}, [
            el('td', { stil: { textAlign: 'left', whiteSpace: 'normal' } }, [
              el('a', {
                href: 'https://www.bauzeuge.de' + z.pfad,
                target: '_blank', rel: 'noopener', text: z.pfad,
              }),
              el('div', { klasse: 'fortschrittsbalken' }, [
                el('div', { stil: { width: Math.round((Number(z.aufrufe) / hoechst) * 100) + '%' } }),
              ]),
            ]),
            el('td', { text: zahl(z.aufrufe) }),
          ])
        )),
      ]),
    ]),
  ]);
}

/** Die ersten zwei Ziffern der Postleitzahl, absteigend. */
function webRegionen({ regionen }) {
  if (!regionen.length) {
    return karte([
      el('h2', { text: 'Gegenden' }),
      el('p', { klasse: 'unterzeile', text: 'Noch keine Postleitzahl eingegeben.' }),
    ]);
  }
  const hoechst = Math.max(1, ...regionen.map((r) => Number(r.anzahl)));
  return karte([
    el('h2', { text: 'Woher die Anfragen kommen' }),
    el('div', { klasse: 'kennzahlen' }, regionen.map((r) =>
      el('div', { klasse: 'kennzahl' }, [
        el('span', { klasse: 'wert', text: r.region }),
        el('span', {
          klasse: 'name',
          text: zahl(r.anzahl) + (Number(r.anzahl) === 1 ? ' Anfrage' : ' Anfragen'),
        }),
        el('div', { klasse: 'fortschrittsbalken' }, [
          el('div', { stil: { width: Math.round((Number(r.anzahl) / hoechst) * 100) + '%' } }),
        ]),
      ])
    )),
  ]);
}

/** Wer einen Rechner zu Ende ausgefuellt hat. */
function webLeads({ leads }) {
  if (!leads.length) {
    return karte([
      el('h2', { text: 'Anfragen aus den Rechnern' }),
      el('p', { klasse: 'unterzeile', text: 'Noch keine Anfrage eingegangen.' }),
    ]);
  }
  return karte([
    el('h2', { text: 'Anfragen aus den Rechnern' }),
    el('div', { klasse: 'tabellenrahmen' }, [
      el('table', {}, [
        el('thead', {}, [el('tr', {}, [
          el('th', { text: 'Wann' }),
          el('th', { text: 'Adresse' }),
          el('th', { text: 'PLZ' }),
          el('th', { text: 'Angaben' }),
        ])]),
        el('tbody', {}, leads.map((l) =>
          el('tr', {}, [
            el('td', { text: datumLang(String(l.zeit).slice(0, 10)) }),
            el('td', { stil: { textAlign: 'left' } }, [
              el('span', { klasse: 'zeilen-titel', text: l.epost }),
              el('span', { klasse: 'zeilen-unter', text: l.quelle }),
            ]),
            el('td', { text: (l.plz || '—') + (l.bundesland ? ' · ' + l.bundesland : '') }),
            el('td', { text: angabenText(l.angaben) }),
          ])
        )),
      ]),
    ]),
  ]);
}

/** Die Zahlen eines Leads in einer Zeile, ohne JSON-Klammern. */
function angabenText(a) {
  if (!a) return '—';
  const teile = [];
  if (a.flaeche) teile.push(a.flaeche + ' m²');
  if (a.standard) teile.push(a.standard);
  if (a.keller) teile.push('Keller');
  if (a.gesamt) teile.push(zahl(a.gesamt) + ' €');
  return teile.join(' · ') || '—';
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
    kennzahl('Aus dem Buch', zahl(gesamt.buchcodes || 0), 'Code eingelöst'),
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

/*
 * Die Zelle mit der Adresse.
 *
 * Der Knopf holt genau diese eine Adresse und ersetzt die Kurzform. Danach
 * ist er weg: Ein zweiter Druck haette nur einen zweiten Protokolleintrag
 * erzeugt und dieselbe Adresse gezeigt.
 */
function kontozelle(n) {
  const titel = el('span', { klasse: 'zeilen-titel', text: n.epost });
  const unter = el('span', {
    klasse: 'zeilen-unter',
    text: '#' + n.id + (n.passwort ? ' · mit Passwort' : ' · nur per Anmeldelink')
      + (n.einblick ? ' · angesehen ' + datumLang(n.einblick) : ''),
  });
  const knopf = el('button', {
    klasse: 'knopf knopf-schmal', type: 'button', text: 'Adresse zeigen',
    onclick: async () => {
      knopf.disabled = true;
      knopf.textContent = 'Einen Moment …';
      try {
        const antwort = await adminAdresse(n.id);
        titel.textContent = antwort.epost;
        unter.textContent = unter.textContent.replace(/ · angesehen .*$/, '') + ' · eben angesehen';
        knopf.remove();
      } catch (fehler) {
        knopf.disabled = false;
        knopf.textContent = 'Adresse zeigen';
        unter.textContent = 'Ging nicht: ' + fehler.message;
      }
    },
  });
  return [titel, unter, knopf];
}

function nutzertabelle({ nutzer, tage }) {
  if (!nutzer.length) {
    return karte([leerzustand('Noch keine Konten', 'Sobald sich jemand anmeldet, steht er hier.')]);
  }

  const spalten = [
    ['Konto', 'links'], ['Baustelle', 'links'], ['Angelegt', 'links'], ['Zuletzt', 'links'],
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
            el('td', {}, kontozelle(n)),
            // Der Ort der Baustelle, so wie er fuers Wetter eingetippt wurde.
            el('td', {
              text: n.ort || '—',
              stil: n.ort ? null : { color: 'var(--tinte-leise)' },
            }),
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
        + tage + ' Tage. Sätze, Fotos und Tagebuch-Aufrufe sind Gesamtstände. '
        + 'Adressen stehen verkürzt; "Adresse zeigen" holt eine einzelne nach '
        + 'und vermerkt das auf dem Server. Die Baustelle ist der Ort aus den '
        + 'Einstellungen des zuletzt bearbeiteten Projekts; ohne Konto-Abgleich '
        + 'steht dort nichts.',
    }),
  ]);
}
