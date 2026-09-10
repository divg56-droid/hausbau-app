// Kleinkram, den jedes Modul braucht.

export const eur = new Intl.NumberFormat('de-DE', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
});
export const eurGenau = new Intl.NumberFormat('de-DE', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2,
});

export const zahl = (n, stellen = 0) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: stellen, maximumFractionDigits: stellen }).format(n);

export const heute = () => new Date().toISOString().slice(0, 10);

export function datumLang(iso) {
  if (!iso) return '';
  const [j, m, t] = iso.slice(0, 10).split('-');
  return `${t}.${m}.${j}`;
}

// Erzeugt ein Element. kind kann Text, Element oder eine Liste davon sein.
export function el(tag, eigenschaften = {}, kinder = []) {
  const knoten = document.createElement(tag);
  for (const [name, wert] of Object.entries(eigenschaften)) {
    if (wert === null || wert === undefined || wert === false) continue;
    if (name === 'klasse') knoten.className = wert;
    else if (name === 'text') knoten.textContent = wert;
    else if (name === 'html') knoten.innerHTML = wert;
    else if (name.startsWith('on')) knoten.addEventListener(name.slice(2), wert);
    else if (name === 'stil') Object.assign(knoten.style, wert);
    else knoten.setAttribute(name, wert === true ? '' : wert);
  }
  for (const kind of [].concat(kinder)) {
    if (kind === null || kind === undefined || kind === false) continue;
    knoten.append(kind instanceof Node ? kind : document.createTextNode(String(kind)));
  }
  return knoten;
}

/**
 * Haengt Kinder an und laesst weg, was keines ist.
 *
 * el() ueberspringt null von sich aus, append() und replaceChildren() nicht:
 * Dort wird aus null das Wort "null" mitten im Text. Wer eine Bedingung im
 * Anhaengen hat, nimmt deshalb diese Funktion.
 */
export function anhaengen(knoten, ...kinder) {
  knoten.append(...kinder.flat().filter((k) => k !== null && k !== undefined && k !== false));
  return knoten;
}

/** Ersetzt den Inhalt und laesst dabei weg, was kein Kind ist. */
export function fuellen(knoten, ...kinder) {
  knoten.replaceChildren();
  return anhaengen(knoten, ...kinder);
}

export const leeren = (knoten) => {
  while (knoten.firstChild) knoten.removeChild(knoten.firstChild);
  return knoten;
};

// --------------------------------------------------------------- Formularbau

export function feld(beschriftung, eingabe, hinweis) {
  return el('label', { klasse: 'feld' }, [
    el('span', { klasse: 'feld-name', text: beschriftung }),
    eingabe,
    hinweis ? el('span', { klasse: 'feld-hinweis', text: hinweis }) : null,
  ]);
}

export function eingabe(eigenschaften = {}) {
  return el('input', { type: 'text', ...eigenschaften });
}

export function zahlfeld(eigenschaften = {}) {
  // inputmode statt type=number: type=number blendet auf Android die
  // Komma-Taste aus und laesst sich nicht formatieren.
  return el('input', { type: 'text', inputmode: 'decimal', ...eigenschaften });
}

export function auswahl(optionen, gewaehlt, eigenschaften = {}) {
  return el(
    'select',
    eigenschaften,
    optionen.map(([wert, name]) =>
      el('option', { value: wert, selected: String(wert) === String(gewaehlt) }, [name])
    )
  );
}

export function knopf(text, beim_klick, klasse = 'knopf') {
  return el('button', { type: 'button', klasse, onclick: beim_klick }, [text]);
}

// Liest eine deutsche Zahleneingabe: "1.250,50" und "1250.5" ergeben beide 1250,5.
export function zuZahl(wert) {
  if (typeof wert === 'number') return wert;
  const roh = String(wert ?? '').trim();
  if (!roh) return 0;
  const bereinigt = roh.replace(/[^\d,.-]/g, '');
  // Kommt ein Komma vor, ist es das Dezimaltrennzeichen und Punkte sind Tausender.
  const zahl = bereinigt.includes(',')
    ? bereinigt.replace(/\./g, '').replace(',', '.')
    : bereinigt;
  const n = parseFloat(zahl);
  return Number.isFinite(n) ? n : 0;
}

// ------------------------------------------------------------------- Bausteine

export function kopfzeile(titel, untertitel) {
  return el('header', { klasse: 'seitenkopf' }, [
    el('h1', { text: titel }),
    untertitel ? el('p', { klasse: 'unterzeile', text: untertitel }) : null,
  ]);
}

/**
 * Ein Gitter fuer gleichrangige Karten.
 *
 * Sechs Karten untereinander sind auf einem Bildschirm eine Kolonne mit viel
 * Luft daneben. Das Gitter richtet sich nach seinem Behaelter, nicht nach dem
 * Fenster: In einer schmalen Spalte bleibt es einspaltig, und wer das Fenster
 * schmaler zieht, sieht die Karten von allein zusammenrutschen.
 */
export function kartengitter(karten) {
  return el('div', { klasse: 'kartengitter' }, karten);
}

export function karte(kinder, klasse = '') {
  return el('section', { klasse: ('karte ' + klasse).trim() }, kinder);
}

export function hinweisKasten(text, art = 'info') {
  return el('p', { klasse: 'kasten kasten-' + art, text });
}

export function leerzustand(titel, text, aktion) {
  return el('div', { klasse: 'leer' }, [
    el('h2', { text: titel }),
    el('p', { text }),
    aktion || null,
  ]);
}

// Zeile aus Bezeichnung und Wert, wie in den Ergebnisblöcken der Rechner.
export function wertzeile(name, wert, stark = false) {
  return el('div', { klasse: 'wertzeile' + (stark ? ' stark' : '') }, [
    el('span', { text: name }),
    el('strong', { text: wert }),
  ]);
}

// ------------------------------------------------------------------- Dialoge

export function frage(text) {
  return window.confirm(text);
}

export function melde(text) {
  const meldung = el('div', { klasse: 'meldung', text });
  document.body.append(meldung);
  setTimeout(() => meldung.classList.add('weg'), 2200);
  setTimeout(() => meldung.remove(), 2600);
}
