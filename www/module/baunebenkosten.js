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
// Deshalb ist das hier kein Ueberschlag, sondern eine Liste, die dem
// Bauherrn gehoert: Jede Zeile laesst sich umbenennen, entfernen und im
// Betrag ueberschreiben, eigene kommen dazu. Am Ende wandert alles als
// Position in die Kostenaufstellung, mit Kostengruppe nach DIN 276.

import {
  el, eur, zahl, feld, eingabe, zahlfeld, auswahl, knopf, karte, kopfzeile,
  wertzeile, hinweisKasten, zuZahl, melde, anhaengen, fuellen, geheZu,
} from '../hilfen.js';
import { blattOeffnen } from '../blatt.js';
import { daten, einstellung } from '../daten.js';
import { bauweise, SCHLUESSELFERTIG, SANIERUNG } from '../bauweise.js';
import { kostengruppeLang, kostengruppenOptionen } from '../din276.js';
import { LAENDER } from './baukosten.js';

// Die Vorgabe. "anteil" rechnet in Prozent der Basis, "pauschal" ist ein
// Erfahrungswert in Euro -- eine Vermessung kostet nicht mehr, weil das
// Haus teurer ist.
//
// "ohne" nennt die Bauweisen, bei denen die Zeile nicht vorgeschlagen wird.
// Beim schluesselfertigen Bauen stecken Planung, Statik und Bauleitung im
// Vertragspreis; wer sie trotzdem braucht, legt die Zeile von Hand an.
const ZEILEN = [
  // ------------------------------------------------------ Grundstueck
  { id: 'grest', name: 'Grunderwerbsteuer', kg: '120', basis: 'grundstueck',
    art: 'anteil', wert: null, ohne: [SANIERUNG],
    hinweis: 'Fällig wenige Wochen nach dem Notartermin.' },
  { id: 'notar', name: 'Notar und Grundbuch', kg: '120', basis: 'grundstueck',
    art: 'anteil', wert: 2.0, ohne: [SANIERUNG],
    hinweis: 'Beurkundung, Auflassungsvormerkung, Eintragung der Grundschuld.' },
  { id: 'makler', name: 'Maklerprovision', kg: '120', basis: 'grundstueck',
    art: 'anteil', wert: 3.57, ohne: [SANIERUNG],
    hinweis: 'Ohne Vermittlung entfernen.' },
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
 * @param {object} zeile   Eine Zeile mit art, wert und basis
 * @param {object} basen   { bau, grundstueck, grest }
 * @returns {number}
 */
export function zeilenbetrag(zeile, basen) {
  if (zeile.art === 'pauschal') return zeile.wert;
  const satz = zeile.id === 'grest' ? basen.grest : zeile.wert;
  const basis = zeile.basis === 'grundstueck' ? basen.grundstueck : basen.bau;
  return Math.round((basis * satz) / 100);
}

/**
 * Die Vorgabe fuer diese Bauweise, als eigenstaendige Liste.
 *
 * Sobald jemand etwas umbenennt, entfernt oder hinzufuegt, steht die ganze
 * Liste in den Einstellungen und die Vorgabe spielt keine Rolle mehr --
 * sonst kaeme eine entfernte Zeile beim naechsten Aufruf zurueck.
 */
function vorgabe(bauweiseId) {
  return ZEILEN
    .filter((z) => !(z.ohne || []).includes(bauweiseId))
    .map((z) => ({
      id: z.id, name: z.name, kg: z.kg, art: z.art, wert: z.wert,
      basis: z.basis, hinweis: z.hinweis, betrag: null,
    }));
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

  const bauFeld = zahlfeld({
    value: String(Math.round(
      stand.bau ?? (ausPosten || (haus.flaeche ? haus.flaeche * 2800 : 350000))
    )),
  });
  const grundstueckFeld = zahlfeld({
    value: String(Math.round(stand.grundstueck ?? (haus.grundstueck ?? 100000))),
  });
  const landFeld = auswahl(
    LAENDER.map((l) => [l.slug, l.name]), stand.land || haus.land || 'rheinland-pfalz'
  );

  // Die Liste des Nutzers, sobald es eine gibt. Sonst die Vorgabe.
  let zeilen = Array.isArray(stand.zeilen) && stand.zeilen.length
    ? stand.zeilen
    : vorgabe(art.id);

  const zeilenliste = el('div', { klasse: 'nebenliste' });
  const summenzeile = el('div');

  function basen() {
    const land = LAENDER.find((l) => l.slug === landFeld.value) || LAENDER[10];
    return {
      bau: Math.max(0, zuZahl(bauFeld.value)),
      grundstueck: Math.max(0, zuZahl(grundstueckFeld.value)),
      grest: land.grest,
    };
  }

  // Eingetragen schlaegt gerechnet: Wer einen Betrag tippt, hat ein Angebot.
  const betragVon = (z) => (z.betrag === null || z.betrag === undefined
    ? zeilenbetrag(z, basen())
    : z.betrag);

  async function merken() {
    await einstellung('nebenkosten_eingabe', {
      bau: basen().bau, grundstueck: basen().grundstueck, land: landFeld.value, zeilen,
    });
  }

  function summe() {
    const gesamt = zeilen.reduce((s, z) => s + Math.max(0, betragVon(z)), 0);
    const b = basen();

    // Die Faustregel "15 bis 20 Prozent" meint die Nebenkosten des Baus.
    // Was am Grundstueck haengt -- Steuer, Notar, Makler, Vermessung --
    // richtet sich nach dessen Preis und wuerde den Anteil verfaelschen:
    // Bei 100.000 Euro Grundstueck kaeme man auf 27 Prozent und haette
    // trotzdem nichts falsch gemacht. Deshalb wird nur der Bauteil
    // verglichen, und der Rest steht als eigene Zahl daneben.
    const amGrundstueck = zeilen
      .filter((z) => z.basis === 'grundstueck' || z.id === 'vermessung')
      .reduce((s, z) => s + Math.max(0, betragVon(z)), 0);
    const amBau = gesamt - amGrundstueck;
    const anteil = b.bau > 0 ? (amBau / b.bau) * 100 : 0;

    fuellen(
      summenzeile,
      wertzeile('Baunebenkosten gesamt', eur.format(gesamt), true),
      el('p', {
        klasse: 'unterzeile',
        text: amGrundstueck > 0
          ? `Davon ${eur.format(amGrundstueck)} rund ums Grundstück und ` +
            `${eur.format(amBau)} am Bau — ${zahl(anteil, 1)} Prozent der Bausumme. ` +
            'Üblich sind dort 15 bis 20 Prozent.'
          : `${zahl(anteil, 1)} Prozent der Bausumme. Üblich sind 15 bis 20 Prozent; ` +
            'liegst du deutlich darunter, fehlt eine Zeile.',
      })
    );
  }

  function zeichne() {
    fuellen(zeilenliste, ...zeilen.map((z) => {
      const betrag = zahlfeld({ value: String(betragVon(z)) });
      betrag.setAttribute('aria-label', z.name + ' in Euro');
      betrag.addEventListener('input', () => {
        z.betrag = Math.max(0, zuZahl(betrag.value));
        summe();
        merken();
      });

      return el('div', { klasse: 'nebenzeile' }, [
        el('div', { klasse: 'zeilen-text' }, [
          el('span', { klasse: 'zeilen-titel', text: z.name }),
          el('span', {
            klasse: 'zeilen-unter',
            text: [
              kostengruppeLang(z.kg),
              // Ein gerechneter Betrag sagt, woher er kommt. Ein getippter
              // nicht: Der steht ja fest.
              z.betrag === null && z.art === 'anteil'
                ? (z.id === 'grest' ? zahl(basen().grest, 1) : zahl(z.wert, 2)) +
                  ' % vom ' + (z.basis === 'grundstueck' ? 'Grundstück' : 'Bau')
                : null,
              z.hinweis,
            ].filter(Boolean).join(' · '),
          }),
        ]),
        betrag,
        el('div', { klasse: 'nebenknoepfe' }, [
          el('button', {
            klasse: 'knopf knopf-schmal', type: 'button', text: 'Umbenennen',
            onclick: () => aendern(z),
          }),
          el('button', {
            klasse: 'knopf knopf-schmal', type: 'button', text: 'Entfernen',
            onclick: async () => {
              zeilen = zeilen.filter((x) => x !== z);
              zeichne();
              await merken();
            },
          }),
        ]),
      ]);
    }));
    summe();
  }

  function aendern(z) {
    const name = eingabe({ value: z.name });
    const kg = auswahl(kostengruppenOptionen(), z.kg);
    const betrag = zahlfeld({ value: z.betrag === null ? '' : String(z.betrag) });
    blattOeffnen(
      'Zeile ändern',
      [
        feld('Bezeichnung', name),
        art.zeigtKostengruppen ? feld('Kostengruppe (DIN 276)', kg) : null,
        feld('Betrag in €', betrag,
          z.art === 'anteil'
            ? 'Leer lassen, dann rechnet die App den Prozentsatz aus.'
            : 'Leer lassen, dann steht wieder der Erfahrungswert da.'),
      ].filter(Boolean),
      async () => {
        const wert = name.value.trim();
        if (!wert) throw new Error('Bitte eine Bezeichnung eintragen.');
        z.name = wert;
        z.kg = kg.value || z.kg;
        z.betrag = betrag.value.trim() === '' ? null : Math.max(0, zuZahl(betrag.value));
        zeichne();
        await merken();
      },
      {
        loeschen: async () => {
          zeilen = zeilen.filter((x) => x !== z);
          zeichne();
          await merken();
        },
      }
    );
  }

  function hinzufuegen() {
    const name = eingabe({ placeholder: 'z. B. Baumfällung' });
    const kg = auswahl(kostengruppenOptionen(), '760');
    const betrag = zahlfeld({ value: '' });
    blattOeffnen(
      'Zeile hinzufügen',
      [
        feld('Bezeichnung', name),
        art.zeigtKostengruppen ? feld('Kostengruppe (DIN 276)', kg) : null,
        feld('Betrag in €', betrag),
      ].filter(Boolean),
      async () => {
        const wert = name.value.trim();
        if (!wert) throw new Error('Bitte eine Bezeichnung eintragen.');
        const summe = Math.max(0, zuZahl(betrag.value));
        zeilen = [...zeilen, {
          // Die Kennung haengt am Namen: So findet "Übernehmen" beim zweiten
          // Mal dieselbe Position wieder, statt eine zweite anzulegen.
          id: 'eigen-' + wert.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          name: wert, kg: kg.value || '760', art: 'pauschal', wert: summe,
          basis: 'fest', hinweis: null, betrag: summe,
        }];
        zeichne();
        await merken();
      }
    );
  }

  /** Jede Zeile mit Betrag wird eine Position -- vorhandene werden aktualisiert. */
  async function uebernehmen() {
    const vorhanden = await daten.alle('posten');
    let neu = 0;
    let ersetzt = 0;
    for (const z of zeilen) {
      const betrag = Math.max(0, betragVon(z));
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
      melde('Keine Zeile mit Betrag, nichts übernommen.');
      return;
    }
    melde(`${neu} neu, ${ersetzt} aktualisiert. Öffne die Kostenaufstellung.`);
    geheZu('#/baukasse/kosten');
  }

  for (const f of [bauFeld, grundstueckFeld, landFeld]) {
    f.addEventListener('input', () => { zeichne(); merken(); });
    f.addEventListener('change', () => { zeichne(); merken(); });
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
        text: 'Was auf dich nicht zutrifft, entfernst du. Jeden Betrag kannst du ' +
          'überschreiben; getippte Beträge bleiben stehen, die übrigen rechnen sich ' +
          'aus Bausumme und Grundstückspreis.',
      }),
      zeilenliste,
      summenzeile,
      el('div', { klasse: 'knopf-reihe' }, [
        knopf('In die Kostenaufstellung übernehmen', uebernehmen, 'knopf-haupt'),
        knopf('Zeile hinzufügen', hinzufuegen),
        knopf('Auf die Vorgabe zurücksetzen', async () => {
          if (!window.confirm(
            'Alle Zeilen auf die Vorgabe zurücksetzen? Eigene Zeilen und geänderte ' +
            'Beträge gehen dabei verloren. Positionen in der Kostenaufstellung ' +
            'bleiben stehen.'
          )) return;
          zeilen = vorgabe(art.id);
          zeichne();
          await merken();
        }, 'knopf-leise'),
      ]),
    ]),
    hinweisKasten(
      art.istSchluesselfertig
        ? 'Bei schlüsselfertigem Bauen stecken Planung, Statik und Bauleitung im ' +
          'Vertragspreis; sie stehen deshalb nicht in der Vorgabe. Alles andere zahlst ' +
          'du trotzdem selbst. Prüfe im Vertrag, was unter Bauherrenleistungen steht ' +
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

  zeichne();
}
