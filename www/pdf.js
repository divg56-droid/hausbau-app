// Ein kleiner PDF-Schreiber, gerade gross genug fuer Tilgungsplan und
// Maengelliste.
//
// Warum selbst gebaut: Die fertigen Bibliotheken wiegen mehrere hundert
// Kilobyte, und wir brauchen genau drei Dinge - Text, Tabelle, Seitenumbruch.
// Helvetica ist eine der 14 Standardschriften, die jeder PDF-Betrachter
// mitbringt; damit muss nichts eingebettet werden.

// Helvetica-Zeichenbreiten (1/1000 em) fuer die Zeichen 32 bis 126.
// Nur damit rechtsbuendige Zahlen buendig stehen. Ziffern sind in Helvetica
// und Helvetica-Bold gleich breit, deshalb reicht eine Tabelle fuer beide.
const BREITEN = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

// PDF-Standardschriften erwarten WinAnsi. Alles ausserhalb von Latin-1
// bekommt einen Ersatz, damit keine kaputten Zeichen im Dokument landen.
const SONDER = { '€': 128, '‚': 130, '„': 132, '…': 133, '‘': 145, '’': 146, '“': 147, '”': 148, '–': 150, '—': 151 };

function zuWinAnsi(text) {
  const bytes = [];
  for (const zeichen of String(text ?? '')) {
    const code = zeichen.codePointAt(0);
    if (code < 256) bytes.push(code);
    else if (SONDER[zeichen] !== undefined) bytes.push(SONDER[zeichen]);
    else bytes.push(63); // Fragezeichen statt eines unbekannten Zeichens
  }
  return bytes;
}

function textbreite(text, groesse) {
  let summe = 0;
  for (const byte of zuWinAnsi(text)) {
    summe += byte >= 32 && byte <= 126 ? BREITEN[byte - 32] : 556;
  }
  return (summe / 1000) * groesse;
}

/** Kuerzt Text auf eine Breite und haengt Auslassungspunkte an. */
function kuerzen(text, groesse, maxBreite) {
  if (maxBreite <= 0 || textbreite(text, groesse) <= maxBreite) return text;
  let gekuerzt = text;
  while (gekuerzt.length > 1 && textbreite(gekuerzt + '…', groesse) > maxBreite) {
    gekuerzt = gekuerzt.slice(0, -1);
  }
  return gekuerzt.trimEnd() + '…';
}

// PDF-Zeichenketten: Klammern und Rueckstrich muessen maskiert werden.
function alsPdfText(text) {
  let raus = '';
  for (const byte of zuWinAnsi(text)) {
    if (byte === 40 || byte === 41 || byte === 92) raus += '\\';
    raus += String.fromCharCode(byte);
  }
  return raus;
}

/*
 * Die Marke im Kopf und in der Fusszeile jedes PDF. Sie steht hier und nicht in den
 * Modulen: Sonst schreibt sie jedes Blatt selbst hin, und beim naechsten
 * Namenswechsel bleibt eines davon stehen. Die Module liefern nur noch den
 * beschreibenden Teil.
 */
export const PDF_MARKE = 'BauZeuge.de';

export const A4 = { breite: 595.28, hoehe: 841.89 };
export const RAND = 48;
export const INNEN = A4.breite - 2 * RAND;

// --------------------------------------------------------------------- Bilder

/**
 * Liest Breite, Hoehe und Farbkanaele aus dem JPEG-Kopf.
 *
 * PDF kann JPEG-Daten unveraendert uebernehmen (Filter DCTDecode), aber es
 * muss vorher wissen, wie gross das Bild ist. Diese Angaben stehen im
 * SOF-Abschnitt, den wir uns hier heraussuchen.
 */
function jpegMasse(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null; // kein JPEG
  let i = 2;
  while (i < bytes.length - 9) {
    if (bytes[i] !== 0xff) { i++; continue; }
    const marke = bytes[i + 1];
    // SOF0 bis SOF15; C4, C8 und CC sind Huffman-Tabellen und kein Rahmen.
    if (marke >= 0xc0 && marke <= 0xcf && marke !== 0xc4 && marke !== 0xc8 && marke !== 0xcc) {
      return {
        hoehe: (bytes[i + 5] << 8) | bytes[i + 6],
        breite: (bytes[i + 7] << 8) | bytes[i + 8],
        kanaele: bytes[i + 9],
      };
    }
    const laenge = (bytes[i + 2] << 8) | bytes[i + 3];
    if (laenge < 2) return null;
    i += 2 + laenge;
  }
  return null;
}

// Fuers PDF reicht deutlich weniger als fuer die Ablage: bei etwa 100 Punkt
// Anzeigehoehe sind 900 Bildpunkte immer noch rund 600 dpi. Ohne dieses
// zweite Verkleinern waere eine Maengelliste mit zwanzig Fotos sechs
// Megabyte gross und liesse sich nicht mehr per Mail verschicken.
const PDF_KANTE = 900;

/**
 * Bereitet ein gespeichertes Foto fuer das PDF auf.
 * Gibt null zurueck, wenn daraus kein einbettbares Bild wird (etwa bei einer
 * hochgeladenen PDF-Rechnung).
 *
 * @param {Blob} blob
 * @returns {Promise<{bytes: Uint8Array, breite: number, hoehe: number, kanaele: number} | null>}
 */
export async function bildLaden(blob) {
  if (!blob || !String(blob.type).startsWith('image/')) return null;
  try {
    const { bildVerkleinern } = await import('./daten.js');
    const klein = await bildVerkleinern(blob, PDF_KANTE, 0.72);
    const bytes = new Uint8Array(await klein.arrayBuffer());
    const masse = jpegMasse(bytes);
    return masse ? { bytes, ...masse } : null;
  } catch (fehler) {
    console.error('Bild fürs PDF nicht lesbar', fehler);
    return null;
  }
}

export class Blatt {
  /**
   * @param {object} optionen
   *   ohneKopf: laesst den Kopf mit Marke und Titel weg. Fuer Schreiben, die
   *   nach aussen gehen: Auf einer Maengelruege hat kein Werbekopf etwas zu
   *   suchen, dort steht der Absender oben.
   */
  constructor({ titel, untertitel = '', fusszeile = '', ohneKopf = false } = {}) {
    this.titel = titel || 'Dokument';
    this.untertitel = untertitel;
    this.fusszeile = fusszeile;
    this.ohneKopf = ohneKopf;
    this.seiten = [];
    this.strom = '';
    this.y = 0;
    this.bilder = [];   // eingebettete Bilder, Reihenfolge bestimmt den Namen
    this.neueSeite();
  }

  /** Ein Bild nur einmal einbetten, auch wenn es mehrfach vorkommt. */
  bildRegistrieren(bild) {
    let platz = this.bilder.indexOf(bild);
    if (platz === -1) platz = this.bilder.push(bild) - 1;
    return 'Im' + platz;
  }

  /**
   * Fotos nebeneinander, bei Bedarf in mehreren Zeilen.
   *
   * @param {Array<{bytes: Uint8Array, breite: number, hoehe: number}>} bilder
   * @param {{hoehe?: number, abstand?: number}} optionen
   */
  bilderreihe(bilder, { hoehe = 96, abstand = 7 } = {}) {
    const brauchbar = bilder.filter(Boolean);
    if (!brauchbar.length) return;

    let x = RAND;
    this.platz(hoehe + 8);

    for (const bild of brauchbar) {
      // Seitenverhaeltnis behalten, aber kein Panorama ueber die halbe Seite.
      const breite = Math.min(INNEN / 2, hoehe * (bild.breite / bild.hoehe));

      if (x > RAND && x + breite > A4.breite - RAND) {
        // Zeile ist voll: umbrechen und notfalls die Seite wechseln.
        this.y -= hoehe + abstand;
        x = RAND;
        this.platz(hoehe + 8);
      }

      const name = this.bildRegistrieren(bild);
      this.strom +=
        'q ' + breite.toFixed(2) + ' 0 0 ' + hoehe.toFixed(2) + ' ' +
        x.toFixed(2) + ' ' + (this.y - hoehe).toFixed(2) + ' cm /' + name + ' Do Q\n';
      x += breite + abstand;
    }

    this.y -= hoehe + 10;
  }

  /**
   * Ein Bild gross und mittig, so gross wie Breite und Restplatz es zulassen.
   * Gibt den belegten Rahmen zurueck, damit sich darauf zeichnen laesst.
   */
  bildGross(bild, { maxHoehe = 430 } = {}) {
    // Erst schauen, ob ueberhaupt noch genug Platz auf der Seite ist.
    if (this.y - 140 < RAND + 26) this.neueSeite();

    const platzHoehe = Math.min(maxHoehe, this.y - RAND - 30);
    let breite = INNEN;
    let hoehe = breite * (bild.hoehe / bild.breite);
    if (hoehe > platzHoehe) {
      hoehe = platzHoehe;
      breite = hoehe * (bild.breite / bild.hoehe);
    }

    const name = this.bildRegistrieren(bild);
    const x = RAND + (INNEN - breite) / 2;
    const unten = this.y - hoehe;
    this.strom +=
      'q ' + breite.toFixed(2) + ' 0 0 ' + hoehe.toFixed(2) + ' ' +
      x.toFixed(2) + ' ' + unten.toFixed(2) + ' cm /' + name + ' Do Q\n';

    this.y = unten - 12;
    return { x, unten, breite, hoehe };
  }

  /**
   * Nummerierte Marke auf einen zuvor gezeichneten Bildrahmen setzen.
   *
   * @param {{x:number, unten:number, breite:number, hoehe:number}} rahmen
   * @param {number} relX  0 bis 1, von links
   * @param {number} relY  0 bis 1, von oben - so liegen die Pins in der App
   */
  marke(rahmen, relX, relY, beschriftung, farbe = [14, 110, 114]) {
    const x = rahmen.x + relX * rahmen.breite;
    // In PDF zeigt die y-Achse nach oben, in der App nach unten.
    const y = rahmen.unten + (1 - relY) * rahmen.hoehe;
    const r = 8.5;
    const k = r * 0.5523; // Bezier-Faktor fuer einen Kreis aus vier Boegen

    const rgb = farbe.map((f) => (f / 255).toFixed(3)).join(' ');
    this.strom +=
      rgb + ' rg 1 1 1 RG 1.2 w\n' +
      `${(x - r).toFixed(2)} ${y.toFixed(2)} m ` +
      `${(x - r).toFixed(2)} ${(y + k).toFixed(2)} ${(x - k).toFixed(2)} ${(y + r).toFixed(2)} ${x.toFixed(2)} ${(y + r).toFixed(2)} c ` +
      `${(x + k).toFixed(2)} ${(y + r).toFixed(2)} ${(x + r).toFixed(2)} ${(y + k).toFixed(2)} ${(x + r).toFixed(2)} ${y.toFixed(2)} c ` +
      `${(x + r).toFixed(2)} ${(y - k).toFixed(2)} ${(x + k).toFixed(2)} ${(y - r).toFixed(2)} ${x.toFixed(2)} ${(y - r).toFixed(2)} c ` +
      `${(x - k).toFixed(2)} ${(y - r).toFixed(2)} ${(x - r).toFixed(2)} ${(y - k).toFixed(2)} ${(x - r).toFixed(2)} ${y.toFixed(2)} c ` +
      'B\n0 0 0 rg 0 G\n';

    const text = String(beschriftung);
    const groesse = text.length > 2 ? 7 : 8.5;
    this.strom +=
      'BT /F2 ' + groesse + ' Tf 1 1 1 rg 1 0 0 1 ' +
      (x - textbreite(text, groesse) / 2).toFixed(2) + ' ' +
      (y - groesse / 2.9).toFixed(2) + ' Tm (' + alsPdfText(text) + ') Tj ET\n0 0 0 rg\n';
  }

  neueSeite() {
    if (this.strom) this.seiten.push(this.strom);
    this.strom = '';
    this.y = A4.hoehe - RAND;
    if (this.seiten.length === 0 && !this.ohneKopf) this.kopfblock();
    else this.y -= 8;
  }

  // Sorgt dafuer, dass noch Platz ist, sonst umbrechen.
  platz(hoehe) {
    if (this.y - hoehe < RAND + 26) this.neueSeite();
  }

  schreibe(text, { groesse = 10, fett = false, x = RAND, farbe = null } = {}) {
    const schrift = fett ? '/F2' : '/F1';
    let block = 'BT ' + schrift + ' ' + groesse + ' Tf ';
    if (farbe) block += farbe.map((k) => (k / 255).toFixed(3)).join(' ') + ' rg ';
    block += '1 0 0 1 ' + x.toFixed(2) + ' ' + this.y.toFixed(2) + ' Tm (' + alsPdfText(text) + ') Tj ET\n';
    if (farbe) block += '0 0 0 rg\n';
    this.strom += block;
  }

  /**
   * Gefuellte Flaeche in Punkten, gemessen von unten links der Seite.
   * Braucht der Balkenplan; Text- und Tabellenbausteine kommen ohne aus.
   */
  flaeche(x, y, breite, hoehe, farbe = [200, 200, 200]) {
    if (breite <= 0 || hoehe <= 0) return;
    this.strom +=
      farbe.map((k) => (k / 255).toFixed(3)).join(' ') + ' rg ' +
      x.toFixed(2) + ' ' + y.toFixed(2) + ' ' +
      breite.toFixed(2) + ' ' + hoehe.toFixed(2) + ' re f 0 0 0 rg\n';
  }

  /** Senkrechte Linie, fuer die Monatsraster des Balkenplans. */
  senkrechte(x, vonY, bisY, farbe = 0.85, staerke = 0.4) {
    this.strom +=
      farbe + ' G ' + staerke + ' w ' + x.toFixed(2) + ' ' + vonY.toFixed(2) +
      ' m ' + x.toFixed(2) + ' ' + bisY.toFixed(2) + ' l S 0 G\n';
  }

  linie(staerke = 0.6, farbe = 0.85) {
    this.strom +=
      farbe + ' G ' + staerke + ' w ' + RAND + ' ' + this.y.toFixed(2) +
      ' m ' + (A4.breite - RAND) + ' ' + this.y.toFixed(2) + ' l S 0 G\n';
  }

  kopfblock() {
    // Dieselbe Schreibweise wie in der Fusszeile und auf der Seite: Das
    // grosse Z in der Mitte ist die Marke, Versalsatz macht es kaputt.
    this.schreibe(PDF_MARKE, { groesse: 9, fett: true, farbe: [10, 81, 85] });
    this.y -= 20;
    this.schreibe(this.titel, { groesse: 18, fett: true });
    this.y -= 15;
    if (this.untertitel) {
      this.schreibe(this.untertitel, { groesse: 10, farbe: [95, 103, 114] });
      this.y -= 12;
    }
    this.y -= 6;
    this.linie(0.8, 0.75);
    this.y -= 18;
  }

  /**
   * Kopf eines Briefes: Absender klein oben, darunter der Empfaenger, rechts
   * das Datum. Entspricht dem, was man aus einem Geschaeftsbrief kennt.
   */
  briefkopf(absender, empfaenger, datum) {
    const absenderzeile = absender.filter(Boolean).join(' · ');
    if (absenderzeile) {
      this.schreibe(absenderzeile, { groesse: 7.5, farbe: [95, 103, 114] });
      this.y -= 4;
      this.linie(0.4, 0.85);
      this.y -= 18;
    }

    const oben = this.y;
    for (const zeile of empfaenger.filter(Boolean)) {
      this.schreibe(zeile, { groesse: 10.5 });
      this.y -= 14;
    }

    if (datum) {
      // Das Datum steht rechts auf Hoehe der ersten Empfaengerzeile.
      const alt = this.y;
      this.y = oben;
      this.schreibe(datum, { groesse: 10.5, x: A4.breite - RAND - textbreite(datum, 10.5) });
      this.y = alt;
    }

    this.y -= 24;
  }

  /** Betreffzeile: fett, mit Luft darunter. */
  betreff(text) {
    this.platz(30);
    this.schreibe(text, { groesse: 11.5, fett: true });
    this.y -= 22;
  }

  /** Zwischentitel im dunklen Petrol der Marke. */
  zwischentitel(text) {
    this.platz(28);
    this.y -= 4;
    this.schreibe(text, { groesse: 10.5, fett: true });
    this.y -= 16;
  }

  ueberschrift(text) {
    this.platz(34);
    this.y -= 8;
    this.schreibe(text, { groesse: 13, fett: true, farbe: [10, 81, 85] });
    this.y -= 16;
  }

  // Bricht laengeren Text auf die Seitenbreite um.
  absatz(text, groesse = 10) {
    const woerter = String(text).split(/\s+/).filter(Boolean);
    let zeile = '';
    for (const wort of woerter) {
      const versuch = zeile ? zeile + ' ' + wort : wort;
      if (textbreite(versuch, groesse) > INNEN && zeile) {
        this.platz(14);
        this.schreibe(zeile, { groesse });
        this.y -= groesse + 3.5;
        zeile = wort;
      } else {
        zeile = versuch;
      }
    }
    if (zeile) {
      this.platz(14);
      this.schreibe(zeile, { groesse });
      this.y -= groesse + 3.5;
    }
    this.y -= 4;
  }

  wertzeile(name, wert, fett = false) {
    this.platz(18);
    this.schreibe(name, { groesse: 10 });
    const groesse = fett ? 11 : 10;
    this.schreibe(wert, {
      groesse, fett,
      x: A4.breite - RAND - textbreite(wert, groesse),
    });
    this.y -= 6;
    this.linie(0.4, 0.9);
    this.y -= 11;
  }

  /**
   * Tabelle mit fester Spaltenaufteilung.
   * @param {string[]} kopf
   * @param {Array<string[]>} zeilen
   * @param {number[]} anteile  Spaltenbreiten als Anteile, Summe beliebig
   * @param {number[]} rechts   Indizes der rechtsbuendigen Spalten
   */
  tabelle(kopf, zeilen, anteile, rechts = []) {
    const summe = anteile.reduce((a, b) => a + b, 0);
    const breiten = anteile.map((a) => (a / summe) * INNEN);
    const x = [];
    let lauf = RAND;
    for (const b of breiten) { x.push(lauf); lauf += b; }

    // Abstand zwischen den Spalten. Ohne ihn stiess ein rechtsbuendiger Wert
    // direkt an den linksbuendigen der naechsten Spalte: "30 cmLeerrohr".
    const LUECKE = 8;

    // Eine Zelle setzen, notfalls gekuerzt. Ueberlanger Text darf nicht in
    // die Nachbarspalte laufen, sonst liest sich die Zeile falsch.
    const zelleSetzen = (inhalt, i, groesse, fett, farbe) => {
      const platzBreite = breiten[i] - LUECKE;
      const text = kuerzen(String(inhalt ?? ''), groesse, platzBreite);
      const pos = rechts.includes(i)
        ? x[i] + breiten[i] - LUECKE - textbreite(text, groesse)
        : x[i];
      this.schreibe(text, { groesse, fett, x: pos, farbe });
    };

    const kopfzeileZeichnen = () => {
      this.platz(26);
      kopf.forEach((zelle, i) => zelleSetzen(zelle, i, 8.5, true, [95, 103, 114]));
      this.y -= 5;
      this.linie(0.6, 0.75);
      this.y -= 12;
    };

    kopfzeileZeichnen();

    for (const zeile of zeilen) {
      if (this.y - 18 < RAND + 26) {
        this.neueSeite();
        kopfzeileZeichnen();
      }
      zeile.forEach((zelle, i) => zelleSetzen(zelle, i, 9.5, false, null));
      this.y -= 5;
      this.linie(0.3, 0.92);
      this.y -= 11;
    }
    this.y -= 6;
  }

  bytes() {
    this.seiten.push(this.strom);
    const anzahl = this.seiten.length;

    // Fusszeile auf jede Seite, erst jetzt, weil die Gesamtzahl feststeht.
    const seitenStroeme = this.seiten.map((strom, i) => {
      const links = this.fusszeile ? PDF_MARKE + ' · ' + this.fusszeile : PDF_MARKE;
      const rechts = 'Seite ' + (i + 1) + ' von ' + anzahl;
      let fuss = '0.6 G 0.5 w ' + RAND + ' ' + (RAND + 14) + ' m ' + (A4.breite - RAND) + ' ' + (RAND + 14) + ' l S 0 G\n';
      fuss += 'BT /F1 7.5 Tf 0.45 0.47 0.5 rg 1 0 0 1 ' + RAND + ' ' + RAND + ' Tm (' + alsPdfText(links) + ') Tj ET\n';
      fuss += 'BT /F1 7.5 Tf 0.45 0.47 0.5 rg 1 0 0 1 ' +
        (A4.breite - RAND - textbreite(rechts, 7.5)).toFixed(2) + ' ' + RAND + ' Tm (' + alsPdfText(rechts) + ') Tj ET\n';
      return strom + fuss;
    });

    // Objekte: 1 Katalog, 2 Seitenbaum, 3 Schrift normal, 4 Schrift fett,
    // danach je Seite ein Seiten- und ein Inhaltsobjekt.
    const objekte = [];
    const seitenIds = seitenStroeme.map((_, i) => 5 + i * 2);
    // Die Bilder bekommen ihre Nummern hinter den Seiten.
    const bildIds = this.bilder.map((_, i) => 5 + anzahl * 2 + i);

    objekte[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objekte[2] = '<< /Type /Pages /Count ' + anzahl + ' /Kids [' +
      seitenIds.map((id) => id + ' 0 R').join(' ') + '] >>';
    objekte[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objekte[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

    // Alle Bilder stehen in den Betriebsmitteln jeder Seite. Das kostet nur
    // ein paar Zeichen im Verzeichnis; die Bilddaten selbst liegen genau
    // einmal im Dokument.
    const bildVerzeichnis = this.bilder.length
      ? ' /XObject << ' + bildIds.map((id, i) => '/Im' + i + ' ' + id + ' 0 R').join(' ') + ' >>'
      : '';

    seitenStroeme.forEach((strom, i) => {
      const seitenId = seitenIds[i];
      objekte[seitenId] =
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + A4.breite + ' ' + A4.hoehe + ']' +
        ' /Resources << /Font << /F1 3 0 R /F2 4 0 R >>' + bildVerzeichnis + ' >>' +
        ' /Contents ' + (seitenId + 1) + ' 0 R >>';
      objekte[seitenId + 1] = { strom };
    });

    this.bilder.forEach((bild, i) => {
      // Ein Farbkanal heisst Graustufen, vier heisst CMYK; alles andere ist RGB.
      const farbraum = bild.kanaele === 1 ? '/DeviceGray'
        : bild.kanaele === 4 ? '/DeviceCMYK' : '/DeviceRGB';
      objekte[bildIds[i]] = {
        roh: bild.bytes,
        kopf: '/Type /XObject /Subtype /Image' +
          ' /Width ' + bild.breite + ' /Height ' + bild.hoehe +
          ' /ColorSpace ' + farbraum + ' /BitsPerComponent 8 /Filter /DCTDecode',
      };
    });

    // Zusammenbauen und dabei die Byte-Abstaende fuer die Querverweistabelle
    // mitschreiben.
    const teile = [];
    let laenge = 0;
    const dazu = (stueck) => {
      const bytes = typeof stueck === 'string'
        ? Uint8Array.from(zuWinAnsi(stueck))
        : stueck;
      teile.push(bytes);
      laenge += bytes.length;
    };

    dazu('%PDF-1.4\n');
    const abstaende = [];
    for (let i = 1; i < objekte.length; i++) {
      const objekt = objekte[i];
      if (objekt === undefined) continue;
      abstaende[i] = laenge;
      if (typeof objekt === 'string') {
        dazu(i + ' 0 obj\n' + objekt + '\nendobj\n');
      } else {
        // Bilddaten liegen schon als Bytes vor; Textstroeme muessen erst
        // nach WinAnsi umgesetzt werden.
        const roh = objekt.roh ?? Uint8Array.from(zuWinAnsi(objekt.strom));
        const kopf = objekt.kopf ? objekt.kopf + ' ' : '';
        dazu(i + ' 0 obj\n<< ' + kopf + '/Length ' + roh.length + ' >>\nstream\n');
        dazu(roh);
        dazu('\nendstream\nendobj\n');
      }
    }

    const xrefAbstand = laenge;
    const hoechste = objekte.length;
    let xref = 'xref\n0 ' + hoechste + '\n0000000000 65535 f \n';
    for (let i = 1; i < hoechste; i++) {
      xref += String(abstaende[i] ?? 0).padStart(10, '0') + ' 00000 n \n';
    }
    dazu(xref);
    dazu('trailer\n<< /Size ' + hoechste + ' /Root 1 0 R >>\nstartxref\n' + xrefAbstand + '\n%%EOF\n');

    const alles = new Uint8Array(laenge);
    let stelle = 0;
    for (const teil of teile) { alles.set(teil, stelle); stelle += teil.length; }
    return alles;
  }

  blob() {
    return new Blob([this.bytes()], { type: 'application/pdf' });
  }
}

/**
 * Gibt das PDF an das Telefon weiter: erst in den Zwischenspeicher schreiben,
 * dann das Android-Teilen-Menue oeffnen. Im Browser faellt es auf einen
 * gewoehnlichen Download zurueck, damit sich dieselbe Datei am Rechner
 * pruefen laesst.
 */
export async function pdfTeilen(blob, dateiname, titel = 'BauZeuge') {
  // Ohne Bundler gibt es kein "import '@capacitor/share'": Capacitor haengt
  // die nativen Erweiterungen zur Laufzeit unter Capacitor.Plugins ein.
  const bruecke = window.Capacitor;
  const nativ = bruecke && bruecke.isNativePlatform && bruecke.isNativePlatform();

  if (nativ && bruecke.Plugins && bruecke.Plugins.Filesystem && bruecke.Plugins.Share) {
    const { Filesystem, Share } = bruecke.Plugins;

    const daten = await new Promise((fertig, fehler) => {
      const leser = new FileReader();
      leser.onerror = () => fehler(leser.error);
      leser.onload = () => fertig(String(leser.result).split(',')[1]);
      leser.readAsDataURL(blob);
    });

    const geschrieben = await Filesystem.writeFile({
      path: dateiname,
      data: daten,
      directory: 'CACHE',
    });
    await Share.share({ title: titel, url: geschrieben.uri });
    return;
  }

  // Im Browser: gewoehnlicher Download, damit sich dieselbe Datei am Rechner
  // pruefen laesst.
  const url = URL.createObjectURL(blob);
  const verweis = document.createElement('a');
  verweis.href = url;
  verweis.download = dateiname;
  verweis.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
