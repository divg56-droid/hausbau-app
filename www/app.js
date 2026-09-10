// Gehaeuse der App: Kopfzeile, Navigation, Startseite.
//
// Die Module liegen einzeln in module/ und werden erst geladen, wenn man sie
// oeffnet. Ein Modul liefert eine Funktion zeige(rahmen), die ihren Inhalt in
// den uebergebenen Knoten haengt.

import { el, leeren } from './hilfen.js';
import { BEREICHE, MODULE } from './bereiche.js';
import { bildUrlsFreigeben, datenZustand, DB_WARTET } from './daten.js';

export { BEREICHE, MODULE };


const kopftitel = document.getElementById('kopftitel');
const zurueckKnopf = document.getElementById('zurueck');
const kopfaktion = document.getElementById('kopfaktion');
const inhalt = document.getElementById('inhalt');

const APPNAME = 'BauZeuge';

/**
 * Die Wortmarke, wie sie auch im Kopf der Website steht: das Hauszeichen,
 * dann "Bau" in Tinte und "Zeuge" im Akzent. Das grosse Z traegt die
 * Trennung, deshalb steht sie farbig und nicht als ein Wort.
 *
 * Sie steht in jedem Bereich, nicht nur auf der Startseite, und fuehrt beim
 * Antippen zur Projektuebersicht -- so, wie das Logo auf jeder Internetseite
 * zur Startseite fuehrt. Welcher Bereich offen ist, sagt ohnehin schon die
 * Ueberschrift darunter und die Markierung in der Leiste; im Kopf waere es
 * ein zweites Mal dasselbe.
 */
function wortmarke() {
  const zeichen = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  zeichen.setAttribute('viewBox', '0 0 64 64');
  zeichen.setAttribute('aria-hidden', 'true');
  zeichen.innerHTML =
    '<rect width="64" height="64" rx="12" fill="#1f2a30"></rect>' +
    '<path d="M11 31 32 13 53 31Z" fill="#5fbabd"></path>' +
    '<rect x="16" y="31" width="32" height="20" fill="none" stroke="#f5f7f6" stroke-width="4"></rect>' +
    '<rect x="28" y="40" width="8" height="11" fill="#f5f7f6"></rect>';

  return el('span', { klasse: 'wortmarke' }, [
    zeichen,
    el('span', { klasse: 'wm-text' }, [
      'Bau',
      el('span', { klasse: 'wm-akzent', text: 'Zeuge' }),
      el('span', { klasse: 'wm-de', text: '.de' }),
    ]),
  ]);
}

// Die Kopfzeile gehoert dem Gehaeuse. Module melden hier an, was rechts oben
// stehen soll, statt sich eine eigene Leiste zu bauen.
export function setzeKopf({ aktion } = {}) {
  if (!kopftitel.querySelector('.wortmarke')) {
    kopftitel.replaceChildren(wortmarke());
  }
  kopfaktion.hidden = !aktion;
  if (aktion) {
    kopfaktion.textContent = aktion.text;
    kopfaktion.onclick = aktion.tun;
  } else {
    kopfaktion.onclick = null;
  }
}

const seitenleiste = document.getElementById('seitenleiste');
const leistenSchatten = document.getElementById('leistenschatten');
const menueKnopf = document.getElementById('menueknopf');

/**
 * Zeichnet die Seitenleiste einmal und haelt danach nur noch die Markierung
 * nach. Sie neu aufzubauen waere einfacher, aber dann klappt bei jedem
 * Bereichswechsel jede Gruppe wieder zu.
 */
function leisteBauen() {
  seitenleiste.replaceChildren(
    projektwahl(),
    ...BEREICHE.map((gruppe) => {
      // "ausLeiste" heisst: erreichbar, aber nicht in der Liste. Ein Bereich,
      // den man einmal im Leben braucht, muss nicht jeden Tag danebenstehen.
      const punkte = gruppe.punkte.filter((p) => !p.ausLeiste);
      if (!punkte.length) return null;

      // Gruppen mit nur einem Punkt brauchen keine Ueberschrift, die man
      // aufklappen muss. Der Punkt steht dann fuer sich.
      if (punkte.length === 1) {
        return el('a', {
          klasse: 'leiste-punkt leiste-allein',
          href: '#/' + punkte[0].weg,
          'data-weg': punkte[0].weg,
        }, [
          el('span', { klasse: 'leiste-zeichen', text: gruppe.zeichen }),
          punkte[0].titel,
        ]);
      }
      return el('details', { klasse: 'leiste-gruppe', open: true }, [
        el('summary', {}, [
          el('span', { klasse: 'leiste-zeichen', text: gruppe.zeichen }),
          gruppe.titel,
        ]),
        ...punkte.map((punkt) =>
          el('a', {
            klasse: 'leiste-punkt', href: '#/' + punkt.weg, 'data-weg': punkt.weg,
          }, [punkt.titel])
        ),
      ]);
    }).filter(Boolean)
  );
}

function leisteMarkieren(weg) {
  for (const a of seitenleiste.querySelectorAll('.leiste-punkt')) {
    const aktiv = a.dataset.weg === weg;
    a.classList.toggle('aktiv', aktiv);
    if (aktiv) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

/**
 * Die Projektwahl ganz oben.
 *
 * Sie steht leer da und fuellt sich, sobald die Liste gelesen ist: Die
 * Seitenleiste wird beim Start gebaut, und darauf zu warten hiesse, die
 * ganze Leiste zu verzoegern. Bei genau einem Projekt bleibt sie unsichtbar
 * -- eine Wahl zwischen einer Sache ist keine.
 */
function projektwahl() {
  const feld = el('select', {
    klasse: 'projektwahl', 'aria-label': 'Bauprojekt wählen',
  });
  const rahmen = el('div', { klasse: 'projektleiste', hidden: true }, [feld]);

  (async () => {
    const { projekteListe } = await import('./projekte.js');
    const { projektAktiv, projektWechseln } = await import('./daten.js');
    const [liste, aktiv] = await Promise.all([projekteListe(), projektAktiv()]);
    if (liste.length < 2) return;

    for (const p of liste) {
      feld.append(el('option', { value: p.id, selected: p.id === aktiv, text: p.name }));
    }
    feld.addEventListener('change', async () => {
      await projektWechseln(feld.value);
      // Ganz neu laden: Jeder Bildschirm haelt seine Daten im Speicher, und
      // die gehoeren jetzt zu einem anderen Projekt.
      location.hash = '';
      location.reload();
    });
    rahmen.hidden = false;
  })();

  return rahmen;
}

/**
 * Blendet aus, was bei dieser Bauweise nicht gebraucht wird.
 *
 * Nachtraeglich und nicht schon beim Bauen der Leiste: Die Leiste steht
 * sofort, die Einstellung kommt aus der Datenbank. Auf das Warten hin waere
 * die Leiste beim Start kurz leer.
 */
(async () => {
  const { bauweise } = await import('./bauweise.js');
  const { versteckt } = await bauweise();
  if (!versteckt.size) return;

  for (const a of seitenleiste.querySelectorAll('.leiste-punkt')) {
    if (versteckt.has(a.dataset.weg)) a.hidden = true;
  }
  // Eine Gruppe, von der nichts uebrig ist, verschwindet mit.
  for (const gruppe of seitenleiste.querySelectorAll('.leiste-gruppe')) {
    const uebrig = [...gruppe.querySelectorAll('.leiste-punkt')].some((a) => !a.hidden);
    gruppe.hidden = !uebrig;
  }
})();

/** Auf dem Telefon faehrt die Leiste als Schublade herein. */
function leisteSchalten(offen) {
  document.body.classList.toggle('leiste-offen', offen);
  menueKnopf.setAttribute('aria-expanded', String(offen));
}

menueKnopf.addEventListener('click', () =>
  leisteSchalten(!document.body.classList.contains('leiste-offen'))
);
leistenSchatten.addEventListener('click', () => leisteSchalten(false));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') leisteSchalten(false);
});
// Ein Klick in der Leiste schliesst sie; sonst verdeckt sie auf dem Telefon
// genau den Bereich, den man gerade geoeffnet hat.
seitenleiste.addEventListener('click', (e) => {
  if (e.target.closest('.leiste-punkt')) leisteSchalten(false);
});

leisteBauen();

zurueckKnopf.addEventListener('click', () => {
  // history.back() statt fester Route: so stimmt auch die Android-Zurücktaste,
  // die auf denselben Verlauf wirkt.
  if (history.length > 1) history.back();
  else location.hash = '';
});

async function zeichne() {
  // Bild-URLs des vorherigen Bildschirms freigeben, sonst waechst der
  // Speicherverbrauch mit jedem Wechsel.
  bildUrlsFreigeben();
  leeren(inhalt);
  window.scrollTo(0, 0);

  // Ein Weg darf zwei Teile haben: "baukasse/statistik" laedt baukasse.js
  // und gibt ihm "statistik" mit. So stehen die Ansichten eines Bereichs
  // einzeln in der Leiste, ohne dass jede eine eigene Datei braucht.
  const weg = location.hash.replace(/^#\/?/, '').replace(/\/$/, '');
  const [datei, unterweg] = weg.split('/');

  // Erst den ganzen Weg suchen, dann nur den ersten Teil. Das zweite ist der
  // Fall "#/raeume/<kennung>": Ein Bereich, der einen einzelnen Satz oeffnet,
  // haengt dessen Kennung hinten an. Ohne diesen Rueckfall landet jeder
  // solche Verweis auf der Uebersicht -- der Nutzer wird herausgeworfen,
  // statt in den Raum zu kommen.
  const modul = MODULE.find((m) => m.weg === weg) || MODULE.find((m) => m.weg === datei);
  if (!modul) {
    location.hash = '';
    return;
  }

  leisteMarkieren(modul.weg);
  // Im Kopf steht immer die Wortmarke. Der Zurueckpfeil entfaellt auf der
  // Uebersicht: Es gibt nichts, wohin er fuehren wuerde.
  zurueckKnopf.hidden = modul.weg === '';
  setzeKopf({});
  // Der Bereichsname gehoert trotzdem in den Fenstertitel: Er steht im
  // Reiter des Browsers und im Verlauf.
  document.title = modul.weg === '' ? APPNAME : modul.titel + ' · ' + APPNAME;

  // Bleibt der Bereich leer, sagt der Bildschirm es, statt weiss zu bleiben.
  // Ein Modul, das haengt, sieht sonst genauso aus wie eines, das nichts zu
  // zeigen hat -- und der Nutzer sieht nur die Leiste links.
  const wache = setTimeout(() => {
    if (inhalt.children.length === 0) notausgang('Das dauert ungewöhnlich lange.');
  }, 8000);

  try {
    const geladen = await import('./module/' + (datei || 'uebersicht') + '.js');
    await geladen.zeige(inhalt, unterweg);
    if (inhalt.children.length === 0) {
      notausgang('Dieser Bereich hat nichts angezeigt.');
    }
  } catch (fehler) {
    console.error(fehler);
    notausgang(String(fehler && fehler.message ? fehler.message : fehler));
  } finally {
    clearTimeout(wache);
  }
}

/**
 * Was zu sehen ist, wenn nichts zu sehen ist.
 *
 * Der Knopf raeumt die Offlineablage weg und laedt neu. Genau das behebt den
 * haeufigsten Fall: eine alte zwischengespeicherte Fassung, die zu den neuen
 * Dateien nicht mehr passt.
 */
function notausgang(grund) {
  if (inhalt.querySelector('.notausgang')) return;

  const zustand = datenZustand();
  // Der haeufigste Fall hat eine eigene Antwort, und es ist nicht die, die
  // man sonst gibt: Wegraeumen hilft hier nicht, Schliessen hilft.
  const wartetAufFenster = zustand.startsWith(DB_WARTET);

  inhalt.append(
    el('div', { klasse: 'leer notausgang' }, wartetAufFenster
      ? [
          el('h2', { text: 'BauZeuge ist noch woanders offen' }),
          el('p', {
            text: 'Die App wartet auf ein anderes Fenster, in dem sie mit einer ' +
              'älteren Fassung läuft. Solange das offen ist, kommt hier nichts an.',
          }),
          el('p', {
            klasse: 'unterzeile',
            text: 'Schließe alle anderen BauZeuge-Fenster und -Reiter, auch die ' +
              'installierte App, und lade dann hier neu. Deine Daten bleiben ' +
              'unberührt.',
          }),
          el('button', {
            klasse: 'knopf knopf-haupt', type: 'button', text: 'Neu laden',
            onclick: () => location.reload(),
          }),
        ]
      : [
          el('h2', { text: 'Hier ist gerade nichts' }),
          el('p', { text: grund }),
          // Woran es liegt, steht fast immer in der Datenbank. Der Satz ist
          // fuer den Nutzer da: Er kann ihn vorlesen, ohne die Konsole zu
          // oeffnen.
          el('p', { klasse: 'unterzeile', text: 'Datenbank: ' + zustand }),
          el('p', {
            klasse: 'unterzeile',
            text: 'Meist hilft es, die zwischengespeicherte Fassung wegzuräumen ' +
              'und neu zu laden. Deine Daten bleiben dabei unberührt.',
          }),
          el('button', {
            klasse: 'knopf knopf-haupt', type: 'button', text: 'Aufräumen und neu laden',
            onclick: async () => {
              try {
                if (window.caches) {
                  for (const name of await caches.keys()) await caches.delete(name);
                }
                if (navigator.serviceWorker) {
                  for (const r of await navigator.serviceWorker.getRegistrations()) {
                    await r.unregister();
                  }
                }
              } catch (fehler) {
                console.error(fehler);
              }
              location.reload();
            },
          }),
        ]
    )
  );
}

window.addEventListener('hashchange', zeichne);
zeichne();

// Beim Start einmal still abgleichen. Schlaegt es fehl, etwa ohne Empfang,
// merkt der Nutzer nichts: Das Geraet ist die Arbeitskopie, der Abgleich holt
// es beim naechsten Mal nach.
import('./abgleich.js')
  .then((m) => m.stillAbgleichen())
  .catch((fehler) => console.warn('Abgleich beim Start nicht möglich:', fehler));
