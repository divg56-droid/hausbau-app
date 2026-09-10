// Fotos anhaengen, ueberall gleich: Maengel, Tagebuch, Pins, Belege.
//
// Bewusst ohne Kamera-Erweiterung. Ein Dateifeld mit capture="environment"
// oeffnet auf Android direkt die Kamera und funktioniert im WebView genauso
// wie im Browser. Ein Plugin weniger, das kaputtgehen kann.

import { el, knopf } from './hilfen.js';
import { daten, bildAblegen, bildUrl, bildLoeschen } from './daten.js';

/**
 * Baut eine Fotoreihe mit Aufnahme-Knopf.
 *
 * @param {number[]} ids      vorhandene Bild-ids, wird in place veraendert
 * @param {Function} beiWechsel  wird nach jeder Aenderung mit den ids gerufen
 * @param {object}   optionen  { text, mehrere, pdfErlaubt }
 */
export function fotofeld(ids, beiWechsel, optionen = {}) {
  const {
    text = 'Foto aufnehmen',
    mehrere = true,
    pdfErlaubt = false,
  } = optionen;

  const reihe = el('div', { klasse: 'fotoreihe' });

  const dateifeld = el('input', {
    klasse: 'versteckt',
    type: 'file',
    accept: pdfErlaubt ? 'image/*,application/pdf' : 'image/*',
    capture: pdfErlaubt ? null : 'environment',
    multiple: mehrere,
  });

  async function zeichneReihe() {
    reihe.replaceChildren();
    for (const id of ids) {
      const url = await bildUrl(id);
      const eintrag = await daten.holen('bilder', id);
      // Ein PDF hat keine Vorschau. Als <img> waere es ein kaputtes Bild;
      // stattdessen eine Kachel mit dem Dateinamen, die sich antippen laesst.
      const istPdf = eintrag && String(eintrag.typ || '').includes('pdf');
      const bild = istPdf
        ? el('a', {
            klasse: 'dateikachel', href: url || '#', target: '_blank', rel: 'noopener',
            title: eintrag.name || 'PDF',
          }, [
            el('span', { klasse: 'dateizeichen', text: 'PDF' }),
            el('span', { klasse: 'dateiname', text: eintrag.name || 'Dokument' }),
          ])
        : el('img', { src: url || '', alt: 'Angehängtes Foto' });
      const weg = el(
        'button',
        {
          type: 'button', klasse: 'weg', 'aria-label': 'Foto entfernen',
          onclick: async () => {
            await bildLoeschen(id);
            ids.splice(ids.indexOf(id), 1);
            await zeichneReihe();
            beiWechsel(ids);
          },
        },
        ['×']
      );
      reihe.append(el('figure', {}, [bild, weg]));
    }
  }

  dateifeld.addEventListener('change', async () => {
    const dateien = [...dateifeld.files];
    dateifeld.value = '';
    for (const datei of dateien) {
      const id = await bildAblegen(datei);
      if (!mehrere) ids.length = 0;
      ids.push(id);
    }
    await zeichneReihe();
    beiWechsel(ids);
  });

  zeichneReihe();

  return el('div', {}, [
    reihe,
    dateifeld,
    knopf('\u{1F4F7} ' + text, () => dateifeld.click()),
  ]);
}

/**
 * Einzelne Datei waehlen, ohne Kamerazwang: fuer Grundrisse und Belege,
 * die oft als PDF oder Foto aus der Galerie kommen.
 */
export function dateiWaehlen(text, beiWahl, akzeptiert = 'image/*,application/pdf') {
  const dateifeld = el('input', { klasse: 'versteckt', type: 'file', accept: akzeptiert });
  dateifeld.addEventListener('change', async () => {
    const datei = dateifeld.files[0];
    dateifeld.value = '';
    if (datei) await beiWahl(datei);
  });
  return el('div', {}, [dateifeld, knopf(text, () => dateifeld.click(), 'knopf-haupt')]);
}
