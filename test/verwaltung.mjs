/* Die Verwaltung zeigt Adressen verkuerzt und holt eine einzelne nur auf
 * Druck nach.
 *
 *     node test/verwaltung.mjs [http://localhost:4301]
 *
 * Der Server wird vorgetaeuscht: Ein echter braeuchte Datenbank, Konto und
 * einen Eintrag unter "admins". Geprueft wird die Anzeige und dass genau
 * eine Kennung erfragt wird -- die Serverseite prueft server/test_api.py.
 */
import { browserStarten } from './browser.mjs';

const BASIS = process.argv[2] || 'http://localhost:4301';
const s = await browserStarten({ basis: BASIS });
const w = (ms) => new Promise((g) => setTimeout(g, ms));
let fehler = 0;
const pruef = (n, b, z = '') => { console.log((b ? '  ok   ' : '  FEHL ') + n + (b ? '' : '  ' + z)); if (!b) fehler++; };

try {
  await s.groesse(1280, 1400, 1);
  await s.vorschalten(`
    localStorage.setItem('hausbau.marke', 'probe');
    const echt = window.fetch;
    window.fetch = async (weg, opt) => {
      const pfad = String(weg);
      if (!pfad.includes('admin.php')) return echt(weg, opt);
      const rein = JSON.parse(opt.body);
      window.__gerufen = (window.__gerufen || []).concat([rein]);
      const inhalt = rein.tun === 'adresse'
        ? { id: rein.id, epost: 'andreas.volz@beispiel.de' }
        : {
            tage: 30,
            gesamt: { nutzer: 1, aktiv: 1, anfragen: 12, bytes: 2048, saetze: 5, bilder: 1,
                      bilder_bytes: 1024, freigaben: 0, freigabe_aufrufe: 0, neu: 1 },
            nutzer: [{ id: 7, epost: 'an…lz@beispiel.de', angelegt: '2026-09-01', passwort: true,
                       anfragen: 12, bytes: 2048, tage_aktiv: 3, zuletzt: '2026-09-18', saetze: 5,
                       bilder: 1, bilder_bytes: 1024, geraete: 1, freigabe_aufrufe: 0, einblick: null,
                       ort: 'Kaiserslautern' }],
            verlauf: [{ tag: '2026-09-18', anfragen: 12, bytes: 2048, nutzer: 1 }],
          };
      return new Response(JSON.stringify(inhalt), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
  `);
  await s.laden('/');
  await s.hin('admin', 2500);

  const vorher = await s.werten(`(() => {
    const knopf = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Adresse zeigen');
    return { text: document.getElementById('inhalt').innerText, knopf: !!knopf };
  })()`);
  pruef('Die Verwaltung zeigt die Kurzform', vorher.text.includes('an…lz@beispiel.de'), vorher.text.slice(0, 200));
  pruef('Es gibt einen Knopf "Adresse zeigen"', vorher.knopf);
  pruef('Die Baustelle steht in der Zeile', vorher.text.includes('Kaiserslautern'), vorher.text.slice(0, 300));
  pruef('Die volle Adresse steht noch nicht da', !vorher.text.includes('andreas.volz@beispiel.de'));

  await s.werten(`[...document.querySelectorAll('button')].find((b) => b.textContent === 'Adresse zeigen').click()`);
  await w(800);
  const nachher = await s.werten(`({
    text: document.getElementById('inhalt').innerText,
    knopf: !![...document.querySelectorAll('button')].find((b) => b.textContent === 'Adresse zeigen'),
    gerufen: window.__gerufen,
  })`);
  pruef('Nach dem Druck steht die volle Adresse da', nachher.text.includes('andreas.volz@beispiel.de'), nachher.text.slice(0, 200));
  pruef('Der Knopf ist weg', !nachher.knopf);
  pruef('Die Zeile vermerkt den Einblick', nachher.text.includes('eben angesehen'), nachher.text.slice(0, 300));
  pruef('Gefragt wurde nach genau einer Kennung',
    JSON.stringify(nachher.gerufen) === JSON.stringify([{ tun: 'ueberblick', tage: 30 }, { tun: 'adresse', id: 7 }]),
    JSON.stringify(nachher.gerufen));

  // Die erfundene Marke laesst die App gegen den echten Server abgleichen;
  // dessen CORS-Absage gehoert zum Aufbau und nicht zur Verwaltung.
  const klagen = s.klagenHolen().filter((k) => !/abgleich\.php|ERR_FAILED/.test(k.text || ''));
  pruef('Keine Konsolenfehler', klagen.length === 0, JSON.stringify(klagen).slice(0, 300));
} finally {
  s.schliessen();
}
console.log(fehler ? `\n${fehler} Fehler.` : '\nDie Verwaltung holt Adressen einzeln.');
process.exitCode = fehler ? 1 : 0;
