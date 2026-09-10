// Excel-Ausgabe, ohne Bibliothek.
//
// CSV gibt es daneben und bleibt fuer vieles das Richtige. Eine echte
// xlsx-Datei kann aber drei Dinge, die CSV nicht kann, und genau die werden
// gebraucht, wenn die Kostenaufstellung zur Bank geht:
//
//   Zahlen sind Zahlen     In CSV entscheidet die Spracheinstellung des
//                          Lesers, ob "1250,5" eine Zahl oder Text ist.
//   Spalten haben Breiten  Sonst steht ueberall "####" und der Empfaenger
//                          zieht erst einmal fuenfzehn Spalten breit.
//   Die Kopfzeile ist fett Sie friert sich ausserdem beim Rollen ein.
//
// Eine xlsx-Datei ist ein ZIP mit ein paar XML-Dateien darin. Gepackt wird
// nicht ("Methode 0", gespeichert): Das spart den halben Code, und bei den
// Datenmengen eines Einfamilienhauses spart Packen nichts, was zaehlt.

const roher = new TextEncoder();

// ------------------------------------------------------------------- ZIP

const CRC_TABELLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABELLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Feste Uhrzeit im Archiv: 1.1.2020, 0:00. Das Datum steht ohnehin in der
// Datei selbst, und ein fester Wert macht die Ausgabe wiederholbar.
const ZEIT = 0;
const DATUM = ((2020 - 1980) << 9) | (1 << 5) | 1;

/**
 * Packt Dateien in ein ZIP, ungepackt.
 *
 * @param {Array<{name: string, inhalt: string}>} dateien
 * @returns {Uint8Array}
 */
function zip(dateien) {
  const teile = [];
  const verzeichnis = [];
  let versatz = 0;

  for (const datei of dateien) {
    const name = roher.encode(datei.name);
    const inhalt = roher.encode(datei.inhalt);
    const pruef = crc32(inhalt);

    const kopf = new Uint8Array(30 + name.length);
    const k = new DataView(kopf.buffer);
    k.setUint32(0, 0x04034b50, true);   // Kennung
    k.setUint16(4, 20, true);           // benoetigte Fassung
    k.setUint16(6, 0, true);            // Merkmale
    k.setUint16(8, 0, true);            // Methode 0: gespeichert
    k.setUint16(10, ZEIT, true);
    k.setUint16(12, DATUM, true);
    k.setUint32(14, pruef, true);
    k.setUint32(18, inhalt.length, true);
    k.setUint32(22, inhalt.length, true);
    k.setUint16(26, name.length, true);
    k.setUint16(28, 0, true);
    kopf.set(name, 30);

    teile.push(kopf, inhalt);

    const eintrag = new Uint8Array(46 + name.length);
    const e = new DataView(eintrag.buffer);
    e.setUint32(0, 0x02014b50, true);
    e.setUint16(4, 20, true);           // erzeugende Fassung
    e.setUint16(6, 20, true);
    e.setUint16(8, 0, true);
    e.setUint16(10, 0, true);
    e.setUint16(12, ZEIT, true);
    e.setUint16(14, DATUM, true);
    e.setUint32(16, pruef, true);
    e.setUint32(20, inhalt.length, true);
    e.setUint32(24, inhalt.length, true);
    e.setUint16(28, name.length, true);
    e.setUint32(42, versatz, true);
    eintrag.set(name, 46);
    verzeichnis.push(eintrag);

    versatz += kopf.length + inhalt.length;
  }

  const verzeichnisGroesse = verzeichnis.reduce((s, v) => s + v.length, 0);
  const ende = new Uint8Array(22);
  const x = new DataView(ende.buffer);
  x.setUint32(0, 0x06054b50, true);
  x.setUint16(8, dateien.length, true);
  x.setUint16(10, dateien.length, true);
  x.setUint32(12, verzeichnisGroesse, true);
  x.setUint32(16, versatz, true);

  const alle = [...teile, ...verzeichnis, ende];
  const gesamt = alle.reduce((s, t) => s + t.length, 0);
  const daten = new Uint8Array(gesamt);
  let stelle = 0;
  for (const t of alle) {
    daten.set(t, stelle);
    stelle += t.length;
  }
  return daten;
}

// ------------------------------------------------------------------- XML

const xmlText = (wert) =>
  String(wert)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Steuerzeichen ausser Tabulator, Zeilenvorschub und Wagenruecklauf sind
    // in XML nicht erlaubt und machen die Datei fuer Excel unlesbar.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

/** Spaltenbuchstabe zur Nummer: 1 -> A, 27 -> AA. */
export function spalte(nummer) {
  let name = '';
  let n = nummer;
  while (n > 0) {
    const rest = (n - 1) % 26;
    name = String.fromCharCode(65 + rest) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function zelle(wert, bezug, stil) {
  const s = stil ? ` s="${stil}"` : '';
  if (typeof wert === 'number' && Number.isFinite(wert)) {
    return `<c r="${bezug}"${s}><v>${wert}</v></c>`;
  }
  if (wert === null || wert === undefined || wert === '') return `<c r="${bezug}"${s}/>`;
  // Zeichenketten stehen unmittelbar in der Zelle statt in einer eigenen
  // Tabelle. Das ist groesser, aber es spart die halbe Datei an Aufbau.
  return `<c r="${bezug}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlText(wert)}</t></is></c>`;
}

/**
 * Baut eine xlsx-Datei mit einem Blatt.
 *
 * @param {string[]} kopf    Spaltenueberschriften
 * @param {Array[]} zeilen   je Zeile ein Feld mit Werten in Spaltenreihenfolge
 * @param {string} blattname erscheint auf dem Reiter unten
 * @returns {Uint8Array}
 */
export function xlsxBytes(kopf, zeilen, blattname = 'Tabelle1') {
  // Excel erlaubt im Blattnamen kein : \ / ? * [ ] und hoechstens 31 Zeichen.
  const reiter = xmlText(String(blattname).replace(/[:\\/?*[\]]/g, ' ').slice(0, 31)) || 'Tabelle1';

  const breiten = kopf.map((titel, i) => {
    const laengste = zeilen.reduce(
      (lang, z) => Math.max(lang, String(z[i] ?? '').length),
      String(titel).length
    );
    // Zwei Zeichen Luft, aber nicht breiter als der Bildschirm.
    return Math.min(60, Math.max(9, laengste + 2));
  });

  const zeilenXml = [
    `<row r="1">${kopf.map((t, i) => zelle(t, spalte(i + 1) + '1', 1)).join('')}</row>`,
    ...zeilen.map((z, r) =>
      `<row r="${r + 2}">${z.map((w, i) => zelle(w, spalte(i + 1) + (r + 2))).join('')}</row>`
    ),
  ].join('');

  const blatt =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    // Die Kopfzeile bleibt beim Rollen stehen. Bei achtzig Positionen ist das
    // der Unterschied zwischen brauchbar und nicht.
    '<sheetViews><sheetView workbookViewId="0">' +
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    '</sheetView></sheetViews>' +
    '<cols>' +
    breiten.map((b, i) => `<col min="${i + 1}" max="${i + 1}" width="${b}" customWidth="1"/>`).join('') +
    '</cols>' +
    `<sheetData>${zeilenXml}</sheetData>` +
    // Der Autofilter macht aus der Kopfzeile Schaltflaechen zum Sortieren.
    `<autoFilter ref="A1:${spalte(kopf.length)}${zeilen.length + 1}"/>` +
    '</worksheet>';

  return zip([
    {
      name: '[Content_Types].xml',
      inhalt:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>',
    },
    {
      name: '_rels/.rels',
      inhalt:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    },
    {
      name: 'xl/workbook.xml',
      inhalt:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        `<sheets><sheet name="${reiter}" sheetId="1" r:id="rId1"/></sheets>` +
        '</workbook>',
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      inhalt:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>',
    },
    {
      // Zwei Schriftschnitte, zwei Formate: normal und fett. Mehr braucht
      // eine Tabelle mit einer Kopfzeile nicht.
      name: 'xl/styles.xml',
      inhalt:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<fonts count="2">' +
        '<font><sz val="11"/><name val="Calibri"/></font>' +
        '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
        '</fonts>' +
        '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>' +
        '<borders count="1"><border/></borders>' +
        '<cellStyleXfs count="1"><xf/></cellStyleXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
        '<cellXfs count="2">' +
        '<xf xfId="0" fontId="0"/>' +
        '<xf xfId="0" fontId="1" applyFont="1"/>' +
        '</cellXfs>' +
        '</styleSheet>',
    },
    { name: 'xl/worksheets/sheet1.xml', inhalt: blatt },
  ]);
}

export function xlsxBlob(kopf, zeilen, blattname) {
  return new Blob([xlsxBytes(kopf, zeilen, blattname)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/** Erzeugt die Datei und reicht sie ans Teilen-Menue weiter, wie CSV und PDF. */
export async function xlsxTeilen(kopf, zeilen, dateiname, titel) {
  const { pdfTeilen } = await import('./pdf.js');
  await pdfTeilen(xlsxBlob(kopf, zeilen, titel), dateiname, titel || dateiname);
}
