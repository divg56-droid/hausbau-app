// Gehaeuse der App: Kopfzeile, Navigation, Startseite.
//
// Die Module liegen einzeln in module/ und werden erst geladen, wenn man sie
// oeffnet. Ein Modul liefert eine Funktion zeige(rahmen), die ihren Inhalt in
// den uebergebenen Knoten haengt.

import { el, leeren } from './hilfen.js';
import { bildUrlsFreigeben } from './daten.js';

export const MODULE = [
  {
    weg: 'baukosten', zeichen: '\u{1F3D7}', titel: 'Baukostenrechner',
    text: 'Was das Haus samt Grundstück und Nebenkosten wirklich kostet.',
  },
  {
    weg: 'finanzierung', zeichen: '\u{1F3E6}', titel: 'Baufinanzierung',
    text: 'Eigenkapital und Darlehen erfassen oder erst einmal rechnen lassen.',
  },
  {
    weg: 'tilgung', zeichen: '\u{1F4C9}', titel: 'Tilgungsverlauf',
    text: 'Restschuld, Rate und Laufzeit Jahr für Jahr, als PDF zum Weitergeben.',
  },
  {
    weg: 'baukasse', zeichen: '\u{1F4B6}', titel: 'Baukasse',
    text: 'Budget, Rechnungen und Restbudget im Blick behalten.',
  },
  {
    weg: 'angebote', zeichen: '\u{1F4C4}', titel: 'Angebote',
    text: 'Mehrere Angebote je Gewerk nebeneinander legen und vergleichen.',
  },
  {
    weg: 'raeume', zeichen: '\u{1F6CB}', titel: 'Räume',
    text: 'Jeder Raum mit Fotos, Mängeln und dem, was er gekostet hat.',
  },
  {
    weg: 'anschlussplan', zeichen: '\u{1F4CD}', titel: 'Anschlussplan',
    text: 'Steckdosen, Schalter und Leitungen auf dem Grundriss markieren.',
  },
  {
    weg: 'maengel', zeichen: '\u{1F50D}', titel: 'Mängelliste',
    text: 'Jeden Schaden mit Foto, Raum, Gewerk und Status festhalten.',
  },
  {
    weg: 'ablauf', zeichen: '\u{1F4C5}', titel: 'Bauablauf',
    text: 'Reihenfolge der Gewerke planen, damit nichts zurückgebaut wird.',
  },
  {
    weg: 'tagebuch', zeichen: '\u{1F4D3}', titel: 'Bauhelfertagebuch',
    text: 'Täglich festhalten, wer da war und was gemacht wurde.',
  },
  {
    weg: 'kontakte', zeichen: '\u{1F4C7}', titel: 'Kontakte',
    text: 'Handwerker, Bauleiter und Ansprechpartner an einer Stelle.',
  },
  {
    weg: 'konto', zeichen: '\u{2601}', titel: 'Konto',
    text: 'Anmelden, damit App und Internetseite dieselben Daten zeigen.',
  },
  {
    weg: 'einstellungen', zeichen: '\u{2699}', titel: 'Einstellungen',
    text: 'Projektname, Daten sichern, alles löschen.',
  },
];

const kopftitel = document.getElementById('kopftitel');
const zurueckKnopf = document.getElementById('zurueck');
const kopfaktion = document.getElementById('kopfaktion');
const inhalt = document.getElementById('inhalt');

// Die Kopfzeile gehoert dem Gehaeuse. Module melden hier an, was rechts oben
// stehen soll, statt sich eine eigene Leiste zu bauen.
export function setzeKopf({ titel, aktion }) {
  kopftitel.textContent = titel || 'Bauzeuge';
  kopfaktion.hidden = !aktion;
  if (aktion) {
    kopfaktion.textContent = aktion.text;
    kopfaktion.onclick = aktion.tun;
  } else {
    kopfaktion.onclick = null;
  }
}

zurueckKnopf.addEventListener('click', () => {
  // history.back() statt fester Route: so stimmt auch die Android-Zurücktaste,
  // die auf denselben Verlauf wirkt.
  if (history.length > 1) history.back();
  else location.hash = '';
});

function startseite() {
  setzeKopf({ titel: 'Bauzeuge' });
  zurueckKnopf.hidden = true;

  inhalt.append(
    el('header', { klasse: 'seitenkopf' }, [
      el('h1', { text: 'Dein Bauprojekt' }),
      el('p', {
        klasse: 'unterzeile',
        text: 'Alle Daten bleiben auf diesem Gerät. Kein Konto, keine Übertragung.',
      }),
    ]),
    el(
      'div',
      { klasse: 'kachelgitter' },
      MODULE.map((m) =>
        el('a', { klasse: 'kachel', href: '#/' + m.weg }, [
          el('span', { klasse: 'kachel-zeichen', text: m.zeichen }),
          el('span', { klasse: 'kachel-titel', text: m.titel }),
          el('span', { klasse: 'kachel-text', text: m.text }),
        ])
      )
    )
  );
}

async function zeichne() {
  // Bild-URLs des vorherigen Bildschirms freigeben, sonst waechst der
  // Speicherverbrauch mit jedem Wechsel.
  bildUrlsFreigeben();
  leeren(inhalt);
  window.scrollTo(0, 0);

  const weg = location.hash.replace(/^#\/?/, '').split('/')[0];

  if (!weg) {
    startseite();
    return;
  }

  const modul = MODULE.find((m) => m.weg === weg);
  if (!modul) {
    location.hash = '';
    return;
  }

  zurueckKnopf.hidden = false;
  setzeKopf({ titel: modul.titel });

  try {
    const geladen = await import('./module/' + weg + '.js');
    await geladen.zeige(inhalt);
  } catch (fehler) {
    console.error(fehler);
    inhalt.append(
      el('div', { klasse: 'leer' }, [
        el('h2', { text: 'Da ging etwas schief' }),
        el('p', { text: String(fehler && fehler.message ? fehler.message : fehler) }),
      ])
    );
  }
}

window.addEventListener('hashchange', zeichne);
zeichne();

// Beim Start einmal still abgleichen. Schlaegt es fehl, etwa ohne Empfang,
// merkt der Nutzer nichts: Das Geraet ist die Arbeitskopie, der Abgleich holt
// es beim naechsten Mal nach.
import('./abgleich.js')
  .then((m) => m.stillAbgleichen())
  .catch((fehler) => console.warn('Abgleich beim Start nicht moeglich:', fehler));
