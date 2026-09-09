"""Traegt die Datenbank-Zugangsdaten in server/daten/geheim.php ein.

    python zugangsdaten.py

Fragt im Terminal nach den drei Werten aus KAS und schreibt sie in die
richtige Datei. Nimmt einem das Suchen im Editor ab und kann die
Anfuehrungszeichen nicht kaputt machen.

Die Eingaben erscheinen nur im eigenen Terminal und landen in einer Datei,
die nicht ins Repository geht.
"""
import io
import pathlib
import re
import secrets
import sys

HIER = pathlib.Path(__file__).parent
ZIEL = HIER / "server" / "daten" / "geheim.php"
VORLAGE = HIER / "server" / "daten" / "geheim.beispiel.php"


def feld_setzen(text: str, name: str, wert: str) -> str:
    """Ersetzt 'name' => '...' durch den neuen Wert."""
    # Einfache Anfuehrungszeichen im Wert maskieren, sonst zerreisst es die
    # PHP-Datei. Bei Passwoertern kommt das durchaus vor.
    sicher = wert.replace("\\", "\\\\").replace("'", "\\'")
    muster = re.compile(r"('" + re.escape(name) + r"'\s*=>\s*)'[^']*'")
    neu, anzahl = muster.subn(lambda m: m.group(1) + "'" + sicher + "'", text, count=1)
    if anzahl == 0:
        raise SystemExit(f"Feld {name} steht nicht in der Datei.")
    return neu


def main() -> None:
    if not ZIEL.is_file():
        if not VORLAGE.is_file():
            raise SystemExit("Weder geheim.php noch die Vorlage gefunden.")
        ZIEL.write_text(VORLAGE.read_text(encoding="utf-8"), encoding="utf-8")
        print("geheim.php aus der Vorlage angelegt.")

    text = io.open(ZIEL, encoding="utf-8").read()

    print("Zugangsdaten der Datenbank, zu finden in KAS unter Datenbanken.")
    print("Bei All-Inkl sind Name und Benutzer derselbe Wert, etwa d0123456.")
    print("Leer lassen und Enter druecken behaelt den bisherigen Wert.\n")

    bisher = dict(re.findall(r"'([a-z_]+)'\s*=>\s*'([^']*)'", text))

    name = input("Datenbankname   : ").strip() or bisher.get("db_name", "")
    if not name:
        raise SystemExit("Ohne Datenbanknamen geht es nicht.")

    nutzer = input(f"Benutzer        [{name}]: ").strip() or name

    # Sichtbar, nicht verdeckt. Ein verdecktes Feld zeigt beim Einfuegen
    # nicht, ob etwas angekommen ist - genau daran ist es beim ersten Mal
    # gescheitert. Die Datei liegt ohnehin lokal und ist gitignored.
    passwort = input("Passwort        : ").strip()
    if not passwort:
        passwort = bisher.get("db_passwort", "")
    if not passwort:
        raise SystemExit("Ohne Passwort geht es nicht.")

    text = feld_setzen(text, "db_name", name)
    text = feld_setzen(text, "db_nutzer", nutzer)
    text = feld_setzen(text, "db_passwort", passwort)

    # Falls der Einrichtungsschluessel noch fehlt, jetzt einen erzeugen.
    if not bisher.get("einrichten_schluessel"):
        text = feld_setzen(text, "einrichten_schluessel", secrets.token_urlsafe(24))

    io.open(ZIEL, "w", encoding="utf-8", newline="\n").write(text)

    # Nachlesen und bestaetigen, ohne die Werte zu zeigen.
    kontrolle = dict(re.findall(r"'([a-z_]+)'\s*=>\s*'([^']*)'", ZIEL.read_text(encoding="utf-8")))
    print("\nGespeichert in", ZIEL)
    for f in ("db_name", "db_nutzer", "db_passwort", "einrichten_schluessel"):
        w = kontrolle.get(f, "")
        print(f"  {f}: {'gefuellt (' + str(len(w)) + ' Zeichen)' if w else 'LEER'}")

    if all(kontrolle.get(f) for f in ("db_name", "db_nutzer", "db_passwort")):
        print("\nAlles da. Weiter mit:")
        print("  python deploy.py && python deploy.py --geheim")
    else:
        print("\nEs fehlt noch etwas. Skript einfach nochmal laufen lassen.")
        sys.exit(1)


if __name__ == "__main__":
    main()
