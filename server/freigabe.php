<?php
declare(strict_types=1);
require __DIR__ . '/_start.php';

/**
 * Verwaltung der oeffentlichen Freigabe des Bautagebuchs.
 *
 *   POST { tun: "stand" }                  gibt es eine Freigabe, und wie lautet sie
 *   POST { tun: "anlegen", titel: "..." }  legt eine an, gibt den Verweis zurueck
 *   POST { tun: "aufheben" }               nimmt sie zurueck
 *
 * Die Marke steht wie bei den Sitzungen nur als SHA-256 in der Datenbank. Wer
 * die Datenbank liest, kann daraus keinen gueltigen Verweis bauen. Der
 * Klartext existiert genau einmal, naemlich in der Antwort auf "anlegen"; wer
 * ihn verliert, hebt die Freigabe auf und legt eine neue an.
 *
 * Bewusst nur eine Freigabe je Nutzer und Art: Zwei gleichzeitig gueltige
 * Verweise kann niemand auseinanderhalten, und ein vergessener zweiter Verweis
 * waere genau das Leck, das man vermeiden will.
 */

const ART = 'tagebuch';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    fehler(405, 'Nur POST.');
}

$n = nutzer();
$eingang = eingang();
$tun = (string)($eingang['tun'] ?? '');

/** Die oeffentliche Adresse zu einer Marke. */
function verweisAuf(string $marke): string
{
    $wirt = $_SERVER['HTTP_HOST'] ?? 'www.bauzeuge.de';
    return 'https://' . $wirt . '/app/api/oeffentlich.php?k=' . $marke;
}

function vorhandene(int $nutzerId): ?array
{
    $s = db()->prepare(
        'SELECT titel, angelegt FROM freigaben WHERE nutzer_id = ? AND art = ?'
    );
    $s->execute([$nutzerId, ART]);
    $zeile = $s->fetch();
    return $zeile ?: null;
}

if ($tun === 'stand') {
    $da = vorhandene($n['id']);
    antwort([
        // Der Klartext der Marke ist hier nicht mehr bekannt. Die App merkt
        // sich den Verweis selbst; hier steht nur, ob die Freigabe noch gilt.
        'frei' => $da !== null,
        'titel' => $da['titel'] ?? '',
        'angelegt' => $da['angelegt'] ?? null,
    ]);
}

if ($tun === 'anlegen') {
    $titel = trim((string)($eingang['titel'] ?? ''));
    if ($titel === '') {
        $titel = 'Unser Bautagebuch';
    }
    if (mb_strlen($titel) > 120) {
        $titel = mb_substr($titel, 0, 120);
    }

    $marke = bin2hex(random_bytes(24));

    $db = db();
    $db->beginTransaction();
    try {
        // Erst die alte weg, dann die neue. So bleibt es bei genau einer.
        $db->prepare('DELETE FROM freigaben WHERE nutzer_id = ? AND art = ?')
           ->execute([$n['id'], ART]);
        $db->prepare(
            'INSERT INTO freigaben (marke, nutzer_id, art, titel, angelegt)
                  VALUES (?, ?, ?, ?, NOW())'
        )->execute([hash('sha256', $marke), $n['id'], ART, $titel]);
        $db->commit();
    } catch (Throwable $ex) {
        $db->rollBack();
        error_log('BauZeuge-Freigabe: ' . $ex->getMessage());
        fehler(500, 'Die Freigabe ließ sich nicht anlegen.');
    }

    antwort(['frei' => true, 'titel' => $titel, 'verweis' => verweisAuf($marke)]);
}

if ($tun === 'aufheben') {
    db()->prepare('DELETE FROM freigaben WHERE nutzer_id = ? AND art = ?')
        ->execute([$n['id'], ART]);
    antwort(['frei' => false]);
}

fehler(400, 'Unbekannte Anweisung.');
