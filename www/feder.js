/* Eine Feder, keine Übergangszeit.
 *
 * Warum nicht `transition`: Ein CSS-Übergang läuft von einem festen Wert zu
 * einem festen Wert in einer festen Zeit. Greift der Finger mitten hinein,
 * springt die Fläche -- der Übergang kennt den Wert, den sie gerade zeigt,
 * nicht. Eine Feder rechnet dagegen Bild für Bild aus der aktuellen Lage und
 * der aktuellen Geschwindigkeit weiter. Sie lässt sich deshalb jederzeit
 * anfassen, umlenken und zurückholen, und sie nimmt den Schwung mit, den der
 * Finger beim Loslassen hatte.
 *
 * Gerechnet wird der gedämpfte harmonische Oszillator, in Schritten von
 * höchstens 1/120 s. Feste Schritte und nicht die echte Bildzeit: Bei einem
 * ausgelassenen Bild wäre der Schritt doppelt so gross, und eine steife
 * Feder würde dann über das Ziel hinausrechnen statt einzuschwingen.
 */

/** @typedef {{ halt: () => void, laeuft: () => boolean }} Lauf */

/**
 * @param {object} o
 * @param {number} o.von        Startwert.
 * @param {number} o.nach       Zielwert.
 * @param {number} [o.tempo]    Geschwindigkeit beim Start, Einheiten je Sekunde.
 * @param {number} [o.antwort]  Wie schnell der Zielwert erreicht wird, in
 *                              Sekunden. Kleiner heisst schnappiger. Das ist
 *                              keine Dauer -- wann die Feder steht, ergibt
 *                              sich aus den Werten.
 * @param {number} [o.daempfung] 1 = kein Überschwingen. Darunter federt es
 *                               nach, darüber kriecht es.
 * @param {(wert: number) => void} o.beiBild
 * @param {() => void} [o.fertig]
 * @returns {Lauf}
 */
export function feder({ von, nach, tempo = 0, antwort = 0.38, daempfung = 1, beiBild, fertig }) {
  const w0 = (2 * Math.PI) / antwort;   // Eigenfrequenz
  let x = von - nach;                   // Abstand zum Ziel
  let v = tempo;
  let laufend = true;
  let bild = 0;
  let zuletzt = performance.now();

  /* Wann es genug ist: Weniger als ein halbes Gerätepixel vom Ziel und
     praktisch ohne Geschwindigkeit. Ohne diese Schwelle rechnet die Feder
     ewig an der vierten Nachkommastelle weiter. */
  const nahGenug = () => Math.abs(x) < 0.5 && Math.abs(v) < 0.5;

  function schritt(jetzt) {
    if (!laufend) return;
    let rest = Math.min((jetzt - zuletzt) / 1000, 0.064);  // nach einem Tab-Wechsel nicht aufholen
    zuletzt = jetzt;

    while (rest > 0) {
      const dt = Math.min(rest, 1 / 120);
      rest -= dt;
      // Gedaempfter harmonischer Oszillator, halbimplizit integriert.
      const a = -(w0 * w0) * x - 2 * daempfung * w0 * v;
      v += a * dt;
      x += v * dt;
    }

    if (nahGenug()) {
      beiBild(nach);
      laufend = false;
      fertig?.();
      return;
    }
    beiBild(nach + x);
    bild = requestAnimationFrame(schritt);
  }

  bild = requestAnimationFrame(schritt);

  return {
    halt() { laufend = false; cancelAnimationFrame(bild); },
    laeuft: () => laufend,
  };
}

/* Wohin die Bewegung läuft, wenn man sie laufen lässt.
 *
 * Gebraucht beim Loslassen: Entschieden wird nicht danach, wo der Finger
 * aufhört, sondern wohin der Schwung die Fläche getragen hätte. Ein kurzer
 * schneller Wisch über zwanzig Pixel soll wegwerfen, ein langsames Schieben
 * über hundert nicht.
 *
 * `abbau` ist der Faktor, mit dem die Geschwindigkeit je Sekunde zerfällt;
 * 0.998^(1000/60) entspricht ungefähr dem, was iOS für Listen benutzt. */
export function ziel(wert, tempo, abbau = 0.998) {
  return wert + (tempo * abbau) / (1 - abbau) / 1000;
}

/* Gummiband: Widerstand jenseits der Grenze.
 *
 * Dieselbe Formel wie bei iOS. Je weiter man zieht, desto weniger folgt die
 * Fläche -- sie hört nicht auf einmal auf, sie wird zäh. Ein hartes Ende
 * fühlt sich kaputt an, ein zähes fühlt sich nach Material an.
 */
export function gummi(weg, groesse, haerte = 0.55) {
  return (weg * haerte * groesse) / (groesse + haerte * Math.abs(weg));
}
