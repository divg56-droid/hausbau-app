/* Die Seitenleiste zum Wegwischen.
 *
 * Nur zumachen, nicht aufmachen: Ein Wisch von der linken Kante gehört auf
 * Android und iOS dem System (Zurück). Wer ihn der App gibt, nimmt ihn dem
 * Gerät weg, und dann streitet sich beides. Aufgemacht wird weiter über den
 * Knopf.
 *
 * Die CSS-Transition der Leiste wird während des Ziehens abgeschaltet. Sie
 * läuft auf ein festes Ziel in fester Zeit und zöge gegen den Finger.
 */

import { feder, ziel, gummi } from './feder.js';

const RUHIG = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
/* Dieselbe Grenze wie in stil.css. Darüber steht die Leiste fest und es gibt
   nichts wegzuwischen. */
const SCHUBLADE = () => window.matchMedia?.('(max-width: 899px)').matches;

const RICHTUNG_AB = 10;   // px, bevor entschieden wird, wohin die Geste will
const ZU_AB_ANTEIL = 0.4;
const ZU_AB_TEMPO = 420;  // px/s nach links

export function leisteZiehbar(leiste, schatten, schliessen) {
  let breite = 0;
  let x = 0;              // 0 = offen, -breite = zu
  let lauf = null;
  let zieht = false;
  let entschieden = false;
  let start = null;
  let spur = [];

  const setzen = (wert) => {
    x = wert;
    leiste.style.transform = `translate3d(${wert}px, 0, 0)`;
    if (schatten) schatten.style.opacity = String(1 - Math.min(1, -wert / breite));
  };

  /* Nach der Geste wieder der Klasse überlassen. Bliebe das Inline-Transform
     stehen, liesse sich die Leiste nie wieder normal öffnen. */
  const freigeben = () => {
    leiste.style.transform = '';
    leiste.style.transition = '';
    if (schatten) schatten.style.opacity = '';
    leiste.classList.remove('leiste-zieht');
  };

  const tempoJetzt = () => {
    if (spur.length < 2) return 0;
    const a = spur[0], b = spur[spur.length - 1];
    const dt = (b.t - a.t) / 1000;
    return dt > 0 ? (b.x - a.x) / dt : 0;
  };

  function runter(e) {
    if (!SCHUBLADE() || !document.body.classList.contains('leiste-offen')) return;
    if (e.button != null && e.button !== 0) return;
    breite = leiste.getBoundingClientRect().width || 280;
    lauf?.halt();
    lauf = null;
    zieht = true;
    entschieden = false;
    start = { x: e.clientX, y: e.clientY };
    spur = [{ x: 0, t: e.timeStamp }];
  }

  function bewegen(e) {
    if (!zieht) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    /* Erst entscheiden, wohin die Geste will, dann festhalten. Beide
       Richtungen werden vom ersten Punkt an beobachtet; sobald eine
       gewinnt, wird die andere verworfen. Ohne diese Schwelle faengt jeder
       Scrollversuch an, die Leiste zu schieben. */
    if (!entschieden) {
      if (Math.abs(dx) < RICHTUNG_AB && Math.abs(dy) < RICHTUNG_AB) return;
      if (Math.abs(dy) > Math.abs(dx)) { zieht = false; return; }  // das ist Scrollen
      entschieden = true;
      leiste.classList.add('leiste-zieht');
      leiste.setPointerCapture(e.pointerId);
    }

    // Nach rechts gibt es nichts zu holen: zäh statt hart.
    const wert = dx > 0 ? gummi(dx, breite) : dx;
    setzen(wert);
    spur.push({ x: wert, t: e.timeStamp });
    if (spur.length > 5) spur.shift();
  }

  function hoch(e) {
    if (!zieht) return;
    zieht = false;
    if (!entschieden) return;
    try { leiste.releasePointerCapture(e.pointerId); } catch { /* egal */ }

    const tempo = tempoJetzt();
    const landet = ziel(x, tempo);
    const zu = landet < -breite * ZU_AB_ANTEIL || tempo < -ZU_AB_TEMPO;

    if (RUHIG()) { freigeben(); if (zu) schliessen(); return; }

    if (zu) {
      lauf = feder({
        von: x, nach: -breite * 1.06, tempo, antwort: 0.26, daempfung: 1,
        beiBild: (w) => { if (w <= -breite) { freigeben(); schliessen(); lauf?.halt(); return; } setzen(w); },
        fertig: () => { freigeben(); schliessen(); },
      });
      setTimeout(() => { if (document.body.classList.contains('leiste-offen')) { freigeben(); schliessen(); } }, 300);
      return;
    }
    lauf = feder({
      von: x, nach: 0, tempo, antwort: 0.38, daempfung: 0.9,
      beiBild: setzen, fertig: freigeben,
    });
  }

  leiste.addEventListener('pointerdown', runter);
  leiste.addEventListener('pointermove', bewegen);
  leiste.addEventListener('pointerup', hoch);
  leiste.addEventListener('pointercancel', hoch);
}
