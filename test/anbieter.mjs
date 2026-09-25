/* Der Anbietervergleich: anlegen, bewerten, rechnen.
 *
 *     node test/anbieter.mjs [http://localhost:4301]
 *
 * Gespielt wird der Fall aus Kapitel 10 des Buches: Das Angebot, das auf
 * Seite eins günstiger ist, wird durch eine fehlende Position teurer.
 */
import { browserStarten } from './browser.mjs';

const BASIS = process.argv[2] || 'http://localhost:4301';
const s = await browserStarten({ basis: BASIS });
const w = (ms) => new Promise((g) => setTimeout(g, ms));
let fehler = 0;
const pruef = (n, b, z = '') => { console.log((b ? '  ok   ' : '  FEHL ') + n + (b ? '' : '  ' + z)); if (!b) fehler++; };

try {
  await s.groesse(1280, 1400, 1);
  await s.laden('/');
  await w(1500);

  // Schluesselfertig einstellen, sonst ist der Bereich zu Recht versteckt.
  await s.werten(`(async () => {
    const b = await import('/bauweise.js');
    await b.bauweiseSetzen('schluesselfertig');
  })()`);
  await s.hin('anbieter', 1600);

  const leer = await s.werten(`document.getElementById('inhalt').innerText`);
  pruef('Der Bereich begrüßt mit dem Leerzustand', /Noch kein Anbieter/.test(leer), leer.slice(0, 160));

  // Zwei Anbieter anlegen, wie ein Nutzer: Feld ausfüllen, Knopf drücken.
  for (const name of ['Bauträger Müller', 'Massivhaus Klein']) {
    await s.werten(`(() => {
      const feld = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('nächsten Anbieter') || (i.placeholder || '').includes('Name des'));
      feld.value = ${JSON.stringify(name)};
      const knopf = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Hinzufügen');
      knopf.click();
    })()`);
    await w(900);
  }
  const zwei = await s.werten(`(async () => {
    const d = await import('/daten.js');
    return (await d.daten.alle('anbieter')).map((a) => a.name);
  })()`);
  pruef('Zwei Anbieter stehen nebeneinander', zwei.length === 2, JSON.stringify(zwei));

  // Angebotspreise eintragen.
  await s.werten(`(() => {
    const felder = [...document.querySelectorAll('input[aria-label="Angebotspreis"]')];
    felder[0].value = '350500'; felder[0].dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await w(800);
  await s.werten(`(() => {
    const felder = [...document.querySelectorAll('input[aria-label="Angebotspreis"]')];
    felder[1].value = '356500'; felder[1].dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await w(800);

  // Der Kanal ist die Position, an der sich die Angebote unterscheiden.
  const kanal = await s.werten(`(() => {
    const zeilen = [...document.querySelectorAll('tr')];
    const zeile = zeilen.find((z) => z.textContent.includes('Kanal: Schmutz- und Regenwasser'));
    return zeile ? zeile.querySelectorAll('select').length : 0;
  })()`);
  pruef('Der Kanal steht als eigene Zeile mit einer Auswahl je Anbieter', kanal === 2, String(kanal));

  // Anbieter A: Kanal fehlt, 5.500 € eintragen. Anbieter B: im Preis.
  await s.werten(`(() => {
    const zeile = [...document.querySelectorAll('tr')].find((z) => z.textContent.includes('Kanal: Schmutz- und Regenwasser'));
    const wahl = zeile.querySelectorAll('select');
    wahl[0].value = 'betrag'; wahl[0].dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await w(900);
  const feldDa = await s.werten(`(() => {
    const zeile = [...document.querySelectorAll('tr')].find((z) => z.textContent.includes('Kanal: Schmutz- und Regenwasser'));
    const felder = [...zeile.querySelectorAll('input')];
    return { sichtbar: felder.filter((f) => !f.hidden).length, gesamt: felder.length };
  })()`);
  pruef('Erst bei „fehlt" erscheint ein Betragsfeld', feldDa.sichtbar === 1 && feldDa.gesamt === 2, JSON.stringify(feldDa));

  await s.werten(`(() => {
    const zeile = [...document.querySelectorAll('tr')].find((z) => z.textContent.includes('Kanal: Schmutz- und Regenwasser'));
    const feld = [...zeile.querySelectorAll('input')].find((f) => !f.hidden);
    feld.value = '5500'; feld.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await w(900);
  await s.werten(`(() => {
    const zeile = [...document.querySelectorAll('tr')].find((z) => z.textContent.includes('Kanal: Schmutz- und Regenwasser'));
    const wahl = zeile.querySelectorAll('select');
    wahl[1].value = 'drin'; wahl[1].dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await w(900);

  const summe = await s.werten(`(async () => {
    const d = await import('/daten.js');
    const { endpreis } = await import('/anbietervergleich-daten.js');
    const liste = (await d.daten.alle('anbieter')).sort((a, b) => (a.angelegt || '').localeCompare(b.angelegt || ''));
    return liste.map((a) => ({ name: a.name, ...endpreis(a) }));
  })()`);
  pruef('Der Betrag landet im vergleichbaren Endpreis',
    summe[0].summe === 356000 && summe[1].summe === 356500, JSON.stringify(summe));

  const text = await s.werten(`document.getElementById('inhalt').innerText`);
  pruef('Die Seite zeigt den Endpreis an', text.includes('356.000') && text.includes('Vergleichbarer Endpreis'), text.slice(-400));
  pruef('Offene Positionen werden gemeldet', /ungeklärt|unfertig/i.test(text));

  // Auf dem Telefon rollt die Tabelle in sich, die Seite steht still.
  await s.groesse(320, 1400, 2);
  await s.hin('anbieter', 1600);
  const schmal = await s.werten(`({
    quer: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    rollt: [...document.querySelectorAll('.tabelle-rolle')].some((e) => e.scrollWidth > e.clientWidth),
  })`);
  pruef('Bei 320 px rollt die Tabelle, nicht die Seite', !schmal.quer && schmal.rollt, JSON.stringify(schmal));
  await s.groesse(1280, 1400, 1);


  // Bei Einzelvergabe hat der Bereich nichts zu suchen.
  await s.werten(`(async () => {
    const b = await import('/bauweise.js');
    await b.bauweiseSetzen('einzelvergabe');
  })()`);
  await s.laden('/');
  await w(1800);
  const leiste = await s.werten(`(() => {
    const a = [...document.querySelectorAll('[data-weg]')].find((e) => e.dataset.weg === 'anbieter');
    return { da: !!a, versteckt: a ? a.hidden : null };
  })()`);
  pruef('Bei Einzelvergabe steht er nicht in der Leiste', leiste.da && leiste.versteckt === true, JSON.stringify(leiste));

  // Aufräumen, damit der nächste Lauf sauber startet.
  await s.werten(`(async () => {
    const d = await import('/daten.js');
    for (const a of await d.daten.alle('anbieter')) await d.daten.entfernen('anbieter', a.id);
    const b = await import('/bauweise.js');
    await b.bauweiseSetzen('einzelvergabe');
  })()`);

  const klagen = s.klagenHolen().filter((k) => !/abgleich\.php|ERR_FAILED/.test(k.text || ''));
  pruef('Keine Konsolenfehler', klagen.length === 0, JSON.stringify(klagen).slice(0, 300));
} finally {
  s.schliessen();
}
console.log(fehler ? `\n${fehler} Fehler.` : '\nDer Anbietervergleich rechnet.');
process.exitCode = fehler ? 1 : 0;
