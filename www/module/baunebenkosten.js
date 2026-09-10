// Baunebenkosten.
//
// Der Posten, an dem private Bauvorhaben am haeufigsten aufschlagen. Das
// Haus hat einen Preis, das Grundstueck hat einen Preis, und dazwischen
// liegen zwanzig Rechnungen, die niemand angeboten bekommt: Notar,
// Grunderwerbsteuer, Vermessung, Statik, Genehmigung, Hausanschluesse,
// Baustrom, Versicherungen. Zusammen sind das 15 bis 20 Prozent der
// Bausumme -- und sie fallen frueh an, bevor die Bank die erste Rate des
// Bauvertrags auszahlt.
//
// Deshalb ist das hier kein Ueberschlag, sondern eine Liste: jede Zeile
// einzeln an- und abwaehlbar, jeder Betrag von Hand ueberschreibbar. Am
// Ende wandert alles als Position in die Kostenaufstellung, mit
// Kostengruppe nach DIN 276.

import {
  el, eur, zahl, feld, zahlfeld, auswahl, knopf, karte, kopfzeile, wertzeile,
  hinweisKasten, zuZahl, melde, anhaengen, geheZu,
} from '../hilfen.js';
import { daten, einstellung } from '../daten.js';
import { bauweise, SCHLUESSELFERTIG, SANIERUNG } from '../bauweise.js';
import { kostengruppeLang } from '../din276.js';
import { LAENDER } from './baukosten.js';

// Die Zeilen. "anteil" rechnet in Prozent der Basis, "pauschal" ist ein
// Erfahrungswert in Euro -- eine Vermessung kostet nicht mehr, weil das
// Haus teurer ist.
//
// "ohne" nennt die Bauweisen, bei denen die Zeile nicht vorgeschlagen wird.
// Beim schluesselfertigen Bauen stecken Planung, Statik und Bauleitung im
// Vertragspreis; wer sie trotzdem braucht, hakt sie von Hand an.
const ZEILEN = [
  // ------------------------------------------------------ Grundstueck
  { id: 'grest', name: 'Grunderwerbsteuer', kg: '120', basis: 'grundstueck',
    art: 'anteil', wert: null, ohne: [SANIERUNG],
    hinweis: 'Satz des Bundeslandes, fällig wenige Wochen nach dem Notartermin.' },
  { id: 'notar', name: 'Notar und Grundbuch', kg: '120', basis: 'grundstueck',
    art: 'anteil', wert: 2.0, ohne: [SANIERUNG],
    hinweis: 'Beurkundung, Auflassungsvormerkung, Eintragung der Grundschuld.' },
  { id: 'makler', name: 'Maklerprovision', kg: '120', basis: 'grundstueck',
    art: 'anteil', wert: 3.57, ohne: [SANIERUNG], aus: true,
    hinweis: 'Nur bei Vermittlung. Seit 2020 wird sie geteilt.' },
  { id: 'vermessung', name: 'Vermessung und Abmarkung', kg: '120', basis: 'fest',
    art: 'pauschal', wert: 2500, ohne: [SANIERUNG] },
  { id: 'boden', name: 'Bodengutachten', kg: '720', basis: 'fest',
    art: 'pauschal', wert: 1200, ohne: [SANIERUNG],
    hinweis: 'Die günstigste Rechnung im ganzen Bau. Ohne sie ist die Baugrube ein Glücksspiel.' },
  { id: 'erschliessung', name: 'Erschließungsbeitrag', kg: '220', basis: 'fest',
    art: 'pauschal', wert: 12000, ohne: [SANIERUNG],
    hinweis: 'Straße, Kanal, Gehweg. Steht im Bescheid der Gemeinde, nicht im Exposé.' },

  // ------------------------------------------------------------- Bau
  { id: 'planung', name: 'Architekt und Objektplanung', kg: '730', basis: 'bau',
    art: 'anteil', wert: 10, ohne: [SCHLUESSELFERTIG] },
  { id: 'statik', name: 'Statik und Prüfstatik', kg: '740', basis: 'bau',
    art: 'anteil', wert: 1.5, ohne: [SCHLUESSELFERTIG] },
  { id: 'genehmigung', name: 'Baugenehmigung und Gebühren', kg: '760', basis: 'bau',
    art: 'anteil', wert: 0.5 },
  { id: 'anschluesse', name: 'Hausanschlüsse', kg: '220', basis: 'fest',
    art: 'pauschal', wert: 10000,
    hinweis: 'Strom, Wasser, Abwasser, Telekommunikation. Beim Schlüsselfertigen fast nie enthalten.' },
  { id: 'einmessung', name: 'Gebäudeeinmessung', kg: '760', basis: 'fest',
    art: 'pauschal', wert: 2000, ohne: [SANIERUNG] },
  { id: 'baustrom', name: 'Baustrom und Bauwasser', kg: '760', basis: 'fest',
    art: 'pauschal', wert: 1500 },
  { id: 'einrichtung', name: 'Baustelleneinrichtung', kg: '760', basis: 'fest',
    art: 'pauschal', wert: 2000,
    hinweis: 'Bauzaun, Container, Toilette, Zuwegung.' },
  { id: 'versicherung', name: 'Bauversicherungen', kg: '710', basis: 'fest',
    art: 'pauschal', wert: 1200,
    hinweis: 'Bauherrenhaftpflicht und Bauleistung. Beides gehört vor den ersten Spatenstich.' },
  { id: 'energie', name: 'Energieberatung und Nachweise', kg: '740', basis: 'fest',
    art: 'pauschal', wert: 2500,
    hinweis: 'Ohne den Nachweis gibt es keine Förderung, und zwar nur vorher.' },
  { id: 'begleitung', name: 'Baubegleitung und Abnahmen', kg: '710', basis: 'fest',
    art: 'pauschal', wert: 3000,
    hinweis: 'Ein unabhängiger Gutachter zu drei Terminen kostet weniger als ein Mangel, der bleibt.' },
];

/**
 * Rechnet eine Zeile durch.
 *
 * @param {object} zeile   Eintrag aus ZEILEN
 * @param {object} basen   { bau, grundstueck, grest }
 * @returns {number}
 */
export function zeilenbetrag(zeile, basen) {
  if (zeile.art === 'pauschal') return zeile.wert;
  const satz = zeile.id === 'grest' ? basen.grest : zeile.wert;
  const basis = zeile.basis === 'grundstueck' ? basen.grundstueck : basen.bau;
  return Math.round((basis * satz) / 100);
}

export async function zeige(rahmen) {
  const [gemerkt, hausdaten, art, posten] = await Promise.all([
    einstellung('nebenkosten_eingabe'),
    einstellung('baukosten_eingabe'),
    bauweise(),
    daten.alle('posten'),
  ]);
  const stand = gemerkt || {};
  const haus = hausdaten || {};

  // Vorbelegung: Was schon in der Kostenaufstellung steht, ist die beste
  // Schaetzung der Bausumme. Sonst der Baukostenrechner, sonst ein Wert,
  // mit dem sich rechnen laesst.
  //
  // Was von hier stammt, zaehlt nicht mit: Sonst waere die Bausumme beim
  // zweiten Aufruf um die eigenen Nebenkosten groesser, und die Prozentsaetze
  // liefen mit jedem Mal weiter auf.
  const ausPosten = posten
    .filter((p) => !String(p.herkunft || '').startsWith('baunebenkosten:'))
    .reduce((s, p) => s + (p.tatsaechlich || p.geplant || 0), 0);

  const eingaben = {
    bau: stand.bau ?? (ausPosten || (haus.flaeche ? haus.flaeche * 2800 : 350000)),
    grundstueck: stand.grundstueck ?? (haus.grundstueck ?? 100000),
    land: stand.land || haus.land || 'rheinland-pfalz',
  };

  const bauFeld = zahlfeld({ value: String(Math.round(eingaben.bau)) });
  const grundstueckFeld = zahlfeld({ value: String(Math.round(eingaben.grundstueck)) });
  const landFeld = auswahl(LAENDER.map((l) => [l.slug, l.name]), eingaben.land);

  // Je Zeile: angehakt und Betrag. Beides bleibt gemerkt, sonst waere jede
  // Korrektur beim naechsten Aufruf wieder weg.
  const zustand = stand.zeilen || {};
  const felder = new Map();
  const summenzeile = el('div');

  const sichtbar = ZEILEN.filter((z) => !(z.ohne || []).includes(art.id));

  function basen() {
    const land = LAENDER.find((l) => l.slug === landFeld.value) || LAENDER[10];
    return {
      bau: Math.max(0, zuZahl(bauFeld.value)),
      grundstueck: Math.max(0, zuZahl(grundstueckFeld.value)),
      grest: land.grest,
    };
  }

  /** Die Betragsfelder neu befuellen -- aber nur die, die niemand angefasst hat. */
  function nachrechnen(auchGeaenderte) {
    const b = basen();
    for (const z of sichtbar) {
      const f = felder.get(z.id);
      if (!f) continue;
      if (auchGeaenderte || !f.selbst) {
        f.betrag.value = String(zeilenbetrag(z, b));
        f.selbst = false;
      }
    }
    summe();
  }

  function summe() {
    let gesamt = 0;
    for (const z of sichtbar) {
      const f = felder.get(z.id);
      if (f && f.an.checked) gesamt += Math.max(0, zuZahl(f.betrag.value));
    }
    const b = basen();
    const anteil = b.bau > 0 ? (gesamt / b.bau) * 100 : 0;
    summenzeile.replaceChildren(
      wertzeile('Baunebenkosten gesamt', eur.format(gesamt), true),
      el('p', {
        klasse: 'unterzeile',
        text: `${zahl(anteil, 1)} Prozent der Bausumme. Üblich sind 15 bis 20 Prozent; ` +
          'liegst du deutlich darunter, fehlt eine Zeile.',
      })
    );
    return gesamt;
  }

  const zeilenliste = el('div', { klasse: 'nebenliste' }, sichtbar.map((z) => {
    const gemerkteZeile = zustand[z.id] || {};
    const an = el('input', {
      type: 'checkbox',
      checked: gemerkteZeile.an ?? !z.aus,
    });
    const betrag = zahlfeld({ value: String(gemerkteZeile.betrag ?? 0) });
    const f = { an, betrag, selbst: gemerkteZeile.betrag !== undefined };
    felder.set(z.id, f);

    an.addEventListener('change', summe);
    betrag.addEventListener('input', () => { f.selbst = true; summe(); });

    return el('label', { klasse: 'nebenzeile' }, [
      an,
      el('span', { klasse: 'zeilen-text' }, [
        el('span', { klasse: 'zeilen-titel', text: z.name }),
        el('span', {
          klasse: 'zeilen-unter',
          text: [
            kostengruppeLang(z.kg),
            z.art === 'anteil' && z.id !== 'grest' ? zahl(z.wert, 2) + ' %' : null,
            z.hinweis,
          ].filter(Boolean).join(' · '),
        }),
      ]),
      betrag,
    ]);
  }));

  for (const f of [bauFeld, grundstueckFeld, landFeld]) {
    f.addEventListener('input', () => nachrechnen(false));
    f.addEventListener('change', () => nachrechnen(false));
  }

  async function merken() {
    const zeilen = {};
    for (const z of sichtbar) {
      const f = felder.get(z.id);
      zeilen[z.id] = { an: f.an.checked, betrag: Math.max(0, zuZahl(f.betrag.value)) };
    }
    await einstellung('nebenkosten_eingabe', {
      bau: basen().bau, grundstueck: basen().grundstueck, land: landFeld.value, zeilen,
    });
  }

  /** Jede angehakte Zeile wird eine Position -- vorhandene werden aktualisiert. */
  async function uebernehmen() {
    const vorhanden = await daten.alle('posten');
    let neu = 0;
    let ersetzt = 0;
    for (const z of sichtbar) {
      const f = felder.get(z.id);
      if (!f.an.checked) continue;
      const betrag = Math.max(0, zuZahl(f.betrag.value));
      if (!betrag) continue;
      const alt = vorhanden.find((p) => p.herkunft === 'baunebenkosten:' + z.id);
      await daten.sichern('posten', {
        ...(alt || {}),
        herkunft: 'baunebenkosten:' + z.id,
        name: z.name,
        gewerk: alt ? alt.gewerk : 'Sonstiges',
        kostengruppe: art.zeigtKostengruppen ? z.kg : null,
        geplant: betrag,
        tatsaechlich: alt ? alt.tatsaechlich || 0 : 0,
        status: alt ? alt.status || 'geplant' : 'geplant',
        kontaktId: alt ? alt.kontaktId || null : null,
        raumId: null,
        notiz: alt ? alt.notiz || '' : 'Aus dem Baunebenkosten-Rechner übernommen.',
      });
      if (alt) ersetzt += 1; else neu += 1;
    }
    await merken();
    if (!neu && !ersetzt) {
      melde('Nichts angehakt, nichts übernommen.');
      return;
    }
    melde(`${neu} neu, ${ersetzt} aktualisiert. Öffne die Kostenaufstellung.`);
    geheZu('#/baukasse/kosten');
  }

  anhaengen(
    rahmen,
    kopfzeile(
      'Baunebenkosten',
      'Was zwischen Grundstückspreis und Bauvertrag liegt und in keinem Angebot steht.'
    ),
    karte([
      el('h2', { text: 'Grundlage' }),
      feld('Bausumme in €', bauFeld, 'Haus ohne Grundstück, so wie es im Vertrag oder Angebot steht.'),
      feld('Grundstückspreis in €', grundstueckFeld, 'Null eintragen, wenn das Grundstück schon dir gehört.'),
      feld('Bundesland', landFeld, 'Bestimmt den Satz der Grunderwerbsteuer.'),
    ]),
    karte([
      el('h2', { text: 'Die einzelnen Posten' }),
      el('p', {
        klasse: 'unterzeile',
        text: 'Jeder Betrag lässt sich überschreiben. Sobald du einen Wert von Hand ' +
          'änderst, bleibt er stehen, auch wenn du oben etwas anpasst.',
      }),
      zeilenliste,
      summenzeile,
      el('div', { klasse: 'knopf-reihe' }, [
        knopf('In die Kostenaufstellung übernehmen', uebernehmen, 'knopf-haupt'),
        knopf('Vorschläge zurücksetzen', () => nachrechnen(true), 'knopf-leise'),
      ]),
    ]),
    hinweisKasten(
      art.istSchluesselfertig
        ? 'Bei schlüsselfertigem Bauen stecken Planung, Statik und Bauleitung im ' +
          'Vertragspreis; sie stehen deshalb nicht in der Liste. Alles andere zahlst ' +
          'du trotzdem selbst. Prüfe im Vertrag, was unter „Bauherrenleistungen" steht ' +
          'oder ausdrücklich nicht enthalten ist.'
        : 'Bei Einzelvergabe ist das Architektenhonorar der größte Einzelposten. Die ' +
          'HOAI-Sätze sind seit 2021 unverbindlich, verhandelbar und je nach ' +
          'Leistungsphasen sehr unterschiedlich. Zehn Prozent sind ein Mittelwert, ' +
          'kein Angebot.',
      'info'
    ),
    hinweisKasten(
      'Baunebenkosten fallen früh an, oft bevor die Bank die erste Rate auszahlt. ' +
        'Plane sie im Eigenkapital ein, nicht im Bauvertrag.',
      'warn'
    ),
    el('div', { klasse: 'knopf-reihe' }, [
      knopf('Zur Kostenaufstellung', () => { geheZu('#/baukasse/kosten'); }, 'knopf-leise'),
      knopf('Zur Baufinanzierung', () => { geheZu('#/finanzierung'); }, 'knopf-leise'),
    ])
  );

  // Erst jetzt rechnen: Die Felder haengen im Baum und koennen sich fuellen.
  nachrechnen(false);
  for (const z of sichtbar) {
    const g = zustand[z.id];
    if (g && g.betrag !== undefined) felder.get(z.id).betrag.value = String(g.betrag);
  }
  summe();
}
