"""Erzeugt App-Symbol, Startbild und die Symbole der Webfassung.

    python ressourcen/symbol.py

Schreibt ressourcen/icon.png und ressourcen/splash.png. Daraus macht
@capacitor/assets im CI die Android-Groessen. Ausserdem entstehen die
Symbole fuer das Web-App-Manifest direkt in www/. Das Motiv ist ein Haus mit
Giebel in Kranbau-Gelb auf dem Papierton der Website - dieselbe Marke wie
hausbauatlas.de, damit man die App im Startmenue wiedererkennt.
"""
import pathlib
from PIL import Image, ImageDraw

HIER = pathlib.Path(__file__).parent
# Die Palette von BauZeuge.de, siehe www/stil.css.
PAPIER = (245, 247, 246)
TINTE = (31, 42, 48)
AKZENT = (14, 110, 114)
# Der Giebel sitzt auf der dunklen Kachel; dort traegt der helle Akzent.
AKZENT_HELL = (95, 186, 189)


def haus(bild: Image.Image, mitte: tuple[int, int], groesse: int) -> None:
    """Zeichnet das Hauszeichen mittig, groesse ist die Breite der Fassade."""
    stift = ImageDraw.Draw(bild)
    mx, my = mitte
    b = groesse
    h = int(b * 0.62)          # Hoehe der Fassade
    dach = int(b * 0.46)       # Hoehe des Giebels
    strich = max(6, b // 14)

    oben = my - (h + dach) // 2
    links = mx - b // 2
    rechts = mx + b // 2
    unten = oben + dach + h

    # Giebel als gefuellte Flaeche, Fassade als Umriss: so bleibt das Zeichen
    # auch klein noch lesbar.
    stift.polygon(
        [(links - strich, oben + dach), (mx, oben), (rechts + strich, oben + dach)],
        fill=AKZENT_HELL,
    )
    stift.rectangle(
        [links, oben + dach, rechts, unten],
        outline=PAPIER, width=strich,
    )

    # Tuer
    tb = int(b * 0.26)
    th = int(h * 0.55)
    stift.rectangle(
        [mx - tb // 2, unten - th, mx + tb // 2, unten],
        fill=PAPIER,
    )


def symbol(kante: int, ziel: str, rand_faktor: float, hintergrund) -> None:
    bild = Image.new("RGB", (kante, kante), hintergrund)
    haus(bild, (kante // 2, kante // 2), int(kante * rand_faktor))
    bild.save(HIER / ziel)
    print(f"  {ziel}  {kante}x{kante}")


WWW = HIER.parent / "www"


def websymbol(kante: int, ziel: str, rand_faktor: float) -> None:
    """Symbol fuer das Web-App-Manifest, direkt nach www/."""
    bild = Image.new("RGB", (kante, kante), TINTE)
    haus(bild, (kante // 2, kante // 2), int(kante * rand_faktor))
    bild.save(WWW / ziel)
    print(f"  www/{ziel}  {kante}x{kante}")


if __name__ == "__main__":
    # Android beschneidet adaptive Symbole kreisfoermig; deshalb nur 52 Prozent
    # der Kante belegen, sonst wird der Giebel abgeschnitten.
    symbol(1024, "icon.png", 0.52, TINTE)
    # Startbild: dasselbe Zeichen klein auf grosser Flaeche.
    splash = Image.new("RGB", (2732, 2732), TINTE)
    haus(splash, (1366, 1366), 620)
    splash.save(HIER / "splash.png")
    print("  splash.png  2732x2732")

    # Symbole fuer die Webfassung.
    #
    # "any" wird gezeigt, wie es ist, deshalb darf das Zeichen die Flaeche
    # gut ausfuellen. "maskable" schneidet das Betriebssystem selbst zu,
    # meist kreisfoermig; sicher ist dort nur der innere Kreis mit achtzig
    # Prozent der Kante. Deshalb dasselbe schmale Mass wie beim Android-Symbol.
    websymbol(192, "symbol-192.png", 0.70)
    websymbol(512, "symbol-512.png", 0.70)
    websymbol(512, "symbol-maskable-512.png", 0.52)
