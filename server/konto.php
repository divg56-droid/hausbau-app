<?php
declare(strict_types=1);
require __DIR__ . '/_start.php';

/**
 * Konto: registrieren, anmelden, abmelden, nachsehen wer angemeldet ist.
 *
 *   POST { tun: "registrieren", epost, passwort }
 *   POST { tun: "anmelden",     epost, passwort }
 *   POST { tun: "abmelden" }
 *   POST { tun: "wer" }
 *   POST { tun: "passwort_aendern", alt, neu }
 *   POST { tun: "konto_loeschen",   passwort }
 *
 * Antwort beim Anmelden und Registrieren enthaelt die Marke. Die App legt sie
 * ab und schickt sie danach im Kopf X-Hausbau-Marke mit.
 */

const PASSWORT_MINDESTLAENGE = 10;

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    fehler(405, 'Nur POST.');
}

$eingang = eingang();
$tun = (string)($eingang['tun'] ?? '');

switch ($tun) {

    case 'registrieren': {
        $epost = strtolower(trim((string)($eingang['epost'] ?? '')));
        $passwort = (string)($eingang['passwort'] ?? '');

        if (!epostGueltig($epost)) {
            fehler(400, 'Bitte eine gültige E-Mail-Adresse angeben.');
        }
        if (mb_strlen($passwort) < PASSWORT_MINDESTLAENGE) {
            fehler(400, 'Das Passwort braucht mindestens ' . PASSWORT_MINDESTLAENGE . ' Zeichen.');
        }

        // Auch das Registrieren wird gebremst, sonst laesst sich damit
        // durchprobieren, welche Adressen es schon gibt.
        $bremskennung = 'reg:' . ($_SERVER['REMOTE_ADDR'] ?? '?');
        if (bremseGesperrt($bremskennung)) {
            fehler(429, 'Zu viele Versuche. Bitte später erneut probieren.');
        }

        $s = db()->prepare('SELECT id FROM nutzer WHERE epost = ?');
        $s->execute([$epost]);
        if ($s->fetch()) {
            bremseZaehlen($bremskennung);
            fehler(409, 'Zu dieser Adresse gibt es schon ein Konto.');
        }

        db()->prepare('INSERT INTO nutzer (epost, passwort_hash, angelegt) VALUES (?, ?, NOW())')
            ->execute([$epost, password_hash($passwort, PASSWORD_DEFAULT)]);

        $id = (int)db()->lastInsertId();
        antwort(['marke' => sitzungAnlegen($id), 'epost' => $epost]);
    }

    case 'anmelden': {
        $epost = strtolower(trim((string)($eingang['epost'] ?? '')));
        $passwort = (string)($eingang['passwort'] ?? '');

        $bremskennung = 'an:' . $epost;
        if (bremseGesperrt($bremskennung)) {
            fehler(429, 'Zu viele Fehlversuche. Bitte in einer Viertelstunde erneut probieren.');
        }

        $s = db()->prepare('SELECT id, passwort_hash FROM nutzer WHERE epost = ?');
        $s->execute([$epost]);
        $zeile = $s->fetch();

        // Auch ohne Treffer einmal rechnen lassen, damit die Antwortzeit nicht
        // verraet, ob es die Adresse gibt. Die Attrappe ist ein echter
        // bcrypt-Hash zu einem Passwort, das niemand kennt; nur so kostet der
        // Vergleich dieselbe Zeit wie im Erfolgsfall.
        $hash = is_array($zeile)
            ? (string)$zeile['passwort_hash']
            : '$2y$12$C6UzMDM.H6dfI/f/IKcEe.5Uu4pDdMhtNVpXEgVwsKAHVCJ2E1Rgi';
        $stimmt = password_verify($passwort, $hash);

        if (!is_array($zeile) || !$stimmt) {
            bremseZaehlen($bremskennung);
            fehler(401, 'E-Mail-Adresse oder Passwort stimmt nicht.');
        }

        // Wenn PHP inzwischen ein staerkeres Verfahren mitbringt, hier
        // nachziehen; der Nutzer merkt davon nichts.
        if (password_needs_rehash($hash, PASSWORD_DEFAULT)) {
            db()->prepare('UPDATE nutzer SET passwort_hash = ? WHERE id = ?')
                ->execute([password_hash($passwort, PASSWORD_DEFAULT), (int)$zeile['id']]);
        }

        bremseLoeschen($bremskennung);
        antwort(['marke' => sitzungAnlegen((int)$zeile['id']), 'epost' => $epost]);
    }

    case 'abmelden': {
        $marke = marke();
        if ($marke !== '') {
            db()->prepare('DELETE FROM sitzungen WHERE marke = ?')->execute([hash('sha256', $marke)]);
        }
        antwort(['abgemeldet' => true]);
    }

    case 'wer': {
        $n = nutzer();
        $s = db()->prepare('SELECT COUNT(*) AS n FROM saetze WHERE nutzer_id = ? AND geloescht = 0');
        $s->execute([$n['id']]);
        $saetze = (int)$s->fetch()['n'];
        $s = db()->prepare('SELECT COUNT(*) AS n, COALESCE(SUM(groesse), 0) AS b FROM bilder WHERE nutzer_id = ? AND geloescht = 0');
        $s->execute([$n['id']]);
        $bilder = $s->fetch();
        antwort([
            'epost' => $n['epost'],
            'saetze' => $saetze,
            'bilder' => (int)$bilder['n'],
            'bytes' => (int)$bilder['b'],
        ]);
    }

    case 'passwort_aendern': {
        $n = nutzer();
        $alt = (string)($eingang['alt'] ?? '');
        $neu = (string)($eingang['neu'] ?? '');

        if (mb_strlen($neu) < PASSWORT_MINDESTLAENGE) {
            fehler(400, 'Das neue Passwort braucht mindestens ' . PASSWORT_MINDESTLAENGE . ' Zeichen.');
        }
        $s = db()->prepare('SELECT passwort_hash FROM nutzer WHERE id = ?');
        $s->execute([$n['id']]);
        if (!password_verify($alt, (string)$s->fetch()['passwort_hash'])) {
            fehler(401, 'Das bisherige Passwort stimmt nicht.');
        }

        db()->prepare('UPDATE nutzer SET passwort_hash = ? WHERE id = ?')
            ->execute([password_hash($neu, PASSWORD_DEFAULT), $n['id']]);

        // Alle anderen Anmeldungen beenden: Wer sein Passwort wechselt, will
        // in aller Regel genau das.
        db()->prepare('DELETE FROM sitzungen WHERE nutzer_id = ? AND marke <> ?')
            ->execute([$n['id'], hash('sha256', marke())]);

        antwort(['geaendert' => true]);
    }

    case 'konto_loeschen': {
        $n = nutzer();
        $s = db()->prepare('SELECT passwort_hash FROM nutzer WHERE id = ?');
        $s->execute([$n['id']]);
        if (!password_verify((string)($eingang['passwort'] ?? ''), (string)$s->fetch()['passwort_hash'])) {
            fehler(401, 'Das Passwort stimmt nicht.');
        }

        // Erst die Bilddateien, dann die Zeilen. Andersherum bliebe bei einem
        // Abbruch Datenmuell ohne Eigentuemer liegen.
        $b = db()->prepare('SELECT kennung FROM bilder WHERE nutzer_id = ?');
        $b->execute([$n['id']]);
        foreach ($b->fetchAll(PDO::FETCH_COLUMN) as $kennung) {
            $pfad = __DIR__ . '/daten/bilder/' . $n['id'] . '-' . $kennung;
            if (is_file($pfad)) {
                unlink($pfad);
            }
        }
        // Sitzungen, Saetze und Bilder haengen per Fremdschluessel daran.
        db()->prepare('DELETE FROM nutzer WHERE id = ?')->execute([$n['id']]);

        antwort(['geloescht' => true]);
    }

    default:
        fehler(400, 'Unbekannte Aktion.');
}
