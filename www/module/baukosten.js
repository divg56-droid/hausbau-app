// Baukostenrechner.
//
// Dieselbe Formel wie auf BauZeuge.de/hausbau/baukostenrechner/ und in
// public/hausbau-assistent-anfordern.php. Aendert sich dort etwas, muss es
// hier mitgezogen werden - deshalb stehen die Zahlen offen im Kopf der Datei
// und nicht verstreut im Code.

import {
  el, eur, zahl, feld, zahlfeld, auswahl, knopf, karte, kopfzeile, wertzeile,
  hinweisKasten, zuZahl, melde, anhaengen,
} from '../hilfen.js';
import { einstellung } from '../daten.js';

// Baukosten je m2 (schluesselfertig, Stand 08.2026) und Grunderwerbsteuer.
// Quelle: BauZeuge.de/hausbau/kosten-pro-qm/ und /hausbau/grunderwerbsteuer/.
export const LAENDER = [
  { slug: 'baden-wuerttemberg', name: 'Baden-Württemberg', min: 2900, max: 3600, grest: 5.0 },
  { slug: 'bayern', name: 'Bayern', min: 2900, max: 3700, grest: 3.5 },
  { slug: 'berlin', name: 'Berlin', min: 3100, max: 3700, grest: 6.0 },
  { slug: 'brandenburg', name: 'Brandenburg', min: 2400, max: 3000, grest: 6.5 },
  { slug: 'bremen', name: 'Bremen', min: 2500, max: 3100, grest: 5.0 },
  { slug: 'hamburg', name: 'Hamburg', min: 3100, max: 3900, grest: 5.5 },
  { slug: 'hessen', name: 'Hessen', min: 2800, max: 3400, grest: 6.0 },
  { slug: 'mecklenburg-vorpommern', name: 'Mecklenburg-Vorpommern', min: 2400, max: 3000, grest: 6.0 },
  { slug: 'niedersachsen', name: 'Niedersachsen', min: 2300, max: 3000, grest: 5.0 },
  { slug: 'nordrhein-westfalen', name: 'Nordrhein-Westfalen', min: 2600, max: 3200, grest: 6.5 },
  { slug: 'rheinland-pfalz', name: 'Rheinland-Pfalz', min: 2300, max: 3000, grest: 5.0 },
  { slug: 'saarland', name: 'Saarland', min: 2300, max: 3000, grest: 6.5 },
  { slug: 'sachsen', name: 'Sachsen', min: 2400, max: 3000, grest: 5.5 },
  { slug: 'sachsen-anhalt', name: 'Sachsen-Anhalt', min: 2300, max: 3100, grest: 5.0 },
  { slug: 'schleswig-holstein', name: 'Schleswig-Holstein', min: 2300, max: 3300, grest: 6.5 },
  { slug: 'thueringen', name: 'Thüringen', min: 2400, max: 3000, grest: 5.0 },
];

const KELLER_AUFSCHLAG = 95000;

/**
 * Die eigentliche Rechnung. Getrennt vom Bildschirm, damit sie sich
 * nachrechnen laesst (siehe pruefe() am Dateiende).
 */
export function baukosten({ land, flaeche, standard, keller, grundstueck }) {
  const l = LAENDER.find((x) => x.slug === land) || LAENDER[10];

  let satz = standard === 'einfach' ? l.min : standard === 'gehoben' ? l.max : Math.round((l.min + l.max) / 2);

  // Groessenanpassung: Bad, Kueche und Haustechnik kosten fast unabhaengig
  // von der Flaeche. Bei kleinen Haeusern verteilen sich diese Fixkosten auf
  // wenig Quadratmeter, ab 145 m2 sinkt der Satz.
  if (flaeche <= 90) satz = Math.max(satz, 2900);
  else if (flaeche <= 100) satz = Math.max(satz, 2850);
  else if (flaeche >= 155) satz -= 150;
  else if (flaeche >= 145) satz -= 100;

  const kellerKosten = keller ? KELLER_AUFSCHLAG : 0;
  const haus = flaeche * satz;

  // Grunderwerbsteuer, Notar und Makler nur auf das Grundstueck; Baugenehmigung
  // und Hausanschluesse mit rund 6 Prozent auf Haus und Keller.
  const nebenkosten = Math.round(grundstueck * (l.grest / 100 + 0.055) + (haus + kellerKosten) * 0.06);

  // Aussenanlagen, Kueche und Umzug, mindestens 25.000 Euro.
  const rest = Math.max(25000, flaeche * 250);

  return {
    land: l, satz, haus, kellerKosten, grundstueck, nebenkosten, rest,
    gesamt: grundstueck + haus + kellerKosten + nebenkosten + rest,
  };
}

export async function zeige(rahmen) {
  const gemerkt = (await einstellung('baukosten_eingabe')) || {};

  const eingaben = {
    land: gemerkt.land || 'rheinland-pfalz',
    flaeche: gemerkt.flaeche ?? 130,
    standard: gemerkt.standard || 'mittel',
    keller: gemerkt.keller ?? false,
    grundstueck: gemerkt.grundstueck ?? 100000,
  };

  const landFeld = auswahl(LAENDER.map((l) => [l.slug, l.name]), eingaben.land);
  const flaecheFeld = zahlfeld({ value: String(eingaben.flaeche) });
  const standardFeld = auswahl(
    [['einfach', 'Einfach'], ['mittel', 'Mittel'], ['gehoben', 'Gehoben']],
    eingaben.standard
  );
  const kellerFeld = auswahl([['0', 'Bodenplatte'], ['1', 'Keller']], eingaben.keller ? '1' : '0');
  const grundstueckFeld = zahlfeld({ value: String(eingaben.grundstueck) });

  const ergebnis = el('div');

  async function rechne() {
    eingaben.land = landFeld.value;
    eingaben.flaeche = Math.min(500, Math.max(40, Math.round(zuZahl(flaecheFeld.value))));
    eingaben.standard = standardFeld.value;
    eingaben.keller = kellerFeld.value === '1';
    eingaben.grundstueck = Math.max(0, Math.round(zuZahl(grundstueckFeld.value)));

    const r = baukosten(eingaben);

    ergebnis.replaceChildren(
      karte([
        el('h2', { text: 'Realistische Gesamtkosten' }),
        el('p', {
          klasse: 'unterzeile',
          text: `${zahl(eingaben.flaeche)} m² ${standardFeld.options[standardFeld.selectedIndex].text.toLowerCase()}, ${r.land.name}`,
        }),
        el('div', { stil: { marginTop: '12px' } }, [
          wertzeile('Haus schlüsselfertig', eur.format(r.haus)),
          r.kellerKosten ? wertzeile('Keller', eur.format(r.kellerKosten)) : null,
          wertzeile('Grundstück', eur.format(r.grundstueck)),
          wertzeile(`Baunebenkosten (GrESt ${zahl(r.land.grest, 1)} %)`, eur.format(r.nebenkosten)),
          wertzeile('Außenanlagen, Küche, Umzug', eur.format(r.rest)),
          wertzeile('Gesamt', eur.format(r.gesamt), true),
        ]),
        el('p', { klasse: 'unterzeile', stil: { marginTop: '10px' } }, [
          `Gerechneter m²-Satz: ${eur.format(r.satz)}`,
        ]),
      ]),

      hinweisKasten(
        'Das ist die Untergrenze für das Bankgespräch, nicht die Obergrenze der Wahrheit. ' +
          'Plane 5 bis 10 Prozent Puffer für Baugrund, Nachträge und Preissteigerungen während der Bauzeit.',
        'info'
      ),

      knopf('In die Baufinanzierung übernehmen', async () => {
        await einstellung('finanzierung_kosten', r.gesamt);
        melde('Übernommen. Öffne die Baufinanzierung.');
        location.hash = '#/finanzierung';
      }, 'knopf-haupt')
    );

    await einstellung('baukosten_eingabe', eingaben);
  }

  for (const f of [landFeld, flaecheFeld, standardFeld, kellerFeld, grundstueckFeld]) {
    f.addEventListener('change', rechne);
    f.addEventListener('input', rechne);
  }

  anhaengen(
    rahmen,
    kopfzeile('Baukostenrechner', 'Sechs Angaben, daraus die vollständige Bausumme.'),
    karte([
      feld('Bundesland', landFeld),
      feld('Wohnfläche in m²', flaecheFeld, '40 bis 500 m²'),
      feld('Ausstattungsstandard', standardFeld, 'Alle Varianten schlüsselfertig gerechnet.'),
      feld('Unterbau', kellerFeld),
      feld('Grundstückspreis in €', grundstueckFeld, 'Falls schon bekannt, sonst Schätzwert.'),
    ]),
    ergebnis,
    karte([
      el('h2', { text: 'Wie gerechnet wird' }),
      el('p', {
        klasse: 'unterzeile',
        text:
          'Die m²-Spannen je Bundesland stammen aus der Baukosten-Übersicht von BauZeuge.de ' +
          '(schlüsselfertig, Stand 08.2026). Der Standard wählt das untere, mittlere oder obere Ende ' +
          'der Spanne. Unter 100 m² greift eine Untergrenze, ab 145 m² sinkt der Satz. ' +
          'Die ermittelten Werte sind eine auf realen Marktdaten beruhende Prognose, kein Angebot.',
      }),
    ])
  );

  await rechne();
}

// Nachrechnen des Beispiels von der Website: 130 m², Rheinland-Pfalz, mittel,
// Bodenplatte, 100.000 € Grundstück ergibt dort 508.170 €.
export function pruefe() {
  const r = baukosten({
    land: 'rheinland-pfalz', flaeche: 130, standard: 'mittel',
    keller: false, grundstueck: 100000,
  });
  if (r.gesamt !== 508170) throw new Error('Baukosten weichen ab: ' + r.gesamt + ' statt 508170');
  return true;
}
