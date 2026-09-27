/* Die Website-Auswertung in der Verwaltung.
 *
 *     node test/verwaltungWeb.mjs [http://localhost:4301]
 *
 * Der Server wird vorgetaeuscht. Geprueft wird, dass die Umschaltung
 * wirklich eine andere Frage stellt, dass die Postleitzahl-Regionen nach
 * den ersten zwei Ziffern erscheinen und dass Adressen auch hier verkuerzt
 * stehen -- eine Auswertung ist kein Grund, den Bestand auszupacken.
 */
import { browserStarten } from './browser.mjs';

const BASIS = process.argv[2] || 'http://localhost:4301';
const s = await browserStarten({ basis: BASIS });
const w = (ms) => new Promise((g) => setTimeout(g, ms));
let fehler = 0;
const pruef = (n, b, z = '') => { console.log((b ? '  ok   ' : '  FEHL ') + n + (b ? '' : '  ' + z)); if (!b) fehler++; };

try {
  await s.groesse(1280, 1600, 1);
  await s.vorschalten(`
    localStorage.setItem('hausbau.marke', 'probe');
    window.__gerufen = [];
    const echt = window.fetch;
    window.fetch = async (weg, opt) => {
      if (!String(weg).includes('admin.php')) return echt(weg, opt);
      const r = JSON.parse(opt.body);
      window.__gerufen.push(r);
      if (r.tun === 'website') {
        return Response.json({
          tage: 30,
          gesamt: { aufrufe: 1234, seiten: 42 },
          seiten: [
            { pfad: '/kfw/', aufrufe: 800 },
            { pfad: '/preise/', aufrufe: 300 },
            { pfad: '/buch/', aufrufe: 134 },
          ],
          verlauf: [
            { tag: '2026-09-25', aufrufe: 400 },
            { tag: '2026-09-26', aufrufe: 834 },
          ],
          regionen: [
            { region: '66', anzahl: 7 },
            { region: '55', anzahl: 2 },
            { region: '67', anzahl: 1 },
          ],
          leads: [
            { id: 1, quelle: 'baukosten', epost: 'an…lz@beispiel.de', plz: '66989',
              bundesland: 'rheinland-pfalz', zeit: '2026-09-26 10:00',
              angaben: { flaeche: 140, standard: 'gehoben', keller: true, gesamt: 480000 } },
          ],
          leads_gesamt: 10,
        });
      }
      return Response.json({
        tage: 30,
        gesamt: { nutzer: 1, aktiv: 1, anfragen: 12, bytes: 2048, saetze: 5, bilder: 1,
                  bilder_bytes: 1024, freigaben: 0, freigabe_aufrufe: 0, neu: 1, buchcodes: 0 },
        nutzer: [{ id: 7, epost: 'an…lz@beispiel.de', angelegt: '2026-09-01', passwort: true,
                   anfragen: 12, bytes: 2048, tage_aktiv: 3, zuletzt: '2026-09-18', saetze: 5,
                   bilder: 1, bilder_bytes: 1024, geraete: 1, freigabe_aufrufe: 0, einblick: null,
                   ort: 'Kaiserslautern' }],
        verlauf: [{ tag: '2026-09-18', anfragen: 12, bytes: 2048, nutzer: 1 }],
      });
    };
  `);
  await s.laden('/');
  await s.hin('admin', 2500);
  await w(700);

  pruef('Zuerst steht die App da',
    (await s.werten(`document.getElementById('inhalt').innerText`)).includes('Konten'));

  const umgeschaltet = await s.werten(
    `(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Website');`
    + ` if (!b) return false; b.click(); return true; })()`
  );
  pruef('Es gibt eine Umschaltung auf die Website', umgeschaltet);
  await w(900);

  const text = await s.werten(`document.getElementById('inhalt').innerText`);
  const gefragt = await s.werten(`window.__gerufen.map((r) => r.tun)`);

  pruef('Die Website wird getrennt abgefragt', gefragt.includes('website'), JSON.stringify(gefragt));
  pruef('Die Seitenaufrufe stehen da', /1\.234|1234/.test(text), text.slice(0, 200));
  pruef('Die meistgelesene Seite steht oben', text.indexOf('/kfw/') < text.indexOf('/preise/'));
  pruef('Die Postleitzahl-Region steht als zwei Ziffern da',
    /\b66\b/.test(text) && !/66989\s*Anfragen/.test(text), text.slice(0, 600));
  pruef('Die stärkste Gegend steht vorn', text.indexOf('66') < text.indexOf('55'));
  pruef('Die Anfrage aus dem Rechner steht da', text.includes('baukosten'));
  pruef('Adressen bleiben verkürzt', text.includes('an…lz@beispiel.de') && !text.includes('andreas'));
  pruef('Die Angaben stehen lesbar da', /140 m²/.test(text), text.slice(0, 800));

  // Und wieder zurueck: Die App-Ansicht darf davon nichts abbekommen.
  await s.werten(`[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'App').click()`);
  await w(900);
  const zurueck = await s.werten(`document.getElementById('inhalt').innerText`);
  pruef('Zurück zur App geht auch', zurueck.includes('Konten') && !zurueck.includes('Meistgelesene'));

  const klagen = s.klagenHolen().filter((k) => !/abgleich\.php|ERR_FAILED/.test(k.text || ''));
  pruef('Keine Konsolenfehler', klagen.length === 0, JSON.stringify(klagen).slice(0, 300));
} finally {
  await s.schliessen();
}

console.log(fehler ? `\n${fehler} Fehler.` : '\nDie Website-Auswertung steht.');
process.exitCode = fehler ? 1 : 0;
