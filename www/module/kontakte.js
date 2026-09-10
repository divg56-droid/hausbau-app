// Kontakte, in drei Sichten. Jede steht einzeln in der Seitenleiste und kommt
// als Unterweg hier an: "#/kontakte/gewerke" laedt diese Datei.
//
//   Firmen           Wer arbeitet am Haus, mit Anschrift fuer die Ruege
//   Privatpersonen   Bauhelfer, Nachbarn, Verwandte
//   Gewerke          Die Liste, aus der Positionen, Maengel und Kontakte
//                    waehlen
//
// Firmen und Privatpersonen liegen im selben Speicher, unterschieden ueber
// das Feld "art". Maengel und Bauablauf haengen ihre Zustaendigkeiten hier
// ein, das Tagebuch hakt die Helfer ab.

import {
  el, feld, eingabe, auswahl, knopf, karte, kopfzeile, leerzustand,
  hinweisKasten, melde,
  anhaengen,
} from '../hilfen.js';
import { daten } from '../daten.js';
import { blattOeffnen } from '../blatt.js';
import { zeichen, gewerkZeichen, kontaktZeichen } from '../zeichen.js';
import {
  gewerkeListe, gewerkeSetzen, gewerkVerwendung, gewerkUmbenennen, GEWERKE_VORGABE,
} from '../gewerke.js';

// Was die beiden Personensichten unterscheidet. Alles andere ist gleich.
const ARTEN = {
  firma: {
    titel: 'Firmen',
    unter: 'Handwerker, Bauleiter und Planer, mit Anschrift für die Mängelrüge.',
    knopf: 'Firma hinzufügen',
    leer: 'Noch keine Firma erfasst',
    leerText:
      'Trage die Betriebe ein, die am Haus arbeiten. Dann kannst du Mängel, ' +
      'Angebote und Arbeitsschritte einer Firma zuordnen, und die Anschrift ' +
      'steht im Briefkopf der Rüge.',
  },
  helfer: {
    titel: 'Privatpersonen',
    unter: 'Bauhelfer, Nachbarn, Verwandte: alle, die keine Firma sind.',
    knopf: 'Person hinzufügen',
    leer: 'Noch keine Privatpersonen erfasst',
    leerText:
      'Wer beim Bau mit anpackt, gehört hierher. Aus dieser Liste wählt das ' +
      'Bauhelfertagebuch aus, wer an einem Tag da war.',
  },
};

export async function zeige(rahmen, unterweg) {
  await zeichne(rahmen, unterweg || 'firmen');
}

async function zeichne(rahmen, ansicht) {
  rahmen.replaceChildren();
  const neu = () => zeichne(rahmen, ansicht);

  if (ansicht === 'gewerke') return zeigeGewerke(rahmen, neu);
  return zeigePersonen(rahmen, ansicht === 'personen' ? 'helfer' : 'firma', neu);
}

// -------------------------------------------------- Firmen und Privatpersonen

async function zeigePersonen(rahmen, art, neu) {
  const alle = await daten.alle('kontakte');
  const was = ARTEN[art];

  const drin = alle
    .filter((k) => (k.art || 'firma') === art)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));

  anhaengen(rahmen, kopfzeile(was.titel, was.unter));

  if (!drin.length) {
    anhaengen(
      rahmen,
      karte([
        leerzustand(was.leer, was.leerText),
        knopf(was.knopf, () => bearbeiten({ art }, neu), 'knopf-haupt'),
      ])
    );
    return;
  }

  anhaengen(
    rahmen,
    karte([
      el('ul', { klasse: 'liste' }, drin.map((k) =>
        el('li', {}, [
          el('button', { klasse: 'listenzeile', onclick: () => bearbeiten(k, neu) }, [
            el('span', { klasse: 'zeilenzeichen' }, [zeichen(kontaktZeichen(k))]),
            el('span', { klasse: 'zeilen-text' }, [
              el('span', { klasse: 'zeilen-titel', text: k.name }),
              el('span', {
                klasse: 'zeilen-unter',
                text: [k.firma, k.gewerk, k.telefon].filter(Boolean).join(' · ') ||
                  'ohne weitere Angaben',
              }),
            ]),
            // tel: oeffnet im WebView die Telefon-App.
            k.telefon
              ? el('a', {
                  klasse: 'marke', href: 'tel:' + k.telefon.replace(/\s/g, ''),
                  'aria-label': 'Anrufen',
                  onclick: (ereignis) => ereignis.stopPropagation(),
                }, ['Anrufen'])
              : null,
          ]),
        ])
      )),
    ]),
    knopf(was.knopf, () => bearbeiten({ art }, neu), 'knopf-haupt')
  );
}

async function bearbeiten(kontakt, nachher) {
  const gewerke = await gewerkeListe();
  const art = auswahl(
    [['firma', 'Firma'], ['helfer', 'Privatperson']], kontakt.art || 'firma'
  );
  const name = eingabe({ value: kontakt.name || '', placeholder: 'Vor- und Nachname' });
  const firma = eingabe({ value: kontakt.firma || '', placeholder: 'Betrieb' });
  // Ein Gewerk, das es in der Liste nicht mehr gibt, bleibt trotzdem waehlbar:
  // Sonst wuerde es beim naechsten Speichern stillschweigend verschwinden.
  const bekannt = kontakt.gewerk && !gewerke.includes(kontakt.gewerk)
    ? [kontakt.gewerk, ...gewerke]
    : gewerke;
  const gewerk = auswahl(
    [['', '– kein Gewerk –'], ...bekannt.map((g) => [g, g])], kontakt.gewerk || ''
  );
  // Anschrift: wird fuer den Briefkopf der Maengelruege gebraucht.
  const strasse = eingabe({ value: kontakt.strasse || '', placeholder: 'Straße und Hausnummer' });
  const plzOrt = eingabe({ value: kontakt.plzOrt || '', placeholder: 'PLZ und Ort' });
  const telefon = el('input', { type: 'tel', value: kontakt.telefon || '', placeholder: '01512 3456789' });
  const epost = el('input', { type: 'email', value: kontakt.epost || '', placeholder: 'name@betrieb.de' });
  const notiz = el('textarea', {}, [kontakt.notiz || '']);

  blattOeffnen(
    kontakt.id ? 'Kontakt bearbeiten' : 'Kontakt anlegen',
    [
      feld('Art', art),
      feld('Name', name),
      feld('Betrieb', firma),
      feld('Gewerk', gewerk),
      feld('Straße und Hausnummer', strasse),
      feld('PLZ und Ort', plzOrt),
      feld('Telefon', telefon),
      feld('E-Mail', epost),
      feld('Notiz', notiz),
    ],
    async () => {
      const wert = {
        art: art.value,
        name: name.value.trim(),
        firma: firma.value.trim(),
        gewerk: gewerk.value,
        strasse: strasse.value.trim(),
        plzOrt: plzOrt.value.trim(),
        telefon: telefon.value.trim(),
        epost: epost.value.trim(),
        notiz: notiz.value.trim(),
      };
      if (!wert.name) throw new Error('Bitte einen Namen eintragen.');
      if (kontakt.id) wert.id = kontakt.id;
      await daten.sichern('kontakte', wert);
      await nachher();
    },
    {
      loeschen: kontakt.id
        ? async () => {
            await daten.loeschen('kontakte', kontakt.id);
            await nachher();
          }
        : null,
    }
  );
}

// ------------------------------------------------------------------ Gewerke

const mengen = (anzahl, eins, viele) => anzahl + ' ' + (anzahl === 1 ? eins : viele);

async function zeigeGewerke(rahmen, neu) {
  const gewerke = await gewerkeListe();

  // Einmal zaehlen, wie oft jedes Gewerk vorkommt: Das entscheidet, ob es
  // sich loeschen laesst, und sagt dem Nutzer, woran er haengt.
  const verwendung = new Map();
  for (const g of gewerke) verwendung.set(g, await gewerkVerwendung(g));

  const feldNeu = eingabe({ placeholder: 'z. B. Photovoltaik' });
  const anlegen = async () => {
    const name = feldNeu.value.trim();
    if (!name) return;
    if (gewerke.some((g) => g.toLowerCase() === name.toLowerCase())) {
      melde('Dieses Gewerk gibt es schon.');
      return;
    }
    // Vor "Sonstiges" einsortieren: Der Sammelposten bleibt am Ende.
    const rest = gewerke.filter((g) => g !== 'Sonstiges');
    const sammel = gewerke.filter((g) => g === 'Sonstiges');
    await gewerkeSetzen([...rest, name, ...sammel]);
    await neu();
  };
  feldNeu.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); anlegen(); }
  });

  anhaengen(
    rahmen,
    kopfzeile('Gewerke', 'Die Liste, aus der Positionen, Mängel und Kontakte wählen.'),
    karte([
      el('ul', { klasse: 'liste' }, gewerke.map((g) => {
        const wo = verwendung.get(g);
        return el('li', {}, [
          el('div', { klasse: 'leitfaden-zeile' }, [
            el('span', { klasse: 'zeilenzeichen' }, [zeichen(gewerkZeichen(g))]),
            el('div', { klasse: 'zeilen-text' }, [
              el('span', { klasse: 'zeilen-titel', text: g }),
              el('span', {
                klasse: 'zeilen-unter',
                text: wo.gesamt
                  ? [
                      wo.posten ? mengen(wo.posten, 'Position', 'Positionen') : null,
                      wo.maengel ? mengen(wo.maengel, 'Mangel', 'Mängel') : null,
                      wo.kontakte ? mengen(wo.kontakte, 'Kontakt', 'Kontakte') : null,
                    ].filter(Boolean).join(' · ')
                  : 'noch nicht verwendet',
              }),
            ]),
            // Beide Knoepfe in einem Behaelter: So brechen sie als Paar um
            // und nicht einzeln, wenn der Name lang und das Telefon schmal ist.
            el('span', { klasse: 'zeilen-aktionen' }, [
              el('button', {
                klasse: 'knopf knopf-schmal', type: 'button', text: 'Umbenennen',
                onclick: () => umbenennen(g, gewerke, neu),
              }),
              el('button', {
                klasse: 'knopf knopf-schmal', type: 'button', text: 'Löschen',
                onclick: () => loeschen(g, wo, gewerke, neu),
              }),
            ]),
          ]),
        ]);
      })),
      el('div', { klasse: 'filterleiste' }, [
        feldNeu,
        knopf('Gewerk hinzufügen', anlegen, 'knopf-leise'),
      ]),
    ]),
    hinweisKasten(
      'Beim Umbenennen ziehen alle Positionen, Mängel und Kontakte mit. ' +
        'Ein Gewerk, an dem noch etwas hängt, lässt sich nicht löschen.',
      'info'
    ),
    JSON.stringify(gewerke) !== JSON.stringify(GEWERKE_VORGABE)
      ? knopf('Auf die Vorgabe zurücksetzen', async () => {
          if (!window.confirm(
            'Die Gewerkeliste auf die Vorgabe zurücksetzen? Selbst angelegte Gewerke ' +
            'verschwinden aus der Liste. An Positionen und Mängeln bleiben sie stehen.'
          )) return;
          await gewerkeSetzen([...GEWERKE_VORGABE]);
          await neu();
        }, 'knopf-leise')
      : null
  );
}

function umbenennen(alt, gewerke, nachher) {
  const name = eingabe({ value: alt });
  blattOeffnen(
    'Gewerk umbenennen',
    [
      feld('Bezeichnung', name),
      el('p', {
        klasse: 'unterzeile',
        text: 'Alle Positionen, Mängel und Kontakte mit diesem Gewerk werden mit ' +
          'umbenannt. Es geht nichts verloren.',
      }),
    ],
    async () => {
      const wert = name.value.trim();
      if (!wert) throw new Error('Bitte eine Bezeichnung eintragen.');
      if (wert === alt) return;
      if (gewerke.some((g) => g.toLowerCase() === wert.toLowerCase())) {
        throw new Error('Dieses Gewerk gibt es schon.');
      }
      await gewerkUmbenennen(alt, wert);
      await nachher();
    }
  );
}

async function loeschen(name, wo, gewerke, nachher) {
  if (wo.gesamt) {
    melde(`"${name}" hängt noch an ${wo.gesamt} Einträgen und bleibt deshalb stehen.`);
    return;
  }
  if (gewerke.length <= 1) {
    melde('Das letzte Gewerk lässt sich nicht löschen.');
    return;
  }
  if (!window.confirm(`Gewerk "${name}" löschen?`)) return;
  await gewerkeSetzen(gewerke.filter((g) => g !== name));
  await nachher();
}
