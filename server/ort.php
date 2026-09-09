<?php
declare(strict_types=1);
require __DIR__ . '/_start.php';

/**
 * Ortsname zu Koordinaten.
 *
 *   GET /ort.php?ort=Kaiserslautern
 *   -> { name: "Kaiserslautern, ...", lat: 49.44, lon: 7.77 }
 *
 * Warum ueber den eigenen Server und nicht direkt aus der App: Nominatim
 * verlangt eine Kennung des aufrufenden Programms und hoechstens eine Anfrage
 * je Sekunde. Ein Browser kann seine Kennung nicht setzen, und tausend
 * Geraete koennten die Regel nicht einhalten. Hier laeuft es gebuendelt, mit
 * Kennung und mit Zwischenspeicher: Jeder Ort wird genau einmal erfragt.
 *
 * Braucht keine Anmeldung. Ein Ortsname ist keine persoenliche Angabe, und
 * die App soll auch ohne Konto Wetter holen koennen.
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const KENNUNG = 'Bauzeuge/1.0 (+https://www.bauzeuge.de/app/)';

// Wie viele neue Orte darf eine Adresse in der Stunde nachschlagen? Aus dem
// Zwischenspeicher bedient werden beliebig viele.
const MAX_NEUE_JE_STUNDE = 20;

$suche = trim((string)($_GET['ort'] ?? ''));
if ($suche === '' || mb_strlen($suche) > 120) {
    fehler(400, 'Bitte einen Ort angeben.');
}

// Vereinheitlichen, damit "Kaiserslautern" und " kaiserslautern " denselben
// Eintrag treffen.
$schluessel = mb_strtolower(preg_replace('/\s+/', ' ', $suche));

$s = db()->prepare('SELECT name, lat, lon, gefunden FROM orte WHERE suche = ?');
$s->execute([$schluessel]);
$zeile = $s->fetch();

if ($zeile) {
    if ((int)$zeile['gefunden'] === 0) {
        fehler(404, 'Diesen Ort kennen wir nicht. Versuch es mit der nächstgrößeren Stadt.');
    }
    antwort([
        'name' => $zeile['name'],
        'lat' => (float)$zeile['lat'],
        'lon' => (float)$zeile['lon'],
        'aus' => 'zwischenspeicher',
    ]);
}

$bremskennung = 'ort:' . ($_SERVER['REMOTE_ADDR'] ?? '?');
$b = db()->prepare('SELECT versuche FROM bremse WHERE kennung = ? AND bis > NOW()');
$b->execute([$bremskennung]);
$bisher = $b->fetch();
if ($bisher && (int)$bisher['versuche'] >= MAX_NEUE_JE_STUNDE) {
    fehler(429, 'Zu viele Ortsabfragen. Bitte später erneut.');
}
db()->prepare(
    'INSERT INTO bremse (kennung, versuche, bis)
          VALUES (?, 1, DATE_ADD(NOW(), INTERVAL 60 MINUTE))
     ON DUPLICATE KEY UPDATE
          versuche = IF(bis > NOW(), versuche + 1, 1),
          bis = IF(bis > NOW(), bis, DATE_ADD(NOW(), INTERVAL 60 MINUTE))'
)->execute([$bremskennung]);

$adresse = NOMINATIM . '?' . http_build_query([
    'q' => $suche,
    'format' => 'jsonv2',
    'limit' => 1,
    'countrycodes' => 'de',
    'addressdetails' => 0,
]);

/**
 * Holt eine Adresse ueber cURL, sonst ueber den Stream-Wrapper.
 *
 * Zwei Wege, weil nicht jede PHP-Installation beides mitbringt: Ohne die
 * Erweiterung openssl kennt file_get_contents kein https und meldet nur
 * "No such file or directory" - eine Meldung, die einen lange suchen laesst.
 */
function holen(string $adresse): ?string
{
    if (function_exists('curl_init')) {
        $c = curl_init($adresse);
        curl_setopt_array($c, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_USERAGENT => KENNUNG,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
            CURLOPT_TIMEOUT => 12,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 3,
        ]);
        $rumpf = curl_exec($c);
        $code = (int)curl_getinfo($c, CURLINFO_RESPONSE_CODE);
        curl_close($c);
        return ($rumpf !== false && $code === 200) ? (string)$rumpf : null;
    }

    if (!in_array('https', stream_get_wrappers(), true)) {
        error_log('Hausbau-Ort: weder cURL noch https-Wrapper vorhanden.');
        return null;
    }

    $rumpf = @file_get_contents($adresse, false, stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => 'User-Agent: ' . KENNUNG . "\r\nAccept: application/json\r\n",
            'timeout' => 12,
        ],
    ]));
    return $rumpf === false ? null : $rumpf;
}

$rumpf = holen($adresse);

$treffer = $rumpf === null ? null : json_decode($rumpf, true);
$erster = is_array($treffer) && isset($treffer[0]) ? $treffer[0] : null;

if (!$erster || !isset($erster['lat'], $erster['lon'])) {
    // Auch Fehlschlaege merken, sonst fragen wir bei jedem Tippfehler erneut an.
    db()->prepare(
        'INSERT INTO orte (suche, name, lat, lon, gefunden, angelegt)
              VALUES (?, "", 0, 0, 0, NOW())
         ON DUPLICATE KEY UPDATE angelegt = NOW()'
    )->execute([$schluessel]);
    fehler(404, 'Diesen Ort kennen wir nicht. Versuch es mit der nächstgrößeren Stadt.');
}

$name = (string)($erster['display_name'] ?? $suche);
$lat = round((float)$erster['lat'], 6);
$lon = round((float)$erster['lon'], 6);

db()->prepare(
    'INSERT INTO orte (suche, name, lat, lon, gefunden, angelegt)
          VALUES (?, ?, ?, ?, 1, NOW())
     ON DUPLICATE KEY UPDATE name = VALUES(name), lat = VALUES(lat),
          lon = VALUES(lon), gefunden = 1, angelegt = NOW()'
)->execute([$schluessel, $name, $lat, $lon]);

antwort(['name' => $name, 'lat' => $lat, 'lon' => $lon, 'aus' => 'nominatim']);
