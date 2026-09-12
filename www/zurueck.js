// Die Zurücktaste von Android.
//
// Ohne dieses Modul reicht die WebView die Taste ans System weiter. Capacitor
// sieht dann nach, ob es im Verlauf etwas gibt; wenn nicht, schliesst Android
// die App. Genau das passierte mitten in der Arbeit: ein offenes Eingabeblatt
// hat keinen Verlaufseintrag, also flog man beim Abbrechen aus der App.
//
// Eine App, die beim Zurücktippen verschwindet, wirkt kaputt -- und auf einer
// Baustelle, wo man mit Handschuhen tippt, passiert das oefter als einmal.
//
// Die Reihenfolge ist die, die ein Mensch erwartet: erst zumachen, was obenauf
// liegt, dann eine Ebene hoch, und die App verlassen nur von der Übersicht aus
// und nur mit Ansage.

import { melde } from './hilfen.js';
import { blattSchliessen } from './blatt.js';

// Wie lange die Ansage gilt. Zwei Sekunden sind lang genug, um bewusst ein
// zweites Mal zu tippen, und kurz genug, dass ein spaeterer Tipp nicht mehr
// als Bestaetigung durchgeht.
const BEDENKZEIT = 2000;

/**
 * @param {object} haken
 * @param {() => boolean} haken.leisteOffen   Ist die Seitenleiste ausgefahren?
 * @param {() => void}    haken.leisteZu      Sie schliessen.
 * @param {() => void}    haken.zurUebersicht Auf die Projektübersicht gehen.
 */
export function zurueckAnbinden(haken) {
  /* Ohne Bundler gibt es kein "import '@capacitor/app'" -- ein nackter
     Modulname findet im Browser nichts. Capacitor haengt die nativen
     Erweiterungen zur Laufzeit unter Capacitor.Plugins ein; dasselbe Muster
     benutzt pdf.js fuer Share und Filesystem.

     Im Browser gibt es keine Systemtaste, dort macht der Browser sein
     eigenes Zurück -- hier also nichts zu tun. */
  const bruecke = window.Capacitor;
  if (!bruecke?.isNativePlatform?.()) return;
  const App = bruecke.Plugins?.App;
  if (!App) return;

  let gewarnt = 0;

  App.addListener('backButton', () => {
    // 1. Was obenauf liegt, zuerst. Ein offenes Blatt ist ein Abbrechen wert,
    //    keine Navigation.
    if (blattSchliessen()) return;

    // 2. Die ausgefahrene Seitenleiste verdeckt den Bildschirm; sie ist das
    //    Naechste, was weg soll.
    if (haken.leisteOffen()) {
      haken.leisteZu();
      return;
    }

    // 3. Aus jedem Bereich zurück auf die Übersicht. Nicht history.back():
    //    Der Verlauf kann leer sein oder an einer Stelle stehen, die der
    //    Nutzer nie gesehen hat. "Zurück" heisst hier "eine Ebene hoch", und
    //    diese App hat genau eine Ebene.
    const weg = location.hash.replace(/^#\/?/, '').replace(/\/$/, '');
    if (weg !== '') {
      haken.zurUebersicht();
      gewarnt = 0;
      return;
    }

    // 4. Erst auf der Übersicht darf die App enden -- und auch dort erst nach
    //    einer Ansage. Wer aus Versehen einmal zu oft tippt, soll nicht
    //    draussen stehen.
    const jetzt = Date.now();
    if (jetzt - gewarnt < BEDENKZEIT) {
      App.exitApp();
      // Zuruecksetzen, obwohl die App gleich weg ist: Sollte exitApp einmal
      // nicht durchgreifen, stuende die Zusage sonst weiter, und der
      // naechste Tipp beendete ohne Ansage.
      gewarnt = 0;
      return;
    }
    gewarnt = jetzt;
    melde('Noch einmal zurück, dann wird BauZeuge geschlossen.');
  });
}
