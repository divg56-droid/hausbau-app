/* Der Installationshinweis zeigt das Richtige am richtigen Geraet.
 *
 *     node test/installieren.mjs [http://localhost:4301]
 *
 * Der Browser wird je Fall neu gestartet und gibt sich als iPhone, Android
 * oder Rechner aus. Das Angebot von Chrome wird als Ereignis nachgestellt:
 * Es laesst sich ohne echten Nutzer nicht ausloesen.
 */
import { browserStarten } from './browser.mjs';

const BASIS = process.argv[2] || 'http://localhost:4301';
let fehler = 0;
const pruef = (n, b, z = '') => { console.log((b ? '  ok   ' : '  FEHL ') + n + (b ? '' : '  ' + z)); if (!b) fehler++; };

const GERAETE = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
  rechner: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
};

async function fall(geraet, schritte) {
  const s = await browserStarten({ basis: BASIS });
  try {
    await s.groesse(390, 1400, 2);
    // Der Chrome im Test ist selbst ein Chrome und schickt ein echtes
    // Angebot, sobald die App installierbar ist. Ein iPhone taete das nie.
    // Das echte faellt deshalb weg; nur das nachgestellte kommt durch.
    await s.vorschalten(
      `Object.defineProperty(navigator, 'userAgent', { get: () => ${JSON.stringify(GERAETE[geraet])} });
       window.addEventListener('beforeinstallprompt', (e) => {
         if (!e.nachgestellt) e.stopImmediatePropagation();
       }, true);`
    );
    await s.laden('/');
    await schritte(s);
  } finally {
    s.schliessen();
  }
}

const karte = `(() => {
  const k = document.querySelector('.install-karte');
  return k ? { da: true, text: k.innerText, spaeter: [...k.querySelectorAll('button')].some((b) => b.textContent === 'Später') } : { da: false };
})()`;

await fall('iphone', async (s) => {
  const vorher = await s.werten(karte);
  pruef('iPhone ohne Projekt: Hinweis steht da', vorher.da);
  pruef('iPhone: Weg über Teilen', vorher.da && /Teilen-Symbol/.test(vorher.text) && /Zum Home-Bildschirm/.test(vorher.text));
  pruef('iPhone ohne Projekt: warnt vor getrennten Daten', vorher.da && /vor dem ersten Projekt/.test(vorher.text));
  pruef('Vor dem ersten Projekt kein „Später“', vorher.da && !vorher.spaeter);
  pruef('Kein „null“ im Text', vorher.da && !/null/.test(vorher.text), vorher.text);

  await s.werten(`(async () => { const d = await import('/daten.js'); await d.einstellung('projektname', 'Test'); })()`);
  await s.hin('ablauf', 600);
  await s.hin('', 1400);
  const nachher = await s.werten(karte);
  pruef('Mit Projekt: Hinweis nennt die Sicherung', nachher.da && /Sicherung/.test(nachher.text));
  pruef('Mit Projekt: „Später“ ist da', nachher.da && nachher.spaeter);

  await s.werten(`[...document.querySelectorAll('.install-karte button')].find((b) => b.textContent === 'Später').click()`);
  await s.hin('ablauf', 600);
  await s.hin('', 1400);
  pruef('Nach „Später“ bleibt der Hinweis weg', (await s.werten(karte)).da === false);
});

await fall('iphoneChrome', async (s) => {
  const k = await s.werten(karte);
  pruef('Chrome auf dem iPhone: verweist auf Safari', k.da && /in Safari/.test(k.text));
});

await fall('android', async (s) => {
  const ohne = await s.werten(karte);
  pruef('Android ohne Angebot: Weg über das Menü', ohne.da && /drei Punkten/.test(ohne.text));

  await s.werten(`(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.nachgestellt = true;
    e.prompt = () => { window.__gefragt = true; };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  })()`);
  await s.hin('ablauf', 600);
  await s.hin('', 1400);
  const mit = await s.werten(karte);
  pruef('Android mit Angebot: ein Knopf statt Anleitung', mit.da && /Jetzt installieren/.test(mit.text) && !/drei Punkten/.test(mit.text));

  await s.werten(`[...document.querySelectorAll('.install-karte button')].find((b) => b.textContent === 'Jetzt installieren').click()`);
  await new Promise((g) => setTimeout(g, 800));
  const danach = await s.werten(`({ gefragt: window.__gefragt === true, karte: !!document.querySelector('.install-karte'), gemerkt: localStorage.getItem('bauzeuge.installhinweis') })`);
  pruef('Knopf öffnet den Dialog des Browsers', danach.gefragt);
  pruef('Nach dem Installieren ist die Karte weg', !danach.karte);
  pruef('Installation ist vermerkt', String(danach.gemerkt).startsWith('installiert'), String(danach.gemerkt));
});

await fall('rechner', async (s) => {
  pruef('Rechner ohne Angebot: kein Hinweis', (await s.werten(karte)).da === false);
});

console.log(fehler ? `\n${fehler} Fehler.` : '\nDer Installationshinweis passt zum Gerät.');
process.exitCode = fehler ? 1 : 0;
