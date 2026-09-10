// Service Worker der Webfassung.
//
// Zweck ist die Baustelle. Die App haelt ihre Daten ohnehin auf dem Geraet,
// aber ohne diesen Arbeiter kann der Browser nicht einmal seine eigenen
// Programmdateien laden, wenn kein Empfang da ist. Damit laufen beide.
//
// Strategie: erst das Netz, dann die Ablage.
//
// Das ist bewusst nicht andersherum. Eine Ablage zuerst waere schneller, aber
// dann bekaeme nach jeder Veroeffentlichung jemand alte Module neben neuen zu
// sehen, und in einer App aus zwanzig einzeln geladenen Dateien fuehrt das zu
// Fehlern, die niemand nachvollziehen kann. Genau diese Mischung hat beim
// Entwickeln schon einmal eine Stunde gekostet. Mit Netz zuerst ist online
// immer alles frisch, und die Ablage ist das, was zuletzt funktioniert hat.
//
// Was hier niemals hineingehoert:
//
//   /app/api/   Die Schnittstelle. Eine zwischengespeicherte Antwort auf
//               "wer bin ich" oder einen Abgleich waere schlimmer als gar
//               keine. Diese Anfragen laufen unberuehrt durch.
//   alles ausser GET   Anmeldung, Abgleich und Bilder-Upload sind POST.
//   fremde Herkuenfte  Bright Sky und Nominatim gehen uns nichts an.

const ABLAGE = 'bauzeuge-schale';

// Der Programmbestand. Wird beim Einbau vollstaendig geholt, damit auch ein
// Bereich offline aufgeht, den man vorher nie geoeffnet hat.
//
// Diese Liste muss vollstaendig bleiben. test.mjs vergleicht sie mit dem
// Inhalt von www/ und schlaegt fehl, wenn eine Datei fehlt oder zu viel ist.
const SCHALE = [
  './',
  './index.html',
  './manifest.json',
  './stil.css',
  './symbol.svg',
  './symbol-192.png',
  './symbol-512.png',
  './symbol-maskable-512.png',
  './abgleich.js',
  './app.js',
  './bereiche.js',
  './blatt.js',
  './csv.js',
  './daten.js',
  './din276.js',
  './gewerke.js',
  './checklisten-daten.js',
  './leitfaden-daten.js',
  './fotos.js',
  './hilfen.js',
  './konto.js',
  './pdf.js',
  './thema.js',
  './wetter.js',
  './module/ablauf.js',
  './module/angebote.js',
  './module/anschlussplan.js',
  './module/baukasse.js',
  './module/baukosten.js',
  './module/einstellungen.js',
  './module/finanzierung.js',
  './module/kontakte.js',
  './module/leitfaden.js',
  './module/konto.js',
  './module/maengel.js',
  './module/raeume.js',
  './module/tagebuch.js',
  './module/baudoku.js',
  './module/dokumente.js',
  './module/todos.js',
  './module/tilgung.js',
  './module/uebersicht.js',
];

self.addEventListener('install', (ereignis) => {
  ereignis.waitUntil(
    caches.open(ABLAGE).then((ablage) =>
      // Einzeln statt addAll: Faellt eine Datei aus, soll nicht der ganze
      // Einbau scheitern und die App ohne jede Offlinefaehigkeit dastehen.
      Promise.all(
        SCHALE.map((weg) =>
          ablage.add(new Request(weg, { cache: 'reload' })).catch(() => {})
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (ereignis) => {
  ereignis.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(
        namen.filter((n) => n !== ABLAGE).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

/** Anfragen, die der Arbeiter nicht anfassen darf. */
function durchreichen(anfrage, ziel) {
  if (anfrage.method !== 'GET') return true;
  if (ziel.origin !== self.location.origin) return true;
  // Die Schnittstelle niemals zwischenspeichern.
  if (ziel.pathname.includes('/api/')) return true;
  return false;
}

self.addEventListener('fetch', (ereignis) => {
  const anfrage = ereignis.request;
  const ziel = new URL(anfrage.url);

  if (durchreichen(anfrage, ziel)) return;

  ereignis.respondWith(
    fetch(anfrage)
      .then((antwort) => {
        // Nur vollstaendige eigene Antworten ablegen. Ein Teilstueck oder
        // eine Fehlerseite in der Ablage waere schlimmer als nichts.
        if (antwort && antwort.ok && antwort.type === 'basic') {
          const kopie = antwort.clone();
          caches.open(ABLAGE).then((ablage) => ablage.put(anfrage, kopie)).catch(() => {});
        }
        return antwort;
      })
      .catch(async () => {
        const gefunden = await caches.match(anfrage);
        if (gefunden) return gefunden;
        // Beim Aufruf einer Seite auf die Startseite zurueckfallen. Die App
        // arbeitet mit Rauten im Verweis, es gibt also nur diese eine.
        if (anfrage.mode === 'navigate') {
          const start = await caches.match('./index.html') || await caches.match('./');
          if (start) return start;
        }
        return new Response('Offline und nicht in der Ablage.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      })
  );
});
