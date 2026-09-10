// Drei Rechner, die vor dem Kauf gebraucht werden. Jeder steht einzeln in der
// Seitenleiste und kommt als Unterweg hier an: "#/rechner/flaechen".
//
//   Kaufnebenkosten   Was zum Kaufpreis dazukommt, bevor das Haus steht
//   Bebauung          Was auf das Grundstueck ueberhaupt darf, GRZ und GFZ
//   Kreditvergleich   Zwei bis vier Angebote nebeneinander
//
// Alle drei rechnen nur und speichern nichts ausser der letzten Eingabe. Sie
// beantworten Fragen, die man einmal stellt und dann entschieden hat.

import {
  el, eur, zahl, feld, zahlfeld, auswahl, knopf, karte, kopfzeile, wertzeile,
  hinweisKasten, zuZahl,
  anhaengen,
} from '../hilfen.js';
import { einstellung } from '../daten.js';
import { LAENDER } from './baukosten.js';
import { annuitaet } from './finanzierung.js';

// Uebliche Saetze, Stand 2026. Sie stehen offen hier, damit man sie
// nachschlagen und ueberschreiben kann; jeder Notar rechnet etwas anders.
const NOTAR_PROZENT = 1.5;      // Notar und Grundbuch zusammen
const MAKLER_PROZENT = 3.57;    // haelftig geteilt, inklusive Umsatzsteuer

/**
 * Kaufnebenkosten eines Grundstuecks- oder Hauskaufs.
 *
 * Die Grunderwerbsteuer haengt am Bundesland und ist der groesste Posten.
 * Notar und Grundbuch sind der Hoehe nach gesetzlich geregelt, hier als
 * ueblicher Satz. Die Maklercourtage wird seit Dezember 2020 beim Kauf durch
 * Verbraucher geteilt; angesetzt ist die Haelfte, die der Kaeufer traegt.
 *
 * @returns {{posten: Array, summe: number, anteil: number, gesamt: number}}
 */
export function kaufnebenkosten({ preis, grestProzent, notarProzent, maklerProzent, weitere }) {
  const p = Math.max(0, preis || 0);
  const posten = [
    ['Grunderwerbsteuer', (p * (grestProzent || 0)) / 100, zahl(grestProzent, 1) + ' %'],
    ['Notar und Grundbuch', (p * (notarProzent || 0)) / 100, zahl(notarProzent, 2) + ' %'],
    ['Maklercourtage', (p * (maklerProzent || 0)) / 100, zahl(maklerProzent, 2) + ' %'],
  ];
  if (weitere > 0) posten.push(['Gutachter, Vermessung, Sonstiges', weitere, '']);

  const summe = posten.reduce((s, [, betrag]) => s + betrag, 0);
  return {
    posten,
    summe,
    anteil: p > 0 ? (summe / p) * 100 : 0,
    gesamt: p + summe,
  };
}

/**
 * Was auf ein Grundstueck gebaut werden darf.
 *
 * GRZ ist der Anteil der Flaeche, den das Gebaeude ueberdecken darf; GFZ der
 * Anteil, den alle Vollgeschosse zusammen an Flaeche haben duerfen. Beide
 * stehen im Bebauungsplan.
 *
 * Die Ueberschreitung ist der Punkt, an dem in der Praxis gerechnet wird:
 * Nach Paragraph 19 Absatz 4 BauNVO duerfen Garagen, Stellplaetze und
 * Zufahrten die GRZ um bis zur Haelfte ueberschreiten, hoechstens aber bis
 * 0,8. Wer das nicht mitrechnet, plant die Einfahrt weg.
 */
export function bebauung({ flaeche, grz, gfz }) {
  const f = Math.max(0, flaeche || 0);
  const grzWert = Math.max(0, grz || 0);
  const grzMitZuschlag = Math.min(0.8, grzWert * 1.5);
  return {
    grundflaeche: f * grzWert,
    grundflaecheMitNebenanlagen: f * grzMitZuschlag,
    grzMitZuschlag,
    geschossflaeche: f * Math.max(0, gfz || 0),
    // Wie viele Vollgeschosse die GFZ hergibt, wenn jedes die volle
    // Grundflaeche ausnutzt. Krumme Zahlen sind normal: 1,7 heisst
    // Erdgeschoss plus ausgebautes Dach.
    geschosse: grzWert > 0 ? Math.max(0, gfz || 0) / grzWert : 0,
  };
}

export async function zeige(rahmen, unterweg) {
  if (unterweg === 'flaechen') return zeigeBebauung(rahmen);
  if (unterweg === 'kredite') return zeigeKredite(rahmen);
  return zeigeNebenkosten(rahmen);
}

// ------------------------------------------------------------ Kaufnebenkosten

async function zeigeNebenkosten(rahmen) {
  const gemerkt = (await einstellung('nebenkosten_eingabe')) || {};
  const start = {
    preis: gemerkt.preis ?? 350000,
    land: gemerkt.land ?? 'rheinland-pfalz',
    notar: gemerkt.notar ?? NOTAR_PROZENT,
    makler: gemerkt.makler ?? MAKLER_PROZENT,
    weitere: gemerkt.weitere ?? 0,
  };

  const preis = zahlfeld({ value: String(start.preis) });
  const land = auswahl(LAENDER.map((l) => [l.slug, l.name]), start.land);
  const notar = zahlfeld({ value: String(start.notar).replace('.', ',') });
  const makler = zahlfeld({ value: String(start.makler).replace('.', ',') });
  const weitere = zahlfeld({ value: String(start.weitere) });

  const ausgabe = el('div');

  async function rechnen() {
    const gewaehlt = LAENDER.find((l) => l.slug === land.value) || LAENDER[10];
    const eingaben = {
      preis: Math.max(0, zuZahl(preis.value)),
      land: land.value,
      notar: Math.max(0, zuZahl(notar.value)),
      makler: Math.max(0, zuZahl(makler.value)),
      weitere: Math.max(0, zuZahl(weitere.value)),
    };
    const r = kaufnebenkosten({
      preis: eingaben.preis,
      grestProzent: gewaehlt.grest,
      notarProzent: eingaben.notar,
      maklerProzent: eingaben.makler,
      weitere: eingaben.weitere,
    });

    ausgabe.replaceChildren(
      karte([
        el('h2', { text: 'Nebenkosten' }),
        ...r.posten.map(([name, betrag, satz]) =>
          wertzeile(satz ? `${name} (${satz})` : name, eur.format(betrag))
        ),
        el('div', { klasse: 'wertzeile stark' }, [
          el('span', { text: 'Nebenkosten zusammen' }),
          el('strong', { text: eur.format(r.summe) }),
        ]),
        el('p', {
          klasse: 'unterzeile',
          text: `Das sind ${zahl(r.anteil, 1)} Prozent des Kaufpreises.`,
        }),
        el('div', { klasse: 'wertzeile stark' }, [
          el('span', { text: 'Kaufpreis und Nebenkosten' }),
          el('strong', { text: eur.format(r.gesamt) }),
        ]),
      ]),
      hinweisKasten(
        'Nebenkosten finanziert die Bank in der Regel nicht mit. Sie müssen aus ' +
          'dem Eigenkapital kommen, zusätzlich zu dem, was die Bank an Eigenanteil ' +
          'am Kaufpreis erwartet.',
        'warn'
      ),
      knopf('In die Baufinanzierung übernehmen', () => { location.hash = '#/finanzierung'; }, 'knopf-leise')
    );

    await einstellung('nebenkosten_eingabe', eingaben);
  }

  for (const f of [preis, land, notar, makler, weitere]) {
    f.addEventListener('input', rechnen);
    f.addEventListener('change', rechnen);
  }

  anhaengen(
    rahmen,
    kopfzeile('Kaufnebenkosten', 'Was zum Kaufpreis dazukommt, bevor irgendetwas gebaut ist.'),
    karte([
      feld('Kaufpreis in €', preis, 'Grundstück oder Bestandshaus, so wie er im Vertrag steht.'),
      feld('Bundesland', land, 'Bestimmt den Satz der Grunderwerbsteuer.'),
      feld('Notar und Grundbuch in %', notar, 'Der Höhe nach gesetzlich geregelt, üblich rund 1,5 Prozent.'),
      feld('Maklercourtage in %', makler,
        'Seit Dezember 2020 beim Kauf durch Verbraucher geteilt. Ohne Makler: 0.'),
      feld('Weitere Kosten in €', weitere, 'Gutachter, Vermessung, Bodengutachten.'),
    ]),
    ausgabe
  );

  await rechnen();
}

// ------------------------------------------------------------------ Bebauung

async function zeigeBebauung(rahmen) {
  const gemerkt = (await einstellung('bebauung_eingabe')) || {};
  const flaeche = zahlfeld({ value: String(gemerkt.flaeche ?? 600) });
  const grz = zahlfeld({ value: String(gemerkt.grz ?? 0.4).replace('.', ',') });
  const gfz = zahlfeld({ value: String(gemerkt.gfz ?? 0.8).replace('.', ',') });

  const ausgabe = el('div');

  async function rechnen() {
    const eingaben = {
      flaeche: Math.max(0, zuZahl(flaeche.value)),
      grz: Math.max(0, zuZahl(grz.value)),
      gfz: Math.max(0, zuZahl(gfz.value)),
    };
    const r = bebauung(eingaben);

    ausgabe.replaceChildren(
      karte([
        el('h2', { text: 'Was gebaut werden darf' }),
        el('div', { klasse: 'wertzeile stark' }, [
          el('span', { text: 'Überbaubare Grundfläche' }),
          el('strong', { text: zahl(r.grundflaeche, 0) + ' m²' }),
        ]),
        el('p', {
          klasse: 'unterzeile',
          text: 'Die Fläche, die das Haus auf dem Grundstück einnehmen darf, ' +
            'gemessen an der Außenkante.',
        }),
        wertzeile(
          `Mit Garage und Zufahrt (GRZ ${zahl(r.grzMitZuschlag, 2)})`,
          zahl(r.grundflaecheMitNebenanlagen, 0) + ' m²'
        ),
        el('div', { klasse: 'wertzeile stark' }, [
          el('span', { text: 'Zulässige Geschossfläche' }),
          el('strong', { text: zahl(r.geschossflaeche, 0) + ' m²' }),
        ]),
        el('p', {
          klasse: 'unterzeile',
          text: `Alle Vollgeschosse zusammen. Bei voller Ausnutzung der Grundfläche ` +
            `entspricht das ${zahl(r.geschosse, 1)} Vollgeschossen.`,
        }),
      ]),
      hinweisKasten(
        'GRZ und GFZ stehen im Bebauungsplan der Gemeinde. Nach § 19 Abs. 4 BauNVO ' +
          'dürfen Garagen, Stellplätze und Zufahrten die GRZ um bis zur Hälfte ' +
          'überschreiten, höchstens bis 0,8. Ob das im Plan anders geregelt ist, ' +
          'steht dort ausdrücklich.',
        'info'
      ),
      hinweisKasten(
        'Geschossfläche ist nicht Wohnfläche. Wände, Treppen und je nach Land auch ' +
          'das Dachgeschoss zählen anders. Als Faustzahl bleiben rund 80 Prozent ' +
          'der Geschossfläche als Wohnfläche übrig.',
        'info'
      )
    );

    await einstellung('bebauung_eingabe', eingaben);
  }

  for (const f of [flaeche, grz, gfz]) {
    f.addEventListener('input', rechnen);
    f.addEventListener('change', rechnen);
  }

  anhaengen(
    rahmen,
    kopfzeile('Bebauung: GRZ und GFZ', 'Was auf das Grundstück überhaupt darf.'),
    karte([
      feld('Grundstücksfläche in m²', flaeche),
      feld('Grundflächenzahl GRZ', grz, 'Anteil der Fläche, den das Gebäude überdecken darf. Üblich 0,3 bis 0,4.'),
      feld('Geschossflächenzahl GFZ', gfz, 'Anteil, den alle Vollgeschosse zusammen haben dürfen. Üblich 0,6 bis 1,0.'),
    ]),
    ausgabe
  );

  await rechnen();
}

// ------------------------------------------------------------ Kreditvergleich

async function zeigeKredite(rahmen) {
  const gemerkt = (await einstellung('kreditvergleich')) || {};
  const betrag = zahlfeld({ value: String(gemerkt.betrag ?? 400000) });
  const bindung = zahlfeld({ value: String(gemerkt.bindung ?? 10) });

  // Drei Angebote reichen: Mehr holt am Bau ohnehin fast niemand ein, und
  // nebeneinander passen mehr auch nicht auf ein Telefon.
  const start = gemerkt.angebote || [
    { name: 'Hausbank', zins: 3.8, tilgung: 2.0 },
    { name: 'Vermittler', zins: 3.55, tilgung: 2.0 },
    { name: 'Direktbank', zins: 3.45, tilgung: 2.5 },
  ];
  const felder = start.map((a) => ({
    name: el('input', { type: 'text', value: a.name, placeholder: 'Anbieter' }),
    zins: zahlfeld({ value: String(a.zins).replace('.', ',') }),
    tilgung: zahlfeld({ value: String(a.tilgung).replace('.', ',') }),
  }));

  const ausgabe = el('div');

  async function rechnen() {
    const eingaben = {
      betrag: Math.max(0, zuZahl(betrag.value)),
      bindung: Math.max(1, Math.round(zuZahl(bindung.value)) || 10),
      angebote: felder.map((f) => ({
        name: f.name.value.trim() || 'Ohne Namen',
        zins: Math.max(0, zuZahl(f.zins.value)),
        tilgung: Math.max(0, zuZahl(f.tilgung.value)),
      })),
    };

    const gerechnet = eingaben.angebote.map((a) => ({
      ...a,
      ...annuitaet({
        betrag: eingaben.betrag,
        zinsProzent: a.zins,
        tilgungProzent: a.tilgung,
        bindungJahre: eingaben.bindung,
      }),
    }));

    // Verglichen wird ueber die Zinskosten der Bindung, nicht ueber die Rate:
    // Eine niedrige Rate heisst meist nur wenig Tilgung, und die Restschuld
    // steht danach immer noch da.
    const gueltig = gerechnet.filter((a) => a.rate > 0);
    const beste = gueltig.slice().sort((a, b) => a.zinsInBindung - b.zinsInBindung)[0];

    ausgabe.replaceChildren(
      karte([
        el('div', { klasse: 'tabelle-rolle' }, [
          el('table', {}, [
            el('thead', {}, [
              el('tr', {}, [
                el('th', { text: 'Anbieter' }),
                el('th', { text: 'Rate' }),
                el('th', { text: 'Zins in der Bindung' }),
                el('th', { text: 'Restschuld' }),
                el('th', { text: 'Laufzeit' }),
              ]),
            ]),
            el('tbody', {}, gerechnet.map((a) =>
              el('tr', { klasse: beste && a.name === beste.name ? 'bindung' : null }, [
                el('td', { text: a.name }),
                el('td', { text: a.rate ? eur.format(a.rate) : '–' }),
                el('td', { text: a.rate ? eur.format(a.zinsInBindung) : '–' }),
                el('td', { text: a.rate ? eur.format(a.restNachBindung) : '–' }),
                el('td', { text: a.rate ? zahl(a.laufzeitJahre, 1) + ' Jahre' : '–' }),
              ])
            )),
          ]),
        ]),
      ]),
      beste
        ? hinweisKasten(
            `Am wenigsten Zinsen zahlt „${beste.name}“: ${eur.format(beste.zinsInBindung)} ` +
              `in ${eingaben.bindung} Jahren. Verglichen wird über die Zinskosten der ` +
              'Bindung, nicht über die Rate. Eine niedrige Rate heißt meist nur wenig ' +
              'Tilgung, und die Restschuld steht danach immer noch da.',
            'gut'
          )
        : hinweisKasten('Trage bei mindestens einem Angebot Zins und Tilgung ein.', 'info'),
      knopf('Einzelnen Verlauf ansehen', () => { location.hash = '#/tilgung'; }, 'knopf-leise')
    );

    await einstellung('kreditvergleich', eingaben);
  }

  for (const f of [betrag, bindung, ...felder.flatMap((x) => [x.name, x.zins, x.tilgung])]) {
    f.addEventListener('input', rechnen);
    f.addEventListener('change', rechnen);
  }

  anhaengen(
    rahmen,
    kopfzeile('Kreditvergleich', 'Dieselbe Summe, verschiedene Angebote.'),
    karte([
      feld('Darlehensbetrag in €', betrag),
      feld('Zinsbindung in Jahren', bindung, 'Üblich sind 10, 15 oder 20 Jahre.'),
    ]),
    karte([
      el('h2', { text: 'Angebote' }),
      ...felder.map((f) =>
        el('div', { klasse: 'filterleiste' }, [
          f.name,
          el('label', { klasse: 'satzfeld' }, [el('span', { text: 'Zins %' }), f.zins]),
          el('label', { klasse: 'satzfeld' }, [el('span', { text: 'Tilgung %' }), f.tilgung]),
        ])
      ),
    ]),
    ausgabe
  );

  await rechnen();
}
