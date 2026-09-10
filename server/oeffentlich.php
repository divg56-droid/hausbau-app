<?php
declare(strict_types=1);
require __DIR__ . '/_start.php';

/**
 * Das oeffentliche Bautagebuch. Ohne Anmeldung lesbar, nur ueber die Marke
 * erreichbar.
 *
 *   GET oeffentlich.php?k=<marke>              die Seite
 *   GET oeffentlich.php?k=<marke>&bild=<uuid>  ein Foto daraus
 *
 * Was hier hinausgeht und was nicht, ist die wichtigste Entscheidung dieser
 * Datei. Gezeigt werden Datum, Wetter, was gemacht wurde, und die Fotos.
 *
 * Ausdruecklich nicht gezeigt werden:
 *
 *   Helfernamen und Stunden   Das sind personenbezogene Daten Dritter. Wer
 *                             samstags mitgeholfen hat, hat nicht
 *                             eingewilligt, im Netz zu stehen.
 *   "Liegengeblieben"         Das Feld haelt Verzoegerungen und Streitpunkte
 *                             fest und ist Beweismaterial, kein Aushang.
 *
 * Diese Auswahl steht fest und ist nicht einstellbar. Eine Schaltflaeche
 * "Helfernamen mitzeigen" waere eine Einladung, fremde Daten zu
 * veroeffentlichen, ohne darueber nachzudenken.
 */

// Die Seite gehoert nicht in Suchmaschinen. Wer den Verweis hat, soll sie
// lesen koennen; wer ihn nicht hat, soll sie nicht finden.
header('X-Robots-Tag: noindex, nofollow', true);

$marke = (string)($_GET['k'] ?? '');
if (!preg_match('/^[0-9a-f]{32,64}$/', $marke)) {
    absage('Dieser Verweis stimmt nicht.');
}

$s = db()->prepare(
    'SELECT f.nutzer_id, f.titel
       FROM freigaben f
      WHERE f.marke = ? AND f.art = ?'
);
$s->execute([hash('sha256', $marke), 'tagebuch']);
$freigabe = $s->fetch();

if (!$freigabe) {
    absage('Dieses Bautagebuch ist nicht mehr öffentlich.');
}

$nutzerId = (int)$freigabe['nutzer_id'];

// Aufruf mitzaehlen. Erst hier, nach der Pruefung der Marke: Ein falscher
// Verweis soll nichts hochzaehlen.
//
// Gezaehlt wird jeder Seitenaufruf, auch der eigene und auch ein Neuladen.
// Genauer zu zaehlen hiesse, den Leser wiederzuerkennen, und dafuer
// braeuchte es ein Merkmal in seinem Browser. Fuer eine Zahl, die niemand
// abrechnet, ist das den Preis nicht wert.
//
// Der Bildabruf laeuft ueber dieselbe Datei und muss draussen bleiben, sonst
// zaehlte jedes Foto einer Seite als eigener Aufruf.
if (!isset($_GET['bild'])) {
    try {
        db()->prepare(
            'UPDATE freigaben SET aufrufe = aufrufe + 1, zuletzt = NOW() WHERE marke = ?'
        )->execute([hash('sha256', $marke)]);
    } catch (PDOException $e) {
        // Solange einrichten.php die Spalten noch nicht angelegt hat, wird
        // eben nicht gezaehlt. Eine leere Seite waere der schlechtere Preis.
    }
}

// ------------------------------------------------------------------- Eintraege

/** Liest die lebenden Tagebucheintraege des Nutzers, aeltester zuerst. */
function eintraegeLesen(int $nutzerId): array
{
    $s = db()->prepare(
        'SELECT inhalt FROM saetze
          WHERE nutzer_id = ? AND speicher = ? AND geloescht = 0'
    );
    $s->execute([$nutzerId, 'tagebuch']);

    $liste = [];
    foreach ($s->fetchAll() as $zeile) {
        $satz = json_decode((string)$zeile['inhalt'], true);
        if (is_array($satz) && !empty($satz['datum'])) {
            $liste[] = $satz;
        }
    }
    usort($liste, static fn ($a, $b) => strcmp((string)$a['datum'], (string)$b['datum']));
    return $liste;
}

$eintraege = eintraegeLesen($nutzerId);

// ---------------------------------------------------------------------- Bilder

if (isset($_GET['bild'])) {
    $kennung = (string)$_GET['bild'];
    if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', $kennung)) {
        http_response_code(400);
        exit;
    }

    // Nur Bilder ausliefern, die wirklich an einem Tagebucheintrag haengen.
    // Ohne diese Pruefung waere die Marke ein Generalschluessel auf saemtliche
    // Fotos des Nutzers, also auch auf die Maengelfotos.
    $erlaubt = false;
    foreach ($eintraege as $e) {
        if (in_array($kennung, (array)($e['bildIds'] ?? []), true)) {
            $erlaubt = true;
            break;
        }
    }
    if (!$erlaubt) {
        http_response_code(404);
        exit;
    }

    $b = db()->prepare('SELECT typ, geloescht FROM bilder WHERE nutzer_id = ? AND kennung = ?');
    $b->execute([$nutzerId, $kennung]);
    $zeile = $b->fetch();
    $pfad = __DIR__ . '/daten/bilder/' . $nutzerId . '-' . $kennung;

    if (!$zeile || (int)$zeile['geloescht'] === 1 || !is_file($pfad)) {
        http_response_code(404);
        exit;
    }
    // Nur Bilder weiterreichen. Ein hochgeladenes PDF koennte im Browser
    // Skripte ausfuehren und hat auf einer oeffentlichen Seite nichts zu suchen.
    if (!str_starts_with((string)$zeile['typ'], 'image/')) {
        http_response_code(404);
        exit;
    }

    header('Content-Type: ' . $zeile['typ']);
    header('Content-Length: ' . (string)filesize($pfad));
    header('Cache-Control: public, max-age=86400');
    header('X-Content-Type-Options: nosniff');
    readfile($pfad);
    exit;
}

// ----------------------------------------------------------------------- Seite

const WETTER = [
    'sonnig' => 'Sonnig', 'bewoelkt' => 'Bewölkt', 'regen' => 'Regen',
    'sturm' => 'Sturm', 'schnee' => 'Schnee', 'frost' => 'Frost',
];

function h(?string $text): string
{
    return htmlspecialchars((string)$text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function datumLang(string $iso): string
{
    $teile = explode('-', substr($iso, 0, 10));
    return count($teile) === 3 ? "$teile[2].$teile[1].$teile[0]" : $iso;
}

/** Fehlerseite in derselben Aufmachung, damit sie nicht nach Panne aussieht. */
function absage(string $text): never
{
    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="de"><head><meta charset="utf-8">'
       . '<meta name="viewport" content="width=device-width, initial-scale=1">'
       . '<meta name="robots" content="noindex, nofollow">'
       . '<title>Nicht verfügbar</title>' . stil()
       . '</head><body><main><h1>Nicht verfügbar</h1><p>'
       . htmlspecialchars($text, ENT_QUOTES, 'UTF-8')
       . '</p></main></body></html>';
    exit;
}

function stil(): string
{
    // Eingebettet statt als Datei: Die Seite soll ohne einen zweiten
    // Abruf vollstaendig sein, auch bei schlechtem Empfang.
    return '<style>
:root{--papier:#f7f5f1;--karte:#fff;--tinte:#23272b;--leise:#5f6772;--linie:#ddd8cf;--akzent:#e8a020}
*{box-sizing:border-box}
body{margin:0;background:var(--papier);color:var(--tinte);
 font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
main{max-width:680px;margin:0 auto;padding:24px 16px 56px}
h1{font-size:26px;line-height:1.2;margin:0 0 6px}
h2{font-size:18px;margin:0 0 6px}
.unter{color:var(--leise);margin:0 0 24px}
article{background:var(--karte);border:1px solid var(--linie);border-radius:12px;
 padding:16px;margin-bottom:14px}
article p{margin:0 0 10px;white-space:pre-wrap}
.wetter{color:var(--leise);font-size:14px;margin:0 0 10px}
.fotos{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}
.fotos img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;
 border:1px solid var(--linie);background:var(--papier)}
footer{color:var(--leise);font-size:13px;margin-top:32px;border-top:1px solid var(--linie);
 padding-top:14px}
footer a{color:#0a5155}
.leer{color:var(--leise)}
</style>';
}

$titel = (string)$freigabe['titel'];
$sichtbar = array_values(array_filter(
    $eintraege,
    // Ein Tag ohne Text und ohne Foto hat oeffentlich keinen Wert. Er kann
    // trotzdem Helferstunden enthalten, und die bleiben drin.
    static fn ($e) => trim((string)($e['gemacht'] ?? '')) !== '' || !empty($e['bildIds'])
));

$zeitraum = '';
if ($sichtbar) {
    $von = datumLang((string)$sichtbar[0]['datum']);
    $bis = datumLang((string)$sichtbar[count($sichtbar) - 1]['datum']);
    $zeitraum = $von === $bis ? $von : "$von bis $bis";
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: public, max-age=300');
header('X-Content-Type-Options: nosniff');
// Die Seite laedt nichts von fremden Rechnern und braucht kein Skript.
header("Content-Security-Policy: default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'");

$markeUrl = rawurlencode($marke);

echo '<!doctype html><html lang="de"><head><meta charset="utf-8">';
echo '<meta name="viewport" content="width=device-width, initial-scale=1">';
echo '<meta name="robots" content="noindex, nofollow">';
echo '<meta name="referrer" content="no-referrer">';
echo '<title>' . h($titel) . '</title>' . stil() . '</head><body><main>';
echo '<h1>' . h($titel) . '</h1>';
echo '<p class="unter">' . count($sichtbar) . ' '
   . (count($sichtbar) === 1 ? 'Tag' : 'Tage') . ' dokumentiert'
   . ($zeitraum ? ', ' . h($zeitraum) : '') . '.</p>';

if (!$sichtbar) {
    echo '<p class="leer">Hier steht noch nichts.</p>';
}

foreach ($sichtbar as $e) {
    echo '<article>';
    echo '<h2>' . h(datumLang((string)$e['datum'])) . '</h2>';

    $wetter = [];
    if (!empty($e['wetter']) && isset(WETTER[$e['wetter']])) {
        $wetter[] = WETTER[$e['wetter']];
    }
    if (!empty($e['temperatur'])) {
        $wetter[] = (string)$e['temperatur'] . ' °C';
    }
    if ($wetter) {
        echo '<p class="wetter">' . h(implode(', ', $wetter)) . '</p>';
    }

    if (trim((string)($e['gemacht'] ?? '')) !== '') {
        echo '<p>' . h((string)$e['gemacht']) . '</p>';
    }

    $bilder = (array)($e['bildIds'] ?? []);
    if ($bilder) {
        echo '<div class="fotos">';
        foreach ($bilder as $bildId) {
            if (!is_string($bildId)) {
                continue;
            }
            echo '<img loading="lazy" alt="Foto vom '
               . h(datumLang((string)$e['datum'])) . '" src="?k=' . $markeUrl
               . '&amp;bild=' . rawurlencode($bildId) . '">';
        }
        echo '</div>';
    }
    echo '</article>';
}

echo '<footer>Geführt mit <a href="https://www.bauzeuge.de">BauZeuge</a>. '
   . 'Namen und Arbeitszeiten der Helfer werden hier nicht veröffentlicht.</footer>';
echo '</main></body></html>';
