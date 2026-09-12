/* Zwei Geraete, ein Konto: Kommt bei B an, was A eingetragen hat?
 *
 *     npm run dev
 *     node test/zweiGeraete.mjs [http://localhost:4301]
 *
 * Anlass: Am Telefon eingetragen, im Browser angemeldet -- eine Rechnung war
 * da, die Kontakte nicht, und die Projektuebersicht blieb leer. Bis hierher
 * hat nichts den Abgleich zwischen zwei Geraeten wirklich durchgespielt; die
 * Pruefungen davor haben immer nur eine Seite betrachtet.
 *
 * Aufbau: ein nachgebauter Server, der sich wie abgleich.php verhaelt (Saetze
 * annehmen, Neueres herausgeben), und zwei eigene Chrome-Instanzen mit
 * getrennten Profilen -- also getrennte Datenbanken, wie zwei Geraete.
 *
 * Geprueft wird jeder Speicher einzeln. "Der Abgleich laeuft" sagt nichts,
 * solange nicht feststeht, was dabei ankommt.
 */
import { createServer } from 'node:http';
import { browserStarten } from './browser.mjs';

const BASIS = process.argv[2] || 'http://localhost:4301';
const PORT = 4408;

let fehler = 0;
const pruef = (name, bedingung, zusatz = '') => {
  if (bedingung) console.log('  ok   ' + name);
  else { console.log('  FEHL ' + name + '  ' + zusatz); fehler++; }
};

/* Der Server. Haelt die Saetze im Speicher, genau wie die Tabelle "saetze":
 * je Speicher und Kennung einer, der neuere gewinnt. */
const bestand = new Map(); // "speicher/kennung" -> satz
const rumpfLesen = (anfrage) =>
  new Promise((gut) => {
    let roh = '';
    anfrage.on('data', (s) => { roh += s; });
    anfrage.on('end', () => gut(roh ? JSON.parse(roh) : {}));
  });

const server = createServer(async (anfrage, antwort) => {
  /* Herkunft freigeben, wie _start.php es tut. Die App laeuft auf
     localhost:4301, dieser Server auf 127.0.0.1 -- fuer den Browser zwei
     verschiedene Herkuenfte. Ohne diese Koepfe kommt keine Anfrage durch, und
     die App meldet "Keine Verbindung". */
  antwort.setHeader('Access-Control-Allow-Origin', anfrage.headers.origin || '*');
  antwort.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Hausbau-Marke');
  antwort.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (anfrage.method === 'OPTIONS') {
    antwort.writeHead(204).end();
    return;
  }

  const rumpf = await rumpfLesen(anfrage);
  const senden = (o) => {
    antwort.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    antwort.end(JSON.stringify(o));
  };

  if (anfrage.url.includes('/konto.php')) {
    if (rumpf.tun === 'anmelden' || rumpf.tun === 'registrieren') {
      return senden({ marke: 'pruefmarke', epost: rumpf.epost });
    }
    return senden({ epost: 'zwei@example.de', saetze: bestand.size, bilder: 0, bytes: 0 });
  }

  if (anfrage.url.includes('/abgleich.php')) {
    // Hinein: alles annehmen, was neuer ist als das Vorhandene.
    for (const [speicher, liste] of Object.entries(rumpf.saetze || {})) {
      for (const satz of liste) {
        const schluessel = speicher === 'einstellungen' ? satz.name : satz.id;
        const kennung = `${speicher}/${schluessel}`;
        const alt = bestand.get(kennung);
        if (!alt || String(satz.geaendert || '') > String(alt.satz.geaendert || '')) {
          bestand.set(kennung, { speicher, satz });
        }
      }
    }
    // Hinaus: alles, was seit der Marke des Geraets dazukam.
    const seit = String(rumpf.seit || '');
    const hinaus = {};
    let neuesteMarke = seit;
    for (const { speicher, satz } of bestand.values()) {
      const wann = String(satz.geaendert || '');
      if (seit && wann <= seit) continue;
      (hinaus[speicher] ??= []).push(satz);
      if (wann > neuesteMarke) neuesteMarke = wann;
    }
    return senden({ stand: neuesteMarke || new Date().toISOString(), weiter: false, saetze: hinaus });
  }

  antwort.writeHead(404).end('{}');
});

await new Promise((g) => server.listen(PORT, '127.0.0.1', g));

/* Die App auf den nachgebauten Server umlenken. konto.js liest dafuer
 * localStorage["hausbau.basis"] -- derselbe Weg, den auch das oertliche
 * Entwickeln nimmt. */
const UMLENKEN = `
  try {
    localStorage.setItem('hausbau.basis', 'http://127.0.0.1:${PORT}');
  } catch {}
`;

async function geraet(name) {
  const seite = await browserStarten({ basis: BASIS });
  await seite.groesse(390, 840);
  await seite.vorschalten(UMLENKEN);
  await seite.laden('/');
  await new Promise((g) => setTimeout(g, 1500));
  return seite;
}

const a = await geraet('A');
const b = await geraet('B');

try {
  // ------------------------------------------------ Gerät A traegt ein
  const angelegt = await a.werten(`(async () => {
    const { daten } = await import('/daten.js');
    const { projektAnlegen } = await import('/projekte.js');
    const { anmelden } = await import('/konto.js');

    await anmelden('zwei@example.de', 'pruefwort-lang-genug');

    const projektId = await projektAnlegen('Neubau Zweigeraetepruefung');
    const kontaktId = await daten.sichern('kontakte', {
      name: 'Elektro Pruefstein', art: 'firma', gewerk: 'Elektro',
      telefon: '0631 0000', epost: 'a@b.de',
    });
    const postenId = await daten.sichern('posten', {
      name: 'Elektroinstallation', gewerk: 'Elektro', geplant: 22400,
      tatsaechlich: 0, status: 'beauftragt',
    });
    const belegId = await daten.sichern('belege', {
      betrag: 12000, datum: '2026-09-01', beschreibung: 'Abschlag Elektro', postenId,
    });
    const mangelId = await daten.sichern('maengel', {
      titel: 'Steckdose fehlt', raum: 'Küche', gewerk: 'Elektro', status: 'offen',
    });
    return { projektId, kontaktId, postenId, belegId, mangelId };
  })()`);

  const hoch = await a.werten(`(async () => {
    const { abgleichen } = await import('/abgleich.js');
    return await abgleichen();
  })()`);
  pruef('Gerät A schickt Sätze hoch', hoch.hoch > 0, JSON.stringify(hoch));

  // ------------------------------------------------ Gerät B holt
  const runter = await b.werten(`(async () => {
    const { anmelden } = await import('/konto.js');
    const { abgleichen } = await import('/abgleich.js');
    await anmelden('zwei@example.de', 'pruefwort-lang-genug');
    return await abgleichen();
  })()`);
  pruef('Gerät B holt Sätze herunter', runter.runter > 0, JSON.stringify(runter));

  /* Jeden Speicher einzeln nachsehen -- roh, ohne den Projektfilter. Erst
   * damit laesst sich trennen, ob etwas fehlt oder nur nicht angezeigt wird. */
  const beiB = await b.werten(`(async () => {
    const { daten } = await import('/daten.js');
    const raus = {};
    for (const s of ['projekte', 'kontakte', 'posten', 'belege', 'maengel', 'einstellungen']) {
      raus[s] = (await daten.alleMitGrabsteinen(s)).length;
    }
    raus.projektAktiv = (await daten.holen('einstellungen', 'projekt_aktiv') || {}).wert || null;
    return raus;
  })()`);
  console.log('\n  Bei B angekommen (roh):', JSON.stringify(beiB));

  pruef('Das Projekt ist bei B angekommen', beiB.projekte >= 1, JSON.stringify(beiB));
  pruef('Der Kontakt ist bei B angekommen', beiB.kontakte >= 1, JSON.stringify(beiB));
  pruef('Die Position ist bei B angekommen', beiB.posten >= 1, JSON.stringify(beiB));
  pruef('Die Rechnung ist bei B angekommen', beiB.belege >= 1, JSON.stringify(beiB));
  pruef('Der Mangel ist bei B angekommen', beiB.maengel >= 1, JSON.stringify(beiB));
  pruef('Das offene Projekt kam mit', beiB.projektAktiv === angelegt.projektId,
    `${beiB.projektAktiv} statt ${angelegt.projektId}`);

  /* Und jetzt die Frage, die zaehlt: Sieht man es auch? daten.alle() filtert
   * nach dem offenen Projekt -- angekommen und sichtbar sind zweierlei. */
  const sichtbar = await b.werten(`(async () => {
    const { daten, projektzeigerVergessen } = await import('/daten.js');
    projektzeigerVergessen();
    const raus = {};
    for (const s of ['kontakte', 'posten', 'belege', 'maengel']) {
      raus[s] = (await daten.alle(s)).length;
    }
    const { projekteListe } = await import('/projekte.js');
    raus.projekteInDerListe = (await projekteListe()).map((p) => p.name);
    return raus;
  })()`);
  console.log('  Bei B sichtbar:        ', JSON.stringify(sichtbar));

  pruef('Der Kontakt ist bei B auch sichtbar', sichtbar.kontakte >= 1, JSON.stringify(sichtbar));
  pruef('Die Rechnung ist bei B auch sichtbar', sichtbar.belege >= 1, JSON.stringify(sichtbar));
  pruef('Das Projekt steht in der Liste',
    sichtbar.projekteInDerListe.includes('Neubau Zweigeraetepruefung'),
    JSON.stringify(sichtbar.projekteInDerListe));
} finally {
  a.schliessen();
  b.schliessen();
  server.close();
}

console.log(fehler ? `\nFEHLGESCHLAGEN: ${fehler}` : '\nBeide Geräte sehen dasselbe.');
process.exit(fehler ? 1 : 0);
