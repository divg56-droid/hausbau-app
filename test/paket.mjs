/* Prueft das gebaute Paket statt des Arbeitsstands.
 *
 *     node test/paket.mjs <pfad/zum.apk>
 *     npm run paket -- C:/.../bauzeuge-1.0.4.apk
 *
 * Packt die Weboberflaeche aus dem APK aus, liefert sie auf einem eigenen
 * Port aus und laesst alle Pruefungen dagegen laufen. Der Unterschied zu
 * "npm test" ist der ganze Zweck: Hier wird geprueft, was auf dem Telefon
 * landet, und nicht, was gerade im Arbeitsverzeichnis liegt. Zwischen beidem
 * liegt ein Bauvorgang, und der kann etwas anderes einpacken, als man denkt.
 *
 * Was hier nicht geprueft werden kann, ist die native Schicht: ob die Kamera
 * wirklich aufgeht, ob "tel:" das Telefon startet, ob die Systemtaste unten
 * ihr Ereignis liefert. Dafuer braucht es ein Geraet. Alles darueber -- die
 * gesamte Oberflaeche und Logik -- laeuft hier durch.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HIER = dirname(fileURLToPath(import.meta.url));
const APK = process.argv[2];
const PORT = 4402;

if (!APK || !existsSync(APK)) {
  console.error('Kein Paket angegeben.\n\n  node test/paket.mjs <pfad/zum.apk>\n');
  process.exit(2);
}

/* Ausgepackt wird mit Python: Ein APK ist ein ZIP, und Node bringt keinen
 * ZIP-Leser mit. Eine Abhaengigkeit dafuer aufzunehmen waere zu teuer -- der
 * Python steht auf diesem Rechner ohnehin, deploy.py laeuft damit. */
const ordner = mkdtempSync(join(tmpdir(), 'bauzeuge-paket-'));
const AUSPACKEN = `
import sys, zipfile, pathlib
z = zipfile.ZipFile(sys.argv[1])
ziel = pathlib.Path(sys.argv[2])
n = 0
for e in z.namelist():
    if e.startswith('assets/public/') and not e.endswith('/'):
        p = ziel / e[len('assets/public/'):]
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(z.read(e))
        n += 1
print(n)
`;
const anzahl = Number(
  execFileSync('python', ['-c', AUSPACKEN, APK, ordner], { encoding: 'utf8' }).trim()
);
if (!existsSync(join(ordner, 'index.html'))) {
  console.error('In diesem Paket liegt keine Weboberflaeche unter assets/public/.');
  process.exit(2);
}
console.log(`Paket:  ${APK}`);
console.log(`Inhalt: ${anzahl} Dateien ausgepackt\n`);

const TYPEN = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

const server = createServer((anfrage, antwort) => {
  const weg = decodeURIComponent(anfrage.url.split('?')[0]);
  // Kein Ausbruch aus dem Ordner: Der Weg kommt aus einer Anfrage, auch wenn
  // sie hier nur von der eigenen Pruefung stammt.
  const datei = join(ordner, weg === '/' ? 'index.html' : weg.replace(/^\/+/, ''));
  if (!datei.startsWith(ordner) || !existsSync(datei)) {
    antwort.writeHead(404).end('nicht da');
    return;
  }
  antwort.writeHead(200, {
    'Content-Type': TYPEN[extname(datei)] || 'application/octet-stream',
  });
  antwort.end(readFileSync(datei));
});

await new Promise((g) => server.listen(PORT, '127.0.0.1', g));
const basis = `http://127.0.0.1:${PORT}`;

const SUITEN = [
  ['Startschutz', 'startschutz.mjs'],
  ['Zurücktaste', 'zurueck.mjs'],
  ['Durchklicken', 'durchklicken.mjs'],
  ['Breiten', 'breite.mjs'],
];

let schief = 0;
for (const [titel, datei] of SUITEN) {
  console.log(`\n${'='.repeat(58)}\n${titel}\n${'='.repeat(58)}`);
  const lauf = spawn(process.execPath, [join(HIER, datei), basis], { stdio: 'inherit' });
  const code = await new Promise((g) => lauf.on('close', g));
  if (code !== 0) schief++;
}

server.close();
try { rmSync(ordner, { recursive: true, force: true }); } catch { /* egal */ }

console.log('\n' + '='.repeat(58));
console.log(schief
  ? `${schief} von ${SUITEN.length} Pruefungen am Paket fehlgeschlagen.`
  : `Alle ${SUITEN.length} Pruefungen am Paket bestanden.`);
console.log('Nicht geprueft: Kamera, Telefonwahl, Systemtaste -- dafuer braucht es ein Geraet.');
process.exit(schief ? 1 : 0);
