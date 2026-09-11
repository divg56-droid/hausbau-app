<?php
declare(strict_types=1);
require __DIR__ . '/_start.php';

/**
 * Legt die Tabellen an, einmalig nach dem Hochladen:
 *
 *     https://www.bauzeuge.de/app/api/einrichten.php?schluessel=...
 *
 * Laesst sich gefahrlos mehrfach aufrufen: Es wird nur angelegt, was fehlt.
 * Ohne den Schluessel aus geheim.php passiert nichts.
 */

$erwartet = (string)(geheim()['einrichten_schluessel'] ?? '');
$geliefert = (string)($_GET['schluessel'] ?? '');

if ($erwartet === '' || !hash_equals($erwartet, $geliefert)) {
    fehler(403, 'Falscher oder fehlender Schlüssel.');
}

/*
 * Ein schwerer Fehler beendet PHP, ohne dass eine Ausnahme entsteht -- kein
 * try/catch fasst ihn, und heraus kommt eine 500 mit null Byte Rumpf. Genau
 * das stand hier einmal und liess sich von aussen nicht unterscheiden von
 * "Server kaputt". Diese Datei darf reden, also sagt sie, woran sie starb.
 */
register_shutdown_function(static function (): void {
    $letzter = error_get_last();
    if ($letzter === null || !in_array($letzter['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        return;
    }
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode([
        'fehler' => 'Abbruch beim Einrichten.',
        'meldung' => $letzter['message'],
        'stelle' => basename((string)$letzter['file']) . ':' . $letzter['line'],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
});

/*
 * Ab hier ist bewiesen, dass der Aufrufer den Schluessel kennt, also der
 * Betreiber ist. Deshalb darf die echte Meldung der Datenbank heraus - ohne
 * sie sucht man bei "nicht erreichbar" im Dunkeln. Alle anderen
 * Schnittstellen schweigen weiterhin, dort koennte jeder fragen.
 */
try {
    $g = geheim();
    $dsn = empty($g['db_port'])
        ? sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $g['db_host'], $g['db_name'])
        : sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            $g['db_host'], (int)$g['db_port'], $g['db_name']);
    new PDO($dsn, $g['db_nutzer'], $g['db_passwort'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
} catch (PDOException $ex) {
    antwort([
        'fehler' => 'Die Datenbank nimmt die Zugangsdaten nicht an.',
        'meldung' => $ex->getMessage(),
        'versucht' => [
            'host' => (string)($g['db_host'] ?? ''),
            'port' => $g['db_port'] ?? '(Standard)',
            'name' => (string)($g['db_name'] ?? ''),
            'nutzer' => (string)($g['db_nutzer'] ?? ''),
            'passwort_zeichen' => strlen((string)($g['db_passwort'] ?? '')),
        ],
    ], 500);
}

/*
 * Zum Aufbau:
 *
 * Alle Sachdaten liegen in einer einzigen Tabelle "saetze" als JSON. Die App
 * hat zehn Speicher mit unterschiedlichen Feldern, und die aendern sich beim
 * Weiterbauen. Eine Tabelle je Speicher hiesse, jede Feldaenderung in der App
 * zieht eine Wanderung auf dem Server nach sich. Fuer den Abgleich ist der
 * Inhalt ohnehin undurchsichtig: Interessant sind nur Kennung, Zeitpunkt und
 * Loeschmarke, und genau die stehen als eigene Spalten daneben.
 *
 * "geaendert" steht als Zeichenkette, nicht als DATETIME. Die App liefert
 * ISO-8601 in UTC, und solche Zeichenketten sortieren sich von selbst
 * chronologisch. Damit entfaellt jede Umrechnung zwischen Zeitzonen, und der
 * Vergleich "wer ist neuer" kann nicht durch eine Sommerzeit kippen.
 */
$tabellen = [

'nutzer' => "
CREATE TABLE nutzer (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    epost VARCHAR(190) NOT NULL,
    passwort_hash VARCHAR(255) NOT NULL,
    angelegt DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY epost (epost)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

// Die Marke steht nur als SHA-256. Wer die Datenbank liest, kann sich damit
// nicht anmelden.
'sitzungen' => "
CREATE TABLE sitzungen (
    marke CHAR(64) NOT NULL,
    nutzer_id INT UNSIGNED NOT NULL,
    angelegt DATETIME NOT NULL,
    gesehen DATETIME NOT NULL,
    PRIMARY KEY (marke),
    KEY nutzer (nutzer_id),
    CONSTRAINT sitzung_nutzer FOREIGN KEY (nutzer_id) REFERENCES nutzer (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

'saetze' => "
CREATE TABLE saetze (
    nutzer_id INT UNSIGNED NOT NULL,
    speicher VARCHAR(32) NOT NULL,
    kennung CHAR(36) NOT NULL,
    geaendert CHAR(24) NOT NULL,
    geloescht TINYINT(1) NOT NULL DEFAULT 0,
    inhalt LONGTEXT NULL,
    PRIMARY KEY (nutzer_id, speicher, kennung),
    KEY seit (nutzer_id, geaendert),
    CONSTRAINT satz_nutzer FOREIGN KEY (nutzer_id) REFERENCES nutzer (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

// Die Bilddaten liegen als Datei neben der Datenbank, nicht darin. Ein
// Bestand von einigen hundert Megabyte sprengt sonst jede Datenbankgroesse,
// die man bei einem Webhoster bekommt.
'bilder' => "
CREATE TABLE bilder (
    nutzer_id INT UNSIGNED NOT NULL,
    kennung CHAR(36) NOT NULL,
    typ VARCHAR(64) NOT NULL DEFAULT 'image/jpeg',
    groesse INT UNSIGNED NOT NULL DEFAULT 0,
    geaendert CHAR(24) NOT NULL,
    geloescht TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (nutzer_id, kennung),
    KEY seit (nutzer_id, geaendert),
    CONSTRAINT bild_nutzer FOREIGN KEY (nutzer_id) REFERENCES nutzer (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

// Zwischenspeicher der Ortssuche. Steht hier und nicht beim Nutzer: Ein
// Ortsname gehoert niemandem, und einmal nachgeschlagen reicht fuer alle.
'orte' => "
CREATE TABLE orte (
    suche VARCHAR(190) NOT NULL,
    name VARCHAR(255) NOT NULL,
    lat DECIMAL(9,6) NOT NULL DEFAULT 0,
    lon DECIMAL(9,6) NOT NULL DEFAULT 0,
    gefunden TINYINT(1) NOT NULL DEFAULT 0,
    angelegt DATETIME NOT NULL,
    PRIMARY KEY (suche)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

// Oeffentliche Freigabe des Bautagebuchs. Die Marke steht als SHA-256, wie
// bei den Sitzungen: Wer die Datenbank liest, kann daraus keinen gueltigen
// Verweis bauen.
'freigaben' => "
CREATE TABLE freigaben (
    marke CHAR(64) NOT NULL,
    nutzer_id INT UNSIGNED NOT NULL,
    art VARCHAR(32) NOT NULL,
    titel VARCHAR(190) NOT NULL,
    angelegt DATETIME NOT NULL,
    aufrufe INT UNSIGNED NOT NULL DEFAULT 0,
    zuletzt DATETIME NULL,
    PRIMARY KEY (marke),
    UNIQUE KEY je_nutzer (nutzer_id, art),
    CONSTRAINT freigabe_nutzer FOREIGN KEY (nutzer_id) REFERENCES nutzer (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

// Der Schluessel ist der Tabellenname: Danach wird geprueft, ob sie schon
// da ist. Hier stand einmal 'bremse' ueber dem CREATE fuer anmeldelinks --
// mit der Folge, dass anmeldelinks nie angelegt wurde, sobald bremse
// existierte, und CREATE TABLE bremse bei jedem Aufruf erneut lief und
// abbrach. Aufgefallen ist es nicht, weil konto.php sich die Tabelle beim
// ersten Gebrauch selbst anlegt.
'anmeldelinks' => "
CREATE TABLE anmeldelinks (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    epost VARCHAR(190) NOT NULL,
    token_hash CHAR(64) NOT NULL,
    code_hash CHAR(64) NOT NULL,
    angelegt DATETIME NOT NULL,
    gueltig_bis DATETIME NOT NULL,
    versuche TINYINT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY token_hash (token_hash),
    KEY epost (epost)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

'bremse' => "CREATE TABLE bremse (
    kennung VARCHAR(190) NOT NULL,
    versuche INT UNSIGNED NOT NULL DEFAULT 0,
    bis DATETIME NOT NULL,
    PRIMARY KEY (kennung)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

// Wer wie viel Verkehr macht. Eine Zeile je Nutzer und Tag statt einer je
// Anfrage: Der Abgleich macht mehrere Anfragen hintereinander, ein Rohprotokoll
// waere nach einem Jahr das Groesste in der Datenbank und beantwortet keine
// Frage besser. bytes_rein/raus als BIGINT, ein Bilderabgleich bewegt
// zweistellige Megabyte am Tag.
'zugriffe' => "
CREATE TABLE zugriffe (
    nutzer_id INT UNSIGNED NOT NULL,
    tag DATE NOT NULL,
    anfragen INT UNSIGNED NOT NULL DEFAULT 0,
    bytes_rein BIGINT UNSIGNED NOT NULL DEFAULT 0,
    bytes_raus BIGINT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (nutzer_id, tag),
    KEY nach_tag (tag),
    CONSTRAINT zugriff_nutzer FOREIGN KEY (nutzer_id) REFERENCES nutzer (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

];

$meldungen = [];

$vorhanden = [];
foreach (db()->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $name) {
    $vorhanden[$name] = true;
}

/*
 * Mit Meldung, nicht mit einer leeren 500.
 *
 * Bis hierher war klar, dass der Aufrufer den Schluessel kennt, also der
 * Betreiber ist -- und trotzdem brach ein misslungenes CREATE als
 * unbehandelte Ausnahme ab: HTTP 500, null Byte Rumpf, keine Spur. Wer
 * das Schema anlegt, muss lesen koennen, woran es lag.
 */
foreach ($tabellen as $name => $sql) {
    if (isset($vorhanden[$name])) {
        $meldungen[] = "$name: vorhanden";
        continue;
    }
    try {
        db()->exec($sql);
        $meldungen[] = "$name: angelegt";
    } catch (Throwable $ex) {
        antwort([
            'fehler' => 'Tabelle ' . $name . ' liess sich nicht anlegen.',
            'meldung' => $ex->getMessage(),
            'bis_dahin' => $meldungen,
        ], 500);
    }
}

// Nachtraeglich hinzugekommene Spalten. Die Tabellen oben werden nur
// angelegt, wenn sie fehlen; auf einem Server, der schon laeuft, muss die
// Spalte einzeln nachgezogen werden. Ohne "IF NOT EXISTS", das kennt MariaDB
// erst ab 10.0 zuverlaessig und nicht jeder Anbieter ist dort.
$nachtrag = [
    ['freigaben', 'aufrufe', 'INT UNSIGNED NOT NULL DEFAULT 0'],
    ['freigaben', 'zuletzt', 'DATETIME NULL'],
];
/*
 * Spalten holen und in PHP vergleichen, nicht "SHOW COLUMNS ... LIKE ?".
 *
 * Genau das stand hier und hat die Datei jedes Mal getoetet, sobald es die
 * Tabelle freigaben gab: MariaDB nimmt in einem echten vorbereiteten
 * Statement -- und PDO::ATTR_EMULATE_PREPARES steht in _start.php auf false
 * -- an dieser Stelle keinen Platzhalter. Heraus kam eine leere 500, und
 * weil das Einrichten danach abbrach, wurde nie gemeldet, dass die
 * Nachtragsspalten fehlten.
 *
 * Den Namen in die Abfrage zu schreiben waere die andere Loesung gewesen.
 * Sie ist hier zwar ungefaehrlich -- die Namen stehen drei Zeilen hoeher im
 * Quelltext --, aber ein SQL-Text, in den etwas eingesetzt wird, ist eine
 * Gewohnheit, die man sich nicht angewoehnen sollte.
 */
$spaltenVon = [];
foreach ($nachtrag as [$tabelle, , ]) {
    if (isset($vorhanden[$tabelle]) && !isset($spaltenVon[$tabelle])) {
        $spaltenVon[$tabelle] = db()->query('SHOW COLUMNS FROM `' . $tabelle . '`')
            ->fetchAll(PDO::FETCH_COLUMN);
    }
}
foreach ($nachtrag as [$tabelle, $spalte, $art]) {
    if (!isset($vorhanden[$tabelle])) {
        continue;
    }
    if (in_array($spalte, $spaltenVon[$tabelle] ?? [], true)) {
        $meldungen[] = "$tabelle.$spalte: vorhanden";
        continue;
    }
    try {
        db()->exec('ALTER TABLE `' . $tabelle . '` ADD `' . $spalte . '` ' . $art);
        $meldungen[] = "$tabelle.$spalte: ergaenzt";
    } catch (Throwable $ex) {
        antwort([
            'fehler' => 'Spalte ' . $tabelle . '.' . $spalte . ' liess sich nicht ergaenzen.',
            'meldung' => $ex->getMessage(),
            'bis_dahin' => $meldungen,
        ], 500);
    }
}

// Ablage fuer die Bilddateien. Liegt unter daten/, das per .htaccess gesperrt
// ist; ausgeliefert wird ausschliesslich ueber bild.php mit Rechtepruefung.
$ablage = __DIR__ . '/daten/bilder';
if (!is_dir($ablage)) {
    mkdir($ablage, 0750, true);
    $meldungen[] = 'daten/bilder: angelegt';
} else {
    $meldungen[] = 'daten/bilder: vorhanden';
}

$meldungen[] = 'PHP ' . PHP_VERSION;
$meldungen[] = 'Server ' . db()->getAttribute(PDO::ATTR_SERVER_VERSION);

antwort(['fertig' => true, 'schritte' => $meldungen]);
