// Datenhaltung: alles bleibt auf dem Geraet. Kein Server, kein Konto.
//
// IndexedDB statt localStorage, weil Fotos als Blob gespeichert werden und
// localStorage bei 5 MB dicht macht. Ein einziges Bild vom Handy waere schon
// die Haelfte davon.

const DB_NAME = 'hausbau';
const DB_VERSION = 1;

// Jeder Speicher haelt Objekte mit automatischer id. Wo Eintraege zu einem
// Elternobjekt gehoeren (Pins zu einem Geschoss), steht die Eltern-id als
// Feld drin und bekommt einen Index.
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

let dbVersprechen = null;

function db() {
  if (dbVersprechen) return dbVersprechen;
  dbVersprechen = new Promise((fertig, fehler) => {
    const anfrage = indexedDB.open(DB_NAME, DB_VERSION);
    anfrage.onupgradeneeded = () => {
      const d = anfrage.result;
      for (const [name, aufbau] of Object.entries(SPEICHER)) {
        if (d.objectStoreNames.contains(name)) continue;
        const s = aufbau.schluessel
          ? d.createObjectStore(name, { keyPath: aufbau.schluessel })
          : d.createObjectStore(name, { keyPath: 'id', autoIncrement: true });
        for (const feld of aufbau.indizes || []) s.createIndex(feld, feld);
      }
    };
    anfrage.onsuccess = () => fertig(anfrage.result);
    anfrage.onerror = () => fehler(anfrage.error);
  });
  return dbVersprechen;
}

function lauf(speicher, modus, arbeit) {
  return db().then(
    (d) =>
      new Promise((fertig, fehler) => {
        const t = d.transaction(speicher, modus);
        const anfrage = arbeit(t.objectStore(speicher));
        t.onerror = () => fehler(t.error);
        t.oncomplete = () => fertig(anfrage ? anfrage.result : undefined);
      })
  );
}

export const daten = {
  alle: (speicher) => lauf(speicher, 'readonly', (s) => s.getAll()),

  holen: (speicher, id) => lauf(speicher, 'readonly', (s) => s.get(id)),

  // Nach Index filtern, z. B. alle Pins eines Geschosses.
  nach: (speicher, feld, wert) =>
    lauf(speicher, 'readonly', (s) => s.index(feld).getAll(wert)),

  // Ohne id wird angelegt, mit id ueberschrieben.
  sichern: (speicher, objekt) => lauf(speicher, 'readwrite', (s) => s.put(objekt)),

  loeschen: (speicher, id) => lauf(speicher, 'readwrite', (s) => s.delete(id)),

  leeren: (speicher) => lauf(speicher, 'readwrite', (s) => s.clear()),
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

export function bildVerkleinern(datei) {
  return new Promise((fertig, fehler) => {
    const leser = new FileReader();
    leser.onerror = () => fehler(leser.error);
    leser.onload = () => {
      const bild = new Image();
      bild.onerror = () => fehler(new Error('Bild nicht lesbar'));
      bild.onload = () => {
        const faktor = Math.min(1, MAX_KANTE / Math.max(bild.width, bild.height));
        const leinwand = document.createElement('canvas');
        leinwand.width = Math.round(bild.width * faktor);
        leinwand.height = Math.round(bild.height * faktor);
        leinwand.getContext('2d').drawImage(bild, 0, 0, leinwand.width, leinwand.height);
        leinwand.toBlob((b) => (b ? fertig(b) : fehler(new Error('Umwandlung fehlgeschlagen'))), 'image/jpeg', 0.8);
      };
      bild.src = leser.result;
    };
    leser.readAsDataURL(datei);
  });
}

// Legt ein Bild ab und gibt die id zurueck. PDFs werden unveraendert
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
  if (!eintrag) return null;
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
