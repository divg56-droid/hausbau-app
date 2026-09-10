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
const DB_VERSION = 10;

// Wo Eintraege zu einem Elternobjekt gehoeren (Pins zu einem Geschoss), steht
// dessen Kennung als Feld drin und bekommt einen Index.
const SPEICHER = {
  einstellungen: { schluessel: 'name' },
  // Die Bauprojekte selbst. Der einzige Speicher neben den Einstellungen und
  // den Bildern, der nicht nach Projekt gefiltert wird -- er ist die Liste,
  // aus der gefiltert wird.
  projekte: { indizes: [] },
  darlehen: { indizes: [] },
  // Bauleitfaden: nur der Haken je Punkt. Der Text steht im Programm, und
  // die Kennung des Punktes ist zugleich die des Satzes. So gibt es je Punkt
  // genau einen Datensatz, auch wenn zwei Geraete ihn abhaken.
  leitfaden: { indizes: [] },
  // Kostenpositionen: was geplant war und was es wirklich wurde.
  posten: { indizes: ['gewerk'] },
  // Angebote zu einer Position. Mehrere je Position, genau darum geht es.
  angebote: { indizes: ['postenId'] },
  belege: { indizes: ['datum'] },
  geschosse: { indizes: [] },
  // Raeume: das, worauf sich Maengel, Kosten und Fotos beziehen.
  raeume: { indizes: ['geschossId'] },
  pins: { indizes: ['geschossId'] },
  maengel: { indizes: ['status', 'raum'] },
  aufgaben: { indizes: ['phase'] },
  // To-Dos und Checklisten: dasselbe mit und ohne Listennamen. Ein einziger
  // Speicher, sonst gaebe es zwei Wege, dieselbe Zahl auszurechnen.
  todos: { indizes: ['liste'] },
  // Dokumentenablage. Die Datei selbst liegt im Bilderspeicher; hier steht
  // nur, was sie ist und wozu sie gehoert.
  dokumente: { indizes: ['art'] },
  // Baudokumentation: Fotos je Bauabschnitt. Getrennt vom Tagebuch, weil es
  // den Zustand des Hauses festhaelt und nicht die Anwesenheit von Menschen.
  baudoku: { indizes: ['phase'] },
  tagebuch: { indizes: ['datum'] },
  kontakte: { indizes: [] },
  bilder: { indizes: [] },
};

// Einzelne Verweise: Feld -> Speicher, auf den es zeigt.
const VERWEISE = {
  geschosse: { bildId: 'bilder' },
  pins: { geschossId: 'geschosse', bildId: 'bilder' },
  raeume: { geschossId: 'geschosse' },
  posten: { kontaktId: 'kontakte', raumId: 'raeume' },
  angebote: { postenId: 'posten', kontaktId: 'kontakte', bildId: 'bilder' },
  belege: { kontaktId: 'kontakte', quelleId: 'darlehen', bildId: 'bilder', postenId: 'posten' },
  maengel: { kontaktId: 'kontakte', raumId: 'raeume' },
  aufgaben: { vorgaengerId: 'aufgaben', kontaktId: 'kontakte', mangelId: 'maengel' },
  dokumente: { mangelId: 'maengel', postenId: 'posten', kontaktId: 'kontakte' },
};

// Verweislisten: Feld enthaelt ein Feld von Kennungen.
const VERWEISLISTEN = {
  maengel: { bildIds: 'bilder' },
  raeume: { bildIds: 'bilder' },
  tagebuch: { bildIds: 'bilder', helferIds: 'kontakte' },
  dokumente: { bildIds: 'bilder' },
  baudoku: { bildIds: 'bilder' },
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

/*
 * Was die Datenbank gerade tut.
 *
 * Wenn ein Bildschirm leer bleibt, liegt es fast immer hier: Die Datenbank
 * antwortet nicht, und jeder Lesevorgang wartet still weiter. Ohne diesen
 * Zustand sieht man dem leeren Bildschirm nicht an, woran es liegt --
 * hoechstens, dass er leer ist.
 */
let dbZustand = 'noch nicht geöffnet';
export const datenZustand = () => dbZustand;

// Antwortet die Datenbank nach dieser Zeit nicht, gilt sie als haengend. Der
// Wert ist grosszuegig: Eine Wanderung ueber mehrere Fassungen mit vielen
// Fotos darf dauern, nur nicht ewig.
const GEDULD = 15000;

// Bis hierhin ist eine Datenbank normalerweise offen. Danach wartet sie fast
// immer auf ein anderes Fenster.
const VERDACHT = 3000;

/**
 * Der Grund, warum es haengt, im Klartext.
 *
 * Chrome meldet ein blockierendes zweites Fenster nicht zuverlaessig ueber
 * onblocked: Die Anfrage bleibt einfach liegen, ohne dass irgendein
 * Ereignis kommt. Firefox meldet es. Deshalb wird der Fall hier an der Zeit
 * erkannt und nicht am Ereignis.
 */
export const DB_WARTET = 'wartet auf ein anderes Fenster mit BauZeuge';

function db() {
  if (dbVersprechen) return dbVersprechen;
  dbZustand = 'wird geöffnet';

  dbVersprechen = new Promise((fertig, fehler) => {
    let erledigt = false;
    const fertigMelden = (wert) => { erledigt = true; fertig(wert); };
    const fehlerMelden = (f) => {
      erledigt = true;
      dbZustand = 'Fehler: ' + (f && f.message ? f.message : String(f));
      // Das abgelehnte Versprechen nicht behalten: Sonst scheitert auch jeder
      // spaetere Versuch, ohne es je wieder probiert zu haben.
      dbVersprechen = null;
      fehler(f);
    };

    let anfrage;
    try {
      anfrage = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (f) {
      fehlerMelden(f);
      return;
    }

    // Zwei Faelle, in denen sonst nie etwas zurueckkommt: ein zweites offenes
    // Fenster mit aelterer Fassung, und ein Browser, der die Anfrage
    // stillschweigend liegen laesst.
    const verdacht = setTimeout(() => {
      if (!erledigt && dbZustand === 'wird geöffnet') dbZustand = DB_WARTET;
    }, VERDACHT);

    const wache = setTimeout(() => {
      if (erledigt) return;
      fehlerMelden(new Error(
        'Die Datenbank antwortet nicht (' + dbZustand + ').'
      ));
    }, GEDULD);
    const wachenWeg = () => { clearTimeout(verdacht); clearTimeout(wache); };

    anfrage.onupgradeneeded = (ereignis) => {
      clearTimeout(verdacht);
      dbZustand = 'wandert von Fassung ' + ereignis.oldVersion + ' auf ' + DB_VERSION;
      const d = anfrage.result;
      // Bricht die Wanderung ab, kommt sonst weder onsuccess noch onerror.
      if (anfrage.transaction) {
        anfrage.transaction.onabort = () =>
          fehlerMelden(anfrage.transaction.error || new Error('Die Wanderung brach ab.'));
      }
      if (ereignis.oldVersion < 1) {
        anlegen(d);
        return;
      }
      if (ereignis.oldVersion < 2) {
        aufKennungenUmstellen(d, anfrage.transaction);
      }
      // Ab hier reicht Anlegen: anlegen() ueberspringt, was es schon gibt.
      // Die Wanderung auf Fassung 2 legt neue Speicher bereits mit an, ein
      // zweiter Aufruf schadet deshalb nicht.
      if (ereignis.oldVersion < 10) {
        anlegen(d);
      }
    };
    anfrage.onsuccess = () => {
      wachenWeg();
      dbZustand = 'offen, Fassung ' + anfrage.result.version;
      // Fordert ein anderes Fenster eine neuere Fassung an, muss diese
      // Verbindung weichen. Sonst haengt dort die Wanderung fest.
      anfrage.result.onversionchange = () => {
        anfrage.result.close();
        dbVersprechen = null;
        dbZustand = 'geschlossen, ein anderes Fenster braucht eine neuere Fassung';
      };
      fertigMelden(anfrage.result);
    };
    anfrage.onerror = () => {
      wachenWeg();
      fehlerMelden(anfrage.error);
    };
    anfrage.onblocked = () => {
      dbZustand = DB_WARTET;
      wachenWeg();
      fehlerMelden(new Error(
        'Die App ist in einem anderen Fenster oder Reiter offen. Bitte dort ' +
        'schließen, dann hier neu laden.'
      ));
    };
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

/*
 * Mehrere Bauprojekte.
 *
 * Getrennt wird ueber ein Feld am Satz, nicht ueber getrennte Datenbanken:
 * Der Abgleich mit dem Server bleibt damit unveraendert, das Feld faehrt in
 * der JSON einfach mit.
 *
 * Das erste Projekt hat die feste Kennung "projekt-1", auf jedem Geraet
 * dieselbe. Ein Satz ohne projektId gehoert dorthin. Damit brauchen die
 * vorhandenen Daten keine Wanderung: Sie bleiben, wie sie sind, und liegen
 * trotzdem richtig -- auch auf einem zweiten Geraet, das sie ueber den
 * Abgleich bekommt.
 */
export const ERSTES_PROJEKT = 'projekt-1';

// Was nicht nach Projekt getrennt wird. Bilder haengen an ihrer Kennung und
// werden nur ueber sie geholt; sie zu filtern wuerde jeden Verweis brechen.
const OHNE_PROJEKT = new Set(['einstellungen', 'projekte', 'bilder']);

// Einstellungen, die zum Projekt gehoeren und nicht zum Geraet. Beim ersten
// Projekt behalten sie ihren blanken Namen, damit die vorhandenen Werte
// stehen bleiben.
const PROJEKTSACHEN = new Set(['projektname', 'baustelle']);

let aktivesProjekt = null;

/** Die Kennung des Projekts, in dem gerade gearbeitet wird. */
export async function projektAktiv() {
  if (aktivesProjekt) return aktivesProjekt;
  const eintrag = await daten.holen('einstellungen', 'projekt_aktiv');
  aktivesProjekt = (eintrag && eintrag.wert) || ERSTES_PROJEKT;
  return aktivesProjekt;
}

/** Wechselt das Projekt. Der Aufrufer zeichnet danach neu. */
export async function projektWechseln(id) {
  await daten.sichern('einstellungen', { name: 'projekt_aktiv', wert: id });
  aktivesProjekt = id;
}

const gehoertHierher = (speicher, satz, projekt) =>
  OHNE_PROJEKT.has(speicher) || (satz.projektId || ERSTES_PROJEKT) === projekt;

export const daten = {
  alle: async (speicher) => {
    const [liste, projekt] = await Promise.all([
      lauf(speicher, 'readonly', (s) => s.getAll()).then(lebendig),
      projektAktiv(),
    ]);
    return liste.filter((satz) => gehoertHierher(speicher, satz, projekt));
  },

  holen: (speicher, id) =>
    lauf(speicher, 'readonly', (s) => s.get(id)).then((satz) =>
      satz && !satz.geloescht ? satz : undefined
    ),

  // Nach Index filtern, z. B. alle Pins eines Geschosses.
  nach: async (speicher, feld, wert) => {
    const [liste, projekt] = await Promise.all([
      lauf(speicher, 'readonly', (s) => s.index(feld).getAll(wert)).then(lebendig),
      projektAktiv(),
    ]);
    return liste.filter((satz) => gehoertHierher(speicher, satz, projekt));
  },

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
    // Ein neuer Satz gehoert in das Projekt, in dem gerade gearbeitet wird.
    // Ein vorhandener behaelt sein Projekt, auch wenn gerade ein anderes
    // offen ist -- sonst wanderte er beim Bearbeiten herueber.
    if (!OHNE_PROJEKT.has(speicher) && !satz.projektId) {
      satz.projektId = await projektAktiv();
    }
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

  /**
   * Alles Lebendige, ueber alle Projekte hinweg.
   *
   * Fuer die Sicherung: Sie ersetzt beim Einlesen den ganzen Bestand, also
   * muss sie auch den ganzen Bestand enthalten. Eine Sicherung, die still
   * nur das offene Projekt mitnimmt, loescht beim Einlesen die uebrigen.
   */
  alleRoh: (speicher) => lauf(speicher, 'readonly', (s) => s.getAll()).then(lebendig),

  /** Auch die Grabsteine, fuer den spaeteren Abgleich mit dem Server. */
  alleMitGrabsteinen: (speicher) => lauf(speicher, 'readonly', (s) => s.getAll()),
};

// --------------------------------------------------------------- Einstellungen

export async function einstellung(name, wert) {
  const schluessel = PROJEKTSACHEN.has(name) ? await projektschluessel(name) : name;
  if (wert === undefined) {
    const eintrag = await daten.holen('einstellungen', schluessel);
    return eintrag ? eintrag.wert : undefined;
  }
  await daten.sichern('einstellungen', { name: schluessel, wert });
  return wert;
}

/**
 * Der Name der Einstellung im aktuellen Projekt.
 *
 * Beim ersten Projekt bleibt der blanke Name stehen. So finden die
 * vorhandenen Werte sich wieder, ohne dass etwas umgeschrieben werden muss.
 */
async function projektschluessel(name) {
  const projekt = await projektAktiv();
  return projekt === ERSTES_PROJEKT ? name : name + '@' + projekt;
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
