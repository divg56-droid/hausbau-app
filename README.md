# Hausbau App

Android-App für Bauherren: die Rechner von hausbauatlas.de plus die Werkzeuge,
die man auf der Baustelle braucht. Alle Daten bleiben auf dem Gerät.

Testversion, unsigniert. Nicht im Play Store.

## Das APK bekommen

Nach jedem Push auf `main` baut GitHub das Paket und hängt es an die
Veröffentlichung `test`:

    https://github.com/<konto>/hausbau-app/releases/tag/test

Auf dem Telefon herunterladen und öffnen. Android fragt beim ersten Mal nach
der Erlaubnis, Apps aus unbekannten Quellen zu installieren; diese Erlaubnis
gilt dem Browser, nicht der App.

Ohne GitHub-Konto ist das APK auch unter Actions → letzter Lauf → Artifacts zu
finden, dort allerdings nur nach Anmeldung.

## Die zehn Bereiche

| Bereich | Was er tut |
|---|---|
| Baukostenrechner | Bausumme aus Bundesland, Fläche, Standard, Keller, Grundstück |
| Baufinanzierung | Eigenkapital und Darlehen erfassen, oder erst rechnen lassen |
| Tilgungsverlauf | Restschuld Jahr für Jahr, mit Sondertilgung, als PDF |
| Baukasse | Budget, Kostenaufstellung geplant gegen tatsächlich, Rechnungen |
| Räume | Jeder Raum mit Fotos, Mängeln, Fläche und Kosten je m² |
| Anschlussplan | Grundriss hochladen, Anschlüsse markieren, als PDF mit Plan |
| Mängelliste | Mängel je Raum mit Foto und Status, als PDF und als Mängelrüge |
| Bauablauf | Gewerke in der richtigen Reihenfolge, Termine rechnen sich |
| Bauhelfertagebuch | Tageseinträge mit Fotos, Helferstunden und Wetter vom DWD |
| Kontakte | Firmen und Helfer, von den anderen Bereichen verlinkt |
| Einstellungen | Projektname, Sicherung, alles löschen |

Die Bereiche hängen zusammen: Die Baukasse zieht ihr Budget aus der
Baufinanzierung, der Tilgungsverlauf lädt dort die Darlehen, aus einem Mangel
wird auf Wunsch eine Aufgabe im Bauablauf, und Mängel wie Aufgaben zeigen auf
dieselben Kontakte.

## Aufbau

Reines HTML, CSS und JavaScript ohne Bundler. Capacitor verpackt den Ordner
`www/` in eine Android-App, mehr passiert nicht.

    www/
      index.html      Gehäuse: Kopfzeile und Platz für den Inhalt
      app.js          Navigation über den Adress-Anker, Startseite
      daten.js        IndexedDB, Bilder verkleinern und ablegen
      hilfen.js       Formate, Formularbausteine, Elementbau
      blatt.js        Eingabeblatt von unten
      fotos.js        Fotoaufnahme über ein Dateifeld
      pdf.js          PDF-Schreiber und Weitergabe ans Telefon
      stil.css        alles Sichtbare
      module/*.js     die zehn Bereiche, je eine Datei
    ressourcen/       App-Symbol und Startbild samt Erzeuger
    test.mjs          prüft die Rechenkerne

Ein Modul liefert `zeige(rahmen)` und hängt seinen Inhalt dort ein. Geladen
wird es erst beim Öffnen.

### Warum ohne Bundler

Die Rechner stammen aus den `.astro`-Dateien von hausbauatlas.de und konnten
fast unverändert übernommen werden. Ein Bauschritt hätte nur eine weitere
Stelle geschaffen, an der etwas kaputtgeht. Capacitor-Erweiterungen liegen
zur Laufzeit unter `Capacitor.Plugins`, deshalb gibt es im Quelltext keine
Einfuhr von `@capacitor/...`.

## Server und Abgleich

Die App laeuft doppelt: als APK und als Website unter derselben Adresse.

    hausbauatlas.de/             Astro-Seite, Ratgeber, Rechner
    hausbauatlas.de/app/         dieselbe App wie im APK
    hausbauatlas.de/app/api/     PHP fuer Konto und Abgleich

Im Quelltext steht kein absoluter Pfad, und die Navigation laeuft ueber den
Adress-Anker. Deshalb laeuft derselbe Ordner `www/` unveraendert im Paket wie
unter einem Unterpfad.

### Hochladen

    python deploy.py             nur was sich geaendert hat
    python deploy.py --alles     alles neu
    python deploy.py --nur-web   nur www/
    python deploy.py --nur-api   nur server/
    python deploy.py --geheim    zusaetzlich server/daten/geheim.php
    python deploy.py --pruefen   nur nachsehen, was live ist

Zugangsdaten in `deploy.env`, Vorlage daneben. Dieselben Werte wie in
`hausbauatlas/.env`, es ist derselbe Server.

Zwei Dinge gehen nie von allein hoch: `server/daten/geheim.php` mit den
Zugangsdaten der Datenbank, und `server/daten/bilder/` mit den hochgeladenen
Fotos. Die gehoeren dem Server, ein Deploy darf sie nicht anfassen.

Nach dem Hochladen prueft das Skript von selbst, ob die App antwortet, ob PHP
laeuft und ob `geheim.php` gesperrt ist.

### Einmalig einrichten

1. `server/daten/geheim.beispiel.php` als `geheim.php` kopieren und ausfuellen
2. `python deploy.py` und danach `python deploy.py --geheim`
3. `https://hausbauatlas.de/app/api/einrichten.php?schluessel=...` einmal aufrufen

Der dritte Schritt legt die Tabellen an und laesst sich gefahrlos wiederholen.

### Wie der Abgleich funktioniert

Ein Aufruf schickt, was sich auf dem Geraet geaendert hat, und bekommt
zurueck, was sich auf dem Server geaendert hat. Je Datensatz gewinnt der
neuere Zeitpunkt.

Alle Sachdaten liegen serverseitig in einer Tabelle als JSON, daneben Kennung,
Zeitpunkt und Loeschmarke als Spalten. Eine Tabelle je Bereich hiesse: jedes
neue Feld in der App zieht eine Wanderung auf dem Server nach sich.

Fotos laufen ueber eine eigene Schnittstelle und liegen als Dateien neben der
Datenbank, in einem per `.htaccess` gesperrten Verzeichnis. Ausgeliefert
werden sie nur ueber `bild.php`, und nur an den Eigentuemer.

Die Anmeldung laeuft ueber eine Marke im Anfragekopf statt ueber ein
Plaetzchen: Die App laeuft unter der Herkunft `https://localhost` und spricht
mit hausbauatlas.de; ein Plaetzchen waere dort fremd. In der Datenbank steht
die Marke nur als Pruefsumme.

    python server/test_api.py    20 Pruefungen gegen einen laufenden Server

## Entwickeln

    npm install
    npm start        # http://localhost:4300
    node test.mjs    # Rechenkerne gegen die Werte der Website prüfen

Das APK lokal zu bauen braucht JDK 21 und das Android-SDK:

    npm run apk

Ohne beides baut GitHub. Der Ordner `android/` steht bewusst nicht im
Repository, er entsteht bei jedem Lauf neu aus `capacitor.config.json`.

## Datensätze und der spätere Abgleich

Jeder Datensatz trägt drei Felder, die für den Abgleich mit einem Server
gebraucht werden:

| Feld | Wozu |
|---|---|
| `id` | weltweit eindeutige Kennung (UUID) |
| `geaendert` | Zeitpunkt der letzten Änderung |
| `geloescht` | Grabstein statt echtem Löschen |

Warum nicht die einfache laufende Nummer: Die zählt jedes Gerät für sich hoch.
Handy und Rechner vergäben beide die 1, und beim Zusammenführen überschriebe
ein Mangel den anderen.

Der Grabstein ist genauso nötig. Ein einfach entfernter Satz käme beim
nächsten Abgleich vom anderen Gerät zurück, weil der ihn noch kennt. Beim
Setzen des Grabsteins fallen die übrigen Felder weg; bei Fotos gibt das
außerdem den belegten Platz frei.

Vorhandene Installationen wandern beim ersten Start automatisch mit. Dabei
werden alle Querverweise umgeschrieben, also Pins auf ihr Geschoss, Mängel
auf ihren Kontakt, Aufgaben auf ihren Vorgänger. Die Wanderung läuft in einer
einzigen Transaktion: Bricht etwas ab, bleiben die alten Daten stehen.

## Datenschutz

**Ohne Konto sendet die App nichts.** Alles liegt in der IndexedDB des
Geräts, es gibt keine Anmeldung und keinen Aufruf nach außen.

**Mit Konto** gehen die Daten zum Abgleich an hausbauatlas.de: Sätze über
`abgleich.php`, Fotos über `bild.php`, beides nur für das eigene Konto.

Bis zum Abgleich trug das Paket keine Internet-Berechtigung, und Android
verbot das Senden auf Betriebssystemebene. Das gilt nicht mehr, der Abgleich
braucht den Zugang. Geblieben ist die Prüfung im Bau: **außer INTERNET darf
keine Berechtigung im Manifest stehen**, sonst bricht er ab. Kamera und
Standort haben hier nach wie vor nichts zu suchen.

Nachprüfen lässt sich das mit jedem APK-Betrachter, etwa:

    python -m pip install pyaxmlparser
    python -c "from pyaxmlparser import APK; print(APK('hausbau-app.apk').get_permissions())"

Zu sehen sein muss genau INTERNET, dazu
`DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`. Den legt AndroidX selbst an, er
gehört der App und erlaubt nichts nach außen.

Die Oberfläche selbst liegt im Paket und wird vom WebView direkt daraus
bedient; dafür wird nichts geladen. Fotos kommen über ein gewöhnliches
Dateifeld von der Kamera; auch dafür ist keine Berechtigung nötig, weil der
Aufruf über die Kamera-App des Systems läuft.

Daten verlassen das Gerät nur, wenn du sie selbst weitergibst: über das
Teilen-Menü beim PDF oder bei der Sicherung.

## Zahlenbasis

Die m²-Preise je Bundesland und die Grunderwerbsteuersätze stehen oben in
`www/module/baukosten.js` (Stand 08.2026), die Zinsrichtwerte je Bindung in
`www/module/finanzierung.js`. Beides stammt aus hausbauatlas.de und muss beim
dortigen Monatsupdate mitgezogen werden. `test.mjs` rechnet die drei
Beispielhäuser der Website nach und schlägt an, wenn eine Formel abweicht.

Die Ergebnisse sind Prognosen auf Grundlage realer Marktdaten, keine Angebote.

## PDF-Ausgabe

Vier Bereiche geben ein PDF aus: Tilgungsverlauf, Mängelliste, Bauablauf,
Bauhelfertagebuch, dazu der Anschlussplan mit dem Grundriss und den
nummerierten Markierungen.

Der Schreiber in `www/pdf.js` ist selbst gebaut, keine Fremdbibliothek.
Er kann Text, Tabellen, Seitenumbruch und JPEG-Bilder. Fotos werden
unverändert als Datenstrom eingebettet (Filter DCTDecode), vorher aber auf
900 Bildpunkte verkleinert: bei rund 100 Punkt Anzeigehöhe sind das immer
noch etwa 600 dpi, und eine Mängelliste mit zwanzig Fotos bleibt unter einem
Megabyte statt sechs. Ein Bild, das mehrfach vorkommt, liegt trotzdem nur
einmal im Dokument.

## Helferstunden

Die Stunden stehen je Person und Tag, nicht als Tagessumme: Zwei Leute an
derselben Baustelle arbeiten selten gleich lang. Beim Anhaken wird die
Regelarbeitszeit des Tages vorgeschlagen und lässt sich je Person
überschreiben.

Das Tagebuch summiert daraus die Stunden je Helfer und insgesamt, im
Bildschirm wie im PDF. Gedacht ist das für die Meldung an die
Berufsgenossenschaft der Bauwirtschaft, bei der unentgeltliche Helfer
versichert sind. Was dort genau abgefragt wird, sagt die Berufsgenossenschaft;
die App liefert die Zahlen.

Ältere Einträge ohne Stundenangabe bleiben lesbar und zählen mit null Stunden
mit, damit eine alte Sicherung nichts verliert.

## Räume

Ein Raum war bisher nur ein Wort im Mangel. Als eigener Datensatz wird er die
Stelle, an der alles zusammenläuft: Fotos vom Zustand, offene Mängel, und was
er gekostet hat, auch je Quadratmeter.

Vorhandene Daten gehen nicht verloren. Beim ersten Öffnen werden aus den
Raumnamen der Mängel richtige Räume, und die Mängel bekommen die Zuordnung.
Das läuft beliebig oft ohne Schaden. Wer in der Mängelmaske einen neuen
Raumnamen tippt, legt den Raum damit gleich mit an.

Beim Löschen eines Raums bleiben Mängel und Kostenpositionen bestehen und
verlieren nur die Zuordnung. Sie mitzulöschen wäre falsch: Der Mangel ist ja
nicht behoben, nur weil der Raum aus der Liste verschwindet.

Die erfasste Fläche ist die Summe der eingetragenen Räume, nicht die
Wohnfläche nach Wohnflächenverordnung. Die rechnet Dachschrägen und Balkone
anders; darauf weist die App hin.

## Kostenaufstellung

Der Kern der Baukasse, in drei Ansichten:

| Ansicht | Frage |
|---|---|
| Übersicht | Wie viel habe ich, wie viel kostet es, was bleibt? |
| Positionen | Was war geplant, was wurde es wirklich? |
| Rechnungen | Was ist tatsächlich abgeflossen? |

Eine Position trägt **geplante** und **tatsächliche** Kosten. Tatsächlich meint
die Auftrags- oder Schlusssumme, nicht das schon Gezahlte. Das
auseinanderzuhalten ist der ganze Witz: Eine Position kann teurer geworden und
trotzdem noch gar nicht bezahlt sein.

Die Abweichung steht farbig daneben, über dem Plan rot, darunter grün. Auf der
Übersicht stehen die fünf größten Abweichungen zuerst; wer nachsteuern will,
fängt oben an.

Den Status setzt man nur auf Geplant oder Beauftragt. Teilgezahlt und Bezahlt
rechnet die App aus den zugeordneten Rechnungen aus, so kann er nicht
veralten.

Beim Löschen einer Position bleiben ihre Rechnungen bestehen und verlieren nur
die Zuordnung. Sie zu löschen wäre falsch: Das Geld ist trotzdem geflossen.

## Wetter im Bautagebuch

Die Messwerte kommen vom Deutschen Wetterdienst über Bright Sky, ohne
Schlüssel. Bewusst Messwerte und keine Vorhersage: Im Bautagebuch geht es um
einen Tag, der schon vorbei ist. Was gestern wirklich war, entscheidet, ob
eine Verzögerung belegt ist.

Der Ort der Baustelle wird einmal in den Einstellungen bestimmt. Die
Übersetzung von Ortsname zu Koordinaten läuft über `server/ort.php` und nicht
direkt aus der App: Nominatim verlangt eine Kennung des aufrufenden Programms
und höchstens eine Anfrage je Sekunde. Ein Browser kann seine Kennung nicht
setzen. Auf dem Server geht es gebündelt, mit Kennung und Zwischenspeicher,
also ein Ort genau einmal für alle.

Aus den Stundenwerten wird eine Lage: Was Arbeiten stoppt, gewinnt. Schnee vor
Sturm vor Regen vor Frost, sonst sonnig oder bewölkt. Bei Wetter, das Arbeiten
stoppt, schlägt die App den Grund für das Feld „liegengeblieben" vor.

## Mängelrüge

Aus den offenen Mängeln einer Firma wird ein Geschäftsbrief mit Absender,
Empfänger, Betreff, Fristsetzung und Aufstellung. Behobenes bleibt draußen.

Die Anschrift der Firma steht beim Kontakt, der eigene Absender in den
Einstellungen. Das Schreiben ist eine Vorlage und keine Rechtsberatung; darauf
weist die App vor dem Erstellen hin.

## Was noch fehlt

- Signatur für den Play Store; das Debug-Paket ist nur zum Ausprobieren
- Maßstab im Anschlussplan, um Abstände in Zentimetern abzulesen
