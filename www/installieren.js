// Die App auf den Startbildschirm holen.
//
// Solange die App nicht im Play Store steht, ist der Startbildschirm der Weg
// zum Kunden: ein Symbol neben den anderen Apps, Vollbild, ohne Adresszeile.
// Die Technik dafuer ist da (Manifest, Arbeiter, Symbole). Was fehlte, war
// jemand, der es dem Nutzer sagt.
//
// Drei Lagen, drei Antworten:
//
//   Chrome und Edge (Android, Rechner)  Der Browser bietet die Installation
//       selbst an, aber nur einmal und unauffaellig. Wir fangen das Angebot
//       ab und legen es auf einen Knopf.
//   iPhone und iPad  Es gibt kein Angebot, nur den Weg ueber Teilen. Und es
//       gibt eine Falle: Die installierte App hat eigene Daten, getrennt von
//       Safari. Wer erst ein Projekt anlegt und dann installiert, findet es
//       in der App nicht wieder. Deshalb steht der Hinweis vor dem ersten
//       Projekt am deutlichsten da.
//   Schon installiert oder Android-App  Nichts zeigen.
//
// Dieses Modul muss frueh geladen werden: Das Angebot des Browsers kommt
// einmal beim Start, und wer dann noch nicht zuhoert, verpasst es.

import { el } from './hilfen.js';

let angebot = null;

window.addEventListener('beforeinstallprompt', (ereignis) => {
  ereignis.preventDefault();
  angebot = ereignis;
});
window.addEventListener('appinstalled', () => {
  angebot = null;
  merken('installiert');
});

const SCHLUESSEL = 'bauzeuge.installhinweis';
const PAUSE_TAGE = 30;

function merken(wert) {
  try { localStorage.setItem(SCHLUESSEL, wert + '|' + Date.now()); } catch { /* privat */ }
}

function weggeklickt() {
  try {
    const [wert, zeit] = String(localStorage.getItem(SCHLUESSEL) || '').split('|');
    if (wert === 'installiert') return true;
    return wert === 'spaeter' && Date.now() - Number(zeit) < PAUSE_TAGE * 86400000;
  } catch {
    return false;
  }
}

/**
 * In welcher Lage steckt der Nutzer?
 *
 * @returns {'nativ'|'installiert'|'angebot'|'ios'|'ios-anderer'|'android'|'rechner'}
 */
export function installLage(umgebung = globalThis) {
  const w = umgebung.window || umgebung;
  const nav = w.navigator || {};
  const ua = String(nav.userAgent || '');

  if (w.Capacitor && w.Capacitor.isNativePlatform && w.Capacitor.isNativePlatform()) return 'nativ';
  const eigenstaendig = (w.matchMedia && w.matchMedia('(display-mode: standalone)').matches) ||
    nav.standalone === true;
  if (eigenstaendig) return 'installiert';
  if (angebot) return 'angebot';

  // iPadOS meldet sich als Mac. Ein Mac mit Touchscreen ist ein iPad.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (nav.maxTouchPoints || 0) > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? 'ios-anderer' : 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'rechner';
}

const schritt = (nr, text) => el('li', {}, [el('span', { klasse: 'install-nr', text: String(nr) }), el('span', { text })]);

/**
 * Die Karte fuer die Uebersicht, oder null.
 *
 * @param {{vorDemStart?: boolean, nachher?: Function}} optionen
 *   vorDemStart: Es gibt noch kein Projekt. Auf dem iPhone ist das der
 *   einzige Zeitpunkt, an dem Installieren nichts kostet.
 */
export function installKarte({ vorDemStart = false, nachher } = {}) {
  const lage = installLage();
  if (lage === 'nativ' || lage === 'installiert' || lage === 'rechner') return null;
  if (!vorDemStart && weggeklickt()) return null;

  const karte = el('section', { klasse: 'karte install-karte', 'aria-label': 'App installieren' });
  const spaeter = el('button', {
    klasse: 'knopf knopf-leise', type: 'button', text: 'Später',
    onclick: () => { merken('spaeter'); karte.remove(); },
  });

  const kopf = [
    el('p', { klasse: 'willkommen-marke', text: 'Als App installieren' }),
    el('h2', { text: 'BauZeuge auf den Startbildschirm' }),
  ];

  if (lage === 'angebot') {
    karte.append(...[
      ...kopf,
      el('p', {
        klasse: 'unterzeile',
        text: 'Ein Symbol neben deinen anderen Apps, Vollbild und auch ohne Empfang ' +
          'auf der Baustelle. Ohne App Store, in wenigen Sekunden.',
      }),
      el('div', { klasse: 'knopf-reihe' }, [
        el('button', {
          klasse: 'knopf knopf-haupt', type: 'button', text: 'Jetzt installieren',
          onclick: async () => {
            const offen = angebot;
            if (!offen) return;
            angebot = null;
            offen.prompt();
            const { outcome } = await offen.userChoice;
            if (outcome === 'accepted') {
              merken('installiert');
              karte.remove();
            }
            if (nachher) nachher();
          },
        }),
        vorDemStart ? null : spaeter,
      ]),
    ].filter(Boolean));
    return karte;
  }

  if (lage === 'ios' || lage === 'ios-anderer') {
    karte.append(...[
      ...kopf,
      el('ol', { klasse: 'install-schritte' }, [
        schritt(1, lage === 'ios'
          ? 'Tippe unten auf das Teilen-Symbol (Quadrat mit Pfeil nach oben).'
          : 'Tippe auf Teilen. Fehlt dort „Zum Home-Bildschirm“, öffne www.bauzeuge.de/app/ in Safari.'),
        schritt(2, 'Wähle „Zum Home-Bildschirm“. Eventuell erst nach unten scrollen.'),
        schritt(3, 'Tippe auf „Hinzufügen“ und öffne BauZeuge ab jetzt über das neue Symbol.'),
      ]),
      el('p', {
        klasse: 'unterzeile leise',
        text: vorDemStart
          ? 'Am besten jetzt, vor dem ersten Projekt: Die installierte App hat eigene Daten, ' +
            'getrennt von Safari. Was du hier im Browser anlegst, siehst du dort nicht.'
          : 'Die installierte App hat eigene Daten, getrennt von Safari. Deine Einträge von hier ' +
            'nimmst du mit: Einstellungen, Sicherung erstellen, und in der App Sicherung einlesen.',
      }),
      vorDemStart ? null : el('div', { klasse: 'knopf-reihe' }, [spaeter]),
    ].filter(Boolean));
    return karte;
  }

  // Android ohne Angebot: anderer Browser, oder Chrome hat es noch nicht
  // geschickt. Der Weg ueber das Menue geht fast ueberall.
  karte.append(...[
    ...kopf,
    el('ol', { klasse: 'install-schritte' }, [
      schritt(1, 'Tippe oben rechts auf das Menü mit den drei Punkten.'),
      schritt(2, 'Wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“.'),
      schritt(3, 'Bestätige und öffne BauZeuge ab jetzt über das neue Symbol.'),
    ]),
    vorDemStart ? null : el('div', { klasse: 'knopf-reihe' }, [spaeter]),
  ].filter(Boolean));
  return karte;
}
