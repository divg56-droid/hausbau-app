// Anschlussplan: Grundriss als Karte, darauf Pins fuer alles, was spaeter
// hinter dem Putz verschwindet.
//
// Die Pin-Position wird relativ gespeichert (0 bis 1 der Bildbreite und
// -hoehe). Dadurch sitzt sie auf jedem Bildschirm richtig, egal wie breit
// der Grundriss gerade dargestellt wird.

import {
  el, feld, eingabe, zahlfeld, auswahl, knopf, karte, kopfzeile,
  hinweisKasten, leerzustand, zuZahl, melde, datumLang, heute,
} from '../hilfen.js';
import { daten, einstellung, bildUrl, bildAblegen, bildLoeschen } from '../daten.js';
import { Blatt, pdfTeilen, bildLaden } from '../pdf.js';
import { blattOeffnen } from '../blatt.js';
import { fotofeld, dateiWaehlen } from '../fotos.js';

// Farbe und Zeichen je Art, damit sich der Plan ohne Beschriftung lesen laesst.
export const PIN_ARTEN = {
  steckdose:  { name: 'Steckdose',      zeichen: '\u{1F50C}', farbe: '#e8a020' },
  schalter:   { name: 'Lichtschalter',  zeichen: '\u{1F4A1}', farbe: '#d97706' },
  leuchte:    { name: 'Leuchtenauslass', zeichen: '\u{2600}', farbe: '#ca8a04' },
  netzwerk:   { name: 'Netzwerk/Antenne', zeichen: '\u{1F4F6}', farbe: '#7c3aed' },
  wasser:     { name: 'Wasseranschluss', zeichen: '\u{1F6BF}', farbe: '#2563eb' },
  abfluss:    { name: 'Abfluss',        zeichen: '\u{1F30A}', farbe: '#0891b2' },
  heizung:    { name: 'Heizkörper',     zeichen: '\u{1F525}', farbe: '#dc2626' },
  leerrohr:   { name: 'Leerrohr',       zeichen: '\u{27B0}', farbe: '#4b5563' },
  sonstiges:  { name: 'Sonstiges',      zeichen: '\u{1F4CC}', farbe: '#2e7d4f' },
};

export async function zeige(rahmen) {
  await zeichne(rahmen);
}

async function zeichne(rahmen, gewaehltesGeschoss = null) {
  rahmen.replaceChildren();
  const geschosse = (await daten.alle('geschosse')).sort(
    (a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0)
  );

  rahmen.append(kopfzeile('Anschlussplan', 'Grundriss hochladen, Anschlüsse markieren.'));

  if (!geschosse.length) {
    rahmen.append(
      karte([
        leerzustand(
          'Lade zuerst einen Grundriss',
          'Foto oder PDF-Seite eines Geschosses genügt, auch eine saubere Handskizze. ' +
            'Danach markierst du Steckdosen, Schalter und Anschlüsse mit Position, Höhe und Foto.'
        ),
        dateiWaehlen(
          'Grundriss hochladen',
          (datei) => geschossAnlegen(datei, 0, (id) => zeichne(rahmen, id)),
          'image/*'
        ),
      ]),
      hinweisKasten(
        'Warum das lohnt: Bei der nächsten Renovierung weißt du, wo Leitungen und ' +
          'Anschlüsse sitzen. Das spart Aufstemmen und Suchen.',
        'info'
      )
    );
    return;
  }

  const aktuell = geschosse.find((g) => g.id === gewaehltesGeschoss) || geschosse[0];
  const pins = await daten.nach('pins', 'geschossId', aktuell.id);
  const neu = (id) => zeichne(rahmen, id ?? aktuell.id);

  // Geschossleiste
  rahmen.append(
    el('div', { klasse: 'geschossleiste' }, [
      ...geschosse.map((g) =>
        el('button', {
          type: 'button',
          klasse: g.id === aktuell.id ? 'aktiv' : null,
          text: g.name,
          onclick: () => zeichne(rahmen, g.id),
        })
      ),
      el('button', { type: 'button', text: '+', 'aria-label': 'Geschoss hinzufügen', onclick: () => geschossHinzufuegen(geschosse.length, neu) }),
    ])
  );

  // Plan
  const url = await bildUrl(aktuell.bildId);
  const flaeche = el('div', { klasse: 'planflaeche' });
  let setzenAktiv = false;

  if (url) {
    const bild = el('img', { src: url, alt: 'Grundriss ' + aktuell.name });
    flaeche.append(bild);

    flaeche.addEventListener('click', (ereignis) => {
      if (!setzenAktiv) return;
      const masse = bild.getBoundingClientRect();
      const x = (ereignis.clientX - masse.left) / masse.width;
      const y = (ereignis.clientY - masse.top) / masse.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      setzenAktiv = false;
      setzenKnopf.textContent = '\u{1F4CD} Anschluss markieren';
      setzenKnopf.className = 'knopf';
      pinBearbeiten({ geschossId: aktuell.id, x, y }, neu);
    });

    for (const pin of pins) {
      const art = PIN_ARTEN[pin.art] || PIN_ARTEN.sonstiges;
      flaeche.append(
        el(
          'button',
          {
            type: 'button',
            klasse: 'pin',
            title: art.name + (pin.notiz ? ': ' + pin.notiz : ''),
            'aria-label': art.name + (pin.notiz ? ': ' + pin.notiz : ''),
            stil: {
              left: (pin.x * 100).toFixed(2) + '%',
              top: (pin.y * 100).toFixed(2) + '%',
              background: art.farbe,
            },
            onclick: (ereignis) => {
              ereignis.stopPropagation();
              pinBearbeiten(pin, neu);
            },
          },
          [el('span', { text: art.zeichen })]
        )
      );
    }
  }

  const setzenKnopf = knopf('\u{1F4CD} Anschluss markieren', () => {
    setzenAktiv = !setzenAktiv;
    setzenKnopf.textContent = setzenAktiv ? 'Tippe auf die Stelle im Plan' : '\u{1F4CD} Anschluss markieren';
    setzenKnopf.className = setzenAktiv ? 'knopf-haupt' : 'knopf';
  });

  rahmen.append(
    karte([
      flaeche,
      el('p', { klasse: 'unterzeile', stil: { margin: '10px 0 0' }, text: `${pins.length} Markierungen in ${aktuell.name}` }),
    ]),
    setzenKnopf
  );

  // Liste der Pins, damit man sie auch ohne Zielen findet
  if (pins.length) {
    rahmen.append(
      karte([
        el('h2', { text: 'Markierungen in ' + aktuell.name }),
        el('ul', { klasse: 'liste' }, pins.map((pin) => {
          const art = PIN_ARTEN[pin.art] || PIN_ARTEN.sonstiges;
          return el('li', {}, [
            el('button', { klasse: 'listenzeile', onclick: () => pinBearbeiten(pin, neu) }, [
              el('span', {
                klasse: 'vorschau',
                stil: {
                  background: art.farbe, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '20px',
                },
                text: art.zeichen,
              }),
              el('span', { klasse: 'zeilen-text' }, [
                el('span', { klasse: 'zeilen-titel', text: art.name }),
                el('span', {
                  klasse: 'zeilen-unter',
                  text: [pin.hoehe ? pin.hoehe + ' cm über OKFF' : null, pin.notiz]
                    .filter(Boolean).join(' · ') || 'ohne Angabe',
                }),
              ]),
            ]),
          ]);
        })),
      ])
    );
  }

  rahmen.append(
    knopf('Alle Geschosse als PDF teilen', () => pdfErzeugen(geschosse)),
    karte([
      el('h2', { text: 'Geschoss ' + aktuell.name }),
      el('div', { klasse: 'knopf-reihe' }, [
        knopf('Umbenennen', () => geschossUmbenennen(aktuell, neu)),
        knopf('Löschen', async () => {
          if (!window.confirm(`"${aktuell.name}" mit allen Markierungen löschen?`)) return;
          const zuWeg = await daten.nach('pins', 'geschossId', aktuell.id);
          for (const p of zuWeg) {
            if (p.bildId) await bildLoeschen(p.bildId);
            await daten.loeschen('pins', p.id);
          }
          if (aktuell.bildId) await bildLoeschen(aktuell.bildId);
          await daten.loeschen('geschosse', aktuell.id);
          await zeichne(rahmen, null);
        }, 'knopf-warn'),
      ]),
    ])
  );
}

// ---------------------------------------------------------------- Geschosse

async function geschossAnlegen(datei, reihenfolge, nachher) {
  const bildId = await bildAblegen(datei);
  const name = window.prompt('Name des Geschosses', vorschlagName(reihenfolge)) || vorschlagName(reihenfolge);
  const id = await daten.sichern('geschosse', { name: name.trim(), bildId, reihenfolge });
  await nachher(id);
}

function vorschlagName(reihenfolge) {
  return ['Erdgeschoss', 'Obergeschoss', 'Keller', 'Dachgeschoss'][reihenfolge] || 'Geschoss ' + (reihenfolge + 1);
}

function geschossHinzufuegen(reihenfolge, nachher) {
  const dateifeld = el('input', { type: 'file', accept: 'image/*', klasse: 'versteckt' });
  dateifeld.addEventListener('change', async () => {
    const datei = dateifeld.files[0];
    if (datei) await geschossAnlegen(datei, reihenfolge, nachher);
    dateifeld.remove();
  });
  document.body.append(dateifeld);
  dateifeld.click();
}

function geschossUmbenennen(geschoss, nachher) {
  const name = eingabe({ value: geschoss.name });
  blattOeffnen('Geschoss umbenennen', [feld('Name', name)], async () => {
    const wert = name.value.trim();
    if (!wert) throw new Error('Bitte einen Namen eintragen.');
    await daten.sichern('geschosse', { ...geschoss, name: wert });
    await nachher(geschoss.id);
  });
}

// --------------------------------------------------------------------- Pins

function pinBearbeiten(pin, nachher) {
  const art = auswahl(
    Object.entries(PIN_ARTEN).map(([schluessel, a]) => [schluessel, a.name]),
    pin.art || 'steckdose'
  );
  const hoehe = zahlfeld({ value: pin.hoehe ? String(pin.hoehe) : '', placeholder: 'z. B. 30' });
  const notiz = eingabe({ value: pin.notiz || '', placeholder: 'z. B. Doppelsteckdose hinter Sideboard' });

  const bilder = pin.bildId ? [pin.bildId] : [];
  const fotos = fotofeld(bilder, () => {}, { text: 'Foto vom Anschluss', mehrere: false });

  blattOeffnen(
    pin.id ? 'Markierung bearbeiten' : 'Markierung anlegen',
    [
      feld('Art', art),
      feld('Höhe in cm über Fertigfußboden', hoehe, 'Steckdosen meist 30 cm, Schalter 105 cm.'),
      feld('Notiz', notiz),
      el('span', { klasse: 'feld-name', text: 'Foto' }),
      fotos,
    ],
    async () => {
      const wert = {
        geschossId: pin.geschossId,
        x: pin.x, y: pin.y,
        art: art.value,
        hoehe: hoehe.value.trim() ? Math.round(zuZahl(hoehe.value)) : null,
        notiz: notiz.value.trim(),
        bildId: bilder[0] ?? null,
      };
      if (pin.id) wert.id = pin.id;
      await daten.sichern('pins', wert);
      melde(pin.id ? 'Gespeichert.' : 'Markierung gesetzt.');
      await nachher();
    },
    {
      loeschen: pin.id
        ? async () => {
            if (pin.bildId) await bildLoeschen(pin.bildId);
            await daten.loeschen('pins', pin.id);
            await nachher();
          }
        : null,
    }
  );
}

// ------------------------------------------------------------------ Ausgabe

/**
 * Ein Blatt je Geschoss: der Grundriss mit nummerierten Marken, darunter die
 * Tabelle dazu. Genau das, was man beim spaeteren Nachruesten braucht -
 * gedruckt im Ordner oder als Datei an den Elektriker.
 */
async function pdfErzeugen(geschosse) {
  melde('PDF wird erstellt …');
  const projekt = (await einstellung('projektname')) || '';
  const blatt = new Blatt({
    titel: 'Anschlussplan',
    untertitel: (projekt ? projekt + ' · ' : '') + 'Stand ' + datumLang(heute()),
    fusszeile: 'Bauzeuge · Höhen in cm über Fertigfußboden',
  });

  let ohneBild = 0;

  for (const [i, geschoss] of geschosse.entries()) {
    const pins = await daten.nach('pins', 'geschossId', geschoss.id);
    if (i > 0) blatt.neueSeite();
    blatt.ueberschrift(geschoss.name);

    const eintrag = await daten.holen('bilder', geschoss.bildId);
    const plan = eintrag ? await bildLaden(eintrag.blob) : null;

    if (plan) {
      const rahmen = blatt.bildGross(plan);
      pins.forEach((pin, n) => {
        const art = PIN_ARTEN[pin.art] || PIN_ARTEN.sonstiges;
        blatt.marke(rahmen, pin.x, pin.y, n + 1, farbeZuRgb(art.farbe));
      });
    } else {
      // Als PDF hochgeladene Grundrisse lassen sich nicht einbetten.
      ohneBild++;
      blatt.absatz('Der Grundriss dieses Geschosses liegt als PDF vor und kann hier nicht abgebildet werden. Die Markierungen stehen trotzdem in der Tabelle.', 9);
    }

    if (pins.length) {
      blatt.tabelle(
        ['Nr.', 'Art', 'Höhe', 'Notiz'],
        pins.map((pin, n) => [
          String(n + 1),
          (PIN_ARTEN[pin.art] || PIN_ARTEN.sonstiges).name,
          pin.hoehe ? pin.hoehe + ' cm' : '',
          pin.notiz || '',
        ]),
        [0.45, 1.75, 0.8, 3.6],
        [2]
      );
    } else {
      blatt.absatz('In diesem Geschoss ist noch nichts markiert.', 9.5);
    }
  }

  if (ohneBild) {
    blatt.absatz(
      'Hinweis: ' + ohneBild + ' Geschoss(e) ohne abbildbaren Grundriss. ' +
      'Wer den Plan als Foto statt als PDF hochlädt, bekommt ihn hier mit den Marken abgebildet.',
      8.5
    );
  }

  try {
    await pdfTeilen(blatt.blob(), 'anschlussplan.pdf', 'Anschlussplan');
  } catch (fehler) {
    melde('PDF konnte nicht geteilt werden.');
    console.error(fehler);
  }
}

/** "#e8a020" zu [232, 160, 32] */
function farbeZuRgb(hex) {
  const wert = parseInt(String(hex).replace('#', ''), 16);
  return [(wert >> 16) & 255, (wert >> 8) & 255, wert & 255];
}
