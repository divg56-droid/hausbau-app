// Baufinanzierung: Eigenkapital und Darlehen erfassen.
//
// Hieraus entstehen Monatsrate und Fremdkapital. Tilgungsverlauf und Baukasse
// holen sich ihre Zahlen von hier, damit sie nicht auseinanderlaufen.

import {
  el, eur, zahl, feld, eingabe, zahlfeld, auswahl, knopf, karte, kopfzeile,
  wertzeile, hinweisKasten, leerzustand, zuZahl, melde, datumLang,
} from '../hilfen.js';
import { daten, einstellung } from '../daten.js';
import { blattOeffnen } from '../blatt.js';

// Marktnahe Startwerte je Zinsbindung, wie auf BauZeuge.de. Beim
// monatlichen Zins-Update dort mitziehen.
export const ZINS_JE_BINDUNG = { 5: 3.7, 10: 3.8, 15: 4.1, 20: 4.3 };

/*
 * Foerderprogramme fuer private Bauherren.
 *
 * Bewusst ohne Zinssaetze und ohne Foerderhoehen: Beides aendert sich
 * mehrmals im Jahr, und eine veraltete Zahl in einer App ist schlimmer als
 * gar keine. Was hier steht, ist der Name, der Traeger und die Art. Die
 * Betraege traegt der Nutzer ein, sobald er seine Zusage hat.
 *
 * "zuschuss" wird nicht zurueckgezahlt und zaehlt wie Eigenkapital.
 * "darlehen" ist ein zinsverbilligter Kredit und wird wie jedes andere
 * Darlehen mit Zins, Tilgung und Bindung gerechnet.
 *
 * Stand der Liste: September 2026.
 */
export const FOERDERPROGRAMME = [
  { nr: '297/298', name: 'Klimafreundlicher Neubau – Wohngebäude', traeger: 'KfW', art: 'darlehen' },
  { nr: '296', name: 'Klimafreundlicher Neubau im Niedrigpreissegment', traeger: 'KfW', art: 'darlehen' },
  { nr: '300', name: 'Wohneigentum für Familien', traeger: 'KfW', art: 'darlehen' },
  { nr: '308', name: 'Jung kauft Alt', traeger: 'KfW', art: 'darlehen' },
  { nr: '261', name: 'Wohngebäude – Kredit, Effizienzhaus-Sanierung', traeger: 'KfW', art: 'darlehen' },
  { nr: '270', name: 'Erneuerbare Energien Standard', traeger: 'KfW', art: 'darlehen' },
  { nr: '358/359', name: 'Ergänzungskredit zur Heizungsförderung', traeger: 'KfW', art: 'darlehen' },
  { nr: '159', name: 'Altersgerecht Umbauen – Kredit', traeger: 'KfW', art: 'darlehen' },
  { nr: '458', name: 'Heizungsförderung für Privatpersonen', traeger: 'KfW', art: 'zuschuss' },
  { nr: '', name: 'Einzelmaßnahmen: Gebäudehülle, Anlagentechnik', traeger: 'BAFA', art: 'zuschuss' },
  { nr: '501/502/503', name: 'Selbst genutzter Wohnraum', traeger: 'ISB Rheinland-Pfalz', art: 'darlehen' },
  { nr: '', name: 'Modernisierung selbst genutzten Wohnraums', traeger: 'ISB Rheinland-Pfalz', art: 'darlehen' },
  { nr: '', name: 'Tilgungszuschuss aus einem Förderdarlehen', traeger: 'KfW', art: 'zuschuss' },
  { nr: '', name: 'Kommunaler Zuschuss', traeger: 'Kommune', art: 'zuschuss' },
];

/** Beschriftung eines Programms fuer Auswahllisten und Namensvorschlag. */
export function programmName(programm) {
  return [programm.traeger, programm.nr, programm.name].filter(Boolean).join(' ');
}

const programmOptionen = (art) => [
  ['', '– kein Programm –'],
  ...FOERDERPROGRAMME.filter((f) => f.art === art).map((f, i) => [String(i), programmName(f)]),
];

const programmNach = (art, wert) =>
  wert === '' ? null : FOERDERPROGRAMME.filter((f) => f.art === art)[Number(wert)] || null;

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
  // Zuschuesse werden nicht zurueckgezahlt. Sie erhoehen das Budget, aber
  // niemals die Monatsrate - das ist der ganze Unterschied zum Foerderdarlehen.
  const zuschuesse = posten.filter((p) => p.art === 'zuschuss');

  const ekSumme = eigenkapital.reduce((s, p) => s + p.betrag, 0);
  const fkSumme = darlehen.reduce((s, p) => s + p.betrag, 0);
  const zuschussSumme = zuschuesse.reduce((s, p) => s + p.betrag, 0);
  const rate = darlehen.reduce((s, p) => s + annuitaet(p).rate, 0);

  return {
    posten, eigenkapital, darlehen, zuschuesse,
    ekSumme, fkSumme, zuschussSumme,
    // Was die Bank als Eigenmittel ansieht: Erspartes und Zuschuesse zusammen.
    eigenmittel: ekSumme + zuschussSumme,
    rate,
    gesamt: ekSumme + fkSumme + zuschussSumme,
  };
}

// ------------------------------------------------------------------ Eingabe

function darlehensfelder(vorlage) {
  const name = eingabe({ value: vorlage.name || '', placeholder: 'z. B. Bankdarlehen' });
  // Ein Foerderdarlehen ist rechnerisch ein Darlehen wie jedes andere, nur
  // guenstiger. Deshalb dasselbe Formular und nur ein Feld mehr.
  const programm = auswahl(programmOptionen('darlehen'), '');
  programm.addEventListener('change', () => {
    const gewaehlt = programmNach('darlehen', programm.value);
    if (gewaehlt && !name.value.trim()) name.value = programmName(gewaehlt);
  });
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
      feld('Förderprogramm', programm,
        'Nur zum Ausfüllen der Bezeichnung. Zins und Tilgung stehen in deiner Zusage.'),
      feld('Bezeichnung', name),
      feld('Darlehenssumme in €', betrag),
      feld('Sollzins in % p. a.', zins),
      feld('Anfängliche Tilgung in %', tilgung, 'Üblich sind 2 bis 3 Prozent.'),
      feld('Zinsbindung', bindung),
    ],
    lesen: () => {
      const gewaehlt = programmNach('darlehen', programm.value);
      const wert = {
        art: 'darlehen',
        name: name.value.trim() || 'Darlehen',
        betrag: Math.max(0, zuZahl(betrag.value)),
        zinsProzent: zuZahl(zins.value),
        tilgungProzent: zuZahl(tilgung.value),
        bindungJahre: +bindung.value,
        traeger: gewaehlt ? gewaehlt.traeger : (vorlage.traeger ?? null),
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

function zuschussfelder(vorlage) {
  const programm = auswahl(programmOptionen('zuschuss'), '');
  const name = eingabe({ value: vorlage.name || '', placeholder: 'z. B. KfW 458 Heizungsförderung' });
  const betrag = zahlfeld({ value: vorlage.betrag ? String(vorlage.betrag) : '' });
  const bewilligt = el('input', { type: 'date', value: vorlage.bewilligt || '' });

  programm.addEventListener('change', () => {
    const gewaehlt = programmNach('zuschuss', programm.value);
    if (gewaehlt && !name.value.trim()) name.value = programmName(gewaehlt);
  });

  return {
    knoten: [
      feld('Förderprogramm', programm),
      feld('Bezeichnung', name),
      feld('Zuschusshöhe in €', betrag,
        'Nur eintragen, was bewilligt ist. Ein beantragter Zuschuss ist kein Budget.'),
      feld('Bewilligt am', bewilligt, 'Leer lassen, solange nur beantragt.'),
      hinweisKasten(
        'Ein Zuschuss wird nicht zurückgezahlt und erhöht deshalb dein Budget, ohne die ' +
          'Monatsrate zu verändern. Einen Tilgungszuschuss aus einem Förderdarlehen ' +
          'trägst du hier ein und das Darlehen daneben in voller Höhe.',
        'info'
      ),
    ],
    lesen: () => {
      const gewaehlt = programmNach('zuschuss', programm.value);
      const wert = {
        art: 'zuschuss',
        name: name.value.trim() || 'Zuschuss',
        betrag: Math.max(0, zuZahl(betrag.value)),
        traeger: gewaehlt ? gewaehlt.traeger : (vorlage.traeger ?? null),
        bewilligt: bewilligt.value || null,
      };
      if (wert.betrag <= 0) throw new Error('Bitte die Zuschusshöhe eintragen.');
      return wert;
    },
  };
}

const ARTNAME = {
  eigenkapital: 'Eigenkapital',
  darlehen: 'Darlehen',
  zuschuss: 'Zuschuss',
};

function postenBearbeiten(posten, nachher) {
  const bau =
    posten.art === 'darlehen' ? darlehensfelder(posten)
    : posten.art === 'zuschuss' ? zuschussfelder(posten)
    : eigenkapitalfelder(posten);

  blattOeffnen(
    posten.id ? 'Bearbeiten' : (ARTNAME[posten.art] || 'Eigenkapital') + ' anlegen',
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
          knopf('Zuschuss', () => postenBearbeiten({ art: 'zuschuss' }, neu)),
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
      stand.zuschussSumme > 0 ? wertzeile('Zuschüsse', eur.format(stand.zuschussSumme)) : null,
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

  if (stand.eigenmittel > 0 && stand.gesamt > 0 && stand.eigenmittel / stand.gesamt < 0.15) {
    rahmen.append(
      hinweisKasten(
        'Deine Eigenmittel aus Eigenkapital und Zuschüssen liegen unter 15 Prozent des ' +
          'Volumens. Rechne mit einem Zinsaufschlag der Bank.',
        'warn'
      )
    );
  }

  // Posten
  for (const [art, ueberschrift] of [
    ['eigenkapital', 'Eigenkapital'],
    ['zuschuss', 'Förderungen und Zuschüsse'],
    ['darlehen', 'Darlehen'],
  ]) {
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
                const unterzeile = a
                  ? `${zahl(p.zinsProzent, 2)} % Zins · ${zahl(p.tilgungProzent, 2)} % Tilgung · ${p.bindungJahre} Jahre · ${eur.format(a.rate)}/Monat`
                  : art === 'zuschuss'
                    ? [p.traeger, p.bewilligt ? 'bewilligt am ' + datumLang(p.bewilligt) : 'noch nicht bewilligt']
                        .filter(Boolean).join(' · ')
                    : 'Eigenkapital';
                return el('li', {}, [
                  el('button', { klasse: 'listenzeile', onclick: () => postenBearbeiten(p, neu) }, [
                    el('span', { klasse: 'zeilen-text' }, [
                      el('span', { klasse: 'zeilen-titel', text: p.name }),
                      el('span', { klasse: 'zeilen-unter', text: unterzeile }),
                    ]),
                    el('span', { klasse: 'zeilen-wert', text: eur.format(p.betrag) }),
                  ]),
                ]);
              })
            )
          : el('p', { klasse: 'unterzeile', text: 'Noch nichts erfasst.' }),
        knopf(
          art === 'darlehen' ? 'Darlehen hinzufügen'
            : art === 'zuschuss' ? 'Zuschuss hinzufügen'
            : 'Eigenkapital hinzufügen',
          () => postenBearbeiten({ art }, neu),
          'knopf-leise'
        ),
        art === 'zuschuss'
          ? el('p', {
              klasse: 'unterzeile',
              text: 'Ein Förderdarlehen gehört nicht hierher, sondern unter Darlehen. ' +
                'Dort lässt sich das Programm auswählen.',
            })
          : null,
      ])
    );
  }

  rahmen.append(
    hinweisKasten(
      'Nicht mehr verfügbar: Das Baukindergeld ist seit Ende 2022 beendet, die alte ' +
        'Neubauförderung für Effizienzhäuser wurde durch den Klimafreundlichen Neubau ' +
        'abgelöst, und der Zuschuss Altersgerecht Umbauen nimmt seit Juli 2026 keine ' +
        'neuen Anträge mehr an. Prüfe vor dem Eintragen die Zusage, nicht die Werbung. ' +
        'Stand dieser Liste: September 2026.',
      'info'
    ),
    el('div', { klasse: 'knopf-reihe' }, [
      knopf('Tilgungsverlauf', () => { location.hash = '#/tilgung'; }),
      knopf('Zur Budgetplanung', () => { location.hash = '#/baukasse'; }),
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
