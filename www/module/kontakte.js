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
  wertzeile, hinweisKasten, melde, kontaktName, datumLang,
  anhaengen, kartengitter,
  geheZu,
  erreichbar,
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
  // Was weder Sicht noch leer ist, ist die Kennung eines Kontakts: So
  // laesst sich ein einzelner Eintrag verlinken, aus dem Mangel heraus
  // oder aus der Position.
  if (ansicht && ansicht !== 'firmen' && ansicht !== 'personen') {
    return zeigeKontakt(rahmen, ansicht);
  }
  return zeigePersonen(rahmen, ansicht === 'personen' ? 'helfer' : 'firma', neu);
}

// -------------------------------------------------- Firmen und Privatpersonen

async function zeigePersonen(rahmen, art, neu) {
  const alle = await daten.alle('kontakte');
  const was = ARTEN[art];

  const drin = alle
    .filter((k) => (k.art || 'firma') === art)
    .sort((a, b) => kontaktName(a).localeCompare(kontaktName(b), 'de'));

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
          el('button', {
            klasse: 'listenzeile',
            onclick: () => { geheZu('#/kontakte/' + k.id); },
          }, [
            el('span', { klasse: 'zeilenzeichen' }, [zeichen(kontaktZeichen(k))]),
            el('span', { klasse: 'zeilen-text' }, [
              el('span', { klasse: 'zeilen-titel', text: kontaktName(k) }),
              el('span', {
                klasse: 'zeilen-unter',
                // Steht die Firma schon in der Ueberschrift, waere sie hier
                // dieselbe Zeile zweimal.
                text: [k.name ? k.firma : null, k.gewerk, k.telefon]
                  .filter(Boolean).join(' · ') || 'ohne weitere Angaben',
              }),
            ]),
            /* tel: und mailto: oeffnen im WebView die Telefon- oder
               Mail-App. stopPropagation, weil die ganze Zeile auf die
               Einzelseite fuehrt -- ohne das waere der Anruf ein Umweg
               dorthin.

               In einem eigenen Behaelter, der umbrechen darf: Zwei Marken
               nebeneinander passen auf einem 360 Pixel breiten Telefon nicht
               neben einen langen Firmennamen. */
            (k.telefon || k.epost)
              ? el('span', { klasse: 'zeilen-marken' }, [
                  k.telefon
                    ? el('a', {
                        klasse: 'marke', href: 'tel:' + k.telefon.replace(/[\s/]/g, ''),
                        onclick: (ereignis) => ereignis.stopPropagation(),
                      }, ['Anrufen'])
                    : null,
                  k.epost
                    ? el('a', {
                        klasse: 'marke', href: 'mailto:' + k.epost,
                        onclick: (ereignis) => ereignis.stopPropagation(),
                      }, ['E-Mail schreiben'])
                    : null,
                ])
              : null,
          ]),
        ])
      )),
    ]),
    knopf(was.knopf, () => bearbeiten({ art }, neu), 'knopf-haupt'),
    knopf('Alle Adressen als PDF', () => adressenPdf(alle), 'knopf-leise')
  );
}

// -------------------------------------------------------------- Einzelseite

/**
 * Ein Kontakt mit allem, was an ihm haengt.
 *
 * Der Sinn ist der Anruf mit Rueckfrage: "Was hatten wir mit denen noch
 * offen?" Dafuer muss an einer Stelle stehen, welche Positionen, Angebote,
 * Rechnungen, Maengel, Arbeitsschritte und Dokumente auf diese Firma zeigen.
 */
async function zeigeKontakt(rahmen, kennung) {
  const [alle, posten, angebote, belege, maengel, aufgaben, dokumente] = await Promise.all([
    daten.alle('kontakte'), daten.alle('posten'), daten.alle('angebote'),
    daten.alle('belege'), daten.alle('maengel'), daten.alle('aufgaben'),
    daten.alle('dokumente'),
  ]);
  const k = alle.find((x) => x.id === kennung);
  if (!k) {
    anhaengen(rahmen, kopfzeile('Kontakt', 'Diesen Eintrag gibt es nicht mehr.'),
      knopf('Zur Liste', () => { geheZu('#/kontakte'); }, 'knopf-haupt'));
    return;
  }
  const neu = () => { rahmen.replaceChildren(); return zeigeKontakt(rahmen, kennung); };
  const istFirma = (k.art || 'firma') === 'firma';

  anhaengen(
    rahmen,
    kopfzeile(kontaktName(k), [
      istFirma ? 'Firma' : 'Privatperson',
      k.name && k.firma && k.firma !== k.name ? k.firma : null,
      k.gewerk || null,
    ].filter(Boolean).join(' · ')),
    karte([
      el('h2', { text: 'Anschrift und Erreichbarkeit' }),
      k.strasse ? wertzeile('Straße', k.strasse) : null,
      k.plzOrt ? wertzeile('PLZ und Ort', k.plzOrt) : null,
      k.telefon ? wertzeile('Telefon', erreichbar('tel', k.telefon)) : null,
      k.epost ? wertzeile('E-Mail', erreichbar('mail', k.epost)) : null,
      k.notiz ? el('p', { klasse: 'unterzeile', text: k.notiz }) : null,
      !k.strasse && !k.telefon && !k.epost
        ? el('p', { klasse: 'unterzeile', text: 'Noch keine Erreichbarkeit erfasst.' })
        : null,
      el('div', { klasse: 'knopf-reihe' }, [
        k.telefon
          ? el('a', {
              klasse: 'knopf', href: 'tel:' + k.telefon.replace(/[\s/]/g, ''),
            }, ['Anrufen'])
          : null,
        k.epost
          ? el('a', { klasse: 'knopf', href: 'mailto:' + k.epost }, ['E-Mail schreiben'])
          : null,
      ]),
      knopf('Bearbeiten', () => bearbeiten(k, neu), 'knopf-haupt'),
    ])
  );

  // Ansprechpartner: Personen, die auf diese Firma zeigen.
  if (istFirma) {
    const leute = alle.filter((x) => x.firmaId === k.id);
    anhaengen(
      rahmen,
      karte([
        el('h2', { text: `Ansprechpartner (${leute.length})` }),
        leute.length
          ? el('ul', { klasse: 'liste' }, leute.map((x) =>
              el('li', {}, [
                el('button', {
                  klasse: 'listenzeile', onclick: () => { geheZu('#/kontakte/' + x.id); },
                }, [
                  el('span', { klasse: 'zeilenzeichen' }, [zeichen('person')]),
                  el('span', { klasse: 'zeilen-text' }, [
                    el('span', { klasse: 'zeilen-titel', text: kontaktName(x) }),
                    el('span', {
                      klasse: 'zeilen-unter',
                      text: [x.gewerk, x.telefon, x.epost].filter(Boolean).join(' · ') ||
                        'ohne weitere Angaben',
                    }),
                  ]),
                ]),
              ])
            ))
          : el('p', {
              klasse: 'unterzeile',
              text: 'Bauleiter, Poliere, Sachbearbeiter: Wer bei dieser Firma für dich ' +
                'zuständig ist, gehört hierher.',
            }),
        knopf('Ansprechpartner anlegen', () => bearbeiten({ art: 'firma', firmaId: k.id }, neu)),
      ])
    );
  }

  // Was auf diesen Kontakt zeigt.
  const angebotName = (a) => a.firma || 'Angebot';
  const bereiche = [
    { titel: 'Positionen', ziel: '#/baukasse/kosten',
      saetze: posten.filter((p) => p.kontaktId === k.id)
        .map((p) => ({ titel: p.name, unter: [p.gewerk, p.kostengruppe].filter(Boolean).join(' · ') })) },
    { titel: 'Angebote', ziel: '#/angebote',
      saetze: angebote.filter((a) => a.kontaktId === k.id)
        .map((a) => ({ titel: angebotName(a), unter: a.datum ? datumLang(a.datum) : '' })) },
    { titel: 'Rechnungen', ziel: '#/baukasse/rechnungen',
      saetze: belege.filter((b) => b.kontaktId === k.id)
        .map((b) => ({ titel: b.name || 'Rechnung', unter: b.datum ? datumLang(b.datum) : '' })) },
    { titel: 'Mängel', ziel: '#/maengel',
      saetze: maengel.filter((m) => m.kontaktId === k.id)
        .map((m) => ({ titel: m.titel, unter: [m.raum, m.gewerk].filter(Boolean).join(' · ') })) },
    { titel: 'Arbeitsschritte', ziel: '#/ablauf',
      saetze: aufgaben.filter((a) => a.kontaktId === k.id)
        .map((a) => ({ titel: a.titel, unter: a.phase || '' })) },
    { titel: 'Dokumente', ziel: '#/dokumente',
      saetze: dokumente.filter((d) => d.kontaktId === k.id)
        .map((d) => ({ titel: d.titel || d.name || 'Dokument', unter: d.art || '' })) },
  ].filter((b) => b.saetze.length);

  anhaengen(
    rahmen,
    bereiche.length
      ? kartengitter(bereiche.map((b) => karte([
          el('h2', { text: `${b.titel} (${b.saetze.length})` }),
          el('ul', { klasse: 'liste' }, b.saetze.slice(0, 8).map((s) =>
            el('li', {}, [
              el('div', { klasse: 'listenzeile', stil: { cursor: 'default' } }, [
                el('span', { klasse: 'zeilen-text' }, [
                  el('span', { klasse: 'zeilen-titel', text: s.titel }),
                  s.unter ? el('span', { klasse: 'zeilen-unter', text: s.unter }) : null,
                ]),
              ]),
            ])
          )),
          b.saetze.length > 8
            ? el('p', { klasse: 'unterzeile', text: `und ${b.saetze.length - 8} weitere` })
            : null,
          knopf('Dorthin', () => { geheZu(b.ziel); }, 'knopf-leise'),
        ])))
      : karte([
          el('h2', { text: 'Verknüpfungen' }),
          el('p', {
            klasse: 'unterzeile',
            text: 'Noch nichts zugeordnet. Sobald du bei einer Position, einem Mangel ' +
              'oder einer Rechnung diese Firma auswählst, steht sie hier.',
          }),
        ]),
    knopf('Zurück zur Liste', () => {
      geheZu(istFirma ? '#/kontakte' : '#/kontakte/personen');
    })
  );
}

/** Das Adressbuch auf Papier: fuer die Bauakte und den Ordner im Auto. */
async function adressenPdf(alle) {
  const { Blatt, pdfTeilen } = await import('../pdf.js');
  const { einstellung } = await import('../daten.js');
  const projekt = (await einstellung('projektname')) || '';
  const blatt = new Blatt({ titel: 'Adressen', untertitel: projekt, fusszeile: 'Adressen' });

  for (const [art, ueberschrift] of [['firma', 'Firmen'], ['helfer', 'Privatpersonen']]) {
    const drin = alle
      .filter((k) => (k.art || 'firma') === art)
      .sort((a, b) => kontaktName(a).localeCompare(kontaktName(b), 'de'));
    if (!drin.length) continue;
    blatt.ueberschrift(`${ueberschrift} (${drin.length})`);
    blatt.tabelle(
      ['Name', 'Gewerk', 'Anschrift', 'Telefon', 'E-Mail'],
      drin.map((k) => [
        [kontaktName(k), k.name && k.firma && k.firma !== k.name ? k.firma : null]
          .filter(Boolean).join(', '),
        k.gewerk || '',
        [k.strasse, k.plzOrt].filter(Boolean).join(', '),
        k.telefon || '',
        k.epost || '',
      ]),
      [2.2, 1.2, 2.2, 1.3, 2]
    );
  }

  try {
    await pdfTeilen(blatt.blob(), 'adressen.pdf', 'Adressen');
  } catch (fehler) {
    melde('PDF konnte nicht geteilt werden.');
    console.error(fehler);
  }
}

async function bearbeiten(kontakt, nachher) {
  const gewerke = await gewerkeListe();
  const art = auswahl(
    [['firma', 'Firma'], ['helfer', 'Privatperson']], kontakt.art || 'firma'
  );
  const alleKontakte = await daten.alle('kontakte');
  // Nur Firmen kommen als Zugehoerigkeit in Frage, und ein Satz kann nicht
  // sein eigener Ansprechpartner sein.
  const firmen = alleKontakte
    .filter((x) => (x.art || 'firma') === 'firma' && x.id !== kontakt.id)
    .sort((a, b) => kontaktName(a).localeCompare(kontaktName(b), 'de'));
  const gehoertZu = auswahl(
    [['', '– eigenständig –'], ...firmen.map((x) => [x.id, kontaktName(x)])],
    kontakt.firmaId || ''
  );
  const name = eingabe({ value: kontakt.name || '', placeholder: 'Vor- und Nachname' });
  const firma = eingabe({ value: kontakt.firma || '', placeholder: 'z. B. Elektro Meier GmbH' });
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

  // Die Art steht beim Anlegen schon fest: Man kommt aus der Liste der
  // Firmen oder aus der der Privatpersonen und hat sie damit gewaehlt. Nur
  // beim Bearbeiten bleibt sie sichtbar -- ein falsch abgelegter Kontakt
  // waere sonst nicht mehr zu verschieben.
  const artName = (kontakt.art || 'firma') === 'helfer' ? 'Privatperson' : 'Firma';

  blattOeffnen(
    kontakt.id ? artName + ' bearbeiten' : artName + ' anlegen',
    [
      kontakt.id ? feld('Art', art) : null,
      feld('Name', name, 'Name oder Firma genügt.'),
      feld('Firma', firma),
      // Nur bei Firmen: Ein Bauhelfer gehoert nicht zu einer Firma, sonst
      // waere er keine Privatperson.
      firmen.length && (kontakt.art || 'firma') === 'firma'
        ? feld('Gehört zu', gehoertZu,
            'Für Ansprechpartner: Bauleiter, Polier, Sachbearbeiter einer Firma.')
        : null,
      feld('Gewerk', gewerk),
      feld('Straße und Hausnummer', strasse),
      feld('PLZ und Ort', plzOrt),
      feld('Telefon', telefon),
      feld('E-Mail', epost),
      feld('Notiz', notiz),
    ].filter(Boolean),
    async () => {
      const wert = {
        art: art.value,
        name: name.value.trim(),
        firma: firma.value.trim(),
        firmaId: gehoertZu.value || null,
        gewerk: gewerk.value,
        strasse: strasse.value.trim(),
        plzOrt: plzOrt.value.trim(),
        telefon: telefon.value.trim(),
        epost: epost.value.trim(),
        notiz: notiz.value.trim(),
      };
      // Eine Firma hat oft keinen Ansprechpartner, eine Privatperson keine
      // Firma. Pflicht ist deshalb nur, dass ueberhaupt etwas dasteht.
      if (!wert.name && !wert.firma) {
        throw new Error('Bitte einen Namen oder eine Firma eintragen.');
      }
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
      // Kacheln statt Zeilenband: Fuenfzehn kurze Namen mit je zwei
      // Knoepfen ziehen sich sonst ueber die ganze Breite, mit einem Loch in
      // der Mitte.
      el('div', { klasse: 'gewerkegitter' }, gewerke.map((g) => {
        const wo = verwendung.get(g);
        return el('div', { klasse: 'gewerkekachel' }, [
          el('div', { klasse: 'gewerkekopf' }, [
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
          ]),
          el('div', { klasse: 'gewerkeknoepfe' }, [
            el('button', {
              klasse: 'knopf knopf-schmal', type: 'button', text: 'Umbenennen',
              onclick: () => umbenennen(g, gewerke, neu),
            }),
            el('button', {
              klasse: 'knopf knopf-schmal', type: 'button', text: 'Löschen',
              onclick: () => loeschen(g, wo, gewerke, neu),
            }),
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
