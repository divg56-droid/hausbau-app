/* Die Nachbesserungen aus der Buch- und Produktanalyse, im Browser.
 *
 *     node test/analyse.mjs [http://localhost:4301]
 *
 * Geprueft wird, was sich ohne echten Nutzer pruefen laesst:
 *   - Kein window.prompt mehr: Vorlage laden geht ueber ein Blatt.
 *   - Angebote: enthalten, nicht enthalten, ungeklaert; Bearbeiten laesst
 *     den Leistungsumfang stehen.
 *   - Fotoaufgabe: Speichern allein erledigt nichts.
 *   - Sicherung: Hinweis ohne Konto, Datum in den Einstellungen.
 */
import { browserStarten } from './browser.mjs';

const BASIS = process.argv[2] || 'http://localhost:4301';
let fehler = 0;
const pruef = (n, b, z = '') => { console.log((b ? '  ok   ' : '  FEHL ') + n + (b ? '' : '  ' + z)); if (!b) fehler++; };
const warte = (ms) => new Promise((g) => setTimeout(g, ms));

const s = await browserStarten({ basis: BASIS });
try {
  await s.groesse(390, 1600, 2);
  // Ein Eingabefenster darf nirgends mehr aufgehen. Tut es das doch, merkt
  // sich die Seite das, statt zu haengen.
  await s.vorschalten(`window.prompt = () => { window.__prompt = true; return null; };`);
  await s.laden('/');
  await s.werten(`(async () => { const d = await import('/daten.js'); await d.einstellung('projektname', 'Test'); })()`);

  // ------------------------------------------------ Vorlage ueber ein Blatt
  await s.hin('ablauf', 1500);
  await s.werten(`[...document.querySelectorAll('button')].find((b) => b.textContent === 'Vorlage laden').click()`);
  await warte(500);
  const blatt = await s.werten(`({
    datum: !!document.querySelector('.blatt input[type=date], dialog input[type=date], input[type=date]'),
    prompt: window.__prompt === true,
  })`);
  pruef('Vorlage laden fragt im Blatt nach dem Start', blatt.datum && !blatt.prompt, JSON.stringify(blatt));
  await s.werten(`(() => {
    const datum = document.querySelector('input[type=date]');
    datum.value = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    [...document.querySelectorAll('button')].filter((b) => b.textContent === 'Vorlage laden').pop().click();
  })()`);
  await warte(2500);
  const vorlage = await s.werten(`(async () => { const d = await import('/daten.js'); return (await d.daten.alle('aufgaben')).length; })()`);
  pruef('Die Vorlage legt die Arbeitsschritte an', vorlage > 20, String(vorlage));

  // ------------------------------------------------ Fotoaufgabe bestaetigen
  const id = await s.werten(`(async () => {
    const d = await import('/daten.js');
    const iso = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    return d.daten.sichern('aufgaben', { titel: 'Innenputz EG', phase: 'Innenausbau', dauer: 5, start: iso, status: 'offen' });
  })()`);
  await s.hin('', 400);
  await s.hin('ablauf', 1500);
  const knoepfe = await s.werten(`[...document.querySelectorAll('.fotoaufgabe button')].map((b) => b.textContent)`);
  pruef('Fotoaufgabe bietet „Alles fotografiert“', knoepfe.includes('Alles fotografiert'), JSON.stringify(knoepfe));

  await s.werten(`(async () => {
    const d = await import('/daten.js');
    const a = await d.daten.holen('aufgaben', ${JSON.stringify(id)});
    await d.daten.sichern('aufgaben', { ...a, fotosAbgelegt: 1 });
  })()`);
  await s.hin('', 400);
  await s.hin('ablauf', 1500);
  const nachAufnahme = await s.werten(`({
    text: [...document.querySelectorAll('.fotoaufgabe')].map((k) => k.innerText).join(' | '),
  })`);
  pruef('Nach einer Aufnahme bleibt die Aufgabe offen und fragt nach',
    /Innenputz EG/.test(nachAufnahme.text) && /Ist alles aus der Liste im Bild/.test(nachAufnahme.text), nachAufnahme.text.slice(0, 200));

  await s.werten(`(() => {
    const karte = [...document.querySelectorAll('.fotoaufgabe')].find((k) => k.innerText.includes('Innenputz EG'));
    [...karte.querySelectorAll('button')].find((b) => b.textContent === 'Alles fotografiert').click();
  })()`);
  await warte(1200);
  const erledigt = await s.werten(`(async () => { const d = await import('/daten.js'); return (await d.daten.holen('aufgaben', ${JSON.stringify(id)})).fotosErledigt; })()`);
  pruef('Erst die Bestätigung erledigt die Aufgabe', erledigt === true, String(erledigt));

  // ------------------------------------------------ Angebote: drei Zustaende
  const angebotId = await s.werten(`(async () => {
    const d = await import('/daten.js');
    const postenId = await d.daten.sichern('posten', { name: 'Elektro', gewerk: 'Elektro', geplant: 20000,
      leistungen: [{ id: 'l1', titel: 'Außensteckdosen' }, { id: 'l2', titel: 'Netzwerk' }] });
    await d.daten.sichern('angebote', { postenId, firma: 'Teuer GmbH', betrag: 23500, status: 'offen', enthalten: ['l1', 'l2'] });
    return d.daten.sichern('angebote', { postenId, firma: 'Billig KG', betrag: 22000, status: 'offen', enthalten: ['l1'] });
  })()`);
  await s.hin('', 400);
  await s.hin('angebote', 1600);
  await s.werten(`document.querySelectorAll('details.leistungsblock').forEach((d) => { d.open = true; })`);
  await warte(300);
  const umfang = await s.werten(`({
    zeichen: [...document.querySelectorAll('.umfang')].map((b) => b.textContent).join(''),
    warnung: [...document.querySelectorAll('.hinweis, .kasten, [class*=hinweis]')].map((k) => k.innerText).join(' | '),
    legende: document.body.innerText.includes('? ungeklärt'),
  })`);
  pruef('Leistungen zeigen drei Zustände', /\?/.test(umfang.zeichen) && /✓/.test(umfang.zeichen), umfang.zeichen);
  pruef('Die Legende erklärt „ungeklärt“', umfang.legende);
  pruef('Die Warnung nennt Netzwerk als ungeklärt', /Ungeklärt: Netzwerk/.test(umfang.warnung), umfang.warnung.slice(0, 300));

  // Offene Zelle zweimal antippen: ungeklaert -> enthalten -> nicht enthalten
  const tippen = `(() => [...document.querySelectorAll('.umfang')].find((b) => b.textContent === '?' ).click())()`;
  await s.werten(tippen);
  await warte(900);
  await s.werten(`[...document.querySelectorAll('.umfang')].find((b) => b.getAttribute('aria-label').startsWith('Netzwerk bei Billig KG')).click()`);
  await warte(900);
  const gespeichert = await s.werten(`(async () => { const d = await import('/daten.js'); const a = await d.daten.holen('angebote', ${JSON.stringify(angebotId)}); return { enthalten: a.enthalten, ausgeschlossen: a.ausgeschlossen }; })()`);
  pruef('Zweimal antippen ergibt „nicht enthalten“',
    JSON.stringify(gespeichert.ausgeschlossen) === '["l2"]' && !gespeichert.enthalten.includes('l2'), JSON.stringify(gespeichert));

  // Bearbeiten ueber das Formular darf den Umfang nicht loeschen. Frueher
  // schrieb das Formular nur seine eigenen Felder, und alle Haken waren weg.
  const geoeffnet = await s.werten(`(() => {
    const zeile = [...document.querySelectorAll('button.listenzeile')].find((e) => e.innerText.includes('Billig KG'));
    if (!zeile) return false;
    zeile.click();
    return true;
  })()`);
  pruef('Angebot lässt sich zum Bearbeiten öffnen', geoeffnet);
  await warte(500);
  await s.werten(`[...document.querySelectorAll('.blatt button')].find((b) => b.textContent === 'Sichern').click()`);
  await warte(1200);
  const nachFormular = await s.werten(`(async () => { const d = await import('/daten.js'); const a = await d.daten.holen('angebote', ${JSON.stringify(angebotId)}); return { enthalten: a.enthalten, ausgeschlossen: a.ausgeschlossen, projekt: !!a.projektId }; })()`);
  pruef('Nach dem Bearbeiten bleibt der Leistungsumfang',
    JSON.stringify(nachFormular.enthalten) === '["l1"]' && JSON.stringify(nachFormular.ausgeschlossen) === '["l2"]' && nachFormular.projekt,
    JSON.stringify(nachFormular));

  // ------------------------------------------------ Sicherung
  await s.hin('', 1600);
  const hinweis = await s.werten(`({ da: !!document.querySelector('.sicherungshinweis'), text: (document.querySelector('.sicherungshinweis') || {}).innerText || '' })`);
  pruef('Ohne Konto und Sicherung erinnert die Übersicht', hinweis.da && /noch keine Sicherung/.test(hinweis.text), hinweis.text);

  await s.hin('einstellungen', 1500);
  pruef('Einstellungen sagen, dass es keine Sicherung gibt',
    await s.werten(`document.body.innerText.includes('Noch keine Sicherung erstellt.')`));

  await s.werten(`(async () => { const d = await import('/daten.js'); await d.einstellung('letzte_sicherung', new Date().toISOString().slice(0, 10)); })()`);
  await s.hin('', 1600);
  pruef('Nach einer frischen Sicherung ist der Hinweis weg', (await s.werten(`!!document.querySelector('.sicherungshinweis')`)) === false);
  await s.hin('einstellungen', 1500);
  pruef('Einstellungen nennen das Datum', await s.werten(`document.body.innerText.includes('Letzte Sicherung auf diesem Stand')`));

  await s.werten(`(async () => { const d = await import('/daten.js'); await d.einstellung('letzte_sicherung', '2026-01-02'); })()`);
  await s.hin('', 1600);
  const alt = await s.werten(`(document.querySelector('.sicherungshinweis') || {}).innerText || ''`);
  pruef('Eine alte Sicherung löst den Hinweis wieder aus', /02\.01\.2026/.test(alt), alt);

  pruef('Nirgends ist ein Eingabefenster aufgegangen', (await s.werten(`window.__prompt === true`)) === false);
} finally {
  s.schliessen();
}
console.log(fehler ? `\n${fehler} Fehler.` : '\nDie Nachbesserungen aus der Analyse halten.');
process.exitCode = fehler ? 1 : 0;
