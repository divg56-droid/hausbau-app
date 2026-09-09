// Tilgungsverlauf: Restschuld, Rate und Laufzeit Jahr fuer Jahr.
//
// Rechnet monatsgenau und fasst zu Jahren zusammen. Die Rundung auf ganze
// Monate ist kein Schoenheitsfehler, sondern das, was die Bank auch tut.

import {
  el, eur, zahl, feld, zahlfeld, auswahl, knopf, karte, kopfzeile,
  wertzeile, hinweisKasten, zuZahl, melde, datumLang, heute,
} from '../hilfen.js';
import { einstellung } from '../daten.js';
import { finanzierungsstand, ZINS_JE_BINDUNG } from './finanzierung.js';
import { Blatt, pdfTeilen } from '../pdf.js';

const MAX_MONATE = 720; // 60 Jahre; danach gilt das Darlehen als nicht tilgbar

/**
 * Monatsgenaue Simulation.
 * Sondertilgung wird jeweils am Jahresende angesetzt, so handhaben es die
 * meisten Vertraege.
 */
export function simuliere({ betrag, zinsProzent, rate, sondertilgung = 0, bindungJahre = 10 }) {
  const zins = zinsProzent / 100;
  const r = zins / 12;
  const jahre = [];
  let rest = betrag;
  let monat = 0;
  let jahrZins = 0;
  let jahrTilgung = 0;
  let zinsInBindung = 0;
  let restNachBindung = null;

  while (rest > 0.005 && monat < MAX_MONATE) {
    monat++;
    const zinsanteil = rest * r;
    const tilgungsanteil = Math.min(rate - zinsanteil, rest);
    rest -= tilgungsanteil;
    jahrZins += zinsanteil;
    jahrTilgung += tilgungsanteil;
    if (monat <= bindungJahre * 12) zinsInBindung += zinsanteil;

    if (monat % 12 === 0 && rest > 0 && sondertilgung > 0) {
      const extra = Math.min(sondertilgung, rest);
      rest -= extra;
      jahrTilgung += extra;
    }
    if (monat === bindungJahre * 12) restNachBindung = rest;

    if (monat % 12 === 0 || rest <= 0.005) {
      jahre.push({ jahr: Math.ceil(monat / 12), zins: jahrZins, tilgung: jahrTilgung, rest });
      jahrZins = 0;
      jahrTilgung = 0;
    }
  }

  return {
    jahre, restNachBindung, monate: monat, zinsInBindung,
    offen: rest > 0.005,
    zinsGesamt: jahre.reduce((s, j) => s + j.zins, 0),
  };
}

export async function zeige(rahmen) {
  const gemerkt = (await einstellung('tilgung_eingabe')) || {};

  const betragFeld = zahlfeld({ value: String(gemerkt.betrag ?? 400000) });
  const zinsFeld = zahlfeld({ value: String(gemerkt.zinsProzent ?? 3.8) });
  const modusFeld = auswahl(
    [['tilgung', 'Über die Tilgung'], ['rate', 'Über die Wunschrate']],
    gemerkt.modus || 'tilgung'
  );
  const tilgungFeld = zahlfeld({ value: String(gemerkt.tilgungProzent ?? 2.0) });
  const rateFeld = zahlfeld({ value: String(gemerkt.wunschrate ?? 1800) });
  const bindungFeld = auswahl(
    [[5, '5 Jahre'], [10, '10 Jahre'], [15, '15 Jahre'], [20, '20 Jahre']],
    gemerkt.bindungJahre ?? 10
  );
  const sonderFeld = zahlfeld({ value: String(gemerkt.sondertilgung ?? 0) });

  const tilgungsfeld = feld('Anfängliche Tilgung in %', tilgungFeld);
  const ratenfeld = feld('Wunschrate in € pro Monat', rateFeld);

  const ergebnis = el('div');
  let letzteRechnung = null;

  function modusUmschalten() {
    const ueberTilgung = modusFeld.value === 'tilgung';
    tilgungsfeld.hidden = !ueberTilgung;
    ratenfeld.hidden = ueberTilgung;
  }

  let zinsSelbst = gemerkt.zinsProzent !== undefined;
  zinsFeld.addEventListener('input', () => { zinsSelbst = true; });
  bindungFeld.addEventListener('change', () => {
    if (!zinsSelbst) zinsFeld.value = String(ZINS_JE_BINDUNG[+bindungFeld.value] ?? 3.8);
  });

  async function rechne() {
    modusUmschalten();

    const betrag = Math.max(0, zuZahl(betragFeld.value));
    const zinsProzent = zuZahl(zinsFeld.value);
    const bindungJahre = +bindungFeld.value;
    const sondertilgung = Math.max(0, zuZahl(sonderFeld.value));

    const rate = modusFeld.value === 'tilgung'
      ? (betrag * (zinsProzent / 100 + zuZahl(tilgungFeld.value) / 100)) / 12
      : Math.max(0, zuZahl(rateFeld.value));

    await einstellung('tilgung_eingabe', {
      betrag, zinsProzent, bindungJahre, sondertilgung,
      modus: modusFeld.value,
      tilgungProzent: zuZahl(tilgungFeld.value),
      wunschrate: zuZahl(rateFeld.value),
    });

    const ersteZinsen = (betrag * zinsProzent) / 100 / 12;

    if (betrag <= 0 || zinsProzent <= 0 || rate <= ersteZinsen) {
      letzteRechnung = null;
      ergebnis.replaceChildren(
        hinweisKasten(
          rate > 0 && rate <= ersteZinsen && betrag > 0
            ? `Die Rate deckt nicht einmal die Zinsen von ${eur.format(ersteZinsen)} im Monat. So würde das Darlehen nie getilgt.`
            : 'Bitte Darlehenssumme, Zins und Rate eintragen.',
          'warn'
        )
      );
      return;
    }

    const s = simuliere({ betrag, zinsProzent, rate, sondertilgung, bindungJahre });
    const tilgungssatz = ((rate * 12) / betrag - zinsProzent / 100) * 100;
    letzteRechnung = { betrag, zinsProzent, rate, sondertilgung, bindungJahre, tilgungssatz, s };

    ergebnis.replaceChildren(
      karte([
        el('h2', { text: 'Ergebnis' }),
        wertzeile('Monatsrate', eur.format(rate), true),
        wertzeile('Anfängliche Tilgung', zahl(tilgungssatz, 2) + ' %'),
        wertzeile(
          `Restschuld nach ${bindungJahre} Jahren`,
          s.restNachBindung === null ? 'vorher abbezahlt'
            : s.restNachBindung < 1 ? 'abbezahlt' : eur.format(s.restNachBindung)
        ),
        wertzeile('Zinskosten in der Bindung', eur.format(s.zinsInBindung)),
        wertzeile('Zinskosten insgesamt', eur.format(s.zinsGesamt)),
        wertzeile('Gesamtlaufzeit', s.offen ? 'über 60 Jahre' : zahl(s.monate / 12, 1) + ' Jahre'),
      ]),
      diagramm(s.jahre),
      karte([
        el('h2', { text: 'Jahr für Jahr' }),
        el('div', { klasse: 'tabellenrahmen' }, [
          el('table', {}, [
            el('thead', {}, [
              el('tr', {}, [
                el('th', { text: 'Jahr' }), el('th', { text: 'Zins' }),
                el('th', { text: 'Tilgung' }), el('th', { text: 'Restschuld' }),
              ]),
            ]),
            el('tbody', {}, s.jahre.map((j) =>
              el('tr', { klasse: j.jahr === bindungJahre ? 'bindung' : null }, [
                el('td', { text: String(j.jahr) }),
                el('td', { text: eur.format(j.zins) }),
                el('td', { text: eur.format(j.tilgung) }),
                el('td', { text: j.rest < 1 ? 'abbezahlt' : eur.format(j.rest) }),
              ])
            )),
          ]),
        ]),
      ]),
      knopf('Als PDF teilen', pdfErzeugen, 'knopf-haupt')
    );
  }

  async function pdfErzeugen() {
    if (!letzteRechnung) { melde('Erst eine gültige Rechnung eingeben.'); return; }
    const { betrag, zinsProzent, rate, sondertilgung, bindungJahre, tilgungssatz, s } = letzteRechnung;
    const projekt = (await einstellung('projektname')) || '';

    const blatt = new Blatt({
      titel: 'Tilgungsverlauf',
      untertitel: (projekt ? projekt + ' · ' : '') + 'Stand ' + datumLang(heute()),
      fusszeile: 'Bauzeuge · unverbindliche Modellrechnung',
    });

    blatt.ueberschrift('Annahmen');
    blatt.wertzeile('Darlehenssumme', eur.format(betrag));
    blatt.wertzeile('Sollzins', zahl(zinsProzent, 2) + ' % p. a.');
    blatt.wertzeile('Anfängliche Tilgung', zahl(tilgungssatz, 2) + ' %');
    blatt.wertzeile('Zinsbindung', bindungJahre + ' Jahre');
    if (sondertilgung > 0) blatt.wertzeile('Sondertilgung pro Jahr', eur.format(sondertilgung));

    blatt.ueberschrift('Ergebnis');
    blatt.wertzeile('Monatsrate', eur.format(rate), true);
    blatt.wertzeile(
      'Restschuld nach ' + bindungJahre + ' Jahren',
      s.restNachBindung === null || s.restNachBindung < 1 ? 'abbezahlt' : eur.format(s.restNachBindung)
    );
    blatt.wertzeile('Zinskosten in der Bindung', eur.format(s.zinsInBindung));
    blatt.wertzeile('Zinskosten insgesamt', eur.format(s.zinsGesamt));
    blatt.wertzeile('Gesamtlaufzeit', s.offen ? 'über 60 Jahre' : zahl(s.monate / 12, 1) + ' Jahre');

    blatt.ueberschrift('Verlauf');
    blatt.tabelle(
      ['Jahr', 'Zins', 'Tilgung', 'Restschuld'],
      s.jahre.map((j) => [
        String(j.jahr), eur.format(j.zins), eur.format(j.tilgung),
        j.rest < 1 ? 'abbezahlt' : eur.format(j.rest),
      ]),
      [1, 1.6, 1.6, 1.8],
      [1, 2, 3]
    );

    blatt.absatz(
      'Modellrechnung mit gleichbleibender Rate und gleichbleibendem Zins über die ' +
      'gesamte Laufzeit. Nach Ablauf der Zinsbindung gilt der dann gültige Marktzins, ' +
      'die tatsächliche Restlaufzeit kann dadurch abweichen.',
      9
    );

    try {
      await pdfTeilen(blatt.blob(), 'tilgungsverlauf.pdf', 'Tilgungsverlauf');
    } catch (fehler) {
      melde('PDF konnte nicht geteilt werden.');
      console.error(fehler);
    }
  }

  for (const f of [betragFeld, zinsFeld, modusFeld, tilgungFeld, rateFeld, bindungFeld, sonderFeld]) {
    f.addEventListener('input', rechne);
    f.addEventListener('change', rechne);
  }

  rahmen.append(
    kopfzeile('Tilgungsverlauf', 'Restschuld, Raten und Gesamtlaufzeit deines Annuitätendarlehens.'),
    karte([
      knopf('Aus Baufinanzierung laden', async () => {
        const stand = await finanzierungsstand();
        if (!stand.darlehen.length) {
          melde('Noch kein Darlehen erfasst.');
          location.hash = '#/finanzierung';
          return;
        }
        // Mehrere Darlehen werden zu einem zusammengefasst; der Zins wird
        // nach Darlehenshoehe gewichtet, sonst waere er beliebig.
        const summe = stand.darlehen.reduce((s, d) => s + d.betrag, 0);
        const zinsMittel = stand.darlehen.reduce((s, d) => s + d.zinsProzent * d.betrag, 0) / summe;
        const tilgMittel = stand.darlehen.reduce((s, d) => s + d.tilgungProzent * d.betrag, 0) / summe;
        betragFeld.value = String(Math.round(summe));
        zinsFeld.value = zahl(zinsMittel, 2);
        tilgungFeld.value = zahl(tilgMittel, 2);
        modusFeld.value = 'tilgung';
        bindungFeld.value = String(stand.darlehen[0].bindungJahre ?? 10);
        zinsSelbst = true;
        await rechne();
        melde(stand.darlehen.length > 1 ? 'Darlehen zusammengefasst geladen.' : 'Geladen.');
      }),
    ]),
    karte([
      feld('Darlehenssumme in €', betragFeld),
      feld('Sollzins in % p. a.', zinsFeld),
      feld('Rate festlegen', modusFeld),
      tilgungsfeld,
      ratenfeld,
      feld('Zinsbindung', bindungFeld),
      feld('Sondertilgung pro Jahr in €', sonderFeld, 'Wird am Jahresende angesetzt. 0, wenn keine vereinbart ist.'),
    ]),
    ergebnis
  );

  await rechne();
}

// Gestapelte Saeulen: unten Tilgung, oben Zins. Zeigt auf einen Blick, wie
// sich das Verhaeltnis im Lauf der Jahre dreht.
function diagramm(jahre) {
  if (!jahre.length) return el('div');
  const groesste = Math.max(...jahre.map((j) => j.zins + j.tilgung));
  if (groesste <= 0) return el('div');

  return karte([
    el('h2', { text: 'Zins und Tilgung im Verlauf' }),
    el(
      'div',
      { klasse: 'balkenblock', role: 'img', 'aria-label': 'Zinsanteil sinkt, Tilgungsanteil steigt' },
      jahre.map((j) =>
        el('div', { klasse: 'saeule', title: `Jahr ${j.jahr}` }, [
          el('div', {
            klasse: 'anteil-zins',
            stil: { height: Math.round((j.zins / groesste) * 100) + '%' },
          }),
          el('div', {
            klasse: 'anteil-tilg',
            stil: { height: Math.round((j.tilgung / groesste) * 100) + '%' },
          }),
        ])
      )
    ),
    el('div', { klasse: 'legende' }, [
      el('span', {}, [el('i', { stil: { background: 'var(--akzent)' } }), 'Zins']),
      el('span', {}, [el('i', { stil: { background: 'var(--akzent-dunkel)' } }), 'Tilgung']),
      el('span', { text: `Jahr 1 bis ${jahre[jahre.length - 1].jahr}` }),
    ]),
  ]);
}
