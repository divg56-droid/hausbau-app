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
| Baukasse | Budget, Rechnungen, Restbudget je Finanzierungsposten |
| Anschlussplan | Grundriss hochladen, Steckdosen und Leitungen markieren |
| Mängelliste | Mängel je Raum mit Foto, Gewerk, Frist und Status |
| Bauablauf | Gewerke in der richtigen Reihenfolge, Termine rechnen sich |
| Bauhelfertagebuch | Tageseinträge mit Wetter, Helfern und Fotos |
| Kontakte | Firmen und Helfer, von den anderen Bereichen verlinkt |
| Einstellungen | Projektname, Belegerkennung, Sicherung, Löschen |

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
      erkennung.js    Belegerkennung über Google Gemini
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

## Entwickeln

    npm install
    npm start        # http://localhost:4300
    node test.mjs    # Rechenkerne gegen die Werte der Website prüfen

Das APK lokal zu bauen braucht JDK 21 und das Android-SDK:

    npm run apk

Ohne beides baut GitHub. Der Ordner `android/` steht bewusst nicht im
Repository, er entsteht bei jedem Lauf neu aus `capacitor.config.json`.

## Datenschutz

Alles liegt in der IndexedDB des Geräts. Es gibt keinen Server, kein Konto und
keine Übertragung, mit einer Ausnahme:

**Belegerkennung.** Wer in den Einstellungen einen eigenen
Google-Gemini-Schlüssel hinterlegt, kann Rechnungen scannen. Dabei geht die
hochgeladene Datei an Google. Ohne Schlüssel bietet die Baukasse nur die
manuelle Erfassung an, und diese Belege verlassen das Gerät nicht. Der
Schlüssel wird nicht mit der App ausgeliefert; ein mitgeliefertes Kennwort
wäre aus dem APK auslesbar und ginge auf Kosten des Herausgebers.

## Zahlenbasis

Die m²-Preise je Bundesland und die Grunderwerbsteuersätze stehen oben in
`www/module/baukosten.js` (Stand 08.2026), die Zinsrichtwerte je Bindung in
`www/module/finanzierung.js`. Beides stammt aus hausbauatlas.de und muss beim
dortigen Monatsupdate mitgezogen werden. `test.mjs` rechnet die drei
Beispielhäuser der Website nach und schlägt an, wenn eine Formel abweicht.

Die Ergebnisse sind Prognosen auf Grundlage realer Marktdaten, keine Angebote.

## Was noch fehlt

- Signatur für den Play Store; das Debug-Paket ist nur zum Ausprobieren
- Fotos im PDF; sie liegen bisher nur in der App
- Maßstab im Anschlussplan, um Abstände in Zentimetern abzulesen
- Bauhelferstunden je Person summieren, für die Berufsgenossenschaft
