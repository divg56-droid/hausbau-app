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

// Wechselt den Bildschirm.
//
// Nicht "location.hash = ...": Ein Wechsel auf denselben Hash loest kein
// hashchange aus, und der Bildschirm bleibt stehen. Genau das passiert
// nach dem Loeschen aus einer Liste heraus -- der geloeschte Satz blieb
// bis zum naechsten Laden sichtbar.
export function geheZu(weg) {
  const ziel = weg.startsWith('#') ? weg : '#' + weg;
  if (location.hash === ziel) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = ziel;
}

// Ein Kontakt hat einen Namen oder eine Firma; Pflicht ist nur eins von
// beidem. Wo ein Kontakt in einer Zeile steht, steht der Name -- und wenn
// keiner erfasst ist, die Firma. Sonst blieben Zeilen leer.
export const kontaktName = (k) => (k && (k.name || k.firma)) || '';

// "Meier (Elektro Meier GmbH)". Der Zusatz faellt weg, wenn er schon der
// Name ist -- bei einer Firma ohne Ansprechpartner waere er es.
export function kontaktLang(k, zusatz) {
  const name = kontaktName(k);
  return zusatz && zusatz !== name ? name + ' (' + zusatz + ')' : name;
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

/**
 * Zeile aus Bezeichnung und Wert, wie in den Ergebnisblöcken der Rechner.
 *
 * Der Wert darf auch ein Knoten sein. Gebraucht fuer Telefonnummern und
 * E-Mail-Adressen: Sie sollen anklickbar sein und nicht nur danebenstehen,
 * waehrend weiter unten ein Knopf dasselbe kann.
 */
export function wertzeile(name, wert, stark = false) {
  return el('div', { klasse: 'wertzeile' + (stark ? ' stark' : '') }, [
    el('span', { text: name }),
    wert instanceof Node ? el('strong', {}, [wert]) : el('strong', { text: wert }),
  ]);
}

/**
 * Eine Telefonnummer oder E-Mail-Adresse zum Antippen.
 *
 * "tel:" und "mailto:" oeffnet die WebView im Telefon- oder Mailprogramm --
 * dasselbe, was die Knoepfe darunter tun. Beides zu haben ist kein
 * Doppelbau: Der Knopf ist der Weg, den man sucht, der Verweis der, den man
 * findet, wenn man ohnehin schon auf die Nummer schaut.
 */
export function erreichbar(art, wert) {
  const ziel = art === 'tel' ? 'tel:' + String(wert).replace(/[\s/]/g, '') : 'mailto:' + wert;
  return el('a', { klasse: 'erreichbar', href: ziel, text: String(wert) });
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
