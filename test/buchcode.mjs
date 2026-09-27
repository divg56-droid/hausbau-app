/* Der Code aus dem Buch: Laufzeit anzeigen und Code einloesen.
 *
 *     node test/buchcode.mjs [http://localhost:4301]
 *
 * Der Server wird vorgetaeuscht -- ein echter braeuchte Datenbank und Konto.
 * Geprueft wird die Verdrahtung: dass die Laufzeit auf der Kontoseite steht,
 * dass genau ein "buchcode" rausgeht und dass eine Absage im Blatt landet,
 * ohne die Eingabe wegzuwerfen. Die Serverseite prueft server/test_api.py.
 */
import { browserStarten } from './browser.mjs';

const BASIS = process.argv[2] || 'http://localhost:4301';
const s = await browserStarten({ basis: BASIS });
const w = (ms) => new Promise((g) => setTimeout(g, ms));
let fehler = 0;
const pruef = (n, b, z = '') => { console.log((b ? '  ok   ' : '  FEHL ') + n + (b ? '' : '  ' + z)); if (!b) fehler++; };

const knopfDruecken = (text) => s.werten(
  `!![...document.querySelectorAll('button')].find((b) => b.textContent === ${JSON.stringify(text)})`
    + `&& ([...document.querySelectorAll('button')].find((b) => b.textContent === ${JSON.stringify(text)}).click(), true)`
);

try {
  await s.groesse(1280, 1400, 1);
  await s.vorschalten(`
    localStorage.setItem('hausbau.marke', 'probe');
    localStorage.setItem('hausbau.epost', 'andreas@beispiel.de');
    const echt = window.fetch;
    window.__gerufen = [];
    window.fetch = async (weg, opt) => {
      const pfad = String(weg);
      if (!pfad.includes('konto.php')) return echt(weg, opt);
      const rein = JSON.parse(opt.body);
      window.__gerufen.push(rein);
      if (rein.tun === 'wer') {
        return Response.json({
          epost: 'andreas@beispiel.de', saetze: 0, je_speicher: {}, bilder: 0, bytes: 0,
          admin: false, frei_bis: '2026-10-27 09:00:00', tage_frei: 30, buchcode: false,
        });
      }
      if (rein.tun === 'buchcode') {
        // Alles ausser dem einen Code wird abgelehnt, wie auf dem Server.
        if (rein.code.toUpperCase().replace(/[^A-Z0-9]/g, '') !== 'PROBE123') {
          return Response.json({ fehler: 'Diesen Code kennen wir nicht.' }, { status: 401 });
        }
        return Response.json({ eingeloest: true, frei_bis: '2026-12-27 09:00:00' });
      }
      return Response.json({});
    };
  `);
  await s.laden('/');
  await s.hin('konto', 2500);
  await w(600);

  const zuerst = await s.werten(`document.getElementById('inhalt').innerText`);
  pruef('Die Laufzeit steht auf der Kontoseite',
    /Kostenlos bis 27\.10\.2026/.test(zuerst), zuerst.slice(0, 400));
  pruef('Die 30 Tage stehen dabei', /noch 30 Tage/.test(zuerst));

  pruef('Es gibt einen Knopf für den Buchcode',
    await knopfDruecken('Code aus dem Buch eintragen'));
  await w(400);

  // Erst ein falscher Code: Das Blatt muss offen bleiben.
  await s.werten(`(() => {
    const e = [...document.querySelectorAll('.blatt input[type=text]')].pop();
    e.value = 'falsch-code'; return e.value;
  })()`);
  await knopfDruecken('Einlösen');
  await w(600);
  const nachFalsch = await s.werten(`({
    blatt: !!document.querySelector('.blatt'),
    warn: (document.querySelector('.blatt .kasten-warn') || {}).innerText || '',
    wert: (document.querySelector('.blatt input[type=text]') || {}).value || '',
  })`);
  pruef('Das Blatt bleibt bei einer Absage offen', nachFalsch.blatt);
  pruef('Die Absage des Servers steht im Blatt',
    nachFalsch.warn.includes('kennen wir nicht'), nachFalsch.warn);
  pruef('Die Eingabe bleibt stehen', nachFalsch.wert === 'falsch-code', nachFalsch.wert);
  pruef('Ein falscher Code meldet niemanden ab',
    (await s.werten(`localStorage.getItem('hausbau.marke')`)) === 'probe');

  // Jetzt der richtige, klein und mit Bindestrich geschrieben.
  await s.werten(`(() => {
    const e = [...document.querySelectorAll('.blatt input[type=text]')].pop();
    e.value = 'prob-e123'; return e.value;
  })()`);
  await knopfDruecken('Einlösen');
  // Nach dem Einloesen zeichnet die Kontoseite neu, und das liest die
  // Datenbank des Geraets -- darum reichlich Zeit.
  await w(1600);
  const gerufen = await s.werten(`window.__gerufen.filter((r) => r.tun === 'buchcode')`);
  pruef('Genau zwei Versuche gingen raus', gerufen.length === 2, JSON.stringify(gerufen));
  pruef('Der Code geht unveraendert mit', gerufen[1].code === 'prob-e123', JSON.stringify(gerufen[1]));
  pruef('Das Blatt ist nach dem Einlösen zu',
    !(await s.werten(`!!document.querySelector('.blatt')`)));

  // Zu kurz darf gar nicht erst rausgehen.
  pruef('Der Knopf ist nach dem Neuzeichnen wieder da',
    await knopfDruecken('Code aus dem Buch eintragen'));
  await w(700);
  await s.werten(`(() => {
    const e = [...document.querySelectorAll('.blatt input[type=text]')].pop();
    e.value = 'AB-1'; return e.value;
  })()`);
  await knopfDruecken('Einlösen');
  await w(500);
  const kurz = await s.werten(`({
    warn: (document.querySelector('.blatt .kasten-warn') || {}).innerText || '',
    versuche: window.__gerufen.filter((r) => r.tun === 'buchcode').length,
  })`);
  pruef('Ein zu kurzer Code bleibt hier', kurz.versuche === 2, String(kurz.versuche));
  pruef('Und wird erklärt', kurz.warn.includes('kürzer als erwartet'), kurz.warn);

  /* Die abgelehnten Codes sind Absicht, der 401 dazu ist keine Klage. Und
   * die erfundene Marke laesst die App gegen den echten Server abgleichen;
   * dessen CORS-Absage gehoert zum Aufbau. */
  const klagen = s.klagenHolen()
    .filter((k) => !/konto\.php|abgleich\.php|ERR_FAILED/.test(k.text || ''));
  pruef('Keine Konsolenfehler', klagen.length === 0, JSON.stringify(klagen).slice(0, 300));
} finally {
  await s.schliessen();
}

console.log(fehler ? `\n${fehler} Fehler.` : '\nDer Buchcode ist richtig verdrahtet.');
process.exitCode = fehler ? 1 : 0;
