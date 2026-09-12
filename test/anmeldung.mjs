/* Prueft, dass nach dem Anmelden sofort abgeglichen wird.
 *
 *     node test/anmeldung.mjs [http://localhost:4301]
 *
 * Anlass: Wer am Telefon etwas eintrug und sich danach im Browser anmeldete,
 * sah dort nichts. Die Daten lagen auf dem Server -- nur holte sie niemand.
 * Der einzige selbsttaetige Abgleich lief beim Start der App, und der ist
 * vorbei, wenn jemand sich anmeldet.
 *
 * Der Server wird hier nachgebaut: konto.php antwortet mit einer Marke,
 * abgleich.php mit einem Satz, den es hier nicht gibt. Danach muss er in der
 * Datenbank stehen. Damit ist die ganze Kette geprueft -- Anmelden, Abgleich
 * ausloesen, Antwort einarbeiten -- und nicht bloss, ob eine Funktion
 * aufgerufen wurde.
 */
import { browserStarten } from './browser.mjs';

const BASIS = process.argv[2] || 'http://localhost:4301';

let fehler = 0;
const pruef = (name, bedingung, zusatz = '') => {
  if (bedingung) console.log('  ok   ' + name);
  else { console.log('  FEHL ' + name + '  ' + zusatz); fehler++; }
};

/* Der nachgebaute Server. Muss vor allen Skripten stehen: konto.js liest die
 * Marke beim Laden, und abgleich.js haengt daran. */
const SERVER = `
  /* Das Protokoll liegt im sessionStorage und nicht in einer Variablen:
     Bringt der Abgleich etwas herunter, baut die App sich neu auf -- und mit
     ihr verschwaende eine Variable. Genau dieses Neuaufbauen ist Teil dessen,
     was hier geprueft wird. */
  /* Jeder Seitenaufbau zaehlt einmal hoch. Das vorgeschaltete Skript laeuft
     bei jedem Dokument, also auch nach einem reload -- damit laesst sich
     nachweisen, dass der Neuaufbau stattgefunden hat, statt es anzunehmen. */
  sessionStorage.setItem('__aufbauten',
    String(Number(sessionStorage.getItem('__aufbauten') || 0) + 1));

  const merken = (eintrag) => {
    const bisher = JSON.parse(sessionStorage.getItem('__ruf') || '[]');
    bisher.push(eintrag);
    sessionStorage.setItem('__ruf', JSON.stringify(bisher));
  };
  const echt = window.fetch;
  window.fetch = (ziel, opt) => {
    const weg = String(ziel && ziel.url ? ziel.url : ziel);
    const rumpf = opt && opt.body ? JSON.parse(opt.body) : {};
    merken({ weg, tun: rumpf.tun });
    const json = (o) => Promise.resolve(new Response(JSON.stringify(o),
      { status: 200, headers: { 'Content-Type': 'application/json' } }));

    if (weg.includes('/konto.php')) {
      if (rumpf.tun === 'anmelden' || rumpf.tun === 'registrieren') {
        return json({ marke: 'pruefmarke', epost: rumpf.epost });
      }
      return json({ epost: 'pruef@example.de', saetze: 1, bilder: 0, bytes: 0, admin: false });
    }
    if (weg.includes('/abgleich.php')) {
      /* Ein Satz, den es auf diesem Geraet nicht gibt -- kommt er nach dem
         Anmelden in der Datenbank an, hat der Abgleich wirklich gearbeitet.
         "geaendert" weit in der Zukunft, damit er als neuer gilt. */
      return json({
        stand: '2099-01-01T00:00:00.000Z',
        weiter: false,
        saetze: {
          kontakte: [{
            id: 'pruefkontakt-vom-server',
            name: 'Vom Server geholt',
            art: 'firma',
            projektId: 'projekt-1',
            geaendert: '2099-01-01T00:00:00.000Z',
            geloescht: false,
          }],
        },
      });
    }
    return echt(ziel, opt);
  };
`;

const seite = await browserStarten({ basis: BASIS });

try {
  await seite.groesse(390, 840);
  await seite.vorschalten(SERVER);
  await seite.laden('/');
  await new Promise((g) => setTimeout(g, 1500));

  // Abgemeldet anfangen, sonst gleicht der Start schon ab.
  await seite.werten(`(async () => {
    const { vergessen } = await import('/konto.js');
    vergessen();
  })()`);

  await seite.hin('konto', 1200);
  await seite.werten(`sessionStorage.setItem('__ruf', '[]');
    sessionStorage.setItem('__aufbauten', '0');`);

  const formular = await seite.werten(`(() => {
    const felder = [...document.querySelectorAll('#inhalt input')];
    return {
      eingaben: felder.map((f) => f.type),
      knoepfe: [...document.querySelectorAll('#inhalt button')].map((b) => b.textContent.trim()),
    };
  })()`);
  pruef('Der Anmeldebildschirm steht', formular.eingaben.length > 0,
    JSON.stringify(formular));

  /* Anmelden wie ein Mensch: Felder fuellen, Knopf druecken. Der Weg ueber
     die Oberflaeche und nicht ueber die Funktion darunter -- sonst prueft
     man den Aufruf und nicht den Knopf. */
  await seite.werten(`(async () => {
    const felder = [...document.querySelectorAll('#inhalt input')];
    const setzen = (feld, wert) => {
      const s = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value').set;
      s.call(feld, wert);
      feld.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const epost = felder.find((f) => f.type === 'email') || felder[0];
    const wort = felder.find((f) => f.type === 'password');
    setzen(epost, 'pruef@example.de');
    if (wort) setzen(wort, 'pruefwort-lang-genug');
    const knopf = [...document.querySelectorAll('#inhalt button')]
      .find((b) => /Anmelden|Konto anlegen/.test(b.textContent));
    knopf.click();
    await new Promise((g) => setTimeout(g, 800));
  })()`);

  /* Warten, bis der Neuaufbau durch ist. Er kommt 900 Millisekunden nach dem
     Abgleich; danach steht eine frische Seite, und erst dort laesst sich
     wieder etwas fragen. */
  await new Promise((g) => setTimeout(g, 4000));

  const gerufen = await seite.werten("JSON.parse(sessionStorage.getItem('__ruf') || '[]')");
  const wege = gerufen.map((r) => (r.weg.includes('/abgleich.php') ? 'abgleich' : r.tun || '?'));
  pruef('Die Anmeldung geht zum Server', wege.includes('anmelden') || wege.includes('registrieren'),
    JSON.stringify(wege));
  pruef('Und danach wird abgeglichen', wege.includes('abgleich'), JSON.stringify(wege));

  // Die eigentliche Frage: Sind die Daten des Servers jetzt hier?
  const angekommen = await seite.werten(`(async () => {
    const { daten } = await import('/daten.js');
    const alle = await daten.alleMitGrabsteinen('kontakte');
    const treffer = alle.find((k) => k.id === 'pruefkontakt-vom-server');
    return { da: !!treffer, name: treffer ? treffer.name : null, anzahl: alle.length };
  })()`);
  pruef('Der Satz vom Server steht in der Datenbank', angekommen.da,
    JSON.stringify(angekommen));

  /* Und der gemerkte Projektzeiger ist verworfen.
   *
   * Der zweite Teil des Fehlers: Das offene Projekt steht als Einstellung und
   * kommt mit herunter. daten.js merkt es sich aber beim ersten Lesen -- wer
   * am Telefon ein neues Projekt anlegt und sich dann im Browser anmeldet,
   * bekommt es herunter, sieht aber weiter das alte und damit nichts. */
  const zeiger = await seite.werten(`(async () => {
    const d = await import('/daten.js');
    return { gibtEs: typeof d.projektzeigerVergessen === 'function' };
  })()`);
  pruef('Der Projektzeiger laesst sich verwerfen', zeiger.gibtEs, JSON.stringify(zeiger));

  /* Der Beweis, dass der Neuaufbau stattgefunden hat.
   *
   * Der Zaehler wurde vor dem Anmelden auf null gesetzt; jeder Seitenaufbau
   * erhoeht ihn. Steht danach mindestens eins, hat die Seite sich neu
   * geladen. Ohne das saehe man weiter das alte Projekt -- die Daten da, der
   * Bildschirm leer.
   *
   * Hier stand einmal performance.getEntriesByType('navigation').length >= 1.
   * Das ist immer wahr, und eine Pruefung, die nie rot werden kann, ist
   * schlimmer als keine: Sie sieht nach Absicherung aus. */
  const aufbauten = Number(
    await seite.werten("sessionStorage.getItem('__aufbauten') || '0'")
  );
  pruef('Nach dem Abgleich wurde neu aufgebaut', aufbauten >= 1,
    'Aufbauten seit dem Anmelden: ' + aufbauten);
} finally {
  seite.schliessen();
}

console.log(fehler
  ? `\nFEHLGESCHLAGEN: ${fehler}`
  : '\nNach dem Anmelden wird sofort abgeglichen.');
process.exit(fehler ? 1 : 0);
