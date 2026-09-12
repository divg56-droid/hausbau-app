/* Prueft die Zurücktaste von Android.
 *
 *     npm run dev          (oder der Vorschau-Server auf Port 4301)
 *     node test/zurueck.mjs [http://localhost:4301]
 *
 * Anlass: Die Taste hat die App geschlossen, statt eine Ebene hoch zu gehen.
 * Mitten in der Arbeit, und beim Abbrechen eines Eingabeblattes zuverlaessig
 * -- ein Blatt hat keinen Verlaufseintrag, also fand Capacitor nichts, wohin
 * es zurueckgehen koennte, und reichte die Taste ans System weiter.
 *
 * Im Browser gibt es die Taste nicht. Deshalb wird hier die Bruecke
 * nachgebaut: ein Capacitor-Objekt, das sich als nativ ausgibt, und ein
 * App-Plugin, das den Zuhoerer einsammelt und merkt, ob exitApp gerufen
 * wurde. Getestet wird damit genau das, was auf dem Telefon laeuft -- die
 * Reihenfolge in zurueck.js -- und nicht eine Nachbildung davon.
 */
import { browserStarten } from './browser.mjs';

const BASIS = process.argv[2] || 'http://localhost:4301';

let fehler = 0;
const pruef = (name, bedingung, zusatz = '') => {
  if (bedingung) console.log('  ok   ' + name);
  else { console.log('  FEHL ' + name + '  ' + zusatz); fehler++; }
};

/* Muss vor jedem Skript der Seite laufen: zurueck.js fragt beim Anbinden
   einmal nach der Bruecke und merkt sich das Ergebnis. */
const BRUECKE = `
  window.__zurueck = { zuhoerer: null, beendet: 0 };
  window.Capacitor = {
    isNativePlatform: () => true,
    Plugins: {
      App: {
        addListener: (name, fn) => {
          if (name === 'backButton') window.__zurueck.zuhoerer = fn;
          return Promise.resolve({ remove() {} });
        },
        exitApp: () => { window.__zurueck.beendet++; },
      },
      StatusBar: { setStyle: () => Promise.resolve() },
    },
  };
`;

const DRUECKEN = `(async () => {
  window.__zurueck.zuhoerer();
  await new Promise((g) => setTimeout(g, 350));
  return {
    weg: location.hash.replace(/^#\\/?/, '').replace(/\\/$/, ''),
    blatt: !!document.querySelector('.ueberlagerung'),
    leiste: document.body.classList.contains('leiste-offen'),
    meldung: (document.querySelector('.meldung') || {}).textContent || '',
    beendet: window.__zurueck.beendet,
  };
})()`;

const seite = await browserStarten({ basis: BASIS });

try {
  await seite.groesse(390, 800);
  await seite.vorschalten(BRUECKE);
  await seite.laden('/');
  await new Promise((g) => setTimeout(g, 1200));

  pruef('Die Taste ist angebunden',
    await seite.werten('!!window.__zurueck.zuhoerer'));

  // 1. Aus einem Bereich geht es auf die Übersicht, nicht hinaus.
  await seite.hin('baukasse/kosten');
  const ausBereich = await seite.werten(DRUECKEN);
  pruef('Aus einem Bereich zurück auf die Übersicht',
    ausBereich.weg === '' && ausBereich.beendet === 0, JSON.stringify(ausBereich));

  // 2. Ein offenes Eingabeblatt geht zuerst zu. Genau hier flog die App
  //    vorher heraus.
  await seite.hin('baukasse/kosten');
  await seite.werten(`(async () => {
    const { blattOeffnen } = await import('/blatt.js');
    blattOeffnen('Pruefung', [], () => {});
    await new Promise((g) => setTimeout(g, 200));
  })()`);
  pruef('Ein Blatt laesst sich oeffnen',
    await seite.werten("!!document.querySelector('.ueberlagerung')"));

  const mitBlatt = await seite.werten(DRUECKEN);
  pruef('Zurück schliesst das Blatt', !mitBlatt.blatt, JSON.stringify(mitBlatt));
  pruef('Und bleibt im Bereich', mitBlatt.weg === 'baukasse/kosten', mitBlatt.weg);
  pruef('Und beendet nichts', mitBlatt.beendet === 0);

  // 3. Die ausgefahrene Seitenleiste ist das Naechste, was weicht.
  await seite.werten("document.getElementById('menueknopf').click()");
  await new Promise((g) => setTimeout(g, 250));
  const mitLeiste = await seite.werten(DRUECKEN);
  pruef('Zurück schliesst die offene Leiste',
    !mitLeiste.leiste && mitLeiste.beendet === 0, JSON.stringify(mitLeiste));

  // 4. Auf der Übersicht erst die Ansage, dann hinaus.
  await seite.hin('');
  const erstesMal = await seite.werten(DRUECKEN);
  pruef('Auf der Übersicht kommt erst die Ansage',
    erstesMal.beendet === 0 && /noch einmal/i.test(erstesMal.meldung),
    JSON.stringify(erstesMal));

  const zweitesMal = await seite.werten(DRUECKEN);
  pruef('Das zweite Mal beendet die App', zweitesMal.beendet === 1,
    JSON.stringify(zweitesMal));

  // 5. Nach der Bedenkzeit gilt die Ansage nicht mehr -- sonst beendet ein
  //    Tipp von vor einer Minute die App.
  await seite.werten('window.__zurueck.beendet = 0');
  // Erst die Bedenkzeit des vorigen Falls ablaufen lassen, sonst beendet
  // schon der erste Tipp dieses Falls -- die Zusage von eben gilt noch.
  await new Promise((g) => setTimeout(g, 2400));
  await seite.werten(DRUECKEN);
  await new Promise((g) => setTimeout(g, 2400));
  const spaeter = await seite.werten(DRUECKEN);
  pruef('Nach der Bedenkzeit warnt es erneut', spaeter.beendet === 0,
    JSON.stringify(spaeter));
} finally {
  seite.schliessen();
}

console.log(fehler ? `\nFEHLGESCHLAGEN: ${fehler}` : '\nDie Zurücktaste hält die Reihenfolge.');
process.exit(fehler ? 1 : 0);
