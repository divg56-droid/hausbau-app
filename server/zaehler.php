<?php
declare(strict_types=1);
require __DIR__ . '/_start.php';

/**
 * Seitenzaehler fuer www.bauzeuge.de.
 *
 *   POST { pfad: "/kfw/", verweis: "google" }
 *
 * Eigene Zaehlung statt eines fremden Dienstes, und zwar die kleinste, die
 * die Frage beantwortet: Welche Seite wird wie oft geoeffnet?
 *
 * Gespeichert wird **eine Zeile je Tag und Pfad**, sonst nichts. Keine
 * IP-Adresse, kein Keks, keine Kennung, kein Verlauf -- es gibt hier
 * niemanden wiederzuerkennen, auch nicht im Nachhinein. Das ist nicht nur
 * bequem fuer die Datenschutzerklaerung, es ist auch die Zahl, um die es
 * geht: "wie oft" und nicht "von wem".
 *
 * Der Zaehler antwortet immer mit 204 und nie mit einem Fehler. Eine Seite,
 * die wegen der Statistik eine rote Konsole zeigt, waere der Statistik nicht
 * wert.
 */

/** Ist das ein Besucher oder eine Maschine? */
function istMaschine(string $kennung): bool
{
    if ($kennung === '') {
        return true;
    }
    return (bool)preg_match(
        '/bot|crawl|spider|slurp|facebookexternalhit|headless|preview|monitor|curl|wget|python|lighthouse/i',
        $kennung
    );
}

/**
 * Nur der Pfad, und nur einer, den es geben kann.
 *
 * Ohne Abfrageteil: "?utm_source=..." macht aus einer Seite hundert Zeilen,
 * und was in einem Abfrageteil steht, hat in einer Statistik nichts zu
 * suchen -- dort landen sonst Suchbegriffe und E-Mail-Adressen aus fremden
 * Verweisen.
 */
function pfadSaeubern(string $roh): string
{
    $pfad = strtok($roh, '?#');
    if ($pfad === false || $pfad === '' || $pfad[0] !== '/') {
        return '';
    }
    if (!preg_match('#^/[a-z0-9\-/.]*$#', $pfad)) {
        return '';
    }
    return mb_substr($pfad, 0, 190);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    exit;
}

$eingang = eingang();
$pfad = pfadSaeubern((string)($eingang['pfad'] ?? ''));

if ($pfad === '' || istMaschine((string)($_SERVER['HTTP_USER_AGENT'] ?? ''))) {
    http_response_code(204);
    exit;
}

try {
    db()->prepare(
        'INSERT INTO seitenaufrufe (tag, pfad, aufrufe) VALUES (CURDATE(), ?, 1)
         ON DUPLICATE KEY UPDATE aufrufe = aufrufe + 1'
    )->execute([$pfad]);
} catch (Throwable $ex) {
    // Eine verlorene Zaehlung ist nichts, eine kaputte Seite waere etwas.
    error_log('Seitenzaehler: ' . $ex->getMessage());
}

http_response_code(204);
