// Bauhelfertagebuch.
//
// Zweck ist der Nachweis. Bei Streit mit einer Firma, bei einer Bauverzoegerung
// oder gegenueber der Bauhelferversicherung zaehlt, was am selben Tag notiert
// wurde. Deshalb ist das Datum Pflicht und je Tag nur ein Eintrag moeglich.
//
// Die Stunden stehen je Person und Tag, nicht als Tagessumme. Die
// Berufsgenossenschaft fragt nach den geleisteten Stunden der Helfer, und
// zwei Leute an einem Tag arbeiten selten gleich lang.

import {
  el, feld, auswahl, knopf, karte, kopfzeile, hinweisKasten,
  leerzustand, melde, datumLang, heute, zahl, zuZahl,
  anhaengen,
} from '../hilfen.js';
import { daten, einstellung, bildUrl, bildLoeschen } from '../daten.js';
import { blattOeffnen } from '../blatt.js';
import { fotofeld } from '../fotos.js';
import { Blatt, pdfTeilen, bildLaden } from '../pdf.js';
import { csvTeilen } from '../csv.js';
import { unterschriftAufnehmen } from '../unterschrift.js';

export const WETTER = {
  sonnig: 'Sonnig', bewoelkt: 'Bewölkt', regen: 'Regen',
  sturm: 'Sturm', schnee: 'Schnee', frost: 'Frost',
};

// Unter diesen Bedingungen ruhen Arbeiten regelmaessig. Das ist der Grund,
// warum das Wetter ueberhaupt im Tagebuch steht.
const WETTER_STOPP = ['regen', 'sturm', 'schnee', 'frost'];

// Vorbelegung fuer einen normalen Arbeitstag auf der Baustelle.
const REGELSTUNDEN = 8;

/**
 * Liefert die Helfer eines Eintrags einheitlich als [{id, stunden}].
 *
 * Aeltere Eintraege haben nur helferIds ohne Stunden. Die bleiben lesbar und
 * zaehlen mit null Stunden mit, damit eine alte Sicherung nichts verliert.
 */
export function helferVon(eintrag) {
  if (Array.isArray(eintrag.helfer)) {
    return eintrag.helfer.map((h) => ({
      id: h.id,
      stunden: Number(h.stunden) || 0,
      unterschriftId: h.unterschriftId || null,
    }));
  }
  return (eintrag.helferIds || []).map((id) => ({ id, stunden: 0, unterschriftId: null }));
}

/** Summiert die Stunden je Person ueber alle Tage. */
export function stundenJeHelfer(eintraege, kontakte) {
  const summe = new Map();
  for (const e of eintraege) {
    for (const { id, stunden } of helferVon(e)) {
      const bisher = summe.get(id) || { id, stunden: 0, tage: 0 };
      bisher.stunden += stunden;
      bisher.tage += 1;
      summe.set(id, bisher);
    }
  }
  return [...summe.values()]
    .map((s) => ({ ...s, name: (kontakte.find((k) => k.id === s.id) || {}).name || 'Unbekannt' }))
    .sort((a, b) => b.stunden - a.stunden || a.name.localeCompare(b.name, 'de'));
}

export async function zeige(rahmen) {
  await zeichne(rahmen);
}

async function zeichne(rahmen) {
  rahmen.replaceChildren();
  const [eintraege, kontakte] = await Promise.all([daten.alle('tagebuch'), daten.alle('kontakte')]);
  const helfer = kontakte.filter((k) => k.art === 'helfer');
  const neu = () => zeichne(rahmen);

  anhaengen(rahmen, kopfzeile('Bauhelfertagebuch', 'Täglich festhalten, wer da war und wie lange.'));

  if (!helfer.length && !eintraege.length) {
    anhaengen(
      rahmen,
      karte([
        leerzustand(
          'Lege zuerst deine Helfer an',
          'Wer regelmäßig auf der Baustelle mithilft, gehört in die Kontakte. ' +
            'Danach hakst du im Tageseintrag nur noch ab, wer da war, und trägst die Stunden ein.'
        ),
        knopf('Helfer anlegen', () => { location.hash = '#/kontakte'; }, 'knopf-haupt'),
        knopf('Ohne Helfer beginnen', () => eintragBearbeiten({ datum: heute() }, helfer, eintraege, neu)),
      ]),
      hinweisKasten(
        'Wichtig für die Bauhelferversicherung: Wer unentgeltlich mithilft, ist über die ' +
          'Berufsgenossenschaft der Bauwirtschaft versichert. Das Bauvorhaben muss dort ' +
          'angemeldet werden, und gefragt wird nach den geleisteten Helferstunden. ' +
          'Genau die summiert dieses Tagebuch.',
        'info'
      )
    );
    return;
  }

  const sortiert = [...eintraege].sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
  const jeHelfer = stundenJeHelfer(eintraege, kontakte);
  const gesamt = jeHelfer.reduce((s, h) => s + h.stunden, 0);

  anhaengen(
    rahmen,
    karte([
      el('h2', { text: 'Stand' }),
      el('p', {
        klasse: 'unterzeile',
        text: `${eintraege.length} ${eintraege.length === 1 ? 'Tageseintrag' : 'Tageseinträge'}, ` +
          `${zahl(gesamt, gesamt % 1 ? 1 : 0)} Helferstunden.` +
          (sortiert[0] ? ` Zuletzt ${datumLang(sortiert[0].datum)}.` : ''),
      }),
      knopf('Eintrag für heute', () => {
        const vorhanden = eintraege.find((e) => e.datum === heute());
        eintragBearbeiten(vorhanden || { datum: heute() }, helfer, eintraege, neu);
      }, 'knopf-haupt'),
    ])
  );

  if (jeHelfer.length) {
    anhaengen(
      rahmen,
      karte([
        el('h2', { text: 'Stunden je Helfer' }),
        el('ul', { klasse: 'liste' }, jeHelfer.map((h) =>
          el('li', {}, [
            el('div', { klasse: 'listenzeile', stil: { cursor: 'default' } }, [
              el('span', { klasse: 'zeilen-text' }, [
                el('span', { klasse: 'zeilen-titel', text: h.name }),
                el('span', {
                  klasse: 'zeilen-unter',
                  text: `an ${h.tage} ${h.tage === 1 ? 'Tag' : 'Tagen'}`,
                }),
              ]),
              el('span', {
                klasse: 'zeilen-wert',
                text: zahl(h.stunden, h.stunden % 1 ? 1 : 0) + ' h',
              }),
            ]),
          ])
        )),
        el('div', { klasse: 'wertzeile stark' }, [
          el('span', { text: 'Zusammen' }),
          el('strong', { text: zahl(gesamt, gesamt % 1 ? 1 : 0) + ' Stunden' }),
        ]),
        gesamt === 0
          ? hinweisKasten(
              'Noch keine Stunden erfasst. Trage sie beim jeweiligen Tag ein, dann steht ' +
                'die Summe für die Meldung an die Berufsgenossenschaft bereit.',
              'info'
            )
          : null,
      ])
    );
  }

  if (sortiert.length) {
    anhaengen(
      rahmen,
      karte([
        el('h2', { text: 'Einträge' }),
        el('ul', { klasse: 'liste' }, await Promise.all(sortiert.map(async (e) => {
          const url = e.bildIds && e.bildIds.length ? await bildUrl(e.bildIds[0]) : null;
          const drin = helferVon(e);
          const namen = drin
            .map(({ id, stunden }) => {
              const name = (kontakte.find((k) => k.id === id) || {}).name;
              if (!name) return null;
              return stunden ? `${name} (${zahl(stunden, stunden % 1 ? 1 : 0)} h)` : name;
            })
            .filter(Boolean);
          const tagesstunden = drin.reduce((s, h) => s + h.stunden, 0);
          return el('li', {}, [
            el('button', {
              klasse: 'listenzeile',
              onclick: () => eintragBearbeiten(e, helfer, eintraege, neu),
            }, [
              url ? el('img', { klasse: 'vorschau', src: url, alt: '' }) : el('span', { klasse: 'vorschau' }),
              el('span', { klasse: 'zeilen-text' }, [
                el('span', { klasse: 'zeilen-titel', text: datumLang(e.datum) }),
                el('span', {
                  klasse: 'zeilen-unter',
                  text: [
                    e.wetter ? WETTER[e.wetter] : null,
                    namen.length ? namen.join(', ') : 'niemand erfasst',
                    e.gemacht ? e.gemacht.slice(0, 40) : null,
                  ].filter(Boolean).join(' · '),
                }),
              ]),
              tagesstunden
                ? el('span', {
                    klasse: 'zeilen-wert',
                    text: zahl(tagesstunden, tagesstunden % 1 ? 1 : 0) + ' h',
                  })
                : null,
            ]),
          ]);
        }))),
      ]),
      el('div', { klasse: 'knopf-reihe' }, [
        knopf('Tagebuch als PDF teilen', () => pdfErzeugen(sortiert, kontakte)),
        knopf('Als CSV', () => csvErzeugen(sortiert, kontakte), 'knopf-leise'),
      ])
    );
  }

  anhaengen(rahmen, freigabekarte());
}

// ------------------------------------------------------- Oeffentliches Tagebuch

/**
 * Ein Verweis, unter dem Verwandte und Freunde den Baufortschritt mitlesen
 * koennen, ohne ein Konto zu brauchen.
 *
 * Nach aussen gehen nur Datum, Wetter, was gemacht wurde, und die Fotos.
 * Helfernamen, Helferstunden und das Feld "liegengeblieben" bleiben hier. Das
 * eine sind Daten anderer Leute, das andere ist Beweismaterial. Diese
 * Grenze ist fest verdrahtet und absichtlich nicht einstellbar.
 */
function freigabekarte() {
  const stand = el('p', { klasse: 'unterzeile', text: 'Wird geprüft …' });
  const knoepfe = el('div', { klasse: 'knopf-reihe' });
  const verweiszeile = el('p', { klasse: 'unterzeile', hidden: true });
  const zaehlerzeile = el('p', { klasse: 'unterzeile', hidden: true });

  const karteInhalt = karte([
    el('h2', { text: 'Öffentlich mitlesen lassen' }),
    el('p', {
      klasse: 'unterzeile',
      text:
        'Erzeugt einen Verweis, unter dem andere den Baufortschritt sehen können, ' +
        'ohne die App zu haben. Gezeigt werden Datum, Wetter, was gemacht wurde ' +
        'und die Fotos. Namen und Stunden der Helfer bleiben ausdrücklich hier, ' +
        'ebenso alles, was liegengeblieben ist.',
    }),
    stand,
    verweiszeile,
    zaehlerzeile,
    knoepfe,
  ]);

  // Wird im Anlauf unten gesetzt und danach von den Schaltflaechen benutzt.
  let konto = null;

  const zeigen = (frei, verweis, zahlen = null) => {
    knoepfe.replaceChildren();
    verweiszeile.hidden = !(frei && verweis);

    // Die Zahl steht nur, wenn die Seite offen ist. Ein Zaehler auf einer
    // abgeschalteten Seite waere eine Zahl ohne Gegenstand.
    zaehlerzeile.hidden = !(frei && zahlen);
    if (frei && zahlen) {
      const wie = zahlen.aufrufe === 1 ? 'Ein Aufruf' : zahlen.aufrufe + ' Aufrufe';
      zaehlerzeile.textContent = zahlen.aufrufe
        ? wie + (zahlen.zuletzt ? ', zuletzt ' + datumLang(String(zahlen.zuletzt).slice(0, 10)) : '') +
          '. Gezählt wird jeder Seitenaufruf, auch dein eigener.'
        : 'Noch kein Aufruf. Gezählt wird ab dem Tag, an dem du freigeschaltet hast.';
    }

    if (!frei) {
      stand.textContent = 'Das Tagebuch ist derzeit nicht öffentlich.';
      knoepfe.append(knopf('Öffentlich schalten', anschalten, 'knopf-haupt'));
      return;
    }

    stand.textContent = verweis
      ? 'Öffentlich. Es wird gezeigt, was zuletzt abgeglichen wurde.'
      : 'Öffentlich, aber der Verweis ist auf diesem Gerät nicht bekannt. ' +
        'Lege ihn neu an, dann gilt der alte nicht mehr.';

    if (verweis) {
      verweiszeile.replaceChildren(el('a', { href: verweis, target: '_blank', text: verweis }));
      knoepfe.append(knopf('Verweis kopieren', () => kopieren(verweis)));
    } else {
      knoepfe.append(knopf('Verweis neu anlegen', anschalten, 'knopf-haupt'));
    }
    knoepfe.append(knopf('Nicht mehr öffentlich', abschalten, 'knopf-warn'));
  };

  async function anschalten() {
    const vorgabe = (await einstellung('projektname')) || 'Unser Bautagebuch';
    const titel = window.prompt(
      'Überschrift der öffentlichen Seite:\n\n' +
      'Vermeide die genaue Adresse der Baustelle. Wer den Verweis hat, kann die Seite lesen.',
      vorgabe
    );
    if (titel === null) return;
    try {
      const antwort = await konto.freigabeAnlegen(titel.trim());
      melde('Öffentlich geschaltet.');
      zeigen(true, antwort.verweis, { aufrufe: 0, zuletzt: null });
      // Ohne Abgleich stünde die Seite leer da: Sie liest vom Server.
      const { abgleichen } = await import('../abgleich.js');
      await abgleichen(() => {}).catch(() => {});
    } catch (fehler) {
      stand.textContent = fehler.message;
    }
  }

  async function abschalten() {
    if (!window.confirm(
      'Der Verweis gilt danach nicht mehr. Wer ihn gespeichert hat, sieht nichts mehr.'
    )) return;
    try {
      await konto.freigabeAufheben();
      melde('Nicht mehr öffentlich.');
      zeigen(false, '');
    } catch (fehler) {
      stand.textContent = fehler.message;
    }
  }

  async function kopieren(verweis) {
    try {
      await navigator.clipboard.writeText(verweis);
      melde('Verweis kopiert.');
    } catch {
      // Ohne Zwischenablage bleibt der Verweis als Text stehen und lässt
      // sich von Hand markieren.
      melde('Kopieren ging nicht. Der Verweis steht oben zum Markieren.');
    }
  }

  (async () => {
    konto = await import('../konto.js');
    if (!konto.angemeldet()) {
      stand.textContent =
        'Dafür brauchst du ein Konto: Die öffentliche Seite liest die Einträge vom Server.';
      knoepfe.append(knopf('Zum Konto', () => { location.hash = '#/konto'; }));
      return;
    }
    try {
      const antwort = await konto.freigabeStand();
      zeigen(Boolean(antwort.frei), konto.freigabeLesen(), {
        aufrufe: Number(antwort.aufrufe) || 0,
        zuletzt: antwort.zuletzt || null,
      });
    } catch {
      stand.textContent = 'Der Stand ließ sich nicht abfragen. Ohne Netz ist das normal.';
    }
  })();

  return karteInhalt;
}

async function csvErzeugen(eintraege, kontakte) {
  try {
    await csvTeilen(
      ['Datum', 'Wetter', 'Temperatur', 'Helfer', 'Helferstunden am Tag',
        'Ausgeführt', 'Liegengeblieben', 'Fotos'],
      [...eintraege]
        .sort((a, b) => String(a.datum).localeCompare(String(b.datum)))
        .map((e) => {
          const drin = helferVon(e).map((h) => ({
            ...h, name: (kontakte.find((k) => k.id === h.id) || {}).name,
          })).filter((h) => h.name);
          return [
            e.datum || '',
            e.wetter ? WETTER[e.wetter] : '',
            e.temperatur || '',
            drin.map((h) => h.stunden ? `${h.name} (${h.stunden} h)` : h.name).join(', '),
            drin.reduce((s, h) => s + h.stunden, 0),
            e.gemacht || '',
            e.offen || '',
            (e.bildIds || []).length,
          ];
        }),
      'bautagebuch.csv',
      'Bautagebuch'
    );
  } catch (fehler) {
    melde('CSV konnte nicht geteilt werden.');
    console.error(fehler);
  }
}

function eintragBearbeiten(eintrag, helfer, alleEintraege, nachher) {
  const datum = el('input', { type: 'date', value: eintrag.datum || heute() });
  const wetter = auswahl(
    [['', '– keine Angabe –'], ...Object.entries(WETTER)],
    eintrag.wetter || ''
  );
  const temperatur = el('input', {
    type: 'text', inputmode: 'numeric',
    value: eintrag.temperatur ?? '', placeholder: 'z. B. 4',
  });
  const gemacht = el('textarea', {}, [eintrag.gemacht || '']);
  const offen = el('textarea', {}, [eintrag.offen || '']);

  const wetterstand = el('p', { klasse: 'unterzeile' });
  const wetterknopf = knopf('\u{1F326} Wetter zu diesem Tag holen', async () => {
    wetterknopf.disabled = true;
    wetterstand.textContent = 'Wird geholt …';
    try {
      const { einstellung } = await import('../daten.js');
      const ort = (await einstellung('baustelle')) || {};
      if (!ort.lat) {
        wetterstand.textContent = 'Erst den Ort der Baustelle in den Einstellungen bestimmen.';
        return;
      }
      const { wetterHolen, wetterHinweis } = await import('../wetter.js');
      const w = await wetterHolen(ort.lat, ort.lon, datum.value || heute());
      wetter.value = w.wetter;
      temperatur.value = String(w.temperatur);
      wetterstand.textContent =
        `${WETTER[w.wetter]}, ${w.min} bis ${w.max} °C, ${w.niederschlag} mm, ` +
        `Böen bis ${w.wind} km/h. Station ${w.station}.`;
      // Bei Wetter, das Arbeiten stoppt, den Grund gleich vorschlagen.
      const satz = wetterHinweis(w);
      if (satz && !offen.value.trim()) offen.value = satz;
    } catch (fehler) {
      wetterstand.textContent = fehler.message;
    } finally {
      wetterknopf.disabled = false;
    }
  });

  // Stand des Eintrags als Karte: id -> Stunden, nur fuer die Angehakten.
  const stand = new Map(helferVon(eintrag).map((h) => [h.id, h.stunden]));
  // Getrennt vom Stundenstand, damit das Anhaken unveraendert bleibt: Wer
  // abgehakt und wieder angehakt wird, verliert seine Unterschrift, und das
  // ist richtig so -- sie galt fuer die alten Stunden.
  const unterschriften = new Map(
    helferVon(eintrag).filter((h) => h.unterschriftId).map((h) => [h.id, h.unterschriftId])
  );

  const regel = el('input', {
    type: 'text', inputmode: 'decimal',
    value: String(REGELSTUNDEN), placeholder: String(REGELSTUNDEN),
  });

  const summenzeile = el('p', { klasse: 'unterzeile' });
  function summeZeigen() {
    const summe = [...stand.values()].reduce((s, w) => s + w, 0);
    summenzeile.textContent = stand.size
      ? `${stand.size} angehakt, zusammen ${zahl(summe, summe % 1 ? 1 : 0)} Stunden`
      : 'Niemand angehakt.';
  }

  const helferliste = helfer.length
    ? el('div', {}, helfer.map((k) => {
        const stundenfeld = el('input', {
          type: 'text', inputmode: 'decimal',
          stil: { width: '86px', minHeight: '44px', textAlign: 'right' },
          value: stand.has(k.id) ? String(stand.get(k.id)).replace('.', ',') : '',
          placeholder: 'h',
          disabled: !stand.has(k.id),
          oninput: () => {
            if (stand.has(k.id)) stand.set(k.id, zuZahl(stundenfeld.value));
            summeZeigen();
          },
        });

        const zeichnen = el('button', {
          type: 'button', klasse: 'knopf knopf-schmal',
          text: unterschriften.has(k.id) ? '\u2713 Unterschrieben' : 'Unterschrift',
          disabled: !stand.has(k.id),
          onclick: async () => {
            const id = await unterschriftAufnehmen(k.name);
            if (!id) return;
            unterschriften.set(k.id, id);
            zeichnen.textContent = '\u2713 Unterschrieben';
          },
        });

        const haken = el('input', {
          type: 'checkbox',
          checked: stand.has(k.id),
          onchange: (ereignis) => {
            zeichnen.disabled = !ereignis.target.checked;
            // Eine Unterschrift gilt fuer die Stunden, die daneben standen.
            // Wer ausgehakt wird, hat sie nicht mehr bestaetigt.
            if (!ereignis.target.checked) {
              unterschriften.delete(k.id);
              zeichnen.textContent = 'Unterschrift';
            }
            if (ereignis.target.checked) {
              // Wer angehakt wird, bekommt die Regelarbeitszeit des Tages;
              // abweichende Zeiten werden daneben ueberschrieben.
              const vorgabe = zuZahl(regel.value) || REGELSTUNDEN;
              stand.set(k.id, vorgabe);
              stundenfeld.value = String(vorgabe).replace('.', ',');
              stundenfeld.disabled = false;
            } else {
              stand.delete(k.id);
              stundenfeld.value = '';
              stundenfeld.disabled = true;
            }
            summeZeigen();
          },
        });

        return el('div', { klasse: 'helferzeile' }, [
          el('label', { klasse: 'helfername' }, [
            haken,
            el('span', { text: k.name }),
          ]),
          stundenfeld,
          zeichnen,
        ]);
      }))
    : el('p', { klasse: 'unterzeile', text: 'Noch keine Helfer in den Kontakten angelegt.' });

  summeZeigen();

  const bilder = [...(eintrag.bildIds || [])];
  const fotos = fotofeld(bilder, () => {}, { text: 'Foto vom Baufortschritt' });

  blattOeffnen(
    eintrag.id ? 'Eintrag bearbeiten' : 'Tageseintrag',
    [
      feld('Tag', datum),
      feld('Wetter', wetter, 'Wichtig als Beleg, wenn Arbeiten warten mussten.'),
      feld('Temperatur in °C', temperatur),
      wetterknopf,
      wetterstand,
      helfer.length
        ? feld('Regelarbeitszeit in Stunden', regel,
            'Wird beim Anhaken vorgeschlagen und lässt sich je Person überschreiben.')
        : null,
      el('span', { klasse: 'feld-name', text: 'Wer war da, und wie lange?' }),
      helferliste,
      summenzeile,
      feld('Was wurde gemacht?', gemacht),
      feld('Was ist liegengeblieben?', offen),
      el('span', { klasse: 'feld-name', text: 'Fotos' }),
      fotos,
    ].filter(Boolean),
    async () => {
      const tag = datum.value || heute();
      const doppelt = alleEintraege.find((e) => e.datum === tag && e.id !== eintrag.id);
      if (doppelt) throw new Error('Für diesen Tag gibt es schon einen Eintrag.');

      const helferstand = [...stand.entries()].map(([id, stunden]) => ({
        id, stunden, unterschriftId: unterschriften.get(id) || null,
      }));
      if (helferstand.some((h) => h.stunden < 0 || h.stunden > 24)) {
        throw new Error('Die Stunden je Person müssen zwischen 0 und 24 liegen.');
      }

      const wert = {
        datum: tag,
        wetter: wetter.value || null,
        temperatur: temperatur.value.trim() || null,
        helfer: helferstand,
        // Bleibt als einfache Liste erhalten: aeltere Sicherungen und alles,
        // was nur wissen will, wer da war, kommen damit weiter aus.
        helferIds: helferstand.map((h) => h.id),
        gemacht: gemacht.value.trim(),
        offen: offen.value.trim(),
        bildIds: bilder,
      };
      if (!wert.gemacht && !wert.helfer.length && !bilder.length) {
        throw new Error('Bitte wenigstens eintragen, was gemacht wurde.');
      }
      if (eintrag.id) wert.id = eintrag.id;
      await daten.sichern('tagebuch', wert);

      if (WETTER_STOPP.includes(wert.wetter) && !wert.offen) {
        melde('Tipp: Bei diesem Wetter gehört ins Feld „liegengeblieben“, was deshalb wartet.');
      }
      await nachher();
    },
    {
      loeschen: eintrag.id
        ? async () => {
            for (const bildId of eintrag.bildIds || []) await bildLoeschen(bildId);
            await daten.loeschen('tagebuch', eintrag.id);
            await nachher();
          }
        : null,
    }
  );
}

async function pdfErzeugen(eintraege, kontakte) {
  melde('PDF wird erstellt …');
  const projekt = (await einstellung('projektname')) || '';
  const blatt = new Blatt({
    titel: 'Bauhelfertagebuch',
    untertitel: (projekt ? projekt + ' · ' : '') + 'Stand ' + datumLang(heute()),
    fusszeile: 'Bauhelfertagebuch',
  });

  // Aelteste zuerst: ein Nachweis liest sich chronologisch.
  const chronologisch = [...eintraege].sort((a, b) => String(a.datum).localeCompare(String(b.datum)));

  // Fotos vorab laden; der Schreiber braucht die Maße für den Seitenumbruch.
  const fotos = new Map();
  for (const e of chronologisch) {
    const geladen = [];
    for (const bildId of e.bildIds || []) {
      const eintrag = await daten.holen('bilder', bildId);
      const bild = eintrag ? await bildLaden(eintrag.blob) : null;
      if (bild) geladen.push(bild);
    }
    fotos.set(e.id, geladen);
  }

  // Die Unterschriften einmal einlesen. Sie sind kleine PNG-Dateien und
  // gehen denselben Weg ins PDF wie die Fotos.
  const unterschriften = new Map();
  for (const e of chronologisch) {
    for (const h of helferVon(e)) {
      if (!h.unterschriftId || unterschriften.has(h.unterschriftId)) continue;
      const eintrag = await daten.holen('bilder', h.unterschriftId);
      const bild = eintrag ? await bildLaden(eintrag.blob) : null;
      if (bild) unterschriften.set(h.unterschriftId, bild);
    }
  }

  const jeHelfer = stundenJeHelfer(chronologisch, kontakte);
  const gesamt = jeHelfer.reduce((s, h) => s + h.stunden, 0);
  const zeitraum = chronologisch.length
    ? datumLang(chronologisch[0].datum) + ' bis ' + datumLang(chronologisch[chronologisch.length - 1].datum)
    : '';

  blatt.absatz(
    `${chronologisch.length} Tage dokumentiert, ${zeitraum}. ` +
    `Insgesamt ${zahl(gesamt, gesamt % 1 ? 1 : 0)} Helferstunden. ` +
    'Die Fotos stehen bei dem Tag, an dem sie aufgenommen wurden.'
  );

  if (jeHelfer.length) {
    blatt.ueberschrift('Stunden je Helfer');
    blatt.tabelle(
      ['Name', 'Tage', 'Stunden'],
      jeHelfer.map((h) => [h.name, String(h.tage), zahl(h.stunden, h.stunden % 1 ? 1 : 0)]),
      [3, 1, 1.2],
      [1, 2]
    );
    blatt.wertzeile('Zusammen', zahl(gesamt, gesamt % 1 ? 1 : 0) + ' Stunden', true);
    blatt.absatz(
      'Diese Aufstellung ist für die Meldung an die Berufsgenossenschaft der ' +
      'Bauwirtschaft gedacht. Maßgeblich ist, was dort abgefragt wird; ' +
      'die Zahlen stammen aus den Tageseinträgen dieses Tagebuchs.',
      9
    );
  }

  blatt.ueberschrift('Tageseinträge');

  for (const e of chronologisch) {
    const drin = helferVon(e).map((h) => ({
      ...h,
      name: (kontakte.find((k) => k.id === h.id) || {}).name,
    })).filter((h) => h.name);
    const tagesstunden = drin.reduce((s, h) => s + h.stunden, 0);

    blatt.ueberschrift(datumLang(e.datum));
    blatt.wertzeile(
      'Wetter',
      [e.wetter ? WETTER[e.wetter] : 'keine Angabe', e.temperatur ? e.temperatur + ' °C' : null]
        .filter(Boolean).join(', ')
    );
    blatt.wertzeile(
      'Anwesend',
      drin.length
        ? drin.map((h) => h.stunden ? `${h.name} (${zahl(h.stunden, h.stunden % 1 ? 1 : 0)} h)` : h.name).join(', ')
        : 'keine Helfer erfasst'
    );
    if (tagesstunden) {
      blatt.wertzeile('Helferstunden am Tag', zahl(tagesstunden, tagesstunden % 1 ? 1 : 0), true);
    }
    // Der eigentliche Zweck des Tagebuchs: Was der Bauherr allein
    // aufgeschrieben hat, ist seine Behauptung. Was der Helfer am selben Tag
    // unterschrieben hat, ist ein Beleg.
    const unterschrieben = drin.filter((h) => h.unterschriftId);
    if (unterschrieben.length) {
      blatt.absatz(
        'Die eingetragenen Stunden wurden am selben Tag bestätigt:', 9.5
      );
      for (const h of unterschrieben) {
        blatt.wertzeile(h.name, zahl(h.stunden, h.stunden % 1 ? 1 : 0) + ' Stunden');
        const bild = unterschriften.get(h.unterschriftId);
        if (bild) blatt.bilderreihe([bild], { hoehe: 44 });
      }
    }

    if (e.gemacht) blatt.absatz('Ausgeführt: ' + e.gemacht, 9.5);
    if (e.offen) blatt.absatz('Liegengeblieben: ' + e.offen, 9.5);

    const bilder = fotos.get(e.id) || [];
    if (bilder.length) blatt.bilderreihe(bilder, { hoehe: 108 });
  }

  try {
    await pdfTeilen(blatt.blob(), 'bauhelfertagebuch.pdf', 'Bauhelfertagebuch');
  } catch (fehler) {
    melde('PDF konnte nicht geteilt werden.');
    console.error(fehler);
  }
}
