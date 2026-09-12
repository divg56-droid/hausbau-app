// Konto und Abgleich.
//
// Freiwillig: Ohne Anmeldung arbeitet die App wie bisher, alles bleibt auf
// dem Geraet. Wer sich anmeldet, bekommt dieselben Daten in der App und auf
// BauZeuge.de/app/ und kann aufs neue Telefon umziehen.

import {
  el, feld, eingabe, knopf, karte, kopfzeile, wertzeile,
  hinweisKasten, melde, datumLang,
  anhaengen,
  geheZu,
} from '../hilfen.js';
import { zeichen } from '../zeichen.js';
import { daten } from '../daten.js';
import {
  angemeldet, epost, anmelden, registrieren, abmelden, wer,
  passwortAendern, kontoLoeschen, standLesen,
  anmeldelinkAnfordern, linkEinloesen, codeEinloesen,
} from '../konto.js';
import { abgleichen } from '../abgleich.js';
import { blattOeffnen } from '../blatt.js';

export async function zeige(rahmen, unterweg) {
  // "#/konto/<token>" ist der Anmeldelink aus der E-Mail. Er kommt als
  // Unterweg an und wird sofort eingeloest -- niemand soll ihn abtippen
  // oder irgendwo einfuegen muessen.
  if (/^[0-9a-f]{64}$/.test(String(unterweg || ''))) {
    await zeichneLink(rahmen, unterweg);
    return;
  }
  await zeichne(rahmen);
}

/** Der Bildschirm zwischen Klick und Konto: einloesen, dann weiter. */
async function zeichneLink(rahmen, token) {
  rahmen.replaceChildren();
  const meldung = el('p', { klasse: 'anmeldung-unter', text: 'Einen Moment, du wirst angemeldet …' });
  anhaengen(rahmen, el('div', { klasse: 'anmeldung' }, [
    karte([el('h1', { klasse: 'anmeldung-titel', text: 'Anmeldung' }), meldung], 'anmeldekarte'),
  ]));

  try {
    await linkEinloesen(token);
    melde('Angemeldet.');
    await gleichAbgleichen();
    // Weg von der Kennung in der Adresszeile: Sie ist verbraucht, und der
    // Router zeichnet den Kontobildschirm dann von selbst.
    geheZu('#/konto');
  } catch (fehler) {
    meldung.classList.add('anmeldung-meldung');
    meldung.textContent = fehler.message;
    anhaengen(rahmen.querySelector('.anmeldekarte'),
      knopf('Zur Anmeldung', () => { geheZu('#/konto'); }, 'knopf-haupt'));
  }
}

/* Gleich nach dem Anmelden abgleichen.
 *
 * Der einzige selbsttaetige Abgleich lief beim Start der App -- und der ist
 * vorbei, wenn jemand sich anmeldet. Wer also am Telefon etwas eintrug und
 * sich danach im Browser anmeldete, sah dort nichts: Die Daten lagen auf dem
 * Server, aber niemand holte sie. Anmelden und dann warten, bis man die Seite
 * das naechste Mal neu laedt, ist keine Erklaerung, die jemand versteht.
 *
 * Das gilt in beide Richtungen: In der frisch angemeldeten App muss auch das
 * hoch, was vorher ohne Konto entstanden ist.
 */
/* Kam etwas herunter, wird die App neu aufgebaut.
 *
 * Jeder Bildschirm haelt seine Daten im Speicher, und das offene Projekt
 * steht als gemerkter Wert in daten.js. Nach einem Abgleich kann beides
 * ueberholt sein -- besonders das Projekt: Wer am Telefon ein neues anlegt
 * und sich dann im Browser anmeldet, bekommt es herunter, sieht aber weiter
 * das alte und damit einen leeren Bildschirm.
 *
 * Neu laden statt einzelne Zeiger zurueckzusetzen: Es passiert einmal nach
 * dem Anmelden, dauert einen Wimpernschlag, und es gibt keine zweite Stelle,
 * an der man das Nachziehen vergessen kann. */
async function frischAufbauen() {
  const { projektzeigerVergessen } = await import('../daten.js');
  projektzeigerVergessen();
  setTimeout(() => location.reload(), 900);
}

async function gleichAbgleichen() {
  try {
    const stand = await abgleichen();
    if (stand && (stand.hoch || stand.runter)) {
      melde(`Abgeglichen: ${stand.hoch} hoch, ${stand.runter} herunter.`);
    }
    if (stand && stand.runter) await frischAufbauen();
  } catch (fehler) {
    // Kein Netz ist kein Grund, die Anmeldung zu vermasseln -- die gilt.
    melde('Angemeldet. Der Abgleich folgt, sobald wieder Netz da ist.');
    console.warn('Abgleich nach der Anmeldung:', fehler.message);
  }
}

async function zeichne(rahmen, art = 'anmelden') {
  rahmen.replaceChildren();
  const neu = () => zeichne(rahmen);

  if (!angemeldet()) {
    zeigeAnmeldung(rahmen, art, neu);
    return;
  }

  anhaengen(rahmen, kopfzeile('Konto', 'Angemeldet als ' + (epost() || '')));

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
      if (e.runter) {
        await frischAufbauen();
      } else {
        // Zahlen neu einlesen, es können neue Sätze dazugekommen sein.
        setTimeout(() => zeichne(rahmen), 1200);
      }
    } catch (fehler) {
      anzeige.textContent = fehler.message;
    } finally {
      knopfAbgleich.disabled = false;
    }
  }, 'knopf-haupt');

  anhaengen(
    rahmen,
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
      knopf('Passwort ändern oder festlegen', () => passwortBlatt()),
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

  // Ohne await: Der Verweis zur Verwaltung ist ein Nachtrag fuer den
  // Betreiber, und die Kontoseite soll nicht darauf warten. Schlaegt der
  // Aufruf fehl -- kein Netz, kein Recht -- bleibt es einfach dabei.
  verwaltungAnbieten(rahmen);

  function passwortBlatt() {
    const alt = el('input', { type: 'password', autocomplete: 'current-password' });
    const neuesWort = el('input', { type: 'password', autocomplete: 'new-password' });
    blattOeffnen('Passwort ändern oder festlegen', [
      feld('Bisheriges Passwort', alt,
        'Leer lassen, wenn du dich bisher nur per Anmeldelink angemeldet hast.'),
      feld('Neues Passwort', neuesWort, 'Mindestens 10 Zeichen.'),
    ], async () => {
      await passwortAendern(alt.value, neuesWort.value);
      melde('Passwort gesetzt. Andere Geräte sind abgemeldet.');
    });
  }

  function loeschBlatt(nachher) {
    const passwort = el('input', { type: 'password', autocomplete: 'current-password' });
    const adresse = eingabe({ value: '', placeholder: epost() || 'name@beispiel.de' });
    blattOeffnen('Konto wirklich löschen?', [
      el('p', {
        klasse: 'kasten kasten-warn',
        text: 'Alles auf dem Server wird gelöscht. Das lässt sich nicht rückgängig machen. ' +
              'Die Daten auf diesem Gerät bleiben.',
      }),
      feld('Zur Bestätigung dein Passwort', passwort,
        'Ohne Passwort angemeldet? Dann trage stattdessen unten deine Adresse ein.'),
      feld('Oder deine E-Mail-Adresse', adresse),
    ], async () => {
      await kontoLoeschen(passwort.value, adresse.value.trim());
      melde('Konto gelöscht.');
      await nachher();
    }, { sicherText: 'Endgültig löschen' });
  }
}

/**
 * Haengt den Verweis zur Verwaltung an, wenn dieses Konto sie sehen darf.
 *
 * Die Auskunft kommt vom Server; hier steht keine Liste von Adressen. Dass
 * der Verweis fehlt, ist nur eine Anzeige -- den Zugang entscheidet
 * admin.php, und zwar bei jedem Aufruf neu.
 */
async function verwaltungAnbieten(rahmen) {
  let w;
  try {
    w = await wer();
  } catch {
    return;
  }
  if (!w.admin || !rahmen.isConnected) return;
  anhaengen(rahmen, karte([
    el('h2', { text: 'Verwaltung' }),
    el('p', {
      klasse: 'unterzeile',
      text: 'Wer die App nutzt, wie oft und mit wie viel Datenverkehr. '
        + 'Adressen stehen dort nur verkürzt.',
    }),
    knopf('Statistiken ansehen', () => geheZu('#/admin')),
  ]));
}

// ------------------------------------------------------------- Nicht angemeldet

function zeigeAnmeldung(rahmen, art, nachher) {
  const neuesKonto = art === 'neu';

  const adresse = el('input', {
    type: 'email', autocomplete: 'email', placeholder: 'name@beispiel.de',
  });
  const passwort = el('input', {
    type: 'password',
    autocomplete: neuesKonto ? 'new-password' : 'current-password',
    placeholder: neuesKonto ? 'Mindestens 10 Zeichen' : 'Dein Passwort',
  });

  // Das Auge: Auf der Baustelle tippt man ein Passwort mit Handschuh und
  // schiefem Daumen. Einmal hinsehen zu duerfen spart den dritten Versuch.
  const auge = el('button', {
    klasse: 'augenknopf', type: 'button',
    title: 'Passwort anzeigen', 'aria-label': 'Passwort anzeigen',
    onclick: () => {
      const zeigen = passwort.type === 'password';
      passwort.type = zeigen ? 'text' : 'password';
      auge.title = zeigen ? 'Passwort verbergen' : 'Passwort anzeigen';
      auge.setAttribute('aria-label', auge.title);
      auge.replaceChildren(zeichen(zeigen ? 'augezu' : 'auge', { groesse: 18 }));
    },
  }, [zeichen('auge', { groesse: 18 })]);

  const meldung = el('p', { klasse: 'anmeldung-meldung' });

  const senden = knopf(neuesKonto ? 'Konto anlegen' : 'Anmelden', async () => {
    senden.disabled = true;
    meldung.textContent = 'Einen Moment …';
    try {
      if (neuesKonto) await registrieren(adresse.value.trim(), passwort.value);
      else await anmelden(adresse.value.trim(), passwort.value);
      melde(neuesKonto ? 'Konto angelegt.' : 'Angemeldet.');
      await gleichAbgleichen();
      await nachher();
    } catch (fehler) {
      meldung.textContent = fehler.message;
      senden.disabled = false;
    }
  }, 'knopf-haupt knopf-gross');

  // Enter im Formular soll absenden, das erwartet man so.
  for (const f of [adresse, passwort]) {
    f.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') senden.click();
    });
  }

  anhaengen(
    rahmen,
    el('div', { klasse: 'anmeldung' }, [
      karte([
        el('h1', {
          klasse: 'anmeldung-titel',
          text: neuesKonto ? 'Konto anlegen' : 'Willkommen zurück',
        }),
        el('p', {
          klasse: 'anmeldung-unter',
          text: neuesKonto
            ? 'Ein Konto, damit dein Bauvorhaben in der App und auf BauZeuge.de dasselbe zeigt.'
            : 'Melde dich an und mach dort weiter, wo du aufgehört hast.',
        }),
        feld('E-Mail-Adresse', adresse),
        feld('Passwort', el('span', { klasse: 'passwortfeld' }, [passwort, auge]),
          neuesKonto ? 'Mindestens 10 Zeichen.' : null),
        senden,
        meldung,

        // Der zweite Weg. Er steht bewusst unter dem ersten und nicht
        // daneben: Wer ein Passwort hat, benutzt es; wer keins mehr weiss,
        // findet hier heraus, ohne "Passwort vergessen" zu suchen.
        el('p', { klasse: 'anmeldung-oder' }, ['oder']),
        knopf('Anmeldelink per E-Mail', () => linkAnfordern(), 'knopf-leise'),
        el('p', {
          klasse: 'unterzeile',
          text: 'Ohne Passwort: Wir schicken dir einen Link und einen Code an die ' +
            'Adresse oben. Beides gilt 15 Minuten.',
        }),

        el('p', { klasse: 'anmeldung-fuss' }, [
          neuesKonto ? 'Schon ein Konto? ' : 'Noch kein Konto? ',
          el('button', {
            klasse: 'textknopf', type: 'button',
            text: neuesKonto ? 'Hier anmelden' : 'Konto anlegen',
            onclick: () => zeichne(rahmen, neuesKonto ? 'anmelden' : 'neu'),
          }),
        ]),
      ], 'anmeldekarte'),
    ]),

    karte([
      el('h2', { text: 'Wozu ein Konto?' }),
      el('p', {
        klasse: 'unterzeile',
        text:
          'Mit Konto liegen dieselben Daten in der App und auf ' +
          'BauZeuge.de/app/. Du entscheidest, wo du sie pflegst, und ein ' +
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

  /** Schickt Link und Code und schaltet auf die Code-Eingabe um. */
  async function linkAnfordern() {
    const wert = adresse.value.trim();
    if (!wert) {
      meldung.textContent = 'Bitte zuerst deine E-Mail-Adresse eintragen.';
      adresse.focus();
      return;
    }
    meldung.textContent = 'Wird gesendet …';
    try {
      await anmeldelinkAnfordern(wert);
      zeigeCode(rahmen, wert, nachher);
    } catch (fehler) {
      meldung.textContent = fehler.message;
    }
  }
}

/**
 * Der Bildschirm nach dem Absenden: Code eintippen oder Link anklicken.
 *
 * Der Code ist der Weg auf dem Telefon. Dort oeffnet der Link den Browser
 * und nicht die installierte App -- die Sitzung entstuende an der falschen
 * Stelle, und man waere ueberall angemeldet ausser da, wo man arbeitet.
 */
function zeigeCode(rahmen, adresse, nachher) {
  rahmen.replaceChildren();

  const code = eingabe({
    inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6',
    placeholder: '123456', klasse: 'codefeld',
  });
  const meldung = el('p', { klasse: 'anmeldung-meldung' });

  const senden = knopf('Anmelden', async () => {
    senden.disabled = true;
    meldung.textContent = 'Einen Moment …';
    try {
      await codeEinloesen(adresse, code.value.trim());
      melde('Angemeldet.');
      await gleichAbgleichen();
      await nachher();
    } catch (fehler) {
      meldung.textContent = fehler.message;
      senden.disabled = false;
    }
  }, 'knopf-haupt knopf-gross');

  code.addEventListener('keydown', (e) => { if (e.key === 'Enter') senden.click(); });

  anhaengen(
    rahmen,
    el('div', { klasse: 'anmeldung' }, [
      karte([
        el('h1', { klasse: 'anmeldung-titel', text: 'Sieh in dein Postfach' }),
        el('p', {
          klasse: 'anmeldung-unter',
          text: `Wir haben eine E-Mail an ${adresse} geschickt. Klick den Link darin – ` +
            'oder tipp hier den sechsstelligen Code ein, wenn du am Telefon bist.',
        }),
        feld('Code aus der E-Mail', code),
        senden,
        meldung,
        el('p', { klasse: 'anmeldung-fuss' }, [
          'Nichts angekommen? ',
          el('button', {
            klasse: 'textknopf', type: 'button', text: 'Noch einmal senden',
            onclick: async () => {
              meldung.textContent = 'Wird gesendet …';
              try {
                await anmeldelinkAnfordern(adresse);
                meldung.textContent = 'Neue E-Mail unterwegs. Der alte Code gilt nicht mehr.';
              } catch (fehler) {
                meldung.textContent = fehler.message;
              }
            },
          }),
        ]),
      ], 'anmeldekarte'),
    ]),
    knopf('Zurück zur Anmeldung', () => zeichne(rahmen), 'knopf-leise')
  );

  code.focus();
}
