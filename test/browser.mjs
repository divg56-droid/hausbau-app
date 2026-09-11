/* Ein kopfloser Chrome, ueber das DevTools-Protokoll gesteuert.
 *
 * Warum nicht der eingebaute Vorschau-Bereich: Der legt hier nichts aus.
 * visibilityState bleibt "hidden", clientWidth ist 0, und
 * getBoundingClientRect liefert Nullen -- damit laesst sich keine Breite
 * messen und kein Bild aufnehmen.
 *
 * Warum kein Puppeteer: Node 22 bringt einen WebSocket-Client mit, und das
 * Protokoll ist an dieser Stelle ein Dutzend Zeilen. Eine Abhaengigkeit von
 * 300 Megabyte fuer "mach ein Bild" waere teuer bezahlt.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/* Windows zuerst, dann die ueblichen Orte unter Linux -- damit dasselbe
 * Skript auch auf einem Laeufer laeuft, falls es einmal ins CI soll. */
const ORTE = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

export async function browserStarten({ basis }) {
  const { existsSync } = await import('node:fs');
  const pfad = ORTE.find((o) => existsSync(o));
  if (!pfad) throw new Error('Kein Chrome gefunden. Gesucht in:\n  ' + ORTE.join('\n  '));

  const profil = mkdtempSync(join(tmpdir(), 'bauzeuge-'));
  const chrome = spawn(pfad, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
    '--remote-debugging-port=0', `--user-data-dir=${profil}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  const url = await new Promise((gut, schlecht) => {
    let puffer = '';
    const zeit = setTimeout(() => schlecht(new Error('Chrome meldet sich nicht.')), 20000);
    chrome.stderr.on('data', (d) => {
      puffer += d;
      const t = puffer.match(/ws:\/\/\S+/);
      if (t) { clearTimeout(zeit); gut(t[0]); }
    });
  });

  const ws = new WebSocket(url);
  await new Promise((g) => ws.addEventListener('open', g, { once: true }));

  let nr = 0;
  const offen = new Map();
  ws.addEventListener('message', (e) => {
    const n = JSON.parse(e.data);
    if (n.id && offen.has(n.id)) {
      const o = offen.get(n.id);
      offen.delete(n.id);
      n.error ? o.schlecht(new Error(n.error.message)) : o.gut(n.result);
    }
  });

  const ziel = await new Promise((gut, schlecht) => {
    const id = ++nr;
    offen.set(id, { gut, schlecht });
    ws.send(JSON.stringify({ id, method: 'Target.createTarget', params: { url: 'about:blank' } }));
  });

  const ruf = (method, params = {}, sessionId) =>
    new Promise((gut, schlecht) => {
      const id = ++nr;
      offen.set(id, { gut, schlecht });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });

  const { sessionId } = await ruf('Target.attachToTarget',
    { targetId: ziel.targetId, flatten: true });
  await ruf('Page.enable', {}, sessionId);
  await ruf('Runtime.enable', {}, sessionId);

  const seite = {
    async groesse(breite, hoehe, dichte = 1) {
      await ruf('Emulation.setDeviceMetricsOverride',
        { width: breite, height: hoehe, deviceScaleFactor: dichte, mobile: breite < 768 },
        sessionId);
    },

    async laden(weg = '/') {
      await ruf('Page.navigate', { url: basis + weg }, sessionId);
      await new Promise((g) => {
        const ab = (e) => {
          const n = JSON.parse(e.data);
          if (n.sessionId === sessionId && n.method === 'Page.loadEventFired') {
            ws.removeEventListener('message', ab); g();
          }
        };
        ws.addEventListener('message', ab);
      });
      await new Promise((g) => setTimeout(g, 2000));
    },

    /* Nur den Hash setzen statt neu zu laden.
     *
     * Page.navigate auf dieselbe Adresse mit demselben Hash loest kein
     * loadEventFired aus; das Warten darauf lief ins Leere und blieb stehen.
     * Die App ist ohnehin eine Seite mit Hash-Router -- den Hash zu setzen
     * ist der Weg, den auch ein Fingertipp nimmt. */
    async hin(weg, ruhe = 1400) {
      await this.werten(`(async () => {
        const ziel = '#/' + ${JSON.stringify(weg)};
        if (location.hash === ziel) window.dispatchEvent(new HashChangeEvent('hashchange'));
        else location.hash = ziel;
        await new Promise((g) => setTimeout(g, ${ruhe}));
        window.scrollTo(0, 0);
      })()`);
    },

    async werten(ausdruck) {
      const antwort = await ruf('Runtime.evaluate',
        { expression: ausdruck, awaitPromise: true, returnByValue: true }, sessionId);
      if (antwort.exceptionDetails) {
        const d = antwort.exceptionDetails;
        throw new Error(d.exception?.description || d.text || 'Fehler in der Seite');
      }
      return antwort.result.value;
    },

    async bild() {
      const { data } = await ruf('Page.captureScreenshot', { format: 'png' }, sessionId);
      return Buffer.from(data, 'base64');
    },

    schliessen() {
      ws.close();
      chrome.kill();
      try { rmSync(profil, { recursive: true, force: true }); } catch { /* egal */ }
    },
  };

  return seite;
}

/* Sucht, was ueber den rechten Rand steht.
 *
 * Elemente in einem Behaelter mit eigener Querrolle zaehlen nicht: Eine
 * breite Tabelle in einem rollenden Kasten ist Absicht. "clip" gehoert in
 * die Liste -- es schneidet ab, ohne einen Rollbereich aufzumachen, und wer
 * es nicht kennt, meldet abgeschnittene Kaesten als Fehler.
 */
export const UEBERLAUF = `(() => {
  const vw = document.documentElement.clientWidth, raus = [];
  for (const el of document.querySelectorAll('main *, .leiste *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.right <= vw + 1) continue;
    let p = el.parentElement, drin = false;
    while (p && p !== document.body) {
      const o = getComputedStyle(p).overflowX;
      if (['auto', 'scroll', 'hidden', 'clip'].includes(o)) { drin = true; break; }
      p = p.parentElement;
    }
    if (drin) continue;
    raus.push(el.tagName.toLowerCase()
      + (typeof el.className === 'string' && el.className
        ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '')
      + ' bis ' + Math.round(r.right));
  }
  return {
    vw,
    quer: document.documentElement.scrollWidth > vw + 1,
    scroll: document.documentElement.scrollWidth,
    ueber: [...new Set(raus)].slice(0, 5),
  };
})()`;
