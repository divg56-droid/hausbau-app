/* Das Blatt am Finger: hereinfahren, ziehen, wegwerfen, zurückholen.
 *
 * Getrennt von blatt.js, damit dort steht, was ein Blatt ist, und hier,
 * wie es sich bewegt.
 *
 * Gezogen wird am Griff und nicht am ganzen Blatt. Der Rumpf scrollt, und
 * zwei Gesten auf derselben Fläche müssten sich gegenseitig erraten --
 * das geht ein paarmal gut und dann scrollt die Liste, wenn jemand
 * schliessen wollte. Der Griff ist eindeutig.
 */

import { feder, ziel, gummi } from './feder.js';

const RUHIG = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* Ab wann losgelassen wird: entweder ist das Blatt weit genug unten, oder
   der Schwung trägt es dorthin. Zwei Wege und nicht einer, weil ein kurzer
   schneller Wisch wegwerfen soll, ohne dass man das halbe Blatt
   herunterzieht. */
const WEG_AB_ANTEIL = 0.38;   // Anteil der Blatthöhe
const WEG_AB_TEMPO = 520;     // px/s nach unten

export function ziehbarMachen(ueberlagerung, blatt, schliessen) {
  const griff = blatt.querySelector('.blatt-griff');
  let hoehe = blatt.getBoundingClientRect().height || window.innerHeight;
  let y = hoehe;           // aktuelle Lage, 0 = ganz offen
  let lauf = null;         // laufende Feder, falls eine läuft
  let abgeraeumt = false;

  const setzen = (wert) => {
    y = wert;
    blatt.style.transform = `translate3d(0, ${wert}px, 0)`;
    /* Der Schleier folgt dem Blatt. Rückmeldung während der Geste, nicht
       erst am Ende: Man sieht beim Ziehen, dass man gerade schliesst. */
    ueberlagerung.style.setProperty('--blatt-anteil', String(1 - Math.min(1, wert / hoehe)));
  };

  const abraeumen = () => {
    if (abgeraeumt) return;
    abgeraeumt = true;
    lauf?.halt();
    ueberlagerung.remove();
  };

  // ------------------------------------------------------------ Hereinfahren
  if (RUHIG()) {
    setzen(0);
  } else {
    setzen(hoehe);
    // Im nächsten Bild, sonst setzt der Browser Start- und Zielwert in einem
    // Rutsch und es gibt nichts zu sehen.
    requestAnimationFrame(() => {
      if (abgeraeumt) return;
      lauf = feder({ von: hoehe, nach: 0, antwort: 0.42, daempfung: 0.92, beiBild: setzen });
    });
  }

  // ------------------------------------------------------------------ Ziehen
  let zieht = false;
  let griffVersatz = 0;
  let spur = [];   // die letzten Punkte, für die Geschwindigkeit

  const tempoJetzt = () => {
    if (spur.length < 2) return 0;
    const a = spur[0], b = spur[spur.length - 1];
    const dt = (b.t - a.t) / 1000;
    return dt > 0 ? (b.y - a.y) / dt : 0;
  };

  function runter(e) {
    if (e.button != null && e.button !== 0) return;
    griff.setPointerCapture(e.pointerId);
    zieht = true;
    hoehe = blatt.getBoundingClientRect().height || hoehe;
    /* Die laufende Feder anhalten und von da weitermachen, wo das Blatt
       gerade steht -- nicht da, wo es hingewollt hätte. Sonst springt es
       unter dem Finger weg. */
    lauf?.halt();
    lauf = null;
    griffVersatz = e.clientY - y;
    spur = [{ y, t: e.timeStamp }];
  }

  function bewegen(e) {
    if (!zieht) return;
    let neu = e.clientY - griffVersatz;
    // Nach oben gibt es nichts zu holen: zäh statt hart.
    if (neu < 0) neu = -gummi(-neu, hoehe);
    setzen(neu);
    spur.push({ y: neu, t: e.timeStamp });
    if (spur.length > 5) spur.shift();
  }

  function hoch(e) {
    if (!zieht) return;
    zieht = false;
    try { griff.releasePointerCapture(e.pointerId); } catch { /* egal */ }

    const tempo = tempoJetzt();
    const landet = ziel(y, tempo);
    const weg = landet > hoehe * WEG_AB_ANTEIL || tempo > WEG_AB_TEMPO;

    if (weg) {
      schliessen();     // ruft seinerseits hinaus()
      return;
    }
    if (RUHIG()) { setzen(0); return; }
    // Mit dem Schwung weiterrechnen, den der Finger hatte.
    lauf = feder({ von: y, nach: 0, tempo, antwort: 0.4, daempfung: 0.9, beiBild: setzen });
  }

  if (griff) {
    griff.addEventListener('pointerdown', runter);
    griff.addEventListener('pointermove', bewegen);
    griff.addEventListener('pointerup', hoch);
    griff.addEventListener('pointercancel', hoch);
  }

  return {
    /* Hinaus auf demselben Weg, auf dem es hereinkam. Nimmt den Schwung mit,
       wenn gerade gezogen wurde -- wer nach unten wirft, soll nicht sehen,
       wie das Blatt kurz stehen bleibt und dann neu anfährt. */
    hinaus() {
      if (abgeraeumt) return;
      if (RUHIG()) { abraeumen(); return; }
      const tempo = Math.max(tempoJetzt(), 0);
      lauf?.halt();
      /* Zielpunkt liegt hinter der Unterkante, abgeräumt wird aber schon,
         sobald das Blatt sie erreicht. Eine Feder nähert sich ihrem Ziel
         asymptotisch -- liefe sie bis zum Stillstand, wartete man eine
         Viertelsekunde auf etwas, das längst niemand mehr sieht.
         Wegwerfen muss sich schnell anfühlen: Wer schliesst, ist mit dem
         Blatt fertig. */
      lauf = feder({
        von: y, nach: hoehe * 1.06, tempo, antwort: 0.26, daempfung: 1,
        beiBild: (wert) => {
          if (wert >= hoehe) { abraeumen(); return; }
          setzen(wert);
        },
        fertig: abraeumen,
      });
      // Rückhalt: Käme kein Bild mehr (Tab im Hintergrund, kein rAF),
      // bliebe das Blatt sonst für immer stehen.
      setTimeout(abraeumen, 300);
    },
  };
}
