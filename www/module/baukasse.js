// Baukasse: Budget, Rechnungen, Restbudget.
//
// Das Budget kommt aus der Baufinanzierung, damit es nur eine Wahrheit gibt.
// Jeder Beleg haengt an einer Budgetquelle, sonst laesst sich "Rest" pro
// Darlehen nicht sagen - und genau das will man wissen, wenn eine Bank die
// Auszahlung in Raten freigibt.

import {
  el, eur, eurGenau, feld, eingabe, zahlfeld, auswahl, knopf, karte, kopfzeile,
  wertzeile, hinweisKasten, leerzustand, zuZahl, melde, datumLang, heute,
} from '../hilfen.js';
import { daten, einstellung, bildAblegen, bildUrl, bildLoeschen } from '../daten.js';
import { blattOeffnen } from '../blatt.js';
import { finanzierungsstand } from './finanzierung.js';
import { dateiWaehlen } from '../fotos.js';
import { belegLesen, erkennungBereit } from '../erkennung.js';

export async function zeige(rahmen) {
  await zeichne(rahmen);
}

async function zeichne(rahmen) {
  rahmen.replaceChildren();

  const [belege, stand, kontakte] = await Promise.all([
    daten.alle('belege'),
    finanzierungsstand(),
    daten.alle('kontakte'),
  ]);

  const neu = () => zeichne(rahmen);
  const ausgaben = belege.reduce((s, b) => s + b.betrag, 0);
  const budget = stand.gesamt;

  rahmen.append(kopfzeile('Baukasse', 'Budget, Rechnungen und Restbudget im Überblick.'));

  if (!stand.posten.length) {
    rahmen.append(
      karte([
        leerzustand(
          'Erst das Budget, dann die Rechnungen',
          'Die Baukasse zieht ihr Budget aus der Baufinanzierung. Lege dort Eigenkapital ' +
            'und Darlehen an, danach rechnet sich das Restbudget von allein.'
        ),
        knopf('Zur Baufinanzierung', () => { location.hash = '#/finanzierung'; }, 'knopf-haupt'),
      ])
    );
  } else {
    const anteil = budget > 0 ? Math.min(100, (ausgaben / budget) * 100) : 0;
    rahmen.append(
      karte([
        el('h2', { text: 'Mein Budget' }),
        ...stand.posten.map((p) => {
          const verbraucht = belege
            .filter((b) => b.quelleId === p.id)
            .reduce((s, b) => s + b.betrag, 0);
          return el('div', {}, [
            wertzeile(p.name, eur.format(p.betrag)),
            el('p', {
              klasse: 'unterzeile',
              stil: { margin: '-4px 0 8px' },
              text: `Rest: ${eur.format(p.betrag - verbraucht)}`,
            }),
          ]);
        }),
        el('div', { klasse: 'fortschrittsbalken' }, [
          el('div', { stil: { width: anteil + '%' } }),
        ]),
        wertzeile('Ausgaben', eur.format(ausgaben)),
        wertzeile('Restbudget', eur.format(budget - ausgaben), true),
        ausgaben > budget
          ? hinweisKasten('Die Ausgaben liegen über dem Budget.', 'warn')
          : null,
        knopf('Budget in der Baufinanzierung ändern', () => { location.hash = '#/finanzierung'; }, 'knopf-leise'),
      ])
    );
  }

  // Erfassen
  const scanBereit = await erkennungBereit();
  rahmen.append(
    karte([
      el('h2', { text: 'Rechnung erfassen' }),
      scanBereit
        ? dateiWaehlen('\u{1F4C4} Rechnung hochladen & scannen', (datei) =>
            scannenUndOeffnen(datei, stand, kontakte, neu)
          )
        : hinweisKasten(
            'Die automatische Erkennung ist aus. Du kannst sie in den Einstellungen ' +
              'einschalten, indem du einen eigenen Google-Gemini-Schlüssel hinterlegst.',
            'info'
          ),
      knopf('Rechnung manuell erfassen', () =>
        belegBearbeiten({ datum: heute() }, stand, kontakte, neu)
      ),
      el('p', {
        klasse: 'unterzeile',
        stil: { marginTop: '10px' },
        text:
          'Beim Scannen wird die hochgeladene Datei zur Erkennung von Betrag, Kontakt und ' +
          'Beschreibung an Google Gemini übermittelt. Wer keine Übertragung an einen ' +
          'KI-Dienst möchte, erfasst die Rechnung manuell. Manuell erfasste Belege ' +
          'verlassen das Gerät nicht.',
      }),
    ])
  );

  // Belegliste
  const sortiert = [...belege].sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
  rahmen.append(
    karte([
      el('h2', { text: `Rechnungen (${belege.length})` }),
      sortiert.length
        ? el('ul', { klasse: 'liste' }, await Promise.all(sortiert.map(async (b) => {
            const kontakt = kontakte.find((k) => k.id === b.kontaktId);
            const url = b.bildId ? await bildUrl(b.bildId) : null;
            return el('li', {}, [
              el('button', {
                klasse: 'listenzeile',
                onclick: () => belegBearbeiten(b, stand, kontakte, neu),
              }, [
                url
                  ? el('img', { klasse: 'vorschau', src: url, alt: '' })
                  : el('span', { klasse: 'vorschau' }),
                el('span', { klasse: 'zeilen-text' }, [
                  el('span', { klasse: 'zeilen-titel', text: b.beschreibung || 'Rechnung' }),
                  el('span', {
                    klasse: 'zeilen-unter',
                    text: [datumLang(b.datum), kontakt ? kontakt.name : b.kontaktName].filter(Boolean).join(' · '),
                  }),
                ]),
                el('span', { klasse: 'zeilen-wert', text: eur.format(b.betrag) }),
              ]),
            ]);
          })))
        : el('p', { klasse: 'unterzeile', text: 'Noch keine Rechnung erfasst.' }),
    ])
  );
}

// ------------------------------------------------------------------ Erfassen

async function scannenUndOeffnen(datei, stand, kontakte, nachher) {
  const meldung = melde('Beleg wird gelesen …');
  try {
    const bildId = await bildAblegen(datei);
    const erkannt = await belegLesen(datei);
    belegBearbeiten(
      {
        datum: erkannt.datum || heute(),
        betrag: erkannt.betrag || 0,
        beschreibung: erkannt.beschreibung || '',
        kontaktName: erkannt.kontakt || '',
        bildId,
        erkannt: true,
      },
      stand, kontakte, nachher
    );
  } catch (fehler) {
    console.error(fehler);
    melde('Erkennung fehlgeschlagen. Bitte manuell erfassen.');
  }
}

function belegBearbeiten(beleg, stand, kontakte, nachher) {
  const betrag = zahlfeld({ value: beleg.betrag ? String(beleg.betrag).replace('.', ',') : '' });
  const beschreibung = eingabe({ value: beleg.beschreibung || '', placeholder: 'z. B. Abschlag Rohbau' });
  const datum = el('input', { type: 'date', value: beleg.datum || heute() });

  // Erkannte Firmennamen stehen als Text da; passt einer zu einem Kontakt,
  // wird er vorgewaehlt, sonst bleibt der Name als Freitext erhalten.
  const treffer = kontakte.find(
    (k) => beleg.kontaktName && k.name.toLowerCase() === String(beleg.kontaktName).toLowerCase()
  );
  const kontakt = auswahl(
    [['', '– kein Kontakt –'], ...kontakte.map((k) => [k.id, k.name])],
    beleg.kontaktId ?? (treffer ? treffer.id : '')
  );
  const kontaktName = eingabe({
    value: beleg.kontaktName || '',
    placeholder: 'Firma laut Rechnung',
  });

  const quelle = auswahl(
    [['', '– keine Zuordnung –'], ...stand.posten.map((p) => [p.id, p.name])],
    beleg.quelleId ?? (stand.posten[0] ? stand.posten[0].id : '')
  );

  const felder = [
    beleg.erkannt
      ? el('p', { klasse: 'kasten kasten-gut', text: 'Aus dem Beleg gelesen. Bitte die Werte prüfen.' })
      : null,
    feld('Betrag in €', betrag),
    feld('Beschreibung', beschreibung),
    feld('Rechnungsdatum', datum),
    feld('Firma laut Rechnung', kontaktName),
    feld('Zugeordneter Kontakt', kontakt, 'Kontakte legst du im Bereich Kontakte an.'),
    feld('Bezahlt aus', quelle, 'Bestimmt, von welchem Budgetposten der Betrag abgeht.'),
  ].filter(Boolean);

  blattOeffnen(
    beleg.id ? 'Rechnung bearbeiten' : 'Rechnung erfassen',
    felder,
    async () => {
      const wert = {
        betrag: Math.max(0, zuZahl(betrag.value)),
        beschreibung: beschreibung.value.trim(),
        datum: datum.value || heute(),
        kontaktName: kontaktName.value.trim(),
        kontaktId: kontakt.value ? +kontakt.value : null,
        quelleId: quelle.value ? +quelle.value : null,
        bildId: beleg.bildId ?? null,
      };
      if (wert.betrag <= 0) throw new Error('Bitte einen Betrag eintragen.');
      if (beleg.id) wert.id = beleg.id;
      await daten.sichern('belege', wert);
      await nachher();
    },
    {
      loeschen: beleg.id
        ? async () => {
            if (beleg.bildId) await bildLoeschen(beleg.bildId);
            await daten.loeschen('belege', beleg.id);
            await nachher();
          }
        : null,
    }
  );
}
