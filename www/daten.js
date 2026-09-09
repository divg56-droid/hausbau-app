// Datenhaltung auf dem Geraet.
//
// IndexedDB statt localStorage, weil Fotos als Blob gespeichert werden und
// localStorage bei 5 MB dicht macht. Ein einziges Bild vom Handy waere schon
// die Haelfte davon.
//
// Jeder Datensatz traegt drei Felder, die der spaetere Abgleich mit dem
// Server braucht:
//
//   id         weltweit eindeutige Kennung, nicht die frueher hochgezaehlte
//              Nummer. Zwei Geraete vergaben sonst beide die 1 und
//              ueberschrieben sich gegenseitig.
//   geaendert  Zeitpunkt der letzten Aenderung. Beim Zusammenfuehren gewinnt
//              der neuere Stand.
//   geloescht  Grabstein. Ein einfach entfernter Satz kaeme beim naechsten
//              Abgleich vom anderen Geraet zurueck, weil der ihn noch kennt.

const DB_NAME = 'hausbau';
const DB_VERSION = 2;

// Wo Eintraege zu einem Elternobjekt gehoeren (Pins zu einem Geschoss), steht
// dessen Kennung als Feld drin und bekommt einen Index.
const SPEICHER = {
  einstellungen: { schluessel: 'name' },
  darlehen: { indizes: [] },
  belege: { indizes: ['datum'] },
  geschosse: { indizes: [] },
  pins: { indizes: ['geschossId'] },
  maengel: { indizes: ['status', 'raum'] },
  aufgaben: { indizes: ['phase'] },
  tagebuch: { indizes: ['datum'] },
  kontakte: { indizes: [] },
  bilder: { indizes: [] },
};

// Einzelne Verweise: Feld -> Speicher, auf den es zeigt.
const VERWEISE = {
  geschosse: { bildId: 'bilder' },
  pins: { geschossId: 'geschosse', bildId: 'bilder' },
  belege: { kontaktId: 'kontakte', quelleId: 'darlehen', bildId: 'bilder' },
  maengel: { kontaktId: 'kontakte' },
  aufgaben: { vorgaengerId: 'aufgaben', kontaktId: 'kontakte', mangelId: 'maengel' },
};

// Verweislisten: Feld enthaelt ein Feld von Kennungen.
const VERWEISLISTEN = {
  maengel: { bildIds: 'bilder' },
  tagebuch: { bildIds: 'bilder', helferIds: 'kontakte' },
};

/** Weltweit eindeutige Kennung, ohne Absprache zwischen den Geraeten. */
export function neueKennung() {
  if (globalThis.crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Aeltere WebViews kennen randomUUID noch nicht.
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const jetzt = () => new Date().toISOString();

let dbVersprechen = null;

function db() {
  if (dbVersprechen) return dbVersprechen;
  dbVersprechen = new Promise((fertig, fehler) => {
    const anfrage = indexedDB.open(DB_NAME, DB_VERSION);
    anfrage.onupgradeneeded = (ereignis) => {
      const d = anfrage.result;
      if (ereignis.oldVersion < 1) {
        anlegen(d);
        return;
      }
      if (ereignis.oldVersion < 2) {
        aufKennungenUmstellen(d, anfrage.transaction);
      }
    };
    anfrage.onsuccess = () => fertig(anfrage.result);
    anfrage.onerror = () => fehler(anfrage.error);
    anfrage.onblocked = () =>
      fehler(new Error('Die App ist in einem anderen Fenster offen. Bitte dort schließen.'));
  });
  return dbVersprechen;
}

function anlegen(d) {
  for (const [name, aufbau] of Object.entries(SPEICHER)) {
    if (d.objectStoreNames.contains(name)) continue;
    const s = d.createObjectStore(name, { keyPath: aufbau.schluessel || 'id' });
    for (const feld of aufbau.indizes || []) s.createIndex(feld, feld);
  }
}

/**
 * Wandert von Fassung 1 (hochgezaehlte Nummern) auf Fassung 2 (Kennungen).
 *
 * Laeuft vollstaendig in der Aenderungstransaktion: erst alles einlesen, dann
 * die Speicher neu anlegen, dann die umgeschriebenen Saetze zurueck. Bricht
 * etwas ab, wird die ganze Transaktion verworfen und die alten Daten bleiben
 * stehen.
 */
function aufKennungenUmstellen(d, t) {
  const zuWandeln = Object.keys(SPEICHER).filter((n) => n !== 'einstellungen');
  const inhalt = {};
  let offen = zuWandeln.length;
  let gestartet = false;

  const vielleichtSchreiben = () => {
    if (offen > 0 || gestartet) return;
    gestartet = true;
    schreiben();
  };

  for (const name of zuWandeln) {
    if (!d.objectStoreNames.contains(name)) {
      inhalt[name] = [];
      offen--;
      continue;
    }
    const anfrage = t.objectStore(name).getAll();
    anfrage.onsuccess = () => {
      inhalt[name] = anfrage.result || [];
      offen--;
      vielleichtSchreiben();
    };
  }
  vielleichtSchreiben();

  function schreiben() {
    const zeit = jetzt();

    // Erst fuer jeden alten Satz eine Kennung vergeben. Das muss vollstaendig
    // geschehen, bevor Verweise umgeschrieben werden: aufgaben.vorgaengerId
    // zeigt auf denselben Speicher.
    const karte = {};
    for (const name of zuWandeln) {
      karte[name] = new Map();
      for (const satz of inhalt[name]) karte[name].set(satz.id, neueKennung());
    }

    for (const name of zuWandeln) {
      if (d.objectStoreNames.contains(name)) d.deleteObjectStore(name);
      const s = d.createObjectStore(name, { keyPath: 'id' });
      for (const feld of SPEICHER[name].indizes || []) s.createIndex(feld, feld);
      for (const satz of inhalt[name]) s.put(umschreiben(name, satz, karte, zeit));
    }

    // Einstellungen behalten ihren Namensschluessel und haben keine Verweise.
    if (d.objectStoreNames.contains('einstellungen')) {
      const s = t.objectStore('einstellungen');
      const a = s.getAll();
      a.onsuccess = () => {
        for (const e of a.result || []) s.put({ ...e, geaendert: e.geaendert || zeit });
      };
    }
  }
}

/**
 * Schreibt die Verweise eines Satzes auf die neuen Kennungen um.
 * Getrennt und ausgefuehrt, damit sie sich ohne Datenbank pruefen laesst
 * (siehe test.mjs) - hier stecken die Fehler, die Daten kosten.
 */
export function umschreiben(name, satz, karte, zeit) {
  const neu = {
    ...satz,
    id: karte[name].get(satz.id),
    geaendert: satz.geaendert || zeit,
    geloescht: false,
  };

  for (const [feld, ziel] of Object.entries(VERWEISE[name] || {})) {
    if (satz[feld] === null || satz[feld] === undefined) continue;
    neu[feld] = (karte[ziel] && karte[ziel].get(satz[feld])) || null;
  }

  for (const [feld, ziel] of Object.entries(VERWEISLISTEN[name] || {})) {
    if (!Array.isArray(satz[feld])) continue;
    neu[feld] = satz[feld]
      .map((alt) => karte[ziel] && karte[ziel].get(alt))
      .filter(Boolean);
  }

  // Die Helferliste des Tagebuchs traegt die Kennung im Objekt.
  if (name === 'tagebuch' && Array.isArray(satz.helfer)) {
    neu.helfer = satz.helfer
      .map((h) => ({ ...h, id: karte.kontakte && karte.kontakte.get(h.id) }))
      .filter((h) => h.id);
  }

  return neu;
}

function lauf(speicher, modus, arbeit) {
  return db().then(
    (d) =>
      new Promise((fertig, fehler) => {
        const t = d.transaction(speicher, modus);
        const anfrage = arbeit(t.objectStore(speicher));
        t.onerror = () => fehler(t.error);
        t.onabort = () => fehler(t.error || new Error('Transaktion abgebrochen'));
        t.oncomplete = () => fertig(anfrage ? anfrage.result : undefined);
      })
  );
}

const lebendig = (liste) => (liste || []).filter((s) => s && !s.geloescht);

export const daten = {
  alle: (speicher) => lauf(speicher, 'readonly', (s) => s.getAll()).then(lebendig),

  holen: (speicher, id) =>
    lauf(speicher, 'readonly', (s) => s.get(id)).then((satz) =>
      satz && !satz.geloescht ? satz : undefined
    ),

  // Nach Index filtern, z. B. alle Pins eines Geschosses.
  nach: (speicher, feld, wert) =>
    lauf(speicher, 'readonly', (s) => s.index(feld).getAll(wert)).then(lebendig),

  /**
   * Ohne Kennung wird angelegt, mit Kennung ueberschrieben.
   * @param {object} optionen  zeitBehalten: vorhandenes geaendert nicht
   *                           ueberschreiben, fuer das Einlesen einer Sicherung
   * @returns {Promise<string>} die Kennung des Satzes
   */
  sichern: async (speicher, objekt, optionen = {}) => {
    const satz = { ...objekt };
    if (speicher === 'einstellungen') {
      satz.geaendert = optionen.zeitBehalten && satz.geaendert ? satz.geaendert : jetzt();
      await lauf(speicher, 'readwrite', (s) => s.put(satz));
      return satz.name;
    }
    if (!satz.id) satz.id = neueKennung();
    if (satz.geloescht === undefined) satz.geloescht = false;
    satz.geaendert = optionen.zeitBehalten && satz.geaendert ? satz.geaendert : jetzt();
    await lauf(speicher, 'readwrite', (s) => s.put(satz));
    return satz.id;
  },

  /**
   * Setzt einen Grabstein statt wirklich zu loeschen. Die uebrigen Felder
   * fallen dabei weg: Der Satz ist fort, und bei Bildern gibt das ausserdem
   * den belegten Platz frei.
   */
  loeschen: async (speicher, id) => {
    if (speicher === 'einstellungen') {
      return lauf(speicher, 'readwrite', (s) => s.delete(id));
    }
    await lauf(speicher, 'readwrite', (s) =>
      s.put({ id, geloescht: true, geaendert: jetzt() })
    );
  },

  /** Wirklich alles weg, ohne Grabsteine. Fuer "alle Daten loeschen". */
  leeren: (speicher) => lauf(speicher, 'readwrite', (s) => s.clear()),

  /** Auch die Grabsteine, fuer den spaeteren Abgleich mit dem Server. */
  alleMitGrabsteinen: (speicher) => lauf(speicher, 'readonly', (s) => s.getAll()),
};

// --------------------------------------------------------------- Einstellungen

export async function einstellung(name, wert) {
  if (wert === undefined) {
    const eintrag = await daten.holen('einstellungen', name);
    return eintrag ? eintrag.wert : undefined;
  }
  await daten.sichern('einstellungen', { name, wert });
  return wert;
}

// ---------------------------------------------------------------------- Bilder

// Fotos vom Handy sind 3 bis 12 MB gross. Ungeschrumpft ist die Datenbank
// nach dreissig Bildern voll und die App traege. 1600 px lange Kante bei
// Qualitaet 0,8 reicht fuer jede Dokumentation und landet bei etwa 300 KB.
const MAX_KANTE = 1600;

/**
 * @param {Blob} datei
 * @param {number} maxKante  laengste Kante in Bildpunkten; fuers PDF wird
 *                           kleiner verkleinert als fuer die Ablage
 * @param {number} guete     JPEG-Qualitaet zwischen 0 und 1
 */
export function bildVerkleinern(datei, maxKante = MAX_KANTE, guete = 0.8) {
  return new Promise((fertig, fehler) => {
    const leser = new FileReader();
    leser.onerror = () => fehler(leser.error);
    leser.onload = () => {
      const bild = new Image();
      bild.onerror = () => fehler(new Error('Bild nicht lesbar'));
      bild.onload = () => {
        const faktor = Math.min(1, maxKante / Math.max(bild.width, bild.height));
        const leinwand = document.createElement('canvas');
        leinwand.width = Math.round(bild.width * faktor);
        leinwand.height = Math.round(bild.height * faktor);
        leinwand.getContext('2d').drawImage(bild, 0, 0, leinwand.width, leinwand.height);
        leinwand.toBlob((b) => (b ? fertig(b) : fehler(new Error('Umwandlung fehlgeschlagen'))), 'image/jpeg', guete);
      };
      bild.src = leser.result;
    };
    leser.readAsDataURL(datei);
  });
}

// Legt ein Bild ab und gibt die Kennung zurueck. PDFs werden unveraendert
// gespeichert, die lassen sich nicht ueber ein Canvas schrumpfen.
export async function bildAblegen(datei) {
  const istPdf = datei.type === 'application/pdf';
  const inhalt = istPdf ? datei : await bildVerkleinern(datei);
  return daten.sichern('bilder', {
    blob: inhalt,
    typ: inhalt.type || datei.type,
    name: datei.name || 'aufnahme.jpg',
    angelegt: new Date().toISOString(),
  });
}

// Objekt-URLs muessen wieder freigegeben werden, sonst waechst der Speicher
// bei jedem Blaettern durch eine Liste.
const offeneUrls = new Map();

export async function bildUrl(id) {
  if (!id) return null;
  if (offeneUrls.has(id)) return offeneUrls.get(id);
  const eintrag = await daten.holen('bilder', id);
  if (!eintrag || !eintrag.blob) return null;
  const url = URL.createObjectURL(eintrag.blob);
  offeneUrls.set(id, url);
  return url;
}

export function bildUrlsFreigeben() {
  for (const url of offeneUrls.values()) URL.revokeObjectURL(url);
  offeneUrls.clear();
}

export async function bildLoeschen(id) {
  if (!id) return;
  if (offeneUrls.has(id)) {
    URL.revokeObjectURL(offeneUrls.get(id));
    offeneUrls.delete(id);
  }
  await daten.loeschen('bilder', id);
}
