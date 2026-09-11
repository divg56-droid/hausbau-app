<?php
declare(strict_types=1);
require __DIR__ . '/_start.php';

/**
 * Bilddateien hoch- und herunterladen.
 *
 *   POST /bild.php?id=<kennung>   Rumpf = die Bilddatei roh
 *   GET  /bild.php?id=<kennung>   liefert die Datei
 *
 * Getrennt vom Abgleich, weil Bilder gross und unveraenderlich sind: einmal
 * hoch, danach nur noch geholt. Ueber den Abgleich liefe alles durch JSON und
 * waere um ein Drittel aufgeblaeht.
 *
 * Die Dateien liegen unter daten/bilder/, also in einem per .htaccess
 * gesperrten Verzeichnis. Ausgeliefert wird nur hierueber, und nur an den
 * Eigentuemer.
 */

const MAX_BILD_BYTES = 12 * 1024 * 1024;

$n = nutzer();

$kennung = (string)($_GET['id'] ?? '');
// Nur Kennungen in UUID-Form. Damit kann kein "../" im Dateinamen landen.
if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', $kennung)) {
    fehler(400, 'Ungültige Kennung.');
}

$ablage = __DIR__ . '/daten/bilder';
$pfad = $ablage . '/' . $n['id'] . '-' . $kennung;

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {

    $roh = file_get_contents('php://input');
    if ($roh === false || $roh === '') {
        fehler(400, 'Kein Inhalt empfangen.');
    }
    if (strlen($roh) > MAX_BILD_BYTES) {
        fehler(413, 'Die Datei ist zu groß.');
    }

    // Nicht dem Aufrufer glauben, sondern in die Datei schauen.
    $art = null;
    $info = @getimagesizefromstring($roh);
    if ($info !== false && in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) {
        $art = image_type_to_mime_type($info[2]);
    } elseif (str_starts_with($roh, '%PDF-')) {
        $art = 'application/pdf';
    }
    if ($art === null) {
        fehler(415, 'Nur Bilder und PDF-Dateien.');
    }

    if (!is_dir($ablage) && !mkdir($ablage, 0750, true) && !is_dir($ablage)) {
        fehler(500, 'Die Ablage lässt sich nicht anlegen.');
    }

    // Erst daneben schreiben, dann umbenennen: So liegt nie eine halb
    // geschriebene Datei da, wenn die Verbindung abbricht.
    $zwischen = $pfad . '.teil';
    if (file_put_contents($zwischen, $roh, LOCK_EX) === false || !rename($zwischen, $pfad)) {
        @unlink($zwischen);
        fehler(500, 'Die Datei ließ sich nicht ablegen.');
    }

    db()->prepare(
        'INSERT INTO bilder (nutzer_id, kennung, typ, groesse, geaendert, geloescht)
              VALUES (:nutzer, :kennung, :typ, :groesse, :geaendert, 0)
         ON DUPLICATE KEY UPDATE
              typ = VALUES(typ), groesse = VALUES(groesse), geloescht = 0'
    )->execute([
        'nutzer' => $n['id'],
        'kennung' => $kennung,
        'typ' => $art,
        'groesse' => strlen($roh),
        // Nur fuer den Fall, dass die Zeile hier zuerst entsteht. Beim
        // Aktualisieren bleibt geaendert absichtlich stehen: Der Zeitpunkt
        // gehoert dem Abgleich, nicht dem Hochladen. Sonst saehe die
        // Serverfassung staendig neuer aus als die des Geraets.
        'geaendert' => jetztIso(),
    ]);

    antwort(['abgelegt' => true, 'groesse' => strlen($roh), 'typ' => $art]);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    fehler(405, 'Nur GET oder POST.');
}

$s = db()->prepare('SELECT typ, groesse, geloescht FROM bilder WHERE nutzer_id = ? AND kennung = ?');
$s->execute([$n['id'], $kennung]);
$zeile = $s->fetch();

if (!$zeile || (int)$zeile['geloescht'] === 1 || !is_file($pfad)) {
    fehler(404, 'Nicht vorhanden.');
}

header('Content-Type: ' . $zeile['typ']);
header('Content-Length: ' . (string)filesize($pfad));
// Der Inhalt zu einer Kennung aendert sich nie, also darf das Geraet ihn
// behalten. Privat, weil es fremde Bilder sind.
header('Cache-Control: private, max-age=31536000, immutable');
// Bilder sind der einzige nennenswerte Verkehr dieser Schnittstelle und
// laufen an antwort() vorbei -- hier also von Hand aufs Tageskonto.
zugriffZaehlen((int)filesize($pfad));
readfile($pfad);
