<?php
declare(strict_types=1);
require __DIR__ . '/_start.php';

/**
 * Abgleich in einem Zug: schicken, was sich hier geaendert hat, und
 * zurueckbekommen, was sich dort geaendert hat.
 *
 *   POST { seit: "2026-09-09T10:00:00.000Z"|null,
 *          saetze: { maengel: [...], kontakte: [...], ... } }
 *
 *   Antwort { stand: "...", saetze: {...}, weitere: false }
 *
 * Regel beim Zusammenfuehren: Je Datensatz gewinnt der neuere Zeitpunkt. Fuer
 * einen Menschen mit Telefon und Rechner reicht das; denselben Mangel
 * gleichzeitig an beiden Geraeten zu bearbeiten kommt praktisch nicht vor.
 *
 * Bilddaten laufen nicht hierueber, sondern ueber bild.php. Hier fliessen nur
 * die Angaben dazu, damit ein Geraet weiss, welche Datei es noch holen muss.
 */

// Nur diese Speicher werden angenommen. Ohne die Liste koennte ein Aufrufer
// beliebige Namen anlegen und die Tabelle vollschreiben.
const SPEICHER = [
    'einstellungen', 'darlehen', 'belege', 'geschosse', 'pins',
    'maengel', 'aufgaben', 'tagebuch', 'kontakte', 'bilder',
];

// Obergrenze je Antwort. Bei einem grossen Bestand holt sich das Geraet den
// Rest in weiteren Runden, statt in eine Zeitueberschreitung zu laufen.
const PORTION = 500;

// Ein einzelner Satz ist ein paar Kilobyte gross. Wer mehr schickt, hat
// entweder ein Bild hineingelegt oder versucht etwas.
const MAX_SATZ_BYTES = 256 * 1024;

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    fehler(405, 'Nur POST.');
}

$n = nutzer();
$eingang = eingang();
$seit = (string)($eingang['seit'] ?? '');
$hinein = $eingang['saetze'] ?? [];

if (!is_array($hinein)) {
    fehler(400, 'saetze muss ein Objekt sein.');
}

// --------------------------------------------------------------- hochschieben

$db = db();
$db->beginTransaction();

try {
    /*
     * Wichtig ist die Reihenfolge der Zuweisungen: MariaDB wertet sie von
     * links nach rechts aus, und spaetere sehen bereits das Ergebnis der
     * frueheren. Stuende geaendert zuerst, verglichen inhalt und geloescht
     * danach gegen den schon gesetzten neuen Zeitpunkt - die Bedingung waere
     * nie erfuellt, und der Inhalt bliebe auf ewig der alte. Deshalb kommt
     * geaendert zuletzt.
     */
    $schreiben = $db->prepare(
        'INSERT INTO saetze (nutzer_id, speicher, kennung, geaendert, geloescht, inhalt)
              VALUES (:nutzer, :speicher, :kennung, :geaendert, :geloescht, :inhalt)
         ON DUPLICATE KEY UPDATE
              inhalt    = IF(VALUES(geaendert) > geaendert, VALUES(inhalt), inhalt),
              geloescht = IF(VALUES(geaendert) > geaendert, VALUES(geloescht), geloescht),
              geaendert = IF(VALUES(geaendert) > geaendert, VALUES(geaendert), geaendert)'
    );

    $bildSchreiben = $db->prepare(
        'INSERT INTO bilder (nutzer_id, kennung, typ, groesse, geaendert, geloescht)
              VALUES (:nutzer, :kennung, :typ, 0, :geaendert, :geloescht)
         ON DUPLICATE KEY UPDATE
              geloescht = IF(VALUES(geaendert) > geaendert, VALUES(geloescht), geloescht),
              geaendert = IF(VALUES(geaendert) > geaendert, VALUES(geaendert), geaendert)'
    );

    $angenommen = 0;

    foreach ($hinein as $speicher => $liste) {
        if (!in_array($speicher, SPEICHER, true) || !is_array($liste)) {
            continue;
        }
        foreach ($liste as $satz) {
            if (!is_array($satz)) {
                continue;
            }
            // Einstellungen tragen ihren Namen als Schluessel, alles andere
            // eine Kennung.
            $kennung = (string)($satz['id'] ?? $satz['name'] ?? '');
            $geaendert = (string)($satz['geaendert'] ?? '');
            if ($kennung === '' || strlen($kennung) > 36 || $geaendert === '' || strlen($geaendert) > 24) {
                continue;
            }
            $geloescht = !empty($satz['geloescht']) ? 1 : 0;

            if ($speicher === 'bilder') {
                // Der Blob gehoert nicht hierher; nur die Angaben dazu.
                $bildSchreiben->execute([
                    'nutzer' => $n['id'],
                    'kennung' => $kennung,
                    'typ' => substr((string)($satz['typ'] ?? 'image/jpeg'), 0, 64),
                    'geaendert' => $geaendert,
                    'geloescht' => $geloescht,
                ]);
                $angenommen++;
                continue;
            }

            $inhalt = $geloescht ? null : json_encode($satz, JSON_UNESCAPED_UNICODE);
            if ($inhalt !== null && strlen($inhalt) > MAX_SATZ_BYTES) {
                continue;
            }

            $schreiben->execute([
                'nutzer' => $n['id'],
                'speicher' => $speicher,
                'kennung' => $kennung,
                'geaendert' => $geaendert,
                'geloescht' => $geloescht,
                'inhalt' => $inhalt,
            ]);
            $angenommen++;
        }
    }

    $db->commit();
} catch (Throwable $ex) {
    $db->rollBack();
    error_log('Hausbau-Abgleich: ' . $ex->getMessage());
    fehler(500, 'Der Abgleich ist fehlgeschlagen.');
}

// ------------------------------------------------------------------ herunter

/*
 * Streng groesser als "seit": Alles mit genau diesem Zeitpunkt hat das Geraet
 * beim letzten Mal schon bekommen. Die Marke selbst stammt aus einer frueheren
 * Antwort und ist daher immer ein Zeitpunkt, der auf dem Server vorkam.
 */
$hinaus = [];
$anzahl = 0;
$hoechster = $seit;

$lesen = $db->prepare(
    'SELECT speicher, kennung, geaendert, geloescht, inhalt
       FROM saetze
      WHERE nutzer_id = :nutzer AND geaendert > :seit
      ORDER BY geaendert
      LIMIT :grenze'
);
$lesen->bindValue('nutzer', $n['id'], PDO::PARAM_INT);
$lesen->bindValue('seit', $seit === '' ? '' : $seit);
$lesen->bindValue('grenze', PORTION, PDO::PARAM_INT);
$lesen->execute();

foreach ($lesen->fetchAll() as $zeile) {
    $speicher = $zeile['speicher'];
    $hinaus[$speicher] ??= [];
    if ((int)$zeile['geloescht'] === 1) {
        // Grabstein: nur Kennung, Zeitpunkt und Marke.
        $schluessel = $speicher === 'einstellungen' ? 'name' : 'id';
        $hinaus[$speicher][] = [
            $schluessel => $zeile['kennung'],
            'geaendert' => $zeile['geaendert'],
            'geloescht' => true,
        ];
    } else {
        $satz = json_decode((string)$zeile['inhalt'], true);
        if (is_array($satz)) {
            $hinaus[$speicher][] = $satz;
        }
    }
    $hoechster = $zeile['geaendert'];
    $anzahl++;
}

// Bilder liegen in einer eigenen Tabelle, kommen aber im selben Umschlag.
if ($anzahl < PORTION) {
    $lesenBilder = $db->prepare(
        'SELECT kennung, typ, groesse, geaendert, geloescht
           FROM bilder
          WHERE nutzer_id = :nutzer AND geaendert > :seit
          ORDER BY geaendert
          LIMIT :grenze'
    );
    $lesenBilder->bindValue('nutzer', $n['id'], PDO::PARAM_INT);
    $lesenBilder->bindValue('seit', $seit === '' ? '' : $seit);
    $lesenBilder->bindValue('grenze', PORTION - $anzahl, PDO::PARAM_INT);
    $lesenBilder->execute();

    foreach ($lesenBilder->fetchAll() as $zeile) {
        $hinaus['bilder'] ??= [];
        $hinaus['bilder'][] = [
            'id' => $zeile['kennung'],
            'typ' => $zeile['typ'],
            'groesse' => (int)$zeile['groesse'],
            'geaendert' => $zeile['geaendert'],
            'geloescht' => (int)$zeile['geloescht'] === 1,
        ];
        if ($zeile['geaendert'] > $hoechster) {
            $hoechster = $zeile['geaendert'];
        }
        $anzahl++;
    }
}

antwort([
    'angenommen' => $angenommen,
    'stand' => $hoechster,
    'saetze' => (object)$hinaus,
    // Sagt dem Geraet, dass es gleich noch einmal fragen soll.
    'weitere' => $anzahl >= PORTION,
]);
