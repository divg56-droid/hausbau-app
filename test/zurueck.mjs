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
import { FUELLEN } from './beispieldaten.mjs';

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
  // Ohne Daten gibt es keine Einzelseiten, und Punkt 6 haette nichts zu
  // pruefen.
  await seite.werten(FUELLEN);

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

  /* 5. Jeder Weg der App, einzeln.
   *
   *    "Das musst Du bei jedem Reiter in der ganzen App ueberpruefen" -- also
   *    nicht an drei Beispielen, sondern an allen. Geprueft wird zweierlei:
   *    Die App darf nicht enden, und der Zurücktipp muss irgendwo ankommen,
   *    wo man vorher war. Fuer Unterseiten heisst das ihre Liste, fuer
   *    Bereiche die Übersicht.
   */
  const WEGE = await seite.werten(`(async () => {
    const { MODULE } = await import('/bereiche.js');
    return MODULE.map((m) => m.weg).filter((w) => w !== '');
  })()`);

  let schief = [];
  const zaehlerNull = () => seite.werten('window.__zurueck.beendet = 0');
  await zaehlerNull();
  for (const weg of WEGE) {
    await seite.hin(weg, 500);
    const nachher = await seite.werten(DRUECKEN);
    if (nachher.beendet !== 0) schief.push(`${weg}: beendet die App`);
    else if (nachher.weg !== '') schief.push(`${weg}: landet auf "${nachher.weg}"`);
  }
  pruef(`Alle ${WEGE.length} Bereiche gehen auf die Übersicht`,
    schief.length === 0, schief.join(' | '));

  /* 6. Unterseiten: Sie gehoeren zu einer Liste und muessen dorthin zurueck.
   *    Hier lag der zweite Teil des Fehlers -- die App flog nicht mehr
   *    hinaus, sprang aber aus jeder Einzelseite gleich aufs Dashboard. */
  const unterwege = await seite.werten(`(async () => {
    const { daten } = await import('/daten.js');
    const [kontakte, raeume] = await Promise.all([
      daten.alle('kontakte'), daten.alle('raeume'),
    ]);
    const raus = [];
    if (kontakte[0]) raus.push(['kontakte/' + kontakte[0].id, 'kontakte']);
    if (raeume[0]) raus.push(['raeume/' + raeume[0].id, 'raeume']);
    return raus;
  })()`);
  pruef('Es gibt Unterseiten zum Pruefen', unterwege.length >= 1,
    'keine gefunden -- die Beispieldaten liefern keine');

  for (const [weg, erwartet] of unterwege) {
    await zaehlerNull();
    await seite.hin(weg, 700);
    const nachher = await seite.werten(DRUECKEN);
    pruef(`#/${weg.split('/')[0]}/<kennung> geht auf die Liste`,
      nachher.weg === erwartet && nachher.beendet === 0,
      JSON.stringify(nachher));
  }

  /* 7. Ein offenes Formular geht zu, in jedem Bereich, der eines hat.
   *    "Mangel erfassen, anders ueberlegt, zurueck" -- und man steht wieder
   *    in der Mangelliste, nicht irgendwo. */
  for (const weg of ['maengel', 'kontakte', 'todos', 'ablauf', 'baukasse/kosten']) {
    await zaehlerNull();
    await seite.hin(weg, 600);
    const geoeffnet = await seite.werten(`(async () => {
      const { blattOeffnen } = await import('/blatt.js');
      blattOeffnen('Pruefung', [], () => {});
      await new Promise((g) => setTimeout(g, 150));
      return !!document.querySelector('.ueberlagerung');
    })()`);
    const nachher = await seite.werten(DRUECKEN);
    pruef(`In #/${weg} schliesst zurück das Formular`,
      geoeffnet && !nachher.blatt && nachher.weg === weg && nachher.beendet === 0,
      JSON.stringify(nachher));
  }

  /* 8. Die Systemtaste ohne die Bruecke.
   *
   *    Der Fall vom Telefon: Capacitor liefert das backButton-Ereignis nicht,
   *    macht stattdessen sein Standardverhalten -- history.back() -- und das
   *    Blatt blieb als kleines Fenster im Vordergrund stehen, waehrend
   *    dahinter der Bereich wechselte.
   *
   *    Geprueft wird deshalb ohne jeden Zuhoerer der Bruecke: nur der
   *    Verlauf, so wie ihn auch das Standardverhalten benutzt. Danach muss
   *    das Blatt zu sein UND der Bereich stehen geblieben. */
  {
    await seite.hin('maengel', 700);
    await seite.werten(`(async () => {
      const { blattOeffnen } = await import('/blatt.js');
      blattOeffnen('Pruefung', [], () => {});
      await new Promise((g) => setTimeout(g, 250));
    })()`);
    const vorher = await seite.werten(`({
      blatt: !!document.querySelector('.ueberlagerung'),
      weg: location.hash, tiefe: history.length,
    })`);
    const nachher = await seite.werten(`(async () => {
      history.back();
      await new Promise((g) => setTimeout(g, 500));
      return { blatt: !!document.querySelector('.ueberlagerung'), weg: location.hash };
    })()`);
    pruef('Ein Blatt legt einen Eintrag in den Verlauf', vorher.blatt, JSON.stringify(vorher));
    pruef('history.back() schliesst das Blatt', !nachher.blatt, JSON.stringify(nachher));
    pruef('Und der Bereich bleibt stehen', nachher.weg === vorher.weg,
      `${vorher.weg} -> ${nachher.weg}`);
  }

  /* 9. Und andersherum: Wer auf Abbrechen tippt, darf keinen Eintrag
   *    zuruecklassen -- sonst braucht die Zuruecktaste danach zwei Tipps
   *    fuer einen Schritt. */
  {
    await seite.hin('maengel', 700);
    const ergebnis = await seite.werten(`(async () => {
      const vorher = history.length;
      const { blattOeffnen } = await import('/blatt.js');
      blattOeffnen('Pruefung', [], () => {});
      await new Promise((g) => setTimeout(g, 250));
      [...document.querySelectorAll('.ueberlagerung button')]
        .find((b) => b.textContent === 'Abbrechen').click();
      await new Promise((g) => setTimeout(g, 500));
      return { vorher, nachher: history.length,
        blatt: !!document.querySelector('.ueberlagerung'), weg: location.hash };
    })()`);
    pruef('Abbrechen schliesst das Blatt', !ergebnis.blatt, JSON.stringify(ergebnis));
    pruef('Und raeumt seinen Eintrag wieder ab',
      ergebnis.nachher === ergebnis.vorher, JSON.stringify(ergebnis));
  }

  await seite.hin('');

  // 10. Nach der Bedenkzeit gilt die Ansage nicht mehr -- sonst beendet ein
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
