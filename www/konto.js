// Zugang zur Schnittstelle auf BauZeuge.de.
//
// Die Marke und der Abgleichsstand liegen in localStorage, nicht in der
// Datenbank der App. Zwei Gruende: Sie sind an dieses Geraet gebunden und
// duerfen niemals mit abgeglichen werden - sonst bekaeme der Rechner die
// Sitzung des Telefons untergeschoben.

const MARKE = 'hausbau.marke';
const EPOST = 'hausbau.epost';
const STAND = 'hausbau.stand';       // Zeitpunkt, bis zu dem der Server gelesen wurde
const LOKAL = 'hausbau.lokal';       // ab hier muessen eigene Aenderungen noch hoch
const VERWEIS = 'hausbau.freigabe';  // oeffentlicher Verweis aufs Bautagebuch

/*
 * Als Website liegt die Schnittstelle daneben und ist gleicher Herkunft, dann
 * genuegt der Pfad. Im Paket laeuft die App unter https://localhost und muss
 * die volle Adresse nennen; dafuer steht diese Herkunft in der Freigabeliste
 * des Servers.
 *
 * Apex und www sind fuer den Browser zwei verschiedene Herkuenfte mit je
 * eigenem localStorage und eigener IndexedDB. Wer die App einmal unter der
 * einen und einmal unter der anderen Adresse oeffnet, haette zwei getrennte
 * Datenbestaende. Deshalb leitet der Server BauZeuge.de dauerhaft auf
 * www.BauZeuge.de um. Beide stehen hier trotzdem: Faellt die Umleitung
 * einmal aus, soll die Seite wenigstens nicht zusaetzlich die Schnittstelle
 * verfehlen.
 */
// Klein geschrieben, und das muss so bleiben: location.hostname liefert
// den Wirt immer in Kleinbuchstaben. Wer hier auf die Schreibweise der Marke
// "korrigiert", trifft nie zu, die Seite nimmt die absolute Adresse und
// scheitert an der Herkunftspruefung. test.mjs wacht darueber.
const EIGENE_WIRTE = ['www.bauzeuge.de', 'bauzeuge.de'];

/*
 * Diese Adresse steckt fest im APK. Aendert sie sich, hilft keine Umleitung:
 * Ein POST mit eigenem Kopfzeilenfeld ueberlebt eine Weiterleitung samt
 * Vorabfrage nicht zuverlaessig. Ein Adresswechsel braucht darum immer ein
 * neues APK, und die alte Adresse muss so lange weiterlaufen, wie es noch
 * alte Installationen gibt.
 */
export const FERNE_BASIS = 'https://www.bauzeuge.de/app/api';

export const BASIS = EIGENE_WIRTE.includes(location.hostname) ? '/app/api' : FERNE_BASIS;

// Beim oertlichen Entwickeln auf einen selbst gestarteten Server umlenken.
const ABWEICHUNG = (() => {
  try {
    return localStorage.getItem('hausbau.basis') || null;
  } catch {
    return null;
  }
})();

/**
 * Die tatsaechlich benutzte Adresse, Umlenkung eingerechnet. Wer von aussen
 * mit der Schnittstelle spricht, muss diese nehmen und nicht BASIS - sonst
 * greift die oertliche Umlenkung beim Entwickeln nicht.
 */
export const apiBasis = () => ABWEICHUNG || BASIS;

const ziel = (pfad) => apiBasis() + pfad;

// localStorage kann in abgeschotteten Fenstern werfen, deshalb ueberall
// abgesichert. Ohne Ablage funktioniert die App weiter, nur eben ohne
// dauerhafte Anmeldung.
function lies(name) {
  try {
    return localStorage.getItem(name);
  } catch {
    return null;
  }
}

function schreib(name, wert) {
  try {
    if (wert === null) localStorage.removeItem(name);
    else localStorage.setItem(name, wert);
  } catch {
    /* dann eben nicht */
  }
}

export const marke = () => lies(MARKE);
export const epost = () => lies(EPOST);
export const angemeldet = () => Boolean(marke());

export const standLesen = () => lies(STAND) || '';
export const standSetzen = (wert) => schreib(STAND, wert || '');
export const lokalLesen = () => lies(LOKAL) || '';
export const lokalSetzen = (wert) => schreib(LOKAL, wert || '');

/*
 * Der oeffentliche Verweis steht nur hier auf dem Geraet. Auf dem Server liegt
 * die Marke ausschliesslich als SHA-256, damit ein Blick in die Datenbank
 * keinen gueltigen Verweis hergibt. Der Preis dafuer: Geht der Verweis hier
 * verloren, muss die Freigabe neu angelegt werden. Das ist der richtige
 * Tausch, denn ein neuer Verweis kostet nichts und ein Leck waere teuer.
 */
export const freigabeLesen = () => lies(VERWEIS) || '';
export const freigabeSetzen = (wert) => schreib(VERWEIS, wert || null);

/** Wirft mit einer lesbaren Meldung, wenn die Schnittstelle nein sagt. */
export async function ruf(pfad, inhalt, optionen = {}) {
  const kopf = { 'Content-Type': 'application/json' };
  const m = marke();
  if (m) kopf['X-Hausbau-Marke'] = m;

  let antwort;
  try {
    antwort = await fetch(ziel(pfad), {
      method: 'POST',
      headers: kopf,
      body: JSON.stringify(inhalt || {}),
      ...optionen,
    });
  } catch {
    throw new Error('Keine Verbindung. Auf der Baustelle passiert das; die Daten bleiben so lange hier.');
  }

  let daten = {};
  try {
    daten = await antwort.json();
  } catch {
    /* leere oder kaputte Antwort */
  }

  if (!antwort.ok) {
    // Abgelaufene Anmeldung nicht als Fehler stehen lassen, sondern aufraeumen.
    if (antwort.status === 401) vergessen();
    throw new Error(daten.fehler || 'Der Server antwortete mit ' + antwort.status + '.');
  }
  return daten;
}

function merken(antwort) {
  schreib(MARKE, antwort.marke);
  schreib(EPOST, antwort.epost || '');
  return antwort;
}

/** Loescht nur die Anmeldung. Die Daten auf dem Geraet bleiben liegen. */
export function vergessen() {
  schreib(MARKE, null);
  schreib(EPOST, null);
  schreib(STAND, null);
  schreib(LOKAL, null);
  schreib(VERWEIS, null);
}

export async function registrieren(adresse, passwort) {
  return merken(await ruf('/konto.php', { tun: 'registrieren', epost: adresse, passwort }));
}

export async function anmelden(adresse, passwort) {
  return merken(await ruf('/konto.php', { tun: 'anmelden', epost: adresse, passwort }));
}

export async function abmelden() {
  try {
    await ruf('/konto.php', { tun: 'abmelden' });
  } catch {
    // Auch ohne Netz abmelden: Die Sitzung auf dem Server laeuft von selbst ab.
  }
  vergessen();
}

/**
 * Anmeldung ohne Passwort.
 *
 * Der Server antwortet immer gleich, auch wenn es zu der Adresse noch kein
 * Konto gibt: Der Link legt dann eines an. Wer eine Mail an dieser Adresse
 * lesen kann, ist der Inhaber -- dieselbe Annahme, auf der jedes "Passwort
 * vergessen" beruht.
 */
export const anmeldelinkAnfordern = (adresse) =>
  ruf('/konto.php', { tun: 'anmeldelink', epost: adresse });

export async function linkEinloesen(token) {
  return merken(await ruf('/konto.php', { tun: 'link_einloesen', token }));
}

export async function codeEinloesen(adresse, code) {
  return merken(await ruf('/konto.php', { tun: 'code_einloesen', epost: adresse, code }));
}

export const wer = () => ruf('/konto.php', { tun: 'wer' });

export const passwortAendern = (alt, neu) =>
  ruf('/konto.php', { tun: 'passwort_aendern', alt, neu });

/**
 * @param {string} passwort  Leer, wenn das Konto keins hat.
 * @param {string} adresse   Statt des Passworts zur Bestaetigung.
 */
export async function kontoLoeschen(passwort, adresse = '') {
  const ergebnis = await ruf('/konto.php', {
    tun: 'konto_loeschen', passwort, epost: adresse,
  });
  vergessen();
  return ergebnis;
}

/**
 * Zahlen fuer die Verwaltung. Antwortet mit 404, wenn die angemeldete
 * Adresse nicht auf der Liste in geheim.php steht -- absichtlich derselbe
 * Fehler wie fuer einen Weg, den es nicht gibt.
 *
 * @param {number} tage Fenster in Tagen, 1 bis 365.
 */
export const adminUeberblick = (tage = 30) =>
  ruf('/admin.php', { tun: 'ueberblick', tage });

// ------------------------------------------------------------------ Freigabe

export const freigabeStand = () => ruf('/freigabe.php', { tun: 'stand' });

export async function freigabeAnlegen(titel) {
  const antwort = await ruf('/freigabe.php', { tun: 'anlegen', titel });
  freigabeSetzen(antwort.verweis);
  return antwort;
}

export async function freigabeAufheben() {
  const antwort = await ruf('/freigabe.php', { tun: 'aufheben' });
  freigabeSetzen(null);
  return antwort;
}

// -------------------------------------------------------------------- Bilder

/** Laedt eine Bilddatei hoch. Roh im Rumpf, nicht als JSON. */
export async function bildHoch(kennung, blob) {
  const kopf = { 'Content-Type': blob.type || 'application/octet-stream' };
  const m = marke();
  if (m) kopf['X-Hausbau-Marke'] = m;

  const antwort = await fetch(ziel('/bild.php?id=' + encodeURIComponent(kennung)), {
    method: 'POST',
    headers: kopf,
    body: blob,
  });
  if (!antwort.ok) {
    let text = 'HTTP ' + antwort.status;
    try {
      text = (await antwort.json()).fehler || text;
    } catch {
      /* egal */
    }
    throw new Error(text);
  }
  return antwort.json();
}

/** Holt eine Bilddatei. Gibt null, wenn es sie dort nicht gibt. */
export async function bildRunter(kennung) {
  const kopf = {};
  const m = marke();
  if (m) kopf['X-Hausbau-Marke'] = m;

  const antwort = await fetch(ziel('/bild.php?id=' + encodeURIComponent(kennung)), { headers: kopf });
  if (!antwort.ok) return null;
  return antwort.blob();
}
