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
    'einstellungen', 'projekte', 'darlehen', 'leitfaden', 'posten', 'angebote', 'anbieter', 'belege',
    'geschosse', 'raeume', 'pins', 'maengel', 'aufgaben', 'todos', 'tagebuch',
    'dokumente', 'baudoku', 'kontakte', 'bilder',
];

// Obergrenze je Antwort und Tabelle. Bei einem grossen Bestand holt sich das
// Geraet den Rest in weiteren Runden, statt in eine Zeitueberschreitung zu
// laufen. In geheim.php ueberschreibbar, damit die Pruefung das Blaettern
// mit einer Handvoll Saetzen ausloesen kann.
$portion = max(1, (int)(geheim()['abgleich_portion'] ?? 500));

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

/*
 * Mit der Spalte "eingang" fragt ein Geraet nach der Reihenfolge, in der
 * Saetze hier angekommen sind, und nicht mehr nach dem Zeitpunkt, den das
 * schreibende Geraet eingetragen hat (siehe naechsterEingang() in
 * _start.php). Solange einrichten.php die Spalte noch nicht angelegt hat,
 * laeuft alles wie bisher ueber "geaendert".
 */
$mitEingang = spalteDa('saetze', 'eingang') && spalteDa('bilder', 'eingang');
$nach = $mitEingang ? 'eingang' : 'geaendert';

$db->beginTransaction();

try {
    // Jeder angenommene Satz bekommt einen eigenen Stempel, eine Millisekunde
    // nach dem vorigen. Gleiche Stempel waeren beim Blaettern eine Falle.
    $stempel = $mitEingang ? naechsterEingang($n['id']) : '';

    /*
     * Wichtig ist die Reihenfolge der Zuweisungen: MariaDB wertet sie von
     * links nach rechts aus, und spaetere sehen bereits das Ergebnis der
     * frueheren. Stuende geaendert zuerst, verglichen inhalt und geloescht
     * danach gegen den schon gesetzten neuen Zeitpunkt - die Bedingung waere
     * nie erfuellt, und der Inhalt bliebe auf ewig der alte. Deshalb kommt
     * geaendert zuletzt.
     */
    $schreiben = $db->prepare($mitEingang
        ? 'INSERT INTO saetze (nutzer_id, speicher, kennung, geaendert, geloescht, inhalt, eingang)
                VALUES (:nutzer, :speicher, :kennung, :geaendert, :geloescht, :inhalt, :eingang)
           ON DUPLICATE KEY UPDATE
                eingang   = IF(VALUES(geaendert) > geaendert, VALUES(eingang), eingang),
                inhalt    = IF(VALUES(geaendert) > geaendert, VALUES(inhalt), inhalt),
                geloescht = IF(VALUES(geaendert) > geaendert, VALUES(geloescht), geloescht),
                geaendert = IF(VALUES(geaendert) > geaendert, VALUES(geaendert), geaendert)'
        : 'INSERT INTO saetze (nutzer_id, speicher, kennung, geaendert, geloescht, inhalt)
                VALUES (:nutzer, :speicher, :kennung, :geaendert, :geloescht, :inhalt)
           ON DUPLICATE KEY UPDATE
                inhalt    = IF(VALUES(geaendert) > geaendert, VALUES(inhalt), inhalt),
                geloescht = IF(VALUES(geaendert) > geaendert, VALUES(geloescht), geloescht),
                geaendert = IF(VALUES(geaendert) > geaendert, VALUES(geaendert), geaendert)'
    );

    $bildSchreiben = $db->prepare($mitEingang
        ? 'INSERT INTO bilder (nutzer_id, kennung, typ, groesse, geaendert, geloescht, eingang)
                VALUES (:nutzer, :kennung, :typ, 0, :geaendert, :geloescht, :eingang)
           ON DUPLICATE KEY UPDATE
                eingang   = IF(VALUES(geaendert) > geaendert, VALUES(eingang), eingang),
                geloescht = IF(VALUES(geaendert) > geaendert, VALUES(geloescht), geloescht),
                geaendert = IF(VALUES(geaendert) > geaendert, VALUES(geaendert), geaendert)'
        : 'INSERT INTO bilder (nutzer_id, kennung, typ, groesse, geaendert, geloescht)
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
                $werte = [
                    'nutzer' => $n['id'],
                    'kennung' => $kennung,
                    'typ' => substr((string)($satz['typ'] ?? 'image/jpeg'), 0, 64),
                    'geaendert' => $geaendert,
                    'geloescht' => $geloescht,
                ];
                if ($mitEingang) {
                    $werte['eingang'] = isoPlusMs($stempel, $angenommen);
                }
                $bildSchreiben->execute($werte);
                $angenommen++;
                continue;
            }

            $inhalt = $geloescht ? null : json_encode($satz, JSON_UNESCAPED_UNICODE);
            if ($inhalt !== null && strlen($inhalt) > MAX_SATZ_BYTES) {
                continue;
            }

            $werte = [
                'nutzer' => $n['id'],
                'speicher' => $speicher,
                'kennung' => $kennung,
                'geaendert' => $geaendert,
                'geloescht' => $geloescht,
                'inhalt' => $inhalt,
            ];
            if ($mitEingang) {
                $werte['eingang'] = isoPlusMs($stempel, $angenommen);
            }
            $schreiben->execute($werte);
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
 * Streng groesser als "seit": Alles bis einschliesslich dieser Marke hat das
 * Geraet schon bekommen. Die Marke stammt aus einer frueheren Antwort.
 *
 * Saetze und Bilder liegen in zwei Tabellen, das Geraet fuehrt aber nur eine
 * Marke. Deshalb wird aus beiden gelesen und nur so weit ausgeliefert, wie
 * BEIDE Tabellen vollstaendig bekannt sind. Bis zum 13.11.2026 lief die Marke
 * der einen Tabelle der anderen davon: Kamen in einer Runde mehr Bilder
 * zusammen, als in die Portion passten, uebersprang die naechste Runde den
 * Rest.
 */
$lesen = $db->prepare(
    "SELECT speicher, kennung, geaendert, geloescht, inhalt, $nach AS marke
       FROM saetze
      WHERE nutzer_id = :nutzer AND $nach > :seit
      ORDER BY $nach
      LIMIT :grenze"
);
$lesen->bindValue('nutzer', $n['id'], PDO::PARAM_INT);
$lesen->bindValue('seit', $seit);
$lesen->bindValue('grenze', $portion, PDO::PARAM_INT);
$lesen->execute();
$saetze = $lesen->fetchAll();

$lesenBilder = $db->prepare(
    "SELECT kennung, typ, groesse, geaendert, geloescht, $nach AS marke
       FROM bilder
      WHERE nutzer_id = :nutzer AND $nach > :seit
      ORDER BY $nach
      LIMIT :grenze"
);
$lesenBilder->bindValue('nutzer', $n['id'], PDO::PARAM_INT);
$lesenBilder->bindValue('seit', $seit);
$lesenBilder->bindValue('grenze', $portion, PDO::PARAM_INT);
$lesenBilder->execute();
$bilder = $lesenBilder->fetchAll();

// Bis wohin ist alles bekannt? Eine volle Portion heisst: Dahinter kann noch
// etwas liegen, und zwar auch mit demselben Stempel wie die letzte Zeile.
$grenze = null;
foreach ([$saetze, $bilder] as $liste) {
    if (count($liste) >= $portion) {
        $letzte = (string)$liste[count($liste) - 1]['marke'];
        if ($grenze === null || $letzte < $grenze) {
            $grenze = $letzte;
        }
    }
}

if ($grenze !== null) {
    // Alles vor der Grenze ist vollstaendig. Was genau auf ihr liegt, wird
    // eigens und ohne Obergrenze geholt -- sonst bliebe bei vielen Saetzen
    // mit demselben Stempel ein Rest fuer immer liegen.
    $saetze = array_values(array_filter($saetze, static fn ($z) => (string)$z['marke'] < $grenze));
    $bilder = array_values(array_filter($bilder, static fn ($z) => (string)$z['marke'] < $grenze));

    $gleich = $db->prepare(
        "SELECT speicher, kennung, geaendert, geloescht, inhalt, $nach AS marke
           FROM saetze WHERE nutzer_id = ? AND $nach = ?"
    );
    $gleich->execute([$n['id'], $grenze]);
    $saetze = array_merge($saetze, $gleich->fetchAll());

    $gleich = $db->prepare(
        "SELECT kennung, typ, groesse, geaendert, geloescht, $nach AS marke
           FROM bilder WHERE nutzer_id = ? AND $nach = ?"
    );
    $gleich->execute([$n['id'], $grenze]);
    $bilder = array_merge($bilder, $gleich->fetchAll());
}

$hinaus = [];
$hoechster = $seit;

foreach ($saetze as $zeile) {
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
    if ((string)$zeile['marke'] > $hoechster) {
        $hoechster = (string)$zeile['marke'];
    }
}

// Bilder liegen in einer eigenen Tabelle, kommen aber im selben Umschlag.
foreach ($bilder as $zeile) {
    $hinaus['bilder'] ??= [];
    $hinaus['bilder'][] = [
        'id' => $zeile['kennung'],
        'typ' => $zeile['typ'],
        'groesse' => (int)$zeile['groesse'],
        'geaendert' => $zeile['geaendert'],
        'geloescht' => (int)$zeile['geloescht'] === 1,
    ];
    if ((string)$zeile['marke'] > $hoechster) {
        $hoechster = (string)$zeile['marke'];
    }
}

antwort([
    'angenommen' => $angenommen,
    'stand' => $grenze ?? $hoechster,
    'saetze' => (object)$hinaus,
    // Sagt dem Geraet, dass es gleich noch einmal fragen soll.
    'weitere' => $grenze !== null,
]);
