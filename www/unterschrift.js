// Unterschrift mit dem Finger.
//
// Gebraucht wird sie beim Bauhelfertagebuch. Die Berufsgenossenschaft fragt
// im Ernstfall, wer wie lange gearbeitet hat; eine Liste, die der Bauherr
// allein gefuehrt hat, ist dann seine Behauptung. Hat der Helfer am selben
// Tag unterschrieben, ist sie ein Beleg.
//
// Gezeichnet wird auf ein Canvas mit Pointer-Ereignissen: Die decken Finger,
// Stift und Maus gleichermassen ab, und mehr braucht es hier nicht.
//
// Herauskommt ein PNG im Bilderspeicher, wie jedes andere Bild der App. Damit
// wandert die Unterschrift beim Abgleich mit und landet ohne Sonderweg im
// PDF.

import { el, knopf } from './hilfen.js';
import { daten } from './daten.js';

const BREITE = 600;
const HOEHE = 200;

/**
 * Oeffnet das Unterschriftenfeld.
 *
 * @param {string} name  wer unterschreibt, steht ueber dem Feld
 * @returns {Promise<string|null>}  Kennung des Bildes, oder null bei Abbruch
 */
export function unterschriftAufnehmen(name) {
  return new Promise((fertig) => {
    const flaeche = el('canvas', { klasse: 'unterschriftsfeld' });
    flaeche.width = BREITE;
    flaeche.height = HOEHE;

    const stift = flaeche.getContext('2d');
    stift.fillStyle = '#ffffff';
    stift.fillRect(0, 0, BREITE, HOEHE);
    stift.strokeStyle = '#1f2a30';
    stift.lineWidth = 3;
    stift.lineCap = 'round';
    stift.lineJoin = 'round';

    let zeichnet = false;
    let etwasDrauf = false;

    // Das Canvas ist innen 600 breit und aussen so breit, wie es passt. Ohne
    // Umrechnung liefe der Strich neben dem Finger her.
    const punkt = (ereignis) => {
      const kasten = flaeche.getBoundingClientRect();
      return [
        ((ereignis.clientX - kasten.left) / kasten.width) * BREITE,
        ((ereignis.clientY - kasten.top) / kasten.height) * HOEHE,
      ];
    };

    flaeche.addEventListener('pointerdown', (ereignis) => {
      ereignis.preventDefault();
      flaeche.setPointerCapture(ereignis.pointerId);
      zeichnet = true;
      etwasDrauf = true;
      const [x, y] = punkt(ereignis);
      stift.beginPath();
      stift.moveTo(x, y);
      // Ein einzelner Tipp soll auch einen Punkt hinterlassen.
      stift.lineTo(x, y);
      stift.stroke();
    });
    flaeche.addEventListener('pointermove', (ereignis) => {
      if (!zeichnet) return;
      ereignis.preventDefault();
      const [x, y] = punkt(ereignis);
      stift.lineTo(x, y);
      stift.stroke();
    });
    for (const art of ['pointerup', 'pointercancel', 'pointerleave']) {
      flaeche.addEventListener(art, () => { zeichnet = false; });
    }

    const leeren = () => {
      stift.fillStyle = '#ffffff';
      stift.fillRect(0, 0, BREITE, HOEHE);
      etwasDrauf = false;
    };

    const blatt = el('div', { klasse: 'blatt' }, [
      el('h2', { text: 'Unterschrift' }),
      el('p', {
        klasse: 'unterzeile',
        text: name
          ? name + ' bestätigt die eingetragenen Stunden dieses Tages.'
          : 'Bestätigung der eingetragenen Stunden dieses Tages.',
      }),
      flaeche,
      el('p', {
        klasse: 'unterzeile',
        text: 'Mit dem Finger auf der Linie unterschreiben.',
      }),
      el('div', { klasse: 'knopf-reihe', stil: { marginTop: '6px' } }, [
        knopf('Abbrechen', () => schliessen(null)),
        knopf('Löschen', leeren),
        knopf('Übernehmen', uebernehmen, 'knopf-haupt'),
      ]),
    ]);

    const ueberlagerung = el('div', { klasse: 'ueberlagerung' }, [blatt]);
    ueberlagerung.addEventListener('click', (ereignis) => {
      if (ereignis.target === ueberlagerung) schliessen(null);
    });

    // In der Aufnahmephase: Sonst schliesst dieselbe Escape-Taste auch das
    // Eingabeblatt darunter, und der halb ausgefuellte Tageseintrag ist weg.
    function beiTaste(ereignis) {
      if (ereignis.key !== 'Escape') return;
      ereignis.stopImmediatePropagation();
      schliessen(null);
    }
    document.addEventListener('keydown', beiTaste, true);

    function schliessen(wert) {
      document.removeEventListener('keydown', beiTaste, true);
      ueberlagerung.remove();
      fertig(wert);
    }

    async function uebernehmen() {
      if (!etwasDrauf) {
        schliessen(null);
        return;
      }
      const blob = await new Promise((r) => flaeche.toBlob(r, 'image/png'));
      if (!blob) {
        schliessen(null);
        return;
      }
      // Am Bilderspeicher vorbei nichts verkleinern: Eine Unterschrift ist
      // schon klein, und bildAblegen() wuerde sie durch die Bildskalierung
      // schicken und dabei ausfransen.
      const id = await daten.sichern('bilder', {
        blob,
        typ: 'image/png',
        name: 'unterschrift.png',
        angelegt: new Date().toISOString(),
      });
      schliessen(id);
    }

    document.body.append(ueberlagerung);
  });
}
