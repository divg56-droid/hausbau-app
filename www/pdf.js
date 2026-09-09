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

// PDF-Zeichenketten: Klammern und Rueckstrich muessen maskiert werden.
function alsPdfText(text) {
  let raus = '';
  for (const byte of zuWinAnsi(text)) {
    if (byte === 40 || byte === 41 || byte === 92) raus += '\\';
    raus += String.fromCharCode(byte);
  }
  return raus;
}

const A4 = { breite: 595.28, hoehe: 841.89 };
const RAND = 48;
const INNEN = A4.breite - 2 * RAND;

export class Blatt {
  constructor({ titel, untertitel = '', fusszeile = '' } = {}) {
    this.titel = titel || 'Dokument';
    this.untertitel = untertitel;
    this.fusszeile = fusszeile;
    this.seiten = [];
    this.strom = '';
    this.y = 0;
    this.neueSeite();
  }

  neueSeite() {
    if (this.strom) this.seiten.push(this.strom);
    this.strom = '';
    this.y = A4.hoehe - RAND;
    if (this.seiten.length === 0) this.kopfblock();
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

  linie(staerke = 0.6, farbe = 0.85) {
    this.strom +=
      farbe + ' G ' + staerke + ' w ' + RAND + ' ' + this.y.toFixed(2) +
      ' m ' + (A4.breite - RAND) + ' ' + this.y.toFixed(2) + ' l S 0 G\n';
  }

  kopfblock() {
    this.schreibe('HAUSBAU APP', { groesse: 9, fett: true, farbe: [138, 90, 8] });
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

  ueberschrift(text) {
    this.platz(34);
    this.y -= 8;
    this.schreibe(text, { groesse: 13, fett: true, farbe: [138, 90, 8] });
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

    const kopfzeileZeichnen = () => {
      this.platz(26);
      kopf.forEach((zelle, i) => {
        const pos = rechts.includes(i) ? x[i] + breiten[i] - textbreite(zelle, 8.5) : x[i];
        this.schreibe(zelle, { groesse: 8.5, fett: true, x: pos, farbe: [95, 103, 114] });
      });
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
      zeile.forEach((zelle, i) => {
        const inhalt = String(zelle ?? '');
        const pos = rechts.includes(i) ? x[i] + breiten[i] - textbreite(inhalt, 9.5) : x[i];
        this.schreibe(inhalt, { groesse: 9.5, x: pos });
      });
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
      const links = this.fusszeile;
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

    objekte[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objekte[2] = '<< /Type /Pages /Count ' + anzahl + ' /Kids [' +
      seitenIds.map((id) => id + ' 0 R').join(' ') + '] >>';
    objekte[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objekte[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

    seitenStroeme.forEach((strom, i) => {
      const seitenId = seitenIds[i];
      objekte[seitenId] =
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + A4.breite + ' ' + A4.hoehe + ']' +
        ' /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + (seitenId + 1) + ' 0 R >>';
      objekte[seitenId + 1] = { strom };
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
        const roh = Uint8Array.from(zuWinAnsi(objekt.strom));
        dazu(i + ' 0 obj\n<< /Length ' + roh.length + ' >>\nstream\n');
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
export async function pdfTeilen(blob, dateiname, titel = 'Hausbau App') {
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
