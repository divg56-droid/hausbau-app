// Baufinanzierung: Eigenkapital und Darlehen erfassen.
//
// Hieraus entstehen Monatsrate und Fremdkapital. Tilgungsverlauf und Baukasse
// holen sich ihre Zahlen von hier, damit sie nicht auseinanderlaufen.

import {
  el, eur, zahl, feld, eingabe, zahlfeld, auswahl, knopf, karte, kopfzeile,
  wertzeile, hinweisKasten, leerzustand, zuZahl, melde,
} from '../hilfen.js';
import { daten, einstellung } from '../daten.js';
import { blattOeffnen } from '../blatt.js';

// Marktnahe Startwerte je Zinsbindung, wie auf hausbauatlas.de. Beim
// monatlichen Zins-Update dort mitziehen.
export const ZINS_JE_BINDUNG = { 5: 3.7, 10: 3.8, 15: 4.1, 20: 4.3 };

/** Annuitaet und Restschuld am Ende der Zinsbindung. */
export function annuitaet({ betrag, zinsProzent, tilgungProzent, bindungJahre }) {
  const zins = zinsProzent / 100;
  const tilgung = tilgungProzent / 100;
  if (betrag <= 0 || zins <= 0 || tilgung <= 0) {
    return { rate: 0, restNachBindung: betrag, laufzeitJahre: 0, zinsInBindung: 0 };
  }
  const r = zins / 12;
  const rate = (betrag * (zins + tilgung)) / 12;
  const n = bindungJahre * 12;
  const q = Math.pow(1 + r, n);
  const restNachBindung = Math.max(0, betrag * q - (rate * (q - 1)) / r);
  const gezahlt = rate * n;
  const getilgt = betrag - restNachBindung;
  const laufzeitMonate = Math.log(rate / (rate - betrag * r)) / Math.log(1 + r);
  return {
    rate,
    restNachBindung,
    laufzeitJahre: laufzeitMonate / 12,
    zinsInBindung: Math.max(0, gezahlt - getilgt),
  };
}

/** Summen ueber alle erfassten Posten. Auch von Tilgung und Baukasse genutzt. */
export async function finanzierungsstand() {
  const posten = await daten.alle('darlehen');
  const eigenkapital = posten.filter((p) => p.art === 'eigenkapital');
  const darlehen = posten.filter((p) => p.art === 'darlehen');

  const ekSumme = eigenkapital.reduce((s, p) => s + p.betrag, 0);
  const fkSumme = darlehen.reduce((s, p) => s + p.betrag, 0);
  const rate = darlehen.reduce((s, p) => s + annuitaet(p).rate, 0);

  return { posten, eigenkapital, darlehen, ekSumme, fkSumme, rate, gesamt: ekSumme + fkSumme };
}

// ------------------------------------------------------------------ Eingabe

function darlehensfelder(vorlage) {
  const name = eingabe({ value: vorlage.name || '', placeholder: 'z. B. Bankdarlehen' });
  const betrag = zahlfeld({ value: vorlage.betrag ? String(vorlage.betrag) : '' });
  const zins = zahlfeld({ value: String(vorlage.zinsProzent ?? 3.8) });
  const tilgung = zahlfeld({ value: String(vorlage.tilgungProzent ?? 2.0) });
  const bindung = auswahl(
    [[5, '5 Jahre'], [10, '10 Jahre'], [15, '15 Jahre'], [20, '20 Jahre']],
    vorlage.bindungJahre ?? 10
  );

  // Wechselt die Bindung, wandert der Zins um dieselbe Differenz mit, solange
  // der Nutzer ihn nicht selbst angefasst hat.
  let selbstGesetzt = vorlage.zinsProzent !== undefined;
  zins.addEventListener('input', () => { selbstGesetzt = true; });
  bindung.addEventListener('change', () => {
    if (selbstGesetzt) return;
    zins.value = String(ZINS_JE_BINDUNG[+bindung.value] ?? 3.8);
  });

  return {
    knoten: [
      feld('Bezeichnung', name),
      feld('Darlehenssumme in €', betrag),
      feld('Sollzins in % p. a.', zins),
      feld('Anfängliche Tilgung in %', tilgung, 'Üblich sind 2 bis 3 Prozent.'),
      feld('Zinsbindung', bindung),
    ],
    lesen: () => {
      const wert = {
        art: 'darlehen',
        name: name.value.trim() || 'Darlehen',
        betrag: Math.max(0, zuZahl(betrag.value)),
        zinsProzent: zuZahl(zins.value),
        tilgungProzent: zuZahl(tilgung.value),
        bindungJahre: +bindung.value,
      };
      if (wert.betrag <= 0) throw new Error('Bitte eine Darlehenssumme eintragen.');
      if (wert.zinsProzent <= 0) throw new Error('Bitte einen Sollzins eintragen.');
      if (wert.tilgungProzent <= 0) throw new Error('Bitte eine Tilgung eintragen.');
      return wert;
    },
  };
}

function eigenkapitalfelder(vorlage) {
  const name = eingabe({ value: vorlage.name || '', placeholder: 'z. B. Erspartes' });
  const betrag = zahlfeld({ value: vorlage.betrag ? String(vorlage.betrag) : '' });
  return {
    knoten: [feld('Bezeichnung', name), feld('Betrag in €', betrag)],
    lesen: () => {
      const wert = {
        art: 'eigenkapital',
        name: name.value.trim() || 'Eigenkapital',
        betrag: Math.max(0, zuZahl(betrag.value)),
      };
      if (wert.betrag <= 0) throw new Error('Bitte einen Betrag eintragen.');
      return wert;
    },
  };
}

function postenBearbeiten(posten, nachher) {
  const istDarlehen = posten.art === 'darlehen';
  const bau = istDarlehen ? darlehensfelder(posten) : eigenkapitalfelder(posten);

  blattOeffnen(
    posten.id ? 'Bearbeiten' : istDarlehen ? 'Darlehen anlegen' : 'Eigenkapital anlegen',
    bau.knoten,
    async () => {
      const wert = bau.lesen();
      if (posten.id) wert.id = posten.id;
      await daten.sichern('darlehen', wert);
      await nachher();
    },
    {
      loeschen: posten.id
        ? async () => {
            await daten.loeschen('darlehen', posten.id);
            await nachher();
          }
        : null,
    }
  );
}

// ---------------------------------------------------------------- Bildschirm

export async function zeige(rahmen) {
  await zeichne(rahmen);
}

async function zeichne(rahmen) {
  rahmen.replaceChildren();
  const stand = await finanzierungsstand();
  const geschaetzteKosten = (await einstellung('finanzierung_kosten')) || 0;
  const neu = () => zeichne(rahmen);

  rahmen.append(kopfzeile('Baufinanzierung', 'Eigenkapital und Darlehen an einer Stelle.'));

  if (!stand.posten.length) {
    rahmen.append(
      karte([
        leerzustand(
          'Starte mit deiner Finanzierungsbasis',
          'Lege zuerst dein Eigenkapital oder dein Hauptdarlehen an. Daraus entstehen ' +
            'Monatsrate, Fremdkapital und die Grundlage für Tilgungsverlauf und Baukasse.'
        ),
        el('div', { klasse: 'knopf-reihe' }, [
          knopf('Eigenkapital', () => postenBearbeiten({ art: 'eigenkapital' }, neu)),
          knopf('Darlehen', () => postenBearbeiten({ art: 'darlehen' }, neu), 'knopf-haupt'),
        ]),
      ]),
      hinweisKasten(
        'Noch keine konkreten Kreditdaten? Nutze zuerst den Vorschlag unten und ergänze ' +
          'die tatsächlichen Darlehen später.',
        'info'
      ),
      vorschlagsblock(geschaetzteKosten, neu)
    );
    return;
  }

  // Übersicht
  rahmen.append(
    karte([
      el('h2', { text: 'Finanzierungsbasis' }),
      wertzeile('Eigenkapital', eur.format(stand.ekSumme)),
      wertzeile('Fremdkapital', eur.format(stand.fkSumme)),
      wertzeile('Gesamtvolumen', eur.format(stand.gesamt)),
      wertzeile('Monatsrate', stand.rate > 0 ? eur.format(stand.rate) + ' / Monat' : '–', true),
    ])
  );

  if (geschaetzteKosten > 0) {
    const luecke = geschaetzteKosten - stand.gesamt;
    rahmen.append(
      hinweisKasten(
        luecke > 1000
          ? `Deine Baukosten liegen bei ${eur.format(geschaetzteKosten)}. Es fehlen noch ${eur.format(luecke)}.`
          : `Deine Baukosten von ${eur.format(geschaetzteKosten)} sind gedeckt.`,
        luecke > 1000 ? 'warn' : 'gut'
      )
    );
  }

  if (stand.ekSumme > 0 && stand.gesamt > 0 && stand.ekSumme / stand.gesamt < 0.15) {
    rahmen.append(
      hinweisKasten(
        'Dein Eigenkapital liegt unter 15 Prozent des Volumens. Rechne mit einem Zinsaufschlag der Bank.',
        'warn'
      )
    );
  }

  // Posten
  for (const [art, ueberschrift] of [['eigenkapital', 'Eigenkapital'], ['darlehen', 'Darlehen']]) {
    const liste = stand.posten.filter((p) => p.art === art);
    rahmen.append(
      karte([
        el('h2', { text: ueberschrift }),
        liste.length
          ? el(
              'ul',
              { klasse: 'liste' },
              liste.map((p) => {
                const a = art === 'darlehen' ? annuitaet(p) : null;
                return el('li', {}, [
                  el('button', { klasse: 'listenzeile', onclick: () => postenBearbeiten(p, neu) }, [
                    el('span', { klasse: 'zeilen-text' }, [
                      el('span', { klasse: 'zeilen-titel', text: p.name }),
                      el('span', {
                        klasse: 'zeilen-unter',
                        text: a
                          ? `${zahl(p.zinsProzent, 2)} % Zins · ${zahl(p.tilgungProzent, 2)} % Tilgung · ${p.bindungJahre} Jahre · ${eur.format(a.rate)}/Monat`
                          : 'Eigenkapital',
                      }),
                    ]),
                    el('span', { klasse: 'zeilen-wert', text: eur.format(p.betrag) }),
                  ]),
                ]);
              })
            )
          : el('p', { klasse: 'unterzeile', text: 'Noch nichts erfasst.' }),
        knopf(
          art === 'darlehen' ? 'Darlehen hinzufügen' : 'Eigenkapital hinzufügen',
          () => postenBearbeiten({ art }, neu),
          'knopf-leise'
        ),
      ])
    );
  }

  rahmen.append(
    el('div', { klasse: 'knopf-reihe' }, [
      knopf('Tilgungsverlauf', () => { location.hash = '#/tilgung'; }),
      knopf('Zur Baukasse', () => { location.hash = '#/baukasse'; }),
    ]),
    vorschlagsblock(geschaetzteKosten, neu)
  );
}

// Rechner fuer alle, die noch keinen Kredit haben: aus Gesamtkosten und
// Eigenkapital wird ein Darlehensvorschlag, den man direkt uebernimmt.
function vorschlagsblock(vorbelegteKosten, nachher) {
  const kostenFeld = zahlfeld({ value: String(vorbelegteKosten || 500000) });
  const ekFeld = zahlfeld({ value: '100000' });
  const zinsFeld = zahlfeld({ value: '3.8' });
  const tilgungFeld = zahlfeld({ value: '2.0' });
  const bindungFeld = auswahl([[5, '5 Jahre'], [10, '10 Jahre'], [15, '15 Jahre'], [20, '20 Jahre']], 10);
  const ausgabe = el('div');

  let zinsSelbst = false;
  zinsFeld.addEventListener('input', () => { zinsSelbst = true; });
  bindungFeld.addEventListener('change', () => {
    if (!zinsSelbst) zinsFeld.value = String(ZINS_JE_BINDUNG[+bindungFeld.value] ?? 3.8);
  });

  function rechne() {
    const kosten = Math.max(0, zuZahl(kostenFeld.value));
    const ek = Math.max(0, zuZahl(ekFeld.value));
    const betrag = Math.max(0, kosten - ek);
    const a = annuitaet({
      betrag,
      zinsProzent: zuZahl(zinsFeld.value),
      tilgungProzent: zuZahl(tilgungFeld.value),
      bindungJahre: +bindungFeld.value,
    });

    ausgabe.replaceChildren(
      wertzeile('Benötigtes Darlehen', eur.format(betrag)),
      wertzeile('Monatsrate', a.rate > 0 ? eur.format(a.rate) : '–', true),
      wertzeile(
        `Restschuld nach ${bindungFeld.value} Jahren`,
        a.restNachBindung < 1 ? 'abbezahlt' : eur.format(a.restNachBindung)
      ),
      wertzeile('Zinskosten in der Bindung', eur.format(a.zinsInBindung)),
      wertzeile('Gesamtlaufzeit', a.laufzeitJahre > 0 && Number.isFinite(a.laufzeitJahre)
        ? zahl(a.laufzeitJahre, 1) + ' Jahre'
        : 'wird nie getilgt'),
      knopf('Als Darlehen und Eigenkapital übernehmen', async () => {
        if (betrag <= 0) { melde('Kein Darlehensbedarf.'); return; }
        if (ek > 0) {
          await daten.sichern('darlehen', { art: 'eigenkapital', name: 'Eigenkapital', betrag: ek });
        }
        await daten.sichern('darlehen', {
          art: 'darlehen', name: 'Bankdarlehen', betrag,
          zinsProzent: zuZahl(zinsFeld.value),
          tilgungProzent: zuZahl(tilgungFeld.value),
          bindungJahre: +bindungFeld.value,
        });
        await einstellung('finanzierung_kosten', kosten);
        melde('Übernommen.');
        await nachher();
      }, 'knopf-haupt')
    );
  }

  for (const f of [kostenFeld, ekFeld, zinsFeld, tilgungFeld, bindungFeld]) {
    f.addEventListener('input', rechne);
    f.addEventListener('change', rechne);
  }
  rechne();

  return karte([
    el('h2', { text: 'Noch kein Kredit? Erst rechnen' }),
    feld('Gesamtkosten in €', kostenFeld, 'Aus dem Baukostenrechner übernehmbar.'),
    feld('Eigenkapital in €', ekFeld),
    feld('Sollzins in % p. a.', zinsFeld),
    feld('Anfängliche Tilgung in %', tilgungFeld),
    feld('Zinsbindung', bindungFeld),
    ausgabe,
  ]);
}
