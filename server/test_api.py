"""Prueft Konto, Abgleich und Bildablage gegen einen laufenden Server.

Braucht eine leere Testdatenbank und den PHP-Server davor:

    php -S 127.0.0.1:8123 -t server/
    python server/test_api.py

Das Konto andreas@beispiel.de mit dem Passwort einlangespasswort muss
vorhanden sein; sonst legt der erste Aufruf es an. Niemals gegen die
Produktivdatenbank laufen lassen - das Skript schreibt Testsaetze.
"""
import json
import urllib.request
import urllib.error

BASIS = 'http://127.0.0.1:8123'
fehler = []


def ruf(pfad, daten=None, marke=None, roh=None, art='application/json', methode=None):
    kopf = {}
    if marke:
        kopf['X-Hausbau-Marke'] = marke
    if roh is not None:
        rumpf, kopf['Content-Type'] = roh, art
    elif daten is not None:
        rumpf, kopf['Content-Type'] = json.dumps(daten).encode(), 'application/json'
    else:
        rumpf = None
    anfrage = urllib.request.Request(BASIS + pfad, data=rumpf, headers=kopf, method=methode)
    try:
        with urllib.request.urlopen(anfrage) as a:
            inhalt = a.read()
            try:
                return a.status, json.loads(inhalt)
            except (json.JSONDecodeError, UnicodeDecodeError):
                return a.status, inhalt
    except urllib.error.HTTPError as e:
        inhalt = e.read()
        try:
            return e.code, json.loads(inhalt)
        except json.JSONDecodeError:
            return e.code, inhalt


def pruef(name, bedingung, zusatz=''):
    if bedingung:
        print('  ok   ' + name)
    else:
        print('  FEHL ' + name + '  ' + str(zusatz))
        fehler.append(name)


# Zwei Geraete, ein Konto
_, a = ruf('/konto.php', {'tun': 'anmelden', 'epost': 'andreas@beispiel.de',
                          'passwort': 'einlangespasswort'})
handy = a['marke']
_, a = ruf('/konto.php', {'tun': 'anmelden', 'epost': 'andreas@beispiel.de',
                          'passwort': 'einlangespasswort'})
rechner = a['marke']

print('Abgleich')

# Handy schiebt zwei Saetze hoch
code, a = ruf('/abgleich.php', {
    'seit': '',
    'saetze': {
        'kontakte': [
            {'id': 'aaaaaaaa-1111-4111-8111-111111111111', 'name': 'Elektro Meier',
             'art': 'firma', 'geaendert': '2026-09-01T10:00:00.000Z', 'geloescht': False},
        ],
        'maengel': [
            {'id': 'bbbbbbbb-2222-4222-8222-222222222222', 'titel': 'Kratzer',
             'kontaktId': 'aaaaaaaa-1111-4111-8111-111111111111',
             'geaendert': '2026-09-01T10:05:00.000Z', 'geloescht': False},
        ],
    }}, marke=handy)
pruef('Hochschieben angenommen', code == 200 and a['angenommen'] == 2, a)
pruef('eigene Saetze kommen sofort zurueck', len(a['saetze'].get('kontakte', [])) == 1)
stand_handy = a['stand']

# Rechner holt alles ab
code, b = ruf('/abgleich.php', {'seit': '', 'saetze': {}}, marke=rechner)
pruef('Rechner bekommt beide Saetze',
      len(b['saetze'].get('kontakte', [])) == 1 and len(b['saetze'].get('maengel', [])) == 1, b)
pruef('Verweis kam unveraendert an',
      b['saetze']['maengel'][0]['kontaktId'] == 'aaaaaaaa-1111-4111-8111-111111111111')
stand_rechner = b['stand']

# Nichts Neues seit dem letzten Mal
code, c = ruf('/abgleich.php', {'seit': stand_rechner, 'saetze': {}}, marke=rechner)
pruef('kein Nachschlag ohne Aenderung', c['saetze'] == {} or all(not v for v in c['saetze'].values()), c['saetze'])

# Rechner aendert den Mangel, Handy holt ihn
ruf('/abgleich.php', {'seit': stand_rechner, 'saetze': {'maengel': [
    {'id': 'bbbbbbbb-2222-4222-8222-222222222222', 'titel': 'Kratzer, tiefer als gedacht',
     'kontaktId': 'aaaaaaaa-1111-4111-8111-111111111111',
     'geaendert': '2026-09-02T08:00:00.000Z', 'geloescht': False}]}}, marke=rechner)
code, d = ruf('/abgleich.php', {'seit': stand_handy, 'saetze': {}}, marke=handy)
pruef('Handy bekommt die Aenderung',
      d['saetze']['maengel'][0]['titel'] == 'Kratzer, tiefer als gedacht', d['saetze'])

# Konfliktregel: aelterer Stand darf nicht gewinnen
ruf('/abgleich.php', {'seit': '', 'saetze': {'maengel': [
    {'id': 'bbbbbbbb-2222-4222-8222-222222222222', 'titel': 'ALT, darf nicht gewinnen',
     'geaendert': '2026-08-01T00:00:00.000Z', 'geloescht': False}]}}, marke=handy)
code, e = ruf('/abgleich.php', {'seit': '', 'saetze': {}}, marke=rechner)
titel = [m['titel'] for m in e['saetze']['maengel']][0]
pruef('aelterer Stand ueberschreibt nicht', titel == 'Kratzer, tiefer als gedacht', titel)

# Grabstein
ruf('/abgleich.php', {'seit': '', 'saetze': {'maengel': [
    {'id': 'bbbbbbbb-2222-4222-8222-222222222222',
     'geaendert': '2026-09-03T09:00:00.000Z', 'geloescht': True}]}}, marke=handy)
code, f = ruf('/abgleich.php', {'seit': '', 'saetze': {}}, marke=rechner)
grab = [m for m in f['saetze']['maengel'] if m['id'] == 'bbbbbbbb-2222-4222-8222-222222222222'][0]
pruef('Grabstein kommt an', grab.get('geloescht') is True, grab)
pruef('Grabstein traegt keinen Inhalt', 'titel' not in grab, grab)

# Fremde Daten bleiben fremd
_, g = ruf('/konto.php', {'tun': 'registrieren', 'epost': 'fremd@beispiel.de',
                          'passwort': 'ebenfallanggenug'})
code, h = ruf('/abgleich.php', {'seit': '', 'saetze': {}}, marke=g['marke'])
pruef('fremdes Konto sieht nichts', all(not v for v in h['saetze'].values()) if h['saetze'] else True, h['saetze'])

# Unbekannter Speichername wird verworfen
code, i = ruf('/abgleich.php', {'seit': '', 'saetze': {
    'boesartig': [{'id': 'cccccccc-3333-4333-8333-333333333333',
                   'geaendert': '2026-09-04T00:00:00.000Z'}]}}, marke=handy)
pruef('unbekannter Speicher wird ignoriert', i['angenommen'] == 0, i)

print('Bilder')
KENNUNG = 'dddddddd-4444-4444-8444-444444444444'
# Ein winziges gueltiges JPEG
import base64
JPEG = base64.b64decode(
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a'
    'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA'
    'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==')

code, a = ruf('/bild.php?id=' + KENNUNG, roh=JPEG, art='image/jpeg', marke=handy)
pruef('Bild hochgeladen', code == 200 and a.get('abgelegt') is True, a)
pruef('Art selbst erkannt', a.get('typ') == 'image/jpeg', a)

code, inhalt = ruf('/bild.php?id=' + KENNUNG, marke=handy)
pruef('Bild kommt zurueck', code == 200 and inhalt == JPEG, code)

code, _ = ruf('/bild.php?id=' + KENNUNG, marke=g['marke'])
pruef('fremdes Konto bekommt das Bild nicht', code == 404, code)

code, _ = ruf('/bild.php?id=../../geheim', marke=handy)
pruef('Pfadtrick wird abgewiesen', code == 400, code)

code, a = ruf('/bild.php?id=eeeeeeee-5555-4555-8555-555555555555',
              roh=b'kein bild sondern text', art='image/jpeg', marke=handy)
pruef('Nichtbild wird abgewiesen', code == 415, code)

code, _ = ruf('/bild.php?id=' + KENNUNG)
pruef('ohne Anmeldung kein Bild', code == 401, code)

code, a = ruf('/abgleich.php', {'seit': '', 'saetze': {}}, marke=handy)
bilder = a['saetze'].get('bilder', [])
pruef('Bildangaben kommen ueber den Abgleich', any(x['id'] == KENNUNG for x in bilder), bilder)
pruef('Groesse ist vermerkt', any(x['id'] == KENNUNG and x['groesse'] == len(JPEG) for x in bilder), bilder)

# ----------------------------------------------------------- Angebote im Abgleich

# Der Speicher "angebote" ist neu. Fehlte er in der Freigabeliste des Servers,
# wuerde er stillschweigend verworfen: der Abgleich meldete Erfolg, und die
# Angebote waeren auf dem zweiten Geraet einfach nicht da.
ANGEBOT = 'a1b2c3d4-1111-4111-8111-111111111111'
code, a = ruf('/abgleich.php', {'seit': '', 'saetze': {'angebote': [{
    'id': ANGEBOT, 'geaendert': '2026-09-09T09:00:00.000Z', 'geloescht': False,
    'postenId': None, 'firma': 'Meyer Bau GmbH', 'betrag': 192000,
    'datum': '2026-04-02', 'status': 'beauftragt',
}]}}, marke=handy)
pruef('Angebot wird angenommen', code == 200 and a.get('angenommen', 0) >= 1, a)

code, a = ruf('/abgleich.php', {'seit': '', 'saetze': {}}, marke=rechner)
angebote = a['saetze'].get('angebote', [])
pruef('Angebot kommt am zweiten Geraet an',
      any(x['id'] == ANGEBOT for x in angebote), angebote)
pruef('Der Betrag ueberlebt die Runde',
      any(x['id'] == ANGEBOT and x.get('betrag') == 192000 for x in angebote), angebote)

code, a = ruf('/abgleich.php', {'seit': '', 'saetze': {'erfundenes': [{
    'id': 'ffffffff-1111-4111-8111-111111111111',
    'geaendert': '2026-09-09T09:00:00.000Z',
}]}}, marke=handy)
pruef('Unbekannter Speicher wird still verworfen',
      code == 200 and 'erfundenes' not in a['saetze'], a)

# ------------------------------------------------------- Oeffentliches Tagebuch

TAG = 'bbbbbbbb-2222-4222-8222-222222222222'
ruf('/abgleich.php', {'seit': '', 'saetze': {'tagebuch': [{
    'id': TAG, 'geaendert': '2026-09-09T09:10:00.000Z', 'geloescht': False,
    'datum': '2026-08-21', 'wetter': 'regen', 'temperatur': '14',
    'gemacht': 'Nur Aufräumarbeiten wegen Regen.',
    'offen': 'Mauerwerk Obergeschoss wartet',
    'helfer': [{'id': 'cccccccc-3333-4333-8333-333333333333', 'stunden': 6}],
    'bildIds': [KENNUNG],
}]}}, marke=handy)

code, a = ruf('/freigabe.php', {'tun': 'stand'}, marke=handy)
pruef('Ohne Freigabe meldet der Stand nein', code == 200 and a.get('frei') is False, a)

code, _ = ruf('/freigabe.php', {'tun': 'stand'})
pruef('Freigabe braucht eine Anmeldung', code == 401, code)

code, a = ruf('/freigabe.php', {'tun': 'anlegen', 'titel': 'Unser Hausbau'}, marke=handy)
pruef('Freigabe wird angelegt', code == 200 and a.get('frei') is True, a)
verweis = a.get('verweis', '')
pruef('Der Verweis nennt oeffentlich.php', 'oeffentlich.php?k=' in verweis, verweis)
marke_oeff = verweis.split('k=')[-1]
pruef('Die Marke ist lang genug zum Raten', len(marke_oeff) >= 32, len(marke_oeff))

code, a = ruf('/freigabe.php', {'tun': 'stand'}, marke=handy)
pruef('Der Stand kennt die Freigabe jetzt', a.get('frei') is True and a.get('titel') == 'Unser Hausbau', a)

# Die Seite selbst, ohne jede Anmeldung.
code, seite = ruf('/oeffentlich.php?k=' + marke_oeff, methode='GET')
text = seite.decode('utf-8', 'replace') if isinstance(seite, bytes) else str(seite)
pruef('Die Seite ist ohne Anmeldung lesbar', code == 200, code)
pruef('Der Titel steht drin', 'Unser Hausbau' in text)
pruef('Das Datum steht drin', '21.08.2026' in text)
pruef('Was gemacht wurde, steht drin', 'Aufräumarbeiten' in text)
pruef('Das Wetter steht drin', 'Regen' in text)

# Das Wichtigste: was NICHT hinausgehen darf.
pruef('Liegengebliebenes bleibt drin', 'Mauerwerk Obergeschoss wartet' not in text)
pruef('Helferkennungen bleiben drin', 'cccccccc-3333' not in text)
pruef('Die Stundenzahl steht nicht auf der Seite', '6 h' not in text)
pruef('Die Seite verbietet die Aufnahme in Suchmaschinen', 'noindex' in text)

# Das Bild aus dem Eintrag muss kommen, ein fremdes nicht.
code, bild = ruf('/oeffentlich.php?k=' + marke_oeff + '&bild=' + KENNUNG, methode='GET')
pruef('Bild des Eintrags wird ausgeliefert', code == 200 and bild == JPEG, code)

FREMD = 'dddddddd-4444-4444-8444-444444444444'
ruf('/bild.php?id=' + FREMD, roh=JPEG, art='image/jpeg', marke=handy)
code, _ = ruf('/oeffentlich.php?k=' + marke_oeff + '&bild=' + FREMD, methode='GET')
pruef('Bild ohne Tagebuchbezug wird nicht ausgeliefert', code == 404, code)

code, _ = ruf('/oeffentlich.php?k=' + '0' * 48, methode='GET')
pruef('Falsche Marke fuehrt ins Leere', code == 404, code)

code, _ = ruf('/oeffentlich.php?k=nicht-hexadezimal', methode='GET')
pruef('Unsinnige Marke wird abgewiesen', code == 404, code)

# Nur eine Freigabe je Konto: die neue loest die alte ab.
code, a = ruf('/freigabe.php', {'tun': 'anlegen', 'titel': 'Zweiter Anlauf'}, marke=handy)
zweiter = a['verweis'].split('k=')[-1]
pruef('Der neue Verweis ist ein anderer', zweiter != marke_oeff)
code, _ = ruf('/oeffentlich.php?k=' + marke_oeff, methode='GET')
pruef('Der alte Verweis gilt nicht mehr', code == 404, code)

code, a = ruf('/freigabe.php', {'tun': 'aufheben'}, marke=handy)
pruef('Freigabe laesst sich aufheben', code == 200 and a.get('frei') is False, a)
code, _ = ruf('/oeffentlich.php?k=' + zweiter, methode='GET')
pruef('Nach dem Aufheben ist nichts mehr zu sehen', code == 404, code)


print('\nFEHLGESCHLAGEN: ' + str(len(fehler)) if fehler else '\nAlle Pruefungen bestanden.')
raise SystemExit(1 if fehler else 0)
