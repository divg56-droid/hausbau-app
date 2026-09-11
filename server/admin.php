<?php
declare(strict_types=1);
require __DIR__ . '/_start.php';

/**
 * Verwaltung: wer nutzt die App, und wie viel.
 *
 *   POST { tun: "ueberblick", tage?: 30 }
 *
 * Wer hier hereindarf, steht als Liste von Adressen in geheim.php unter
 * "admins". Es gibt keine zweite Anmeldung und kein zweites Passwort: Der
 * Betreiber meldet sich wie jeder andere an, und diese Datei prueft nur
 * zusaetzlich, ob seine Adresse auf der Liste steht.
 *
 * Alle Adressen gehen ausschliesslich verkuerzt heraus ("an…as@example.de").
 * Das ist kein Vorhang vor der Anzeige, sondern die Grenze: Die vollen
 * Adressen bleiben in der Datenbank. Zum Wiedererkennen reicht die Kurzform,
 * und fuer alles andere gibt es keinen Grund, den ganzen Bestand durch einen
 * Browser zu schicken.
 */

$n = nutzer();
if (!istAdmin($n['epost'])) {
    // Dieselbe Antwort wie fuer einen unbekannten Weg. Wer nicht auf der
    // Liste steht, soll nicht erfahren, dass es die Liste gibt.
    fehler(404, 'Nicht vorhanden.');
}

$eingang = eingang();
$tun = (string)($eingang['tun'] ?? 'ueberblick');

// Ein Fenster, das man verstellen kann, aber nicht beliebig: Ueber ein Jahr
// hinaus wird die Abfrage teuer und die Anzeige unlesbar.
$tage = max(1, min(365, (int)($eingang['tage'] ?? 30)));

if ($tun !== 'ueberblick') {
    fehler(400, 'Unbekannte Aktion.');
}

$db = db();

/* ------------------------------------------------------------ Nutzerliste
 *
 * Eine Abfrage je Kennzahl und nicht ein grosses JOIN: Die Summen aus
 * zugriffe, saetze und bilder haben verschiedene Koernigkeit, und ein JOIN
 * ueber drei davon multipliziert die Zeilen, bevor er summiert. Vier kleine
 * Abfragen liefern dasselbe, sind lesbar und bei dieser Groessenordnung
 * nicht messbar langsamer.
 */
$nutzer = [];
foreach ($db->query(
    'SELECT id, epost, angelegt, passwort_hash <> \'\' AS hat_passwort FROM nutzer ORDER BY id'
) as $z) {
    $nutzer[(int)$z['id']] = [
        'id' => (int)$z['id'],
        'epost' => epostKurz((string)$z['epost']),
        'angelegt' => substr((string)$z['angelegt'], 0, 10),
        'passwort' => (bool)$z['hat_passwort'],
        'anfragen' => 0, 'bytes' => 0, 'tage_aktiv' => 0, 'zuletzt' => null,
        'saetze' => 0, 'bilder' => 0, 'bilder_bytes' => 0,
        'geraete' => 0, 'freigabe_aufrufe' => 0,
    ];
}

$fenster = $db->prepare(
    'SELECT nutzer_id, SUM(anfragen) AS anfragen,
            SUM(bytes_rein + bytes_raus) AS bytes,
            COUNT(*) AS tage_aktiv, MAX(tag) AS zuletzt
       FROM zugriffe
      WHERE tag > DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY nutzer_id'
);
$fenster->execute([$tage]);
foreach ($fenster as $z) {
    $id = (int)$z['nutzer_id'];
    if (!isset($nutzer[$id])) {
        continue;
    }
    $nutzer[$id]['anfragen'] = (int)$z['anfragen'];
    $nutzer[$id]['bytes'] = (int)$z['bytes'];
    $nutzer[$id]['tage_aktiv'] = (int)$z['tage_aktiv'];
    $nutzer[$id]['zuletzt'] = $z['zuletzt'];
}

// Wie viel liegt da? Geloeschtes zaehlt nicht mit: Ein Satz mit Loeschmarke
// bleibt fuer den Abgleich stehen, ist fuer den Nutzer aber weg.
foreach ($db->query(
    'SELECT nutzer_id, COUNT(*) AS anzahl FROM saetze WHERE geloescht = 0 GROUP BY nutzer_id'
) as $z) {
    if (isset($nutzer[(int)$z['nutzer_id']])) {
        $nutzer[(int)$z['nutzer_id']]['saetze'] = (int)$z['anzahl'];
    }
}
foreach ($db->query(
    'SELECT nutzer_id, COUNT(*) AS anzahl, SUM(groesse) AS bytes
       FROM bilder WHERE geloescht = 0 GROUP BY nutzer_id'
) as $z) {
    if (isset($nutzer[(int)$z['nutzer_id']])) {
        $nutzer[(int)$z['nutzer_id']]['bilder'] = (int)$z['anzahl'];
        $nutzer[(int)$z['nutzer_id']]['bilder_bytes'] = (int)$z['bytes'];
    }
}

// Offene Sitzungen sind die Geraete, auf denen die App noch angemeldet ist.
$geraete = $db->prepare(
    'SELECT nutzer_id, COUNT(*) AS anzahl, MAX(gesehen) AS gesehen
       FROM sitzungen WHERE gesehen > DATE_SUB(NOW(), INTERVAL ? DAY) GROUP BY nutzer_id'
);
$geraete->execute([SITZUNG_TAGE]);
foreach ($geraete as $z) {
    if (isset($nutzer[(int)$z['nutzer_id']])) {
        $nutzer[(int)$z['nutzer_id']]['geraete'] = (int)$z['anzahl'];
    }
}

// Aufrufe des oeffentlichen Bautagebuchs. Die zaehlen nicht als Verkehr des
// Nutzers -- das waren Fremde -- stehen aber in seiner Zeile, weil es seine
// Freigabe ist.
foreach ($db->query(
    'SELECT nutzer_id, SUM(aufrufe) AS aufrufe FROM freigaben GROUP BY nutzer_id'
) as $z) {
    if (isset($nutzer[(int)$z['nutzer_id']])) {
        $nutzer[(int)$z['nutzer_id']]['freigabe_aufrufe'] = (int)$z['aufrufe'];
    }
}

// Der Vielnutzer zuerst, danach die Neuen. Wer nichts gemacht hat, steht
// unten, ist aber da -- ein Konto ohne jede Anfrage ist eine eigene Aussage.
$liste = array_values($nutzer);
usort($liste, fn($a, $b) => [$b['anfragen'], $b['id']] <=> [$a['anfragen'], $a['id']]);

/* ------------------------------------------------------------- Tagesverlauf */

$verlauf = [];
$v = $db->prepare(
    'SELECT tag, SUM(anfragen) AS anfragen, SUM(bytes_rein + bytes_raus) AS bytes,
            COUNT(DISTINCT nutzer_id) AS nutzer
       FROM zugriffe
      WHERE tag > DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY tag ORDER BY tag'
);
$v->execute([$tage]);
$nachTag = [];
foreach ($v as $z) {
    $nachTag[(string)$z['tag']] = [
        'anfragen' => (int)$z['anfragen'], 'bytes' => (int)$z['bytes'], 'nutzer' => (int)$z['nutzer'],
    ];
}
// Leere Tage auffuellen. Ohne sie staende ein Wochenende ohne Verkehr nicht
// als Luecke im Diagramm, sondern gar nicht -- und die Kurve loege.
for ($i = $tage - 1; $i >= 0; $i--) {
    $tag = gmdate('Y-m-d', time() - $i * 86400);
    $verlauf[] = ['tag' => $tag] + ($nachTag[$tag] ?? ['anfragen' => 0, 'bytes' => 0, 'nutzer' => 0]);
}

/* ----------------------------------------------------------------- Summen */

$gesamt = [
    'nutzer' => count($nutzer),
    'aktiv' => count(array_filter($liste, fn($n) => $n['anfragen'] > 0)),
    'anfragen' => array_sum(array_column($liste, 'anfragen')),
    'bytes' => array_sum(array_column($liste, 'bytes')),
    'saetze' => array_sum(array_column($liste, 'saetze')),
    'bilder' => array_sum(array_column($liste, 'bilder')),
    'bilder_bytes' => array_sum(array_column($liste, 'bilder_bytes')),
    'freigaben' => (int)$db->query('SELECT COUNT(*) FROM freigaben')->fetchColumn(),
    'freigabe_aufrufe' => array_sum(array_column($liste, 'freigabe_aufrufe')),
];

// Neue Konten im Fenster: die einzige Zahl, die sagt, ob es voran geht.
$neu = $db->prepare('SELECT COUNT(*) FROM nutzer WHERE angelegt > DATE_SUB(NOW(), INTERVAL ? DAY)');
$neu->execute([$tage]);
$gesamt['neu'] = (int)$neu->fetchColumn();

antwort([
    'tage' => $tage,
    'gesamt' => $gesamt,
    'nutzer' => $liste,
    'verlauf' => $verlauf,
]);
