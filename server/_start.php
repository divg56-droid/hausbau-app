<?php
declare(strict_types=1);

/**
 * Gemeinsame Grundlage aller Schnittstellen.
 *
 * Jede Datei hier oben bindet diese ein und arbeitet danach nur noch mit
 * antwort(), fehler() und nutzer().
 *
 * Die Anmeldung laeuft ueber eine Marke im Kopf der Anfrage, nicht ueber ein
 * Sitzungsplaetzchen. Grund: Die Android-App laeuft unter der Herkunft
 * https://localhost und spricht mit BauZeuge.de. Ein Plaetzchen waere dort
 * fremd und wird von den Browsern zunehmend verworfen. Eine Marke im Kopf
 * funktioniert in beiden Faellen gleich.
 */

const MARKE_KOPF = 'HTTP_X_HAUSBAU_MARKE';

// Eine Sitzung laeuft ab, wenn sie so lange nicht benutzt wurde. Auf einer
// Baustelle will niemand sich staendig neu anmelden, deshalb grosszuegig.
const SITZUNG_TAGE = 180;

// Bremse gegen das Durchprobieren von Passwoertern.
const MAX_FEHLVERSUCHE = 8;
const SPERRE_MINUTEN = 15;

$GLOBALS['hausbau_geheim'] = null;

function geheim(): array
{
    if ($GLOBALS['hausbau_geheim'] === null) {
        $pfad = __DIR__ . '/daten/geheim.php';
        if (!is_file($pfad)) {
            fehler(500, 'Die Datei daten/geheim.php fehlt auf dem Server.');
        }
        $GLOBALS['hausbau_geheim'] = require $pfad;
    }
    return $GLOBALS['hausbau_geheim'];
}

function db(): PDO
{
    static $db = null;
    if ($db !== null) {
        return $db;
    }
    $g = geheim();
    try {
        $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $g['db_host'], $g['db_name']);
        if (!empty($g['db_port'])) {
            $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
                $g['db_host'], (int)$g['db_port'], $g['db_name']);
        }
        $db = new PDO(
            $dsn,
            $g['db_nutzer'],
            $g['db_passwort'],
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        );
    } catch (PDOException $ex) {
        // Die Meldung der Datenbank kann Zugangsdaten enthalten und gehoert
        // nicht zum Aufrufer.
        error_log('Hausbau-DB: ' . $ex->getMessage());
        fehler(500, 'Die Datenbank ist nicht erreichbar.');
    }
    return $db;
}

// ------------------------------------------------------------------ Herkunft

/**
 * Die Weboberflaeche liegt auf derselben Domain und braucht nichts. Nur die
 * App meldet sich von aussen; deren Herkunft steht in geheim.php.
 */
function herkunftFreigeben(): void
{
    $herkunft = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($herkunft === '') {
        return;
    }
    $erlaubt = geheim()['erlaubte_herkunft'] ?? [];
    $eigene = 'https://' . ($_SERVER['HTTP_HOST'] ?? '');
    if ($herkunft !== $eigene && !in_array($herkunft, $erlaubt, true)) {
        fehler(403, 'Diese Herkunft ist nicht freigegeben.');
    }
    header('Access-Control-Allow-Origin: ' . $herkunft);
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Content-Type, X-Hausbau-Marke');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Max-Age: 86400');
}

// ------------------------------------------------------------------ Antworten

function antwort(array $inhalt, int $code = 200): never
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($inhalt, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fehler(int $code, string $text): never
{
    antwort(['fehler' => $text], $code);
}

/** Liest den Rumpf der Anfrage als JSON. */
function eingang(): array
{
    $roh = file_get_contents('php://input');
    if ($roh === false || $roh === '') {
        return [];
    }
    $daten = json_decode($roh, true);
    if (!is_array($daten)) {
        fehler(400, 'Der Anfragerumpf ist kein gültiges JSON.');
    }
    return $daten;
}

// ------------------------------------------------------------------ Anmeldung

function marke(): string
{
    return trim((string)($_SERVER[MARKE_KOPF] ?? ''));
}

/**
 * Gibt den angemeldeten Nutzer zurueck oder bricht mit 401 ab.
 * @return array{id:int, epost:string}
 */
function nutzer(): array
{
    static $gefunden = null;
    if ($gefunden !== null) {
        return $gefunden;
    }

    $marke = marke();
    if ($marke === '') {
        fehler(401, 'Nicht angemeldet.');
    }

    $s = db()->prepare(
        'SELECT n.id, n.epost, s.marke
           FROM sitzungen s
           JOIN nutzer n ON n.id = s.nutzer_id
          WHERE s.marke = ? AND s.gesehen > DATE_SUB(NOW(), INTERVAL ? DAY)'
    );
    $s->execute([hash('sha256', $marke), SITZUNG_TAGE]);
    $zeile = $s->fetch();
    if (!$zeile) {
        fehler(401, 'Die Anmeldung ist abgelaufen.');
    }

    // Nur einmal am Tag schreiben, sonst kostet jede Anfrage einen Schreibzugriff.
    db()->prepare(
        'UPDATE sitzungen SET gesehen = NOW()
          WHERE marke = ? AND gesehen < DATE_SUB(NOW(), INTERVAL 1 DAY)'
    )->execute([hash('sha256', $marke)]);

    $gefunden = ['id' => (int)$zeile['id'], 'epost' => $zeile['epost']];
    return $gefunden;
}

/** Legt eine Sitzung an und gibt die Marke im Klartext zurueck. */
function sitzungAnlegen(int $nutzerId): string
{
    $marke = bin2hex(random_bytes(32));
    db()->prepare(
        'INSERT INTO sitzungen (marke, nutzer_id, angelegt, gesehen) VALUES (?, ?, NOW(), NOW())'
    )->execute([hash('sha256', $marke), $nutzerId]);
    return $marke;
}

// ------------------------------------------------------------------ Kleinkram

/** Zeitpunkt in derselben Form, die die App erzeugt: ISO-8601 in UTC. */
function jetztIso(): string
{
    return substr(gmdate('Y-m-d\TH:i:s'), 0, 19) . sprintf('.%03dZ', (int)(explode(' ', microtime())[0] * 1000));
}

function epostGueltig(string $epost): bool
{
    return (bool)filter_var($epost, FILTER_VALIDATE_EMAIL) && strlen($epost) <= 190;
}

/**
 * Bremst das Durchprobieren. Zaehlt Fehlversuche je Kennung (E-Mail oder IP)
 * und sperrt nach MAX_FEHLVERSUCHE fuer SPERRE_MINUTEN.
 */
function bremseGesperrt(string $kennung): bool
{
    $s = db()->prepare(
        'SELECT versuche FROM bremse
          WHERE kennung = ? AND bis > NOW()'
    );
    $s->execute([$kennung]);
    $zeile = $s->fetch();
    return $zeile && (int)$zeile['versuche'] >= MAX_FEHLVERSUCHE;
}

function bremseZaehlen(string $kennung): void
{
    db()->prepare(
        'INSERT INTO bremse (kennung, versuche, bis)
              VALUES (?, 1, DATE_ADD(NOW(), INTERVAL ? MINUTE))
         ON DUPLICATE KEY UPDATE
              versuche = IF(bis > NOW(), versuche + 1, 1),
              bis = DATE_ADD(NOW(), INTERVAL ? MINUTE)'
    )->execute([$kennung, SPERRE_MINUTEN, SPERRE_MINUTEN]);
}

function bremseLoeschen(string $kennung): void
{
    db()->prepare('DELETE FROM bremse WHERE kennung = ?')->execute([$kennung]);
}

herkunftFreigeben();

// Vorabfragen des Browsers beantworten, bevor irgendetwas geprueft wird.
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}
