"""Erzeugt App-Symbol, Startbild und die Symbole der Webfassung.

    python ressourcen/symbol.py

Schreibt ressourcen/icon.png und ressourcen/splash.png. Daraus macht
@capacitor/assets im CI die Android-Groessen. Ausserdem entstehen die
Symbole fuer das Web-App-Manifest direkt in www/. Das Motiv ist das Zeichen
von BauZeuge.de: ein Haus im Sucher auf dunklem Petrol (seit dem 13.11.2026),
damit man die App im Startmenue wiedererkennt.
"""
import pathlib
from PIL import Image, ImageDraw

HIER = pathlib.Path(__file__).parent
# Die Palette von BauZeuge.de, siehe www/stil.css.
PAPIER = (245, 247, 246)
TINTE = (31, 42, 48)
AKZENT = (14, 110, 114)
# Das Haus sitzt auf der dunklen Kachel; dort traegt der helle Akzent.
AKZENT_HELL = (95, 186, 189)


# Das Zeichen "Haus im Sucher" auf einem Raster von 64 Einheiten, wie im SVG:
# vier Winkel eines Suchers, darin das Haus. Der Zeuge schaut hin.
#
# Zwei Fassungen. "voll" mit Tuer fuer alles ab etwa 28 Bildpunkten; "klein"
# mit kraeftigeren Winkeln und ohne Tuer fuer Favicon und Knoepfe -- bei
# sechzehn Bildpunkten waere die Tuer ein einzelner dunkler Punkt.
WINKEL_VOLL = ([(13, 23), (13, 13), (23, 13)], [(41, 13), (51, 13), (51, 23)],
               [(51, 41), (51, 51), (41, 51)], [(23, 51), (13, 51), (13, 41)])
WINKEL_KLEIN = ([(12, 23), (12, 12), (23, 12)], [(41, 12), (52, 12), (52, 23)],
                [(52, 41), (52, 52), (41, 52)], [(23, 52), (12, 52), (12, 41)])
HAUS_VOLL = [(21, 34), (32, 24), (43, 34), (43, 44), (21, 44)]
HAUS_KLEIN = [(20, 35), (32, 24), (44, 35), (44, 46), (20, 46)]
TUER = (29, 37, 35, 44)


def zeichen(stift, mitte, raster, grund, klein=False, hell=PAPIER, haus=AKZENT_HELL):
    """Zeichnet das Zeichen. raster ist die Kante, auf die die 64 Einheiten
    gelegt werden; grund ist die Farbe dahinter (fuer die Tuer)."""
    mx, my = mitte
    s = raster / 64.0

    def p(x, y):
        return (mx + (x - 32) * s, my + (y - 32) * s)

    breite = (6.0 if klein else 4.5) * s
    r = breite / 2
    for zug in (WINKEL_KLEIN if klein else WINKEL_VOLL):
        punkte = [p(x, y) for x, y in zug]
        stift.line(punkte, fill=hell, width=max(1, round(breite)), joint='curve')
        # Runde Enden und eine runde Ecke: Pillow zeichnet Linien stumpf.
        for x, y in punkte:
            stift.ellipse([x - r, y - r, x + r, y + r], fill=hell)

    stift.polygon([p(x, y) for x, y in (HAUS_KLEIN if klein else HAUS_VOLL)], fill=haus)
    if not klein:
        (x0, y0), (x1, y1) = p(TUER[0], TUER[1]), p(TUER[2], TUER[3])
        stift.rectangle([x0, y0, x1, y1], fill=grund)


# Die Kachel traegt das dunkle Petrol der Marke.
KACHEL = (10, 81, 85)


def flaeche(kante: int, raster_anteil: float, klein: bool = False) -> Image.Image:
    """Volle Flaeche in der Kachelfarbe mit dem Zeichen in der Mitte.

    raster_anteil: Anteil der Kante, auf den die 64 Einheiten gelegt werden.
    1.0 fuellt die Flaeche wie im SVG. Zweifach gezeichnet und
    heruntergerechnet, das glaettet die Schraegen.
    """
    gross = kante * 2
    bild = Image.new("RGB", (gross, gross), KACHEL)
    zeichen(ImageDraw.Draw(bild), (gross / 2, gross / 2), gross * raster_anteil, KACHEL, klein=klein)
    return bild.resize((kante, kante), Image.LANCZOS)


WWW = HIER.parent / "www"


if __name__ == "__main__":
    # Android beschneidet adaptive Symbole kreisfoermig; sicher ist nur der
    # innere Kreis mit rund zwei Dritteln der Kante. Bei 0,78 liegen die
    # aeusseren Winkel des Suchers gerade noch darin.
    flaeche(1024, 0.78).save(HIER / "icon.png")
    print("  icon.png  1024x1024")
    # Startbild: dasselbe Zeichen klein auf grosser Flaeche.
    flaeche(2732, 0.36).save(HIER / "splash.png")
    print("  splash.png  2732x2732")

    # Symbole fuer die Webfassung.
    #
    # "any" wird gezeigt, wie es ist, deshalb darf das Zeichen die Flaeche
    # ausfuellen. "maskable" schneidet das Betriebssystem selbst zu, meist
    # kreisfoermig; deshalb dasselbe schmale Mass wie beim Android-Symbol.
    for kante, ziel, anteil in ((192, "symbol-192.png", 1.0), (512, "symbol-512.png", 1.0),
                                (512, "symbol-maskable-512.png", 0.78)):
        flaeche(kante, anteil).save(WWW / ziel)
        print(f"  www/{ziel}  {kante}x{kante}")
