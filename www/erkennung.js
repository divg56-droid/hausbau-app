// Belegerkennung ueber Google Gemini.
//
// Bewusst freiwillig und ausgeschaltet, solange kein Schluessel hinterlegt
// ist. Der Schluessel gehoert dem Nutzer und liegt nur auf dem Geraet; er
// wird nicht mit der App ausgeliefert. Ein im APK mitgelieferter Schluessel
// waere aus der Datei auslesbar und ginge auf Kosten des Herausgebers.

import { einstellung } from './daten.js';

const MODELL = 'gemini-2.5-flash';
const ENDPUNKT = 'https://generativelanguage.googleapis.com/v1beta/models/';

export async function erkennungBereit() {
  const schluessel = await einstellung('gemini_schluessel');
  return Boolean(schluessel && String(schluessel).trim());
}

function alsBase64(datei) {
  return new Promise((fertig, fehler) => {
    const leser = new FileReader();
    leser.onerror = () => fehler(leser.error);
    leser.onload = () => fertig(String(leser.result).split(',')[1]);
    leser.readAsDataURL(datei);
  });
}

/**
 * Liest Betrag, Kontakt, Beschreibung und Datum aus einem Rechnungsfoto
 * oder einer Rechnungs-PDF.
 *
 * @returns {Promise<{betrag:number, kontakt:string, beschreibung:string, datum:string}>}
 */
export async function belegLesen(datei) {
  const schluessel = await einstellung('gemini_schluessel');
  if (!schluessel) throw new Error('Kein Schlüssel hinterlegt.');

  const inhalt = await alsBase64(datei);

  const anfrage = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: datei.type || 'image/jpeg', data: inhalt } },
          {
            text:
              'Das ist eine Rechnung von einer deutschen Baustelle. Lies aus: ' +
              'den Rechnungsendbetrag in Euro inklusive Mehrwertsteuer (nur die Zahl, Punkt als Dezimaltrennzeichen), ' +
              'den Namen der rechnungsstellenden Firma, ' +
              'eine kurze Beschreibung der Leistung mit höchstens sechs Wörtern, ' +
              'und das Rechnungsdatum im Format JJJJ-MM-TT. ' +
              'Was nicht sicher lesbar ist, bleibt leer beziehungsweise 0.',
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          betrag: { type: 'NUMBER' },
          kontakt: { type: 'STRING' },
          beschreibung: { type: 'STRING' },
          datum: { type: 'STRING' },
        },
        required: ['betrag', 'kontakt', 'beschreibung', 'datum'],
      },
    },
  };

  const antwort = await fetch(ENDPUNKT + MODELL + ':generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': String(schluessel).trim() },
    body: JSON.stringify(anfrage),
  });

  if (!antwort.ok) {
    const text = await antwort.text();
    throw new Error('Gemini antwortete mit ' + antwort.status + ': ' + text.slice(0, 200));
  }

  const ergebnis = await antwort.json();
  const roh = ergebnis?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!roh) throw new Error('Keine verwertbare Antwort erhalten.');

  const gelesen = JSON.parse(roh);
  return {
    betrag: Number(gelesen.betrag) || 0,
    kontakt: String(gelesen.kontakt || '').trim(),
    beschreibung: String(gelesen.beschreibung || '').trim(),
    // Nur uebernehmen, was wirklich wie ein Datum aussieht.
    datum: /^\d{4}-\d{2}-\d{2}$/.test(gelesen.datum || '') ? gelesen.datum : '',
  };
}
