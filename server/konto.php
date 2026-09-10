<?php
declare(strict_types=1);
require __DIR__ . '/_start.php';

/**
 * Konto: registrieren, anmelden, abmelden, nachsehen wer angemeldet ist.
 *
 *   POST { tun: "registrieren", epost, passwort }
 *   POST { tun: "anmelden",     epost, passwort }
 *   POST { tun: "anmeldelink",  epost }
 *   POST { tun: "link_einloesen", token }
 *   POST { tun: "code_einloesen", epost, code }
 *   POST { tun: "abmelden" }
 *   POST { tun: "wer" }
 *   POST { tun: "passwort_aendern", alt, neu }
 *   POST { tun: "konto_loeschen",   passwort }
 *
 * Antwort beim Anmelden und Registrieren enthaelt die Marke. Die App legt sie
 * ab und schickt sie danach im Kopf X-Hausbau-Marke mit.
 */

const PASSWORT_MINDESTLAENGE = 10;

// Anmeldung ohne Passwort.
//
// Der Link ist die bequeme Fassung fuer den Rechner: anklicken, fertig. Der
// Code ist die fuer das Telefon -- dort oeffnet der Link den Browser und
// nicht die installierte App, und die Sitzung entstuende an der falschen
// Stelle. Beides gehoert zu einer Zeile und faellt zusammen weg.
//
// Eine Viertelstunde: lang genug, um die Mail in Ruhe zu holen, kurz genug,
// dass ein alter Brief im Postfach kein Schluessel mehr ist.
const LINK_MINUTEN = 15;
const CODE_VERSUCHE = 5;
const ABSENDER = 'kontakt@bauzeuge.de';

/** Die Tabelle entsteht beim ersten Gebrauch, damit niemand nachruesten muss. */
function linktabelle(): void
{
    db()->exec(
        'CREATE TABLE IF NOT EXISTS anmeldelinks (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    // Abgelaufenes gleich mitnehmen: Ein Aufraeumlauf, den niemand startet,
    // laeuft nie.
    db()->exec('DELETE FROM anmeldelinks WHERE gueltig_bis < NOW()');
}

/**
 * Meldet an und legt bei Bedarf das Konto an.
 *
 * Wer eine Mail an dieser Adresse lesen kann, ist der Inhaber -- dieselbe
 * Annahme, auf der jedes "Passwort vergessen" der Welt beruht. Ein neues
 * Konto bekommt keinen Passwort-Hash; es kann sich eins geben, muss aber
 * nicht.
 */
function anmeldenPerPost(string $epost): void
{
    $s = db()->prepare('SELECT id FROM nutzer WHERE epost = ?');
    $s->execute([$epost]);
    $zeile = $s->fetch();

    if (is_array($zeile)) {
        $id = (int)$zeile['id'];
    } else {
        db()->prepare("INSERT INTO nutzer (epost, passwort_hash, angelegt) VALUES (?, '', NOW())")
            ->execute([$epost]);
        $id = (int)db()->lastInsertId();
    }

    antwort(['marke' => sitzungAnlegen($id), 'epost' => $epost]);
}

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

    case 'anmeldelink': {
        $epost = strtolower(trim((string)($eingang['epost'] ?? '')));
        if (!epostGueltig($epost)) {
            fehler(400, 'Bitte eine gültige E-Mail-Adresse angeben.');
        }

        // Zwei Bremsen: eine je Adresse, damit niemand ein fremdes Postfach
        // zuschuettet, eine je Absender, damit niemand tausend Adressen
        // durchprobiert.
        foreach (['link:' . $epost, 'linkip:' . ($_SERVER['REMOTE_ADDR'] ?? '?')] as $k) {
            if (bremseGesperrt($k)) {
                fehler(429, 'Zu viele Anfragen. Bitte in einer Viertelstunde erneut probieren.');
            }
        }
        bremseZaehlen('link:' . $epost);
        bremseZaehlen('linkip:' . ($_SERVER['REMOTE_ADDR'] ?? '?'));

        linktabelle();
        // Ein neuer Link macht den alten ungueltig. Sonst laegen zwei
        // Schluessel im Postfach und der aeltere waere der laengere Weg
        // hinein.
        db()->prepare('DELETE FROM anmeldelinks WHERE epost = ?')->execute([$epost]);

        $token = bin2hex(random_bytes(32));
        $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        db()->prepare(
            'INSERT INTO anmeldelinks (epost, token_hash, code_hash, angelegt, gueltig_bis)
             VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? MINUTE))'
        )->execute([$epost, hash('sha256', $token), hash('sha256', $code), LINK_MINUTEN]);

        $link = 'https://www.bauzeuge.de/app/#/konto/' . $token;
        $text = "Hallo,\n\n"
            . "hier ist dein Anmeldelink für BauZeuge:\n\n"
            . $link . "\n\n"
            . "Am Telefon, wo der Link den Browser statt der App öffnet, gibst du "
            . "stattdessen diesen Code in der App ein:\n\n"
            . "    " . $code . "\n\n"
            . "Beides gilt " . LINK_MINUTEN . " Minuten und nur einmal.\n\n"
            . "Wenn du dich nicht anmelden wolltest, ist nichts passiert: Ohne "
            . "Link und ohne Code kommt niemand in dein Konto. Dann kannst du "
            . "diese Nachricht einfach löschen.\n\n"
            . "BauZeuge.de\n";

        $kopf = 'From: ' . ABSENDER . "\r\n"
            . "Content-Type: text/plain; charset=UTF-8\r\n"
            . 'Content-Transfer-Encoding: 8bit';
        @mail($epost, '=?UTF-8?B?' . base64_encode('Dein Anmeldelink für BauZeuge') . '?=', $text, $kopf);

        // Immer dieselbe Antwort. Ob es zu der Adresse ein Konto gibt, geht
        // niemanden etwas an, der nur das Formular ausfuellen kann.
        antwort(['gesendet' => true, 'minuten' => LINK_MINUTEN]);
    }

    case 'link_einloesen': {
        $token = (string)($eingang['token'] ?? '');
        if (!preg_match('/^[0-9a-f]{64}$/', $token)) {
            fehler(400, 'Dieser Anmeldelink ist unvollständig.');
        }
        linktabelle();

        $s = db()->prepare(
            'SELECT id, epost FROM anmeldelinks WHERE token_hash = ? AND gueltig_bis > NOW()'
        );
        $s->execute([hash('sha256', $token)]);
        $zeile = $s->fetch();
        if (!is_array($zeile)) {
            fehler(410, 'Dieser Anmeldelink gilt nicht mehr. Fordere einen neuen an.');
        }

        db()->prepare('DELETE FROM anmeldelinks WHERE id = ?')->execute([(int)$zeile['id']]);
        bremseLoeschen('link:' . $zeile['epost']);
        anmeldenPerPost((string)$zeile['epost']);
    }

    case 'code_einloesen': {
        $epost = strtolower(trim((string)($eingang['epost'] ?? '')));
        $code = preg_replace('/\D/', '', (string)($eingang['code'] ?? ''));
        linktabelle();

        $s = db()->prepare(
            'SELECT id, code_hash, versuche FROM anmeldelinks
              WHERE epost = ? AND gueltig_bis > NOW()'
        );
        $s->execute([$epost]);
        $zeile = $s->fetch();
        if (!is_array($zeile)) {
            fehler(410, 'Dieser Code gilt nicht mehr. Fordere einen neuen an.');
        }

        // Sechs Ziffern sind schnell durchprobiert. Nach fuenf Fehlgriffen
        // ist der Code verbrannt, nicht nur gebremst -- sonst waere die
        // Bremse nur eine Verlangsamung und kein Ende.
        if (!hash_equals((string)$zeile['code_hash'], hash('sha256', (string)$code))) {
            if ((int)$zeile['versuche'] + 1 >= CODE_VERSUCHE) {
                db()->prepare('DELETE FROM anmeldelinks WHERE id = ?')->execute([(int)$zeile['id']]);
                fehler(410, 'Zu viele Fehlversuche. Fordere einen neuen Code an.');
            }
            db()->prepare('UPDATE anmeldelinks SET versuche = versuche + 1 WHERE id = ?')
                ->execute([(int)$zeile['id']]);
            fehler(401, 'Dieser Code stimmt nicht.');
        }

        db()->prepare('DELETE FROM anmeldelinks WHERE id = ?')->execute([(int)$zeile['id']]);
        bremseLoeschen('link:' . $epost);
        anmeldenPerPost($epost);
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
        $hash = (string)$s->fetch()['passwort_hash'];

        // Wer sich per Anmeldelink angemeldet hat, hat kein Passwort. Er
        // bekommt hier sein erstes, ohne ein altes nennen zu koennen -- die
        // Sitzung stammt ohnehin aus seinem Postfach.
        if ($hash !== '' && !password_verify($alt, $hash)) {
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
        $hash = (string)$s->fetch()['passwort_hash'];

        if ($hash === '') {
            // Ohne Passwort taugt die eigene Adresse als Bestaetigung: Sie
            // abzutippen ist kein Schutz vor Fremden -- die Sitzung ist der
            // Schutz --, wohl aber vor dem eigenen Fehlgriff.
            $bestaetigung = strtolower(trim((string)($eingang['epost'] ?? '')));
            if ($bestaetigung !== strtolower((string)$n['epost'])) {
                fehler(401, 'Bitte deine E-Mail-Adresse zur Bestätigung eintragen.');
            }
        } elseif (!password_verify((string)($eingang['passwort'] ?? ''), $hash)) {
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
