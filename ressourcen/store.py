"""Erzeugt die Grafiken fuer den Eintrag im Play Store.

    python ressourcen/store.py

Schreibt nach ressourcen/play/:
    icon-512.png        App-Symbol, 512x512, ohne Transparenz
    feature-1024.png    Kopfgrafik, 1024x500

Die Schrift ist Archivo, die Hausschrift der Marke. Sie liegt im
Website-Projekt nebenan; hier eine zweite Kopie einzuchecken hiesse, zwei
Staende zu pflegen, von denen einer irgendwann der falsche ist. Fehlt das
Nachbarprojekt, sagt das Skript das und macht nichts.

Das Symbol kommt aus ressourcen/icon.png, also aus derselben Datei, aus der
auch das Symbol im Paket entsteht. Play verlangt 512x512 ohne Alphakanal --
transparente Stellen wuerden dort schwarz.
"""
import pathlib
import tempfile

from PIL import Image, ImageDraw, ImageFont

HIER = pathlib.Path(__file__).parent
WURZEL = HIER.parent
ZIEL = HIER / 'play'
NACHBAR = WURZEL.parent / 'hausbauatlas'

# Dieselbe Palette wie in www/stil.css und in der Website. Wer hier etwas
# aendert, aendert es dort mit -- test.mjs prueft die Werte der App.
TINTE = (31, 42, 48)
PAPIER = (245, 247, 246)
AKZENT = (14, 110, 114)
AKZENT_DUNKEL = (10, 81, 85)
AKZENT_HELL = (95, 186, 189)


def archivo(gewicht: int) -> pathlib.Path:
    """Archivo als TTF, umgewandelt aus dem Webfont des Website-Projekts."""
    from fontTools.ttLib import TTFont

    quelle = NACHBAR / 'node_modules/@fontsource/archivo/files' / (
        'archivo-latin-%d-normal.woff' % gewicht)
    if not quelle.is_file():
        raise SystemExit(
            'Archivo fehlt: %s\n'
            'Im Nachbarprojekt hausbauatlas einmal "npm install" laufen lassen.' % quelle)
    ziel = pathlib.Path(tempfile.gettempdir()) / ('archivo-%d.ttf' % gewicht)
    if not ziel.is_file():
        schrift = TTFont(str(quelle))
        schrift.flavor = None
        schrift.save(str(ziel))
    return ziel


def symbol() -> None:
    """512x512 aus der 1024er-Vorlage, auf undurchsichtig gelegt."""
    quelle = Image.open(WURZEL / 'ressourcen/icon.png').convert('RGBA')
    grund = Image.new('RGB', quelle.size, TINTE)
    grund.paste(quelle, (0, 0), quelle)
    grund.resize((512, 512), Image.LANCZOS).save(ZIEL / 'icon-512.png')
    print('  icon-512.png')


def kopfgrafik() -> None:
    """1024x500. Sie steht im Store ueber dem Eintrag, oft ohne Ton und ohne
    Zusammenhang -- also Wortmarke, ein Satz, sonst nichts."""
    breite, hoehe = 1024, 500
    bild = Image.new('RGB', (breite, hoehe), TINTE)
    stift = ImageDraw.Draw(bild)

    # Ein ruhiger Verlauf nach rechts unten, damit die Flaeche nicht wie ein
    # Fehler wirkt. Zeilenweise gezeichnet: Pillow kann keine Verlaeufe.
    for y in range(hoehe):
        anteil = y / hoehe
        farbe = tuple(
            round(TINTE[i] + (AKZENT_DUNKEL[i] - TINTE[i]) * anteil * 0.85)
            for i in range(3)
        )
        stift.line([(0, y), (breite, y)], fill=farbe)

    # Das Hauszeichen links, aus derselben Vorlage wie das App-Symbol.
    zeichen = Image.open(WURZEL / 'ressourcen/icon.png').convert('RGBA')
    kante = 190
    zeichen = zeichen.resize((kante, kante), Image.LANCZOS)
    maske = Image.new('L', (kante, kante), 0)
    ImageDraw.Draw(maske).rounded_rectangle([0, 0, kante - 1, kante - 1], radius=44, fill=255)
    bild.paste(zeichen, (78, (hoehe - kante) // 2), maske)

    fett = ImageFont.truetype(str(archivo(900)), 76)
    halb = ImageFont.truetype(str(archivo(700)), 30)

    satz = 'Dein Bau. Deine Zahlen. An einer Stelle.'
    abstand = 22

    # Aus den gemessenen Kaesten setzen, nicht aus geratenen Zahlen: Die
    # Oberlaenge von Archivo faengt nicht bei y an, und der Block sass
    # dadurch sichtbar zu hoch neben dem Zeichen.
    oben_marke = stift.textbbox((0, 0), 'BauZeuge', font=fett)
    oben_satz = stift.textbbox((0, 0), satz, font=halb)
    block = (oben_marke[3] - oben_marke[1]) + abstand + (oben_satz[3] - oben_satz[1])

    x = 78 + kante + 54
    y = (hoehe - block) // 2 - oben_marke[1]

    stift.text((x, y), 'Bau', font=fett, fill=PAPIER)
    stift.text((x + stift.textlength('Bau', font=fett), y), 'Zeuge',
               font=fett, fill=AKZENT_HELL)
    stift.text((x, y + oben_marke[3] + abstand - oben_satz[1]), satz,
               font=halb, fill=(168, 186, 192))

    bild.save(ZIEL / 'feature-1024.png')
    print('  feature-1024.png')


if __name__ == '__main__':
    ZIEL.mkdir(parents=True, exist_ok=True)
    print('Store-Grafiken nach ressourcen/play/:')
    symbol()
    kopfgrafik()
