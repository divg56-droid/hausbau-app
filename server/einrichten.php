<?php
declare(strict_types=1);
require __DIR__ . '/_start.php';

/**
 * Legt die Tabellen an, einmalig nach dem Hochladen:
 *
 *     https://hausbauatlas.de/app/api/einrichten.php?schluessel=...
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

'bremse' => "
CREATE TABLE bremse (
    kennung VARCHAR(190) NOT NULL,
    versuche INT UNSIGNED NOT NULL DEFAULT 0,
    bis DATETIME NOT NULL,
    PRIMARY KEY (kennung)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

];

$meldungen = [];

$vorhanden = [];
foreach (db()->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $name) {
    $vorhanden[$name] = true;
}

foreach ($tabellen as $name => $sql) {
    if (isset($vorhanden[$name])) {
        $meldungen[] = "$name: vorhanden";
        continue;
    }
    db()->exec($sql);
    $meldungen[] = "$name: angelegt";
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
