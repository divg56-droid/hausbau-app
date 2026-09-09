"""Laedt die App und die Schnittstellen zu All-Inkl.

    python deploy.py                nur was sich geaendert hat
    python deploy.py --alles        alles, ohne Ruecksicht auf den Merkzettel
    python deploy.py --nur-web      nur www/
    python deploy.py --nur-api      nur server/
    python deploy.py --geheim       laedt zusaetzlich server/daten/geheim.php hoch
    python deploy.py --pruefen      laedt nichts, sieht nur nach was live ist

Ziel:
    www/     ->  www.bauzeuge.de/app/
    server/  ->  www.bauzeuge.de/app/api/

Die Astro-Seite deployt weiter unabhaengig in das Wurzelverzeichnis. Ihr
Deploy laedt hoch und loescht nichts, deshalb bleibt /app/ dabei unangetastet
und umgekehrt.

Zugangsdaten stehen in deploy.env neben dieser Datei. Die Datei ist
gitignored; dieselben Werte wie in der .env der Website - es ist derselbe
Server. Nach dem Domainumzug muessen dort FTP_HOST und FTP_DIR auf das
Verzeichnis von bauzeuge.de zeigen, sonst laedt das Skript weiter an die
alte Stelle.

Uebertragen wird mit curl statt mit ftplib. Grund steht in
dem Deploy-Workflow der Website: All-Inkl kappt bestimmten
FTPS-Klienten die Datenverbindung, curl macht die TLS-Sitzungswiederverwendung
richtig und ist gegen genau diesen Server erprobt.
"""
import hashlib
import io
import json
import os
import pathlib
import subprocess
import sys
import urllib.error
import urllib.request

HIER = pathlib.Path(__file__).parent
MERKZETTEL = HIER / ".deploy-stand.json"
# Nur fuer die Probe nach dem Hochladen und fuer die Meldungen.
DOMAIN = "www.bauzeuge.de"

# Was niemals hochgeht.
#
# geheim.php enthaelt die Zugangsdaten der Datenbank und geht nur mit
# --geheim. daten/bilder/ gehoert dem Server: Dort liegen die hochgeladenen
# Fotos der Nutzer, und ein Deploy darf sie unter keinen Umstaenden
# ueberschreiben oder auch nur anfassen.
NIEMALS = {
    "server/daten/geheim.php",      # nur mit --geheim
    "deploy.env",
    "deploy.env.beispiel",
}
NIEMALS_ORDNER = {
    "server/daten/bilder",
}


def env() -> dict:
    pfad = HIER / "deploy.env"
    if not pfad.is_file():
        raus(
            "deploy.env fehlt. Lege sie neben deploy.py an:\n\n"
            "    FTP_HOST=wXXXXXXX.kasserver.com\n"
            "    FTP_USER=fXXXXXXX\n"
            "    FTP_PASS=...\n"
            "    FTP_DIR=\n\n"
            "Dieselben Werte wie in hausbauatlas/.env. FTP_DIR nur setzen, wenn\n"
            "der FTP-Zugang NICHT auf das Verzeichnis der Domain beschraenkt ist."
        )
    werte = {}
    for zeile in io.open(pfad, encoding="utf-8"):
        zeile = zeile.strip()
        if not zeile or zeile.startswith("#") or "=" not in zeile:
            continue
        name, _, wert = zeile.partition("=")
        werte[name.strip()] = wert.strip()
    for pflicht in ("FTP_HOST", "FTP_USER", "FTP_PASS"):
        if not werte.get(pflicht):
            raus(f"{pflicht} fehlt in deploy.env.")
    return werte


def raus(text: str, code: int = 1):
    print(text, file=sys.stderr)
    raise SystemExit(code)


def dateien(mit_geheim: bool, nur: str | None) -> list[tuple[pathlib.Path, str]]:
    """Liefert Paare aus lokalem Pfad und Zielpfad unterhalb von /app/."""
    paare = []

    quellen = []
    if nur in (None, "web"):
        quellen.append((HIER / "www", ""))
    if nur in (None, "api"):
        quellen.append((HIER / "server", "api/"))

    for wurzel, praefix in quellen:
        if not wurzel.is_dir():
            continue
        for pfad in sorted(wurzel.rglob("*")):
            if not pfad.is_file():
                continue
            rel_projekt = pfad.relative_to(HIER).as_posix()

            if any(rel_projekt.startswith(o + "/") for o in NIEMALS_ORDNER):
                continue
            if rel_projekt in NIEMALS and not (
                mit_geheim and rel_projekt == "server/daten/geheim.php"
            ):
                continue
            # Die Vorlage und die Pruefskripte haben auf dem Server nichts zu suchen.
            if pfad.name in ("geheim.beispiel.php", "test_api.py"):
                continue

            ziel = praefix + pfad.relative_to(wurzel).as_posix()
            paare.append((pfad, ziel))

    # .htaccess zuerst: Das Verzeichnis daten/ muss gesperrt sein, bevor
    # irgendetwas Schuetzenswertes darin landet.
    paare.sort(key=lambda p: (not p[1].endswith(".htaccess"), p[1]))
    return paare


def stempel(pfad: pathlib.Path) -> str:
    h = hashlib.md5()
    h.update(pfad.read_bytes())
    return h.hexdigest()


def merkzettel_lesen() -> dict:
    if MERKZETTEL.is_file():
        try:
            return json.loads(MERKZETTEL.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass
    return {}


def hochladen(werte: dict, pfad: pathlib.Path, ziel: str) -> None:
    ordner = werte.get("FTP_DIR", "").strip()
    if ordner and not ordner.endswith("/"):
        ordner += "/"
    adresse = f"ftp://{werte['FTP_HOST']}/{ordner}app/{ziel}"

    ergebnis = subprocess.run(
        ["curl", "--silent", "--show-error", "--ssl-reqd", "--ftp-create-dirs",
         "--retry", "2", "--retry-delay", "3",
         "-T", str(pfad), adresse,
         "--user", f"{werte['FTP_USER']}:{werte['FTP_PASS']}"],
        capture_output=True, text=True,
    )
    if ergebnis.returncode != 0:
        # Die Fehlermeldung von curl kann die Adresse samt Benutzer enthalten,
        # aber nie das Passwort; trotzdem nur die erste Zeile zeigen.
        erste = (ergebnis.stderr or "").strip().splitlines()
        raus(f"Fehler bei {ziel}: {erste[0] if erste else ergebnis.returncode}")


def pruefen() -> bool:
    """Sieht nach, ob die App und die Schnittstelle wirklich antworten."""
    gut = True

    def hole(pfad: str, erwartet: int, was: str, suche: str | None = None):
        nonlocal gut
        adresse = f"https://{DOMAIN}{pfad}"
        try:
            with urllib.request.urlopen(adresse, timeout=20) as a:
                code, inhalt = a.status, a.read().decode("utf-8", "ignore")
        except urllib.error.HTTPError as e:
            code, inhalt = e.code, e.read().decode("utf-8", "ignore")
        except OSError as e:
            print(f"  FEHLER {was}: {e}")
            gut = False
            return
        ok = code == erwartet and (suche is None or suche in inhalt)
        print(f"  {'ok    ' if ok else 'FEHLER'} {was}: HTTP {code}")
        if not ok:
            gut = False

    print("Stichprobe live:")
    hole("/app/", 200, "App-Seite", "Bauzeuge")
    hole("/app/stil.css", 200, "Stylesheet")
    hole("/app/module/tagebuch.js", 200, "ein Modul")
    # GET auf konto.php muss 405 liefern. Das beweist, dass PHP laeuft und
    # _start.php geladen wurde, ohne die Datenbank anzufassen.
    hole("/app/api/konto.php", 405, "PHP antwortet")
    # Die Zugangsdaten duerfen unter keinen Umstaenden abrufbar sein.
    hole("/app/api/daten/geheim.php", 403, "geheim.php gesperrt")
    return gut


def main() -> None:
    argumente = set(sys.argv[1:])
    unbekannt = argumente - {"--alles", "--nur-web", "--nur-api", "--geheim", "--pruefen"}
    if unbekannt:
        raus("Unbekannte Angabe: " + ", ".join(sorted(unbekannt)))

    if "--pruefen" in argumente:
        raise SystemExit(0 if pruefen() else 1)

    nur = "web" if "--nur-web" in argumente else "api" if "--nur-api" in argumente else None
    mit_geheim = "--geheim" in argumente
    werte = env()

    paare = dateien(mit_geheim, nur)
    if not paare:
        raus("Nichts zu tun.")

    stand = {} if "--alles" in argumente else merkzettel_lesen()
    neuer_stand = dict(stand)

    offen = []
    for pfad, ziel in paare:
        s = stempel(pfad)
        neuer_stand[ziel] = s
        if stand.get(ziel) != s:
            offen.append((pfad, ziel, s))

    if not offen:
        print("Alles schon aktuell. Mit --alles trotzdem hochladen.")
        raise SystemExit(0)

    if mit_geheim:
        print("Achtung: geheim.php geht mit hoch.")

    print(f"{len(offen)} Datei(en) nach {DOMAIN}/app/")
    for pfad, ziel, _ in offen:
        hochladen(werte, pfad, ziel)
        print(f"  hoch  {ziel}")

    MERKZETTEL.write_text(json.dumps(neuer_stand, indent=1, sort_keys=True), encoding="utf-8")
    print(f"Fertig, {len(offen)} Datei(en).\n")

    if not pruefen():
        raus(
            "\nDie Stichprobe ist nicht sauber durchgelaufen. Beim ersten Mal ist das\n"
            "normal, solange server/daten/geheim.php noch fehlt oder einrichten.php\n"
            "noch nicht aufgerufen wurde."
        )


if __name__ == "__main__":
    main()
