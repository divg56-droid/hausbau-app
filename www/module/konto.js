// Konto und Abgleich.
//
// Freiwillig: Ohne Anmeldung arbeitet die App wie bisher, alles bleibt auf
// dem Geraet. Wer sich anmeldet, bekommt dieselben Daten in der App und auf
// hausbauatlas.de/app/ und kann aufs neue Telefon umziehen.

import {
  el, feld, eingabe, knopf, karte, kopfzeile, wertzeile,
  hinweisKasten, melde, datumLang,
} from '../hilfen.js';
import { daten } from '../daten.js';
import {
  angemeldet, epost, anmelden, registrieren, abmelden, wer,
  passwortAendern, kontoLoeschen, standLesen,
} from '../konto.js';
import { abgleichen } from '../abgleich.js';
import { blattOeffnen } from '../blatt.js';

export async function zeige(rahmen) {
  await zeichne(rahmen);
}

async function zeichne(rahmen, art = 'anmelden') {
  rahmen.replaceChildren();
  const neu = () => zeichne(rahmen);

  if (!angemeldet()) {
    zeigeAnmeldung(rahmen, art, neu);
    return;
  }

  rahmen.append(kopfzeile('Konto', 'Angemeldet als ' + (epost() || '')));

  // Bestand auf diesem Geraet
  const zahlen = {};
  for (const n of ['maengel', 'aufgaben', 'tagebuch', 'belege', 'kontakte', 'bilder']) {
    zahlen[n] = (await daten.alle(n)).length;
  }
  const ohneBlob = (await daten.alle('bilder')).filter((b) => !b.blob).length;

  const anzeige = el('p', { klasse: 'unterzeile' });
  const stand = standLesen();
  anzeige.textContent = stand
    ? 'Zuletzt abgeglichen bis ' + datumLang(stand.slice(0, 10)) + '.'
    : 'Noch nie abgeglichen.';

  const knopfAbgleich = knopf('Jetzt abgleichen', async () => {
    knopfAbgleich.disabled = true;
    try {
      const e = await abgleichen((text) => { anzeige.textContent = text; });
      anzeige.textContent =
        `${e.hoch} hoch, ${e.runter} herunter, ${e.bilder} Fotos` +
        (e.offen ? `, ${e.offen} Fotos folgen beim nächsten Mal` : '') + '.';
      melde('Abgleich fertig.');
      // Zahlen neu einlesen, es können neue Sätze dazugekommen sein.
      setTimeout(() => zeichne(rahmen), 1200);
    } catch (fehler) {
      anzeige.textContent = fehler.message;
    } finally {
      knopfAbgleich.disabled = false;
    }
  }, 'knopf-haupt');

  rahmen.append(
    karte([
      el('h2', { text: 'Abgleich' }),
      anzeige,
      knopfAbgleich,
      ohneBlob
        ? hinweisKasten(
            `${ohneBlob} Foto(s) sind noch nicht heruntergeladen. Der nächste Abgleich holt sie.`,
            'info'
          )
        : null,
    ]),

    karte([
      el('h2', { text: 'Auf diesem Gerät' }),
      wertzeile('Mängel', String(zahlen.maengel)),
      wertzeile('Arbeitsschritte', String(zahlen.aufgaben)),
      wertzeile('Tageseinträge', String(zahlen.tagebuch)),
      wertzeile('Rechnungen', String(zahlen.belege)),
      wertzeile('Kontakte', String(zahlen.kontakte)),
      wertzeile('Fotos', String(zahlen.bilder), true),
      knopf('Stand auf dem Server prüfen', async () => {
        try {
          const w = await wer();
          melde(`Server: ${w.saetze} Sätze, ${w.bilder} Fotos, ${Math.round(w.bytes / 1024 / 1024 * 10) / 10} MB.`);
        } catch (fehler) {
          melde(fehler.message);
        }
      }, 'knopf-leise'),
    ]),

    karte([
      el('h2', { text: 'Anmeldung' }),
      knopf('Passwort ändern', () => passwortBlatt()),
      knopf('Abmelden', async () => {
        if (!window.confirm(
          'Abmelden? Die Daten bleiben auf diesem Gerät liegen. ' +
          'Nicht abgeglichene Änderungen gehen beim nächsten Anmelden mit hoch.'
        )) return;
        await abmelden();
        melde('Abgemeldet.');
        await zeichne(rahmen);
      }),
    ]),

    karte([
      el('h2', { text: 'Konto löschen' }),
      hinweisKasten(
        'Löscht das Konto und alle Daten auf dem Server, samt Fotos. Was auf ' +
          'diesem Gerät liegt, bleibt erhalten.',
        'warn'
      ),
      knopf('Konto auf dem Server löschen', () => loeschBlatt(neu), 'knopf-warn'),
    ])
  );

  function passwortBlatt() {
    const alt = el('input', { type: 'password', autocomplete: 'current-password' });
    const neuesWort = el('input', { type: 'password', autocomplete: 'new-password' });
    blattOeffnen('Passwort ändern', [
      feld('Bisheriges Passwort', alt),
      feld('Neues Passwort', neuesWort, 'Mindestens 10 Zeichen.'),
    ], async () => {
      await passwortAendern(alt.value, neuesWort.value);
      melde('Passwort geändert. Andere Geräte sind abgemeldet.');
    });
  }

  function loeschBlatt(nachher) {
    const passwort = el('input', { type: 'password', autocomplete: 'current-password' });
    blattOeffnen('Konto wirklich löschen?', [
      el('p', {
        klasse: 'kasten kasten-warn',
        text: 'Alles auf dem Server wird gelöscht und lässt sich nicht wiederholen. ' +
              'Die Daten auf diesem Gerät bleiben.',
      }),
      feld('Zur Bestätigung dein Passwort', passwort),
    ], async () => {
      await kontoLoeschen(passwort.value);
      melde('Konto gelöscht.');
      await nachher();
    }, { sicherText: 'Endgültig löschen' });
  }
}

// ------------------------------------------------------------- Nicht angemeldet

function zeigeAnmeldung(rahmen, art, nachher) {
  const neuesKonto = art === 'neu';

  const adresse = el('input', { type: 'email', autocomplete: 'email', placeholder: 'name@beispiel.de' });
  const passwort = el('input', {
    type: 'password',
    autocomplete: neuesKonto ? 'new-password' : 'current-password',
  });
  const meldung = el('p', { klasse: 'unterzeile' });

  const senden = knopf(neuesKonto ? 'Konto anlegen' : 'Anmelden', async () => {
    senden.disabled = true;
    meldung.textContent = 'Einen Moment …';
    try {
      if (neuesKonto) await registrieren(adresse.value.trim(), passwort.value);
      else await anmelden(adresse.value.trim(), passwort.value);
      melde(neuesKonto ? 'Konto angelegt.' : 'Angemeldet.');
      await nachher();
    } catch (fehler) {
      meldung.textContent = fehler.message;
      senden.disabled = false;
    }
  }, 'knopf-haupt');

  // Enter im Formular soll absenden, das erwartet man so.
  for (const f of [adresse, passwort]) {
    f.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') senden.click();
    });
  }

  rahmen.append(
    kopfzeile('Konto', 'Damit App und Internetseite dieselben Daten zeigen.'),

    el('div', { klasse: 'geschossleiste' }, [
      el('button', {
        type: 'button', text: 'Anmelden',
        klasse: neuesKonto ? null : 'aktiv',
        onclick: () => zeichne(rahmen, 'anmelden'),
      }),
      el('button', {
        type: 'button', text: 'Neues Konto',
        klasse: neuesKonto ? 'aktiv' : null,
        onclick: () => zeichne(rahmen, 'neu'),
      }),
    ]),

    karte([
      feld('E-Mail-Adresse', adresse),
      feld('Passwort', passwort, neuesKonto ? 'Mindestens 10 Zeichen.' : null),
      senden,
      meldung,
    ]),

    karte([
      el('h2', { text: 'Wozu ein Konto?' }),
      el('p', {
        klasse: 'unterzeile',
        text:
          'Mit Konto liegen dieselben Daten in der App und auf ' +
          'hausbauatlas.de/app/. Du entscheidest, wo du sie pflegst, und ein ' +
          'Umzug aufs neue Telefon ist nur ein Anmelden.',
      }),
      el('p', {
        klasse: 'unterzeile',
        text:
          'Ohne Konto arbeitet die App wie bisher: Alles bleibt auf diesem ' +
          'Gerät, und nichts wird übertragen. Du kannst dich auch später noch ' +
          'anmelden, deine vorhandenen Daten gehen dann mit hoch.',
      }),
    ]),

    hinweisKasten(
      'Auch mit Konto bleibt das Gerät die Arbeitskopie. Ohne Empfang auf der ' +
        'Baustelle läuft alles weiter, der Abgleich holt es später nach.',
      'info'
    )
  );
}
