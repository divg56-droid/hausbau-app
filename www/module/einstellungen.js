// Einstellungen, Sicherung und Loeschung.

import {
  el, feld, eingabe, knopf, karte, kopfzeile, wertzeile, hinweisKasten, melde, heute,
} from '../hilfen.js';
import { daten, einstellung } from '../daten.js';

// Alle Speicher ausser den Einstellungen selbst; Bilder werden gesondert
// behandelt, weil sie als Blob nicht in JSON passen.
const SPEICHER = ['darlehen', 'belege', 'geschosse', 'pins', 'maengel', 'aufgaben', 'tagebuch', 'kontakte'];

export async function zeige(rahmen) {
  await zeichne(rahmen);
}

async function zeichne(rahmen) {
  rahmen.replaceChildren();

  const projektname = eingabe({
    value: (await einstellung('projektname')) || '',
    placeholder: 'z. B. Neubau Musterweg 3',
  });
  const bestand = {};
  for (const name of [...SPEICHER, 'bilder']) {
    bestand[name] = (await daten.alle(name)).length;
  }

  rahmen.append(
    kopfzeile('Einstellungen', 'Projekt, Datensicherung und Löschen.'),

    karte([
      el('h2', { text: 'Projekt' }),
      feld('Projektname', projektname, 'Erscheint in der Kopfzeile jedes PDF.'),
      knopf('Speichern', async () => {
        await einstellung('projektname', projektname.value.trim());
        melde('Gespeichert.');
      }, 'knopf-haupt'),
    ]),

    karte([
      el('h2', { text: 'Was gespeichert ist' }),
      wertzeile('Finanzierungsposten', String(bestand.darlehen)),
      wertzeile('Rechnungen', String(bestand.belege)),
      wertzeile('Geschosse', String(bestand.geschosse)),
      wertzeile('Markierungen', String(bestand.pins)),
      wertzeile('Mängel', String(bestand.maengel)),
      wertzeile('Arbeitsschritte', String(bestand.aufgaben)),
      wertzeile('Tageseinträge', String(bestand.tagebuch)),
      wertzeile('Kontakte', String(bestand.kontakte)),
      wertzeile('Fotos', String(bestand.bilder), true),
    ]),

    karte([
      el('h2', { text: 'Sicherung' }),
      el('p', {
        klasse: 'unterzeile',
        text:
          'Die Sicherung enthält alle Daten samt Fotos in einer Datei. Sie kann groß ' +
          'werden. Lege sie über das Teilen-Menü in einer Cloud oder auf dem Rechner ab.',
      }),
      knopf('Sicherung erstellen', sicherungErstellen),
      knopf('Sicherung einlesen', () => sicherungEinlesen(rahmen)),
    ]),

    karte([
      el('h2', { text: 'Alles löschen' }),
      hinweisKasten(
        'Löscht sämtliche Daten dieser App auf diesem Gerät, auch alle Fotos. ' +
          'Das lässt sich nicht rückgängig machen.',
        'warn'
      ),
      knopf('Alle Daten löschen', async () => {
        if (!window.confirm('Wirklich alle Daten unwiderruflich löschen?')) return;
        if (!window.confirm('Sicher? Fotos, Mängel, Rechnungen und Pläne sind danach weg.')) return;
        for (const name of [...SPEICHER, 'bilder', 'einstellungen']) await daten.leeren(name);
        melde('Alles gelöscht.');
        location.hash = '';
      }, 'knopf-warn'),
    ]),

    karte([
      el('h2', { text: 'Über die App' }),
      el('p', {
        klasse: 'unterzeile',
        text:
          'Hausbau App, Testversion. Ohne Konto bleibt alles auf diesem Gerät ' +
          'und nichts wird übertragen. Mit Konto gehen die Daten zum Abgleich ' +
          'an hausbauatlas.de, und nur dorthin. Die Rechner nutzen dieselbe ' +
          'Datenbasis wie hausbauatlas.de (Baukosten Stand 08.2026). ' +
          'Ergebnisse sind Prognosen auf Grundlage realer Marktdaten, keine Angebote.',
      }),
    ])
  );
}

// ------------------------------------------------------------------ Sicherung

async function sicherungErstellen() {
  melde('Sicherung wird erstellt …');
  const inhalt = { version: 1, erstellt: heute(), einstellungen: {}, speicher: {}, bilder: [] };

  for (const eintrag of await daten.alle('einstellungen')) {
    inhalt.einstellungen[eintrag.name] = eintrag.wert;
  }
  for (const name of SPEICHER) inhalt.speicher[name] = await daten.alle(name);

  for (const bild of await daten.alle('bilder')) {
    inhalt.bilder.push({
      id: bild.id,
      typ: bild.typ,
      name: bild.name,
      angelegt: bild.angelegt,
      daten: await blobZuBase64(bild.blob),
    });
  }

  const blob = new Blob([JSON.stringify(inhalt)], { type: 'application/json' });
  const { pdfTeilen } = await import('../pdf.js');
  try {
    await pdfTeilen(blob, 'hausbau-sicherung-' + heute() + '.json', 'Sicherung');
    melde('Sicherung bereit.');
  } catch (fehler) {
    console.error(fehler);
    melde('Sicherung konnte nicht geteilt werden.');
  }
}

function sicherungEinlesen(rahmen) {
  const dateifeld = el('input', { type: 'file', accept: 'application/json,.json', klasse: 'versteckt' });
  dateifeld.addEventListener('change', async () => {
    const datei = dateifeld.files[0];
    dateifeld.remove();
    if (!datei) return;
    if (!window.confirm('Die Sicherung ersetzt alle vorhandenen Daten. Fortfahren?')) return;

    try {
      const inhalt = JSON.parse(await datei.text());
      if (!inhalt || inhalt.version !== 1) throw new Error('Unbekanntes Format.');

      for (const name of [...SPEICHER, 'bilder']) await daten.leeren(name);

      for (const bild of inhalt.bilder || []) {
        await daten.sichern('bilder', {
          id: bild.id,
          typ: bild.typ,
          name: bild.name,
          angelegt: bild.angelegt,
          blob: base64ZuBlob(bild.daten, bild.typ),
        }, { zeitBehalten: true });
      }
      for (const name of SPEICHER) {
        for (const satz of inhalt.speicher[name] || []) {
          await daten.sichern(name, satz, { zeitBehalten: true });
        }
      }
      for (const [name, wert] of Object.entries(inhalt.einstellungen || {})) {
        await einstellung(name, wert);
      }
      melde('Sicherung eingelesen.');
      await zeichne(rahmen);
    } catch (fehler) {
      console.error(fehler);
      melde('Datei konnte nicht gelesen werden.');
    }
  });
  document.body.append(dateifeld);
  dateifeld.click();
}

function blobZuBase64(blob) {
  return new Promise((fertig, fehler) => {
    const leser = new FileReader();
    leser.onerror = () => fehler(leser.error);
    leser.onload = () => fertig(String(leser.result).split(',')[1]);
    leser.readAsDataURL(blob);
  });
}

function base64ZuBlob(base64, typ) {
  const roh = atob(base64);
  const bytes = new Uint8Array(roh.length);
  for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
  return new Blob([bytes], { type: typ || 'image/jpeg' });
}
