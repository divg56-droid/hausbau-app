/* Das Beispielprojekt zeigt, was die Website verspricht, und raeumt auf.
 *
 *     node test/beispiel.mjs [http://localhost:4301]
 *
 * Geoeffnet wird es so, wie die Website es oeffnet: ueber "#/beispiel",
 * auch mit Zielbereich. Danach wird geprueft, ob jeder beworbene Nutzen an
 * einem Eintrag zu sehen ist, und ob beim Schliessen nichts liegen bleibt,
 * auch keine Bilder.
 */
import { browserStarten } from './browser.mjs';

const BASIS = process.argv[2] || 'http://localhost:4301';
let fehler = 0;
const pruef = (n, b, z = '') => { console.log((b ? '  ok   ' : '  FEHL ') + n + (b ? '' : '  ' + z)); if (!b) fehler++; };
const warte = (ms) => new Promise((g) => setTimeout(g, ms));

const s = await browserStarten({ basis: BASIS });
try {
  await s.groesse(390, 1800, 2);
  await s.laden('/');

  // Ueber den Direktweg der Website, gleich in die Angebote.
  await s.werten(`location.hash = '#/beispiel/angebote'`);
  await warte(4500);
  const ort = await s.werten(`({ hash: location.hash, band: !!document.querySelector('.beispielband') })`);
  pruef('Der Direktweg öffnet das Beispiel im Zielbereich', ort.hash === '#/angebote' && ort.band, JSON.stringify(ort));

  await s.werten(`document.querySelectorAll('details.leistungsblock').forEach((d) => { d.open = true; })`);
  await warte(300);
  const angebote = await s.werten(`document.body.innerText`);
  pruef('Ein beauftragtes Angebot ist zu sehen', /Beauftragt/.test(angebote));
  pruef('Der offene Vergleich warnt beim günstigsten Angebot',
    /Garten Kern/.test(angebote) && /Nicht enthalten: Entwässerung und Rigole/.test(angebote) && /Ungeklärt: Zaun zur Straße/.test(angebote),
    angebote.slice(0, 400));

  // Uebersicht: die naechsten Schritte passen zur Bauphase.
  await s.hin('', 2200);
  const schritte = await s.werten(`(() => {
    const karte = [...document.querySelectorAll('.karte')].find((k) => k.innerText.includes('Deine nächsten Schritte'));
    return karte ? [...karte.querySelectorAll('.zeilen-titel')].map((e) => e.textContent) : [];
  })()`);
  pruef('Oben steht die Fotoaufgabe vor dem Innenputz', /Fotografieren, bevor/.test(schritte[0] || ''), JSON.stringify(schritte));
  pruef('Keine Haushaltsrechnung mitten im Bau', !schritte.some((t) => /Haushaltsrechnung/.test(t)), JSON.stringify(schritte));
  pruef('Es sind höchstens drei', schritte.length > 0 && schritte.length <= 3, String(schritte.length));

  // Bauablauf: stimmiger Stand und die Fotoaufgabe.
  await s.hin('ablauf', 1800);
  const ablauf = await s.werten(`({
    foto: [...document.querySelectorAll('.fotoaufgabe')].some((k) => k.innerText.includes('Innenputz')),
    reihenfolge: document.body.innerText.includes('Reihenfolge prüfen'),
    estrich: document.body.innerText.includes('Estrich und Belegreife'),
  })`);
  pruef('Bauablauf meldet die Fotos vor dem Innenputz', ablauf.foto, JSON.stringify(ablauf));
  pruef('Der Beispielplan hat keine Reihenfolgefehler', !ablauf.reihenfolge);
  pruef('Die Estrichkarte steht bereit', ablauf.estrich);

  // Raeume mit Bild, Material und Tuer.
  const raum = await s.werten(`(async () => {
    const d = await import('/daten.js');
    const r = (await d.daten.alle('raeume')).find((x) => x.name === 'Küche');
    return r ? r.id : null;
  })()`);
  await s.hin('raeume/' + raum, 1800);
  const kueche = await s.werten(`({
    bild: [...document.querySelectorAll('img')].some((i) => i.naturalWidth > 0),
    text: document.body.innerText,
  })`);
  pruef('Die Küche zeigt ein Bild', kueche.bild);
  pruef('Die Küche hat einen Materialpass', /Materialpass \(1\)/.test(kueche.text) && /Charge Beispiel 0412/.test(kueche.text));

  const mangel = await s.werten(`(async () => {
    const d = await import('/daten.js');
    const m = (await d.daten.alle('maengel')).find((x) => x.raum === 'Bad OG');
    const r = m && m.raumId ? await d.daten.holen('raeume', m.raumId) : null;
    return r ? r.name : null;
  })()`);
  pruef('Der Mangel hängt am Raum', mangel === 'Bad OG', String(mangel));

  const bilder = await s.werten(`(async () => {
    const d = await import('/daten.js');
    const { istBeispielSatz } = await import('/beispiel.js');
    const alle = await d.daten.alle('bilder');
    return { anzahl: alle.length, alleBeispiel: alle.every((b) => istBeispielSatz('bilder', b)) };
  })()`);
  pruef('Die Beispielbilder sind als Beispiel markiert', bilder.anzahl === 3 && bilder.alleBeispiel, JSON.stringify(bilder));

  // Schliessen: alles weg, auch die Bilder.
  await s.werten(`[...document.querySelectorAll('.beispielband button')][0].click()`);
  await warte(4000);
  const danach = await s.werten(`(async () => {
    const d = await import('/daten.js');
    const zaehle = async (n) => (await d.daten.alleMitGrabsteinen(n)).filter((x) => x.projektId === 'beispielprojekt').length;
    return {
      bilder: await zaehle('bilder'), raeume: await zaehle('raeume'), aufgaben: await zaehle('aufgaben'),
      angebote: await zaehle('angebote'), band: !!document.querySelector('.beispielband'),
    };
  })()`);
  pruef('Nach dem Schließen bleibt nichts liegen',
    danach.bilder === 0 && danach.raeume === 0 && danach.aufgaben === 0 && danach.angebote === 0 && !danach.band,
    JSON.stringify(danach));
} finally {
  s.schliessen();
}
console.log(fehler ? `\n${fehler} Fehler.` : '\nDas Beispielprojekt zeigt, was es soll, und räumt auf.');
process.exitCode = fehler ? 1 : 0;
