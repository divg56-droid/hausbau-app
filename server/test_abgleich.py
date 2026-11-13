"""Prueft die Faelle, in denen der Abgleich bis zum 13.11.2026 etwas ausliess.

Wie test_api.py: gegen einen laufenden Testserver mit leerer Testdatenbank,
niemals gegen die Produktivdatenbank.

    php -S 127.0.0.1:8123 -t <Kopie von server/>
    python server/test_abgleich.py

Der Teil mit Anmeldelinks und gleichen Eingangsstempeln braucht einen Weg in
die Datenbank, weil die Mail mit dem Link hier nie ankommt. Dafuer steht in
der Umgebung BZ_MYSQL der Aufruf des Kommandozeilenprogramms samt
Zugangsdaten und Datenbankname, etwa
    BZ_MYSQL="mysql -uroot -ptest -P3399 -h127.0.0.1 bztest"
Ohne die Angabe wird dieser Teil uebersprungen.

Damit das Blaettern anspringt, sollte der Testserver mit einer kleinen
Portion laufen ('abgleich_portion' in seiner geheim.php, z. B. 5).
"""
import base64
import hashlib
import json
import os
import shlex
import subprocess
import urllib.error
import urllib.request
import uuid

BASIS = os.environ.get('BZ_BASIS', 'http://127.0.0.1:8123')
MYSQL = os.environ.get('BZ_MYSQL', '')
fehler = []

JPEG = base64.b64decode(
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a'
    'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA'
    'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==')


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
        except (json.JSONDecodeError, UnicodeDecodeError):
            return e.code, inhalt


def pruef(name, bedingung, zusatz=''):
    if bedingung:
        print('  ok   ' + name)
    else:
        print('  FEHL ' + name + '  ' + str(zusatz))
        fehler.append(name)


def sql(text):
    """Fuehrt eine Anweisung in der Testdatenbank aus und gibt die Zeilen zurueck."""
    aus = subprocess.run(shlex.split(MYSQL) + ['-N', '-B', '-e', text],
                         capture_output=True, text=True, encoding='utf-8')
    if aus.returncode != 0:
        raise RuntimeError(aus.stderr)
    return [z.split('\t') for z in aus.stdout.splitlines()]


def kennung():
    return str(uuid.uuid4())


def konto():
    """Frisches Konto mit Passwort, zwei Sitzungen."""
    epost = 'test-' + uuid.uuid4().hex[:10] + '@beispiel.de'
    code, a = ruf('/konto.php', {'tun': 'registrieren', 'epost': epost, 'passwort': 'einlangespasswort'})
    assert code == 200, a
    code, b = ruf('/konto.php', {'tun': 'anmelden', 'epost': epost, 'passwort': 'einlangespasswort'})
    assert code == 200, b
    return epost, a['marke'], b['marke']


def alles_holen(marke, seit=''):
    """Blaettert, bis der Server nichts mehr ankuendigt. Gibt Saetze, Stand und Runden."""
    gesammelt, runden = {}, 0
    while True:
        code, a = ruf('/abgleich.php', {'seit': seit, 'saetze': {}}, marke=marke)
        assert code == 200, a
        for speicher, liste in (a['saetze'] or {}).items():
            gesammelt.setdefault(speicher, []).extend(liste)
        runden += 1
        if a['stand']:
            assert a['stand'] >= seit, (a['stand'], seit)
            seit = a['stand']
        if not a['weitere'] or runden > 200:
            return gesammelt, seit, runden


def kontakt(geaendert, name='K'):
    return {'id': kennung(), 'name': name, 'art': 'firma', 'geaendert': geaendert, 'geloescht': False}


# ------------------------------------------------------------ spaet hochgeladen
print('Spaet hochgeladen')
_, handy, rechner = konto()

erster = kontakt('2026-10-01T10:00:00.000Z', 'Heute erfasst')
ruf('/abgleich.php', {'seit': '', 'saetze': {'kontakte': [erster]}}, marke=handy)
_, stand_rechner, _ = alles_holen(rechner)

# Am Vortag ohne Netz erfasst, erst jetzt hochgeladen: aelterer Zeitpunkt als
# alles, was der Rechner schon hat.
nachzuegler = kontakt('2026-09-15T08:00:00.000Z', 'Gestern ohne Netz erfasst')
ruf('/abgleich.php', {'seit': '', 'saetze': {'kontakte': [nachzuegler]}}, marke=handy)
neu, stand_rechner, _ = alles_holen(rechner, stand_rechner)
pruef('Der Nachzuegler kommt auf dem zweiten Geraet an',
      [k['id'] for k in neu.get('kontakte', [])] == [nachzuegler['id']], neu)

neu, stand_rechner, _ = alles_holen(rechner, stand_rechner)
pruef('Danach kommt nichts doppelt', not any(neu.values()), neu)

# Eine Geraeteuhr geht vor. Was danach mit richtiger Uhr geschrieben wird,
# darf nicht hinter diesem Stempel verschwinden.
zukunft = kontakt('2031-01-01T00:00:00.000Z', 'Uhr geht vor')
ruf('/abgleich.php', {'seit': '', 'saetze': {'kontakte': [zukunft]}}, marke=handy)
neu, stand_rechner, _ = alles_holen(rechner, stand_rechner)
pruef('Der Satz mit der falschen Uhr kommt an',
      [k['id'] for k in neu.get('kontakte', [])] == [zukunft['id']], neu)
danach = kontakt('2026-11-13T12:00:00.000Z', 'Nach der falschen Uhr')
ruf('/abgleich.php', {'seit': '', 'saetze': {'kontakte': [danach]}}, marke=handy)
neu, stand_rechner, _ = alles_holen(rechner, stand_rechner)
pruef('Und was danach geschrieben wird, auch',
      [k['id'] for k in neu.get('kontakte', [])] == [danach['id']], neu)

# Der aeltere Stand darf trotz neuem Eingang nicht gewinnen.
alt = dict(erster, name='ALT', geaendert='2026-08-01T00:00:00.000Z')
ruf('/abgleich.php', {'seit': '', 'saetze': {'kontakte': [alt]}}, marke=handy)
neu, stand_rechner, _ = alles_holen(rechner, stand_rechner)
pruef('Ein aelterer Stand loest keinen Nachschlag aus', not any(neu.values()), neu)
alle, _, _ = alles_holen(rechner)
pruef('Und ueberschreibt nichts',
      [k['name'] for k in alle['kontakte'] if k['id'] == erster['id']] == ['Heute erfasst'])

# ------------------------------------------------------------------- Blaettern
print('Blaettern ueber zwei Tabellen')
_, handy, rechner = konto()
kontakte = [kontakt('2026-10-02T10:%02d:00.000Z' % i, 'K%d' % i) for i in range(23)]
bilder = [{'id': kennung(), 'typ': 'image/jpeg', 'geaendert': '2026-10-02T11:%02d:00.000Z' % i,
           'geloescht': False} for i in range(17)]
code, a = ruf('/abgleich.php', {'seit': '', 'saetze': {'kontakte': kontakte, 'bilder': bilder}}, marke=handy)
pruef('Vierzig Saetze angenommen', code == 200 and a['angenommen'] == 40, a)

alle, _, runden = alles_holen(rechner)
pruef('Alle Kontakte kommen an',
      sorted(k['id'] for k in alle.get('kontakte', [])) == sorted(k['id'] for k in kontakte),
      len(alle.get('kontakte', [])))
pruef('Alle Bildangaben kommen an',
      sorted(b['id'] for b in alle.get('bilder', [])) == sorted(b['id'] for b in bilder),
      len(alle.get('bilder', [])))
pruef('Nichts kommt doppelt',
      len(alle.get('kontakte', [])) == 23 and len(alle.get('bilder', [])) == 17)
print('  --   %d Runde(n); bei kleiner Portion muessen es mehrere sein' % runden)

# ------------------------------------------------- Foto nach den Angaben oben
print('Foto kommt nach den Angaben')
_, handy, rechner = konto()
bild = kennung()
ruf('/abgleich.php', {'seit': '', 'saetze': {'bilder': [
    {'id': bild, 'typ': 'image/jpeg', 'geaendert': '2026-10-03T09:00:00.000Z', 'geloescht': False}]}},
    marke=handy)
alle, stand_rechner, _ = alles_holen(rechner)
pruef('Der Rechner kennt das Foto, aber noch ohne Datei',
      [b['groesse'] for b in alle.get('bilder', [])] == [0], alle)

code, a = ruf('/bild.php?id=' + bild, roh=JPEG, art='image/jpeg', marke=handy)
pruef('Datei abgelegt', code == 200 and a.get('abgelegt'), a)
neu, stand_rechner, _ = alles_holen(rechner, stand_rechner)
gemeldet = neu.get('bilder', [])
pruef('Der Rechner erfaehrt, dass die Datei jetzt da ist',
      len(gemeldet) == 1 and gemeldet[0]['id'] == bild and gemeldet[0]['groesse'] == len(JPEG), neu)
pruef('Der Zeitpunkt des Fotos bleibt dabei stehen',
      gemeldet and gemeldet[0]['geaendert'] == '2026-10-03T09:00:00.000Z', gemeldet)
code, datei = ruf('/bild.php?id=' + bild, marke=rechner, methode='GET')
pruef('Und kann sie holen', code == 200 and datei == JPEG, code)

# ------------------------------------------------------------- mit Datenbank
if not MYSQL:
    print('  --   BZ_MYSQL nicht gesetzt: Anmeldelink, Freigabe je Projekt und gleiche Stempel uebersprungen')
else:
    def link_fuer(epost):
        """Legt einen Anmeldelink an, wie konto.php es taete, und gibt den Klartext zurueck."""
        token = uuid.uuid4().hex + uuid.uuid4().hex
        sql("DELETE FROM anmeldelinks WHERE epost = '%s'" % epost)
        sql("INSERT INTO anmeldelinks (epost, token_hash, code_hash, angelegt, gueltig_bis) "
            "VALUES ('%s', '%s', '%s', NOW(), DATE_ADD(NOW(), INTERVAL 15 MINUTE))"
            % (epost, hashlib.sha256(token.encode()).hexdigest(), hashlib.sha256(b'000000').hexdigest()))
        return token

    print('Konto auf fremde Adresse')
    opfer = 'opfer-' + uuid.uuid4().hex[:10] + '@beispiel.de'
    code, fremder = ruf('/konto.php', {'tun': 'registrieren', 'epost': opfer, 'passwort': 'passwortdesfremden'})
    pruef('Ein Fremder kann das Konto anlegen', code == 200, fremder)
    code, eigner = ruf('/konto.php', {'tun': 'link_einloesen', 'token': link_fuer(opfer)})
    pruef('Der Inhaber kommt per Link hinein', code == 200 and eigner.get('marke'), eigner)
    code, _ = ruf('/konto.php', {'tun': 'wer'}, marke=fremder['marke'])
    pruef('Die Sitzung des Fremden ist danach beendet', code == 401, code)
    code, _ = ruf('/konto.php', {'tun': 'anmelden', 'epost': opfer, 'passwort': 'passwortdesfremden'})
    pruef('Und sein Passwort gilt nicht mehr', code == 401, code)
    code, wer = ruf('/konto.php', {'tun': 'wer'}, marke=eigner['marke'])
    pruef('Der Inhaber bleibt angemeldet', code == 200 and wer.get('per_post') is True, wer)

    print('Passwort vergessen')
    code, a = ruf('/konto.php', {'tun': 'passwort_aendern', 'alt': '', 'neu': 'meinerstespasswort'},
                  marke=eigner['marke'])
    pruef('Erstes Passwort ohne altes', code == 200, a)
    code, mit_pw = ruf('/konto.php', {'tun': 'anmelden', 'epost': opfer, 'passwort': 'meinerstespasswort'})
    pruef('Anmelden mit dem Passwort geht', code == 200, mit_pw)
    code, a = ruf('/konto.php', {'tun': 'passwort_aendern', 'alt': 'falsch', 'neu': 'wasanderes123'},
                  marke=mit_pw['marke'])
    pruef('Mit Passwort angemeldet braucht es das alte', code == 401, a)
    code, wer = ruf('/konto.php', {'tun': 'wer'}, marke=mit_pw['marke'])
    pruef('Diese Sitzung gilt nicht als per Post', wer.get('per_post') is False, wer)

    code, per_link = ruf('/konto.php', {'tun': 'link_einloesen', 'token': link_fuer(opfer)})
    pruef('Zweiter Link meldet an', code == 200, per_link)
    code, _ = ruf('/konto.php', {'tun': 'anmelden', 'epost': opfer, 'passwort': 'meinerstespasswort'})
    pruef('Ein bestaetigtes Konto behaelt sein Passwort beim Link', code == 200, code)
    code, a = ruf('/konto.php', {'tun': 'passwort_aendern', 'alt': '', 'neu': 'neuespasswort99'},
                  marke=per_link['marke'])
    pruef('Per Link angemeldet: neues Passwort ohne das alte', code == 200, a)
    code, _ = ruf('/konto.php', {'tun': 'anmelden', 'epost': opfer, 'passwort': 'neuespasswort99'})
    pruef('Das neue Passwort gilt', code == 200, code)
    code, _ = ruf('/konto.php', {'tun': 'anmelden', 'epost': opfer, 'passwort': 'meinerstespasswort'})
    pruef('Das alte nicht mehr', code == 401, code)

    print('Freigabe je Projekt')
    marke = per_link['marke']
    p1, p2 = kennung(), kennung()
    ruf('/abgleich.php', {'seit': '', 'saetze': {'tagebuch': [
        {'id': kennung(), 'projektId': p1, 'datum': '2026-10-05', 'gemacht': 'Bodenplatte Ahornweg',
         'temperatur': 0, 'geaendert': '2026-10-05T18:00:00.000Z', 'geloescht': False},
        {'id': kennung(), 'projektId': p2, 'datum': '2026-10-06', 'gemacht': 'Dachstuhl Birkenallee',
         'geaendert': '2026-10-06T18:00:00.000Z', 'geloescht': False},
        {'id': kennung(), 'datum': '2026-10-07', 'gemacht': 'Eintrag ohne Projekt',
         'geaendert': '2026-10-07T18:00:00.000Z', 'geloescht': False},
    ]}}, marke=marke)

    code, a = ruf('/freigabe.php', {'tun': 'anlegen', 'titel': 'Ahornweg', 'projektId': p1}, marke=marke)
    k = a['verweis'].split('k=')[-1]
    _, seite = ruf('/oeffentlich.php?k=' + k, methode='GET')
    text = seite.decode('utf-8') if isinstance(seite, bytes) else str(seite)
    pruef('Das eigene Projekt steht auf der Seite', 'Bodenplatte Ahornweg' in text)
    pruef('Das andere Projekt nicht', 'Dachstuhl Birkenallee' not in text)
    pruef('Der Eintrag ohne Projekt auch nicht', 'Eintrag ohne Projekt' not in text)
    pruef('Null Grad werden angezeigt', '0 °C' in text)

    code, a = ruf('/freigabe.php', {'tun': 'anlegen', 'titel': 'Erstes', 'projektId': 'projekt-1'}, marke=marke)
    _, seite = ruf('/oeffentlich.php?k=' + a['verweis'].split('k=')[-1], methode='GET')
    text = seite.decode('utf-8')
    pruef('Ohne projektId zaehlt ein Eintrag zum ersten Projekt',
          'Eintrag ohne Projekt' in text and 'Bodenplatte Ahornweg' not in text)

    code, a = ruf('/freigabe.php', {'tun': 'anlegen', 'titel': 'Alte App'}, marke=marke)
    _, seite = ruf('/oeffentlich.php?k=' + a['verweis'].split('k=')[-1], methode='GET')
    text = seite.decode('utf-8')
    pruef('Eine aeltere App ohne Projektangabe zeigt weiter alles',
          'Bodenplatte Ahornweg' in text and 'Dachstuhl Birkenallee' in text)

    print('Viele Saetze mit demselben Stempel')
    epost, handy, rechner = konto()
    viele = [kontakt('2026-10-08T10:00:00.000Z', 'G%d' % i) for i in range(18)]
    ruf('/abgleich.php', {'seit': '', 'saetze': {'kontakte': viele}}, marke=handy)
    # So sieht ein Altbestand aus, dessen Saetze alle denselben Zeitpunkt tragen.
    sql("UPDATE saetze s JOIN nutzer n ON n.id = s.nutzer_id SET s.eingang = '2026-10-08T10:00:00.000Z' "
        "WHERE n.epost = '%s'" % epost)
    alle, _, runden = alles_holen(rechner)
    pruef('Alle achtzehn kommen an, obwohl sie auf einem Stempel liegen',
          len(alle.get('kontakte', [])) == 18, len(alle.get('kontakte', [])))

print()
if fehler:
    print('FEHLGESCHLAGEN: %d' % len(fehler))
    raise SystemExit(1)
print('Alle Pruefungen bestanden.')
