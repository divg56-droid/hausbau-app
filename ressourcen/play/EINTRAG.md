# Play-Store-Eintrag BauZeuge

Alles, was in die Play Console eingetragen wird. Zum Abtippen ist nichts
dabei — die Textblöcke sind zum Kopieren gedacht.

Stand: 11.09.2026 · Paket `de.bauzeuge.app` · Fassung aus `version.json`

---

## 1. Store-Eintrag

**App-Name** (max. 30 Zeichen, hier 29)

```
BauZeuge: Hausbau & Kosten
```

**Kurzbeschreibung** (max. 80 Zeichen, hier 76) — steht unter dem Namen und
entscheidet, ob jemand weiterliest.

```
Baukosten, Mängel und Bautagebuch für dein Haus. Offline, ohne Konto.
```

**Vollständige Beschreibung** (max. 4000 Zeichen, hier ca. 2100)

```
Wer ein Haus baut, verliert die Kosten nicht an einer großen Rechnung, sondern
zwischen zwanzig kleinen: Das Angebot lag bei 22.400 Euro, die Schlussrechnung
kam mit 24.980, und niemand hat die Differenz mitgeschrieben. BauZeuge schreibt
sie mit.

WAS DIE APP MACHT

Kostenaufstellung: Jede Position mit geplanter und tatsächlicher Summe. Das
Restbudget rechnet sich daraus, nicht aus einem Gefühl.

Angebotsvergleich: Mehrere Angebote je Gewerk nebeneinander, samt
Leistungsumfang. Genau daran scheitern Vergleiche sonst.

Baunebenkosten: Notar, Vermessung, Statik, Hausanschlüsse, Baustrom — die
Posten, die in keinem Hausangebot stehen und trotzdem fällig werden.

Baufinanzierung und Tilgung: Eigenkapital, Zuschüsse und Darlehen erfassen
oder rechnen lassen. Restschuld und Rate Jahr für Jahr, als PDF.

Mängelliste: Jeder Mangel mit Foto, Raum, Gewerk, Frist und Status. Mit
Anschrift des Handwerkers für die Mängelrüge.

Bautagebuch: Täglich festhalten, wer da war, wie lange und was das Wetter
gemacht hat. Das Wetter holt die App vom Deutschen Wetterdienst.

Bauleitfaden: Was in welcher Reihenfolge zu tun ist, zugeschnitten auf deine
Bauweise — schlüsselfertig, Einzelvergabe oder Sanierung.

Dazu: Bauablauf mit Balkenplan, Räume mit Fotos, Baudokumentation von dem, was
unter Putz und Estrich verschwindet, Dokumentenablage, Kontakte, GRZ- und
GFZ-Rechner, Baukostenrechner.

DEINE DATEN BLEIBEN DEINE

Ohne Konto verlässt kein Baudatum dein Gerät. Die App arbeitet vollständig
offline — auf der Baustelle gibt es oft kein Netz, und das soll nichts machen.

Ein Konto ist freiwillig und nur dafür da, dieselben Daten am Telefon und am
Rechner zu haben. Dann liegen sie auf einem Server in Deutschland.

Keine Werbung. Keine Analysedienste. Keine Werbe-ID. Die App fordert eine
einzige Berechtigung an: Zugang zum Internet.

AUSGEBEN UND TEILEN

Kostenaufstellung, Tilgungsplan, Mängelliste und Adressliste als PDF. Tabellen
als CSV und XLSX. Das Bautagebuch lässt sich über einen Link freigeben, damit
Familie den Fortschritt sieht — ohne Helfernamen und ohne Arbeitsstunden.

IN DER TESTPHASE KOSTENLOS

BauZeuge wird gerade gebaut. Die App ist vollständig nutzbar und kostet nichts.
Was du jetzt anlegst, bleibt erhalten.

Dieselbe App läuft auch im Browser unter www.bauzeuge.de/app/
```

**Kategorie:** Hauswirtschaft (House & Home)
*Alternative, falls der Schwerpunkt Kosten betont werden soll: Finanzen.
Hauswirtschaft passt besser — die App ist kein Finanzprodukt, und die
Kategorie Finanzen zieht zusätzliche Prüfungen nach sich.*

**Tags** (max. 5): Hausbau, Baukosten, Bautagebuch, Bauherren, Mängel

**Kontaktangaben**
- E-Mail: `info@atlanta-pfalz.de`
- Website: `https://www.bauzeuge.de/`
- Datenschutzerklärung: `https://www.bauzeuge.de/app-datenschutz/`

---

## 2. Datensicherheit (Data Safety)

Das Formular ist die Stelle, an der Einträge später teuer werden: Google
gleicht die Angaben mit dem ab, was die App tatsächlich tut. Was hier steht,
ist gegen den Quelltext geprüft und deckt sich mit
`https://www.bauzeuge.de/app-datenschutz/`.

**Werden Daten erhoben oder geteilt?** Ja, erhoben. **Geteilt: nein** — keine
Weitergabe an Dritte.

**Werden Daten bei der Übertragung verschlüsselt?** Ja (HTTPS/TLS).

**Können Nutzer die Löschung beantragen?** Ja — in der App unter „Konto“ mit
sofortiger Wirkung, zusätzlich auf Anfrage.

| Datentyp | Erhoben | Geteilt | Zweck | Pflicht? |
|---|---|---|---|---|
| E-Mail-Adresse | Ja | Nein | Kontoverwaltung | Optional (nur mit Konto) |
| Nutzer-IDs (Sitzungsmarke) | Ja | Nein | Kontoverwaltung | Optional |
| Fotos | Ja | Nein | App-Funktionalität | Optional |
| Dateien und Dokumente | Ja | Nein | App-Funktionalität | Optional |
| Sonstige Nutzerinhalte (Baudaten) | Ja | Nein | App-Funktionalität | Optional |
| App-Interaktionen | Ja | Nein | Analyse (Auslastung) | Optional |
| Absturzprotokolle | Nein | — | — | — |
| Standort | Nein | — | — | — |
| Finanzdaten | Nein | — | — | — |
| Kontakte (Telefonbuch) | Nein | — | — | — |

**Erläuterungen, die dazugehören**

- *Optional*, weil ohne Konto nichts übertragen wird. Das ist bei Play als
  „optional“ einzutragen, nicht als „erforderlich“.
- *App-Interaktionen*: die Tagessummen aus Abschnitt 7 der
  Datenschutzerklärung — Anzahl Anfragen und übertragene Bytes je Konto und
  Tag. Kein Seitenaufruf, keine Uhrzeit, keine IP.
- *Finanzdaten*: **nein**. Die App rechnet mit Beträgen, die der Nutzer selbst
  einträgt. Zahlungsdaten, Kontonummern oder Bonitätsangaben erhebt sie nicht.
  Google meint mit dieser Kategorie Zahlungsverkehr, nicht selbst getippte
  Zahlen — ein Ja hier löst eine Finanzprüfung aus, die auf die App nicht passt.
- *Standort*: **nein**. Das Wetter kommt aus dem Ortsnamen, den der Nutzer
  eintippt. Die App hat keine Standortberechtigung.

---

## 3. Inhaltsklassifizierung

Fragebogen, Kategorie **Dienstprogramm / Produktivität**. Die Antworten lauten
durchgehend nein: keine Gewalt, keine Sexualität, keine Schimpfwörter, keine
Drogen, kein Glücksspiel, keine simulierten Käufe, keine
nutzergenerierten Inhalte, die andere sehen können.

**Eine Frage braucht Aufmerksamkeit:** „Können Nutzer Inhalte mit anderen
teilen?“ — Ja, über die Freigabe des Bautagebuchs. Es handelt sich um einen
Link, den der Nutzer selbst weitergibt; es gibt keine Community, keine
Kommentare und keine Möglichkeit, fremde Inhalte zu sehen.

Erwartetes Ergebnis: USK 0 / PEGI 3.

**Zielgruppe:** 18 und älter. Die App richtet sich an Bauherren; damit
entfallen die Regeln für Kinder-Apps (Families Policy).

**Werbung:** Die App enthält keine Werbung. Das Kästchen bleibt leer.

---

## 4. Grafiken

Alles Nötige liegt in diesem Ordner:

| Datei | Format | Wofür |
|---|---|---|
| `icon-512.png` | 512×512 PNG, ohne Alpha | App-Symbol |
| `feature-1024.png` | 1024×500 PNG | Kopfgrafik über dem Eintrag |
| `screenshots/*.png` | 1080×1920 PNG | Telefon-Screenshots, mindestens 2, höchstens 8 |

Neu erzeugen lassen sich Symbol und Kopfgrafik mit:

```
python ressourcen/store.py
```

Die Screenshots zeigen ein Beispielprojekt („Neubau Ahornweg 12“) und keine
echten Daten. Wer sie durch eigene ersetzen will: auf dem Telefon aufnehmen,
1080×1920 oder ein anderes 9:16-Format.

---

## 5. Was nur in der Play Console geht

Diese Schritte kann kein Skript übernehmen — sie brauchen das Konto.

1. **Entwicklerkonto** — vorhanden (Stand 11.09.2026).

   **Eine Frage vorweg, sie bestimmt den ganzen Zeitplan:** Was steht in der
   Console unter *Einstellungen → Entwicklerkonto → Kontodetails* als
   Kontotyp?

   - **Organisation:** nichts weiter zu tun. Nach der Prüfung geht die App in
     die Produktion.
   - **Privatperson, Konto nach dem 13.11.2023 angelegt:** Vor der Produktion
     verlangt Google einen **geschlossenen Test mit mindestens 12 Testern,
     die 14 Tage ununterbrochen angemeldet bleiben**. Wer aussteigt und wieder
     einsteigt, fängt seine 14 Tage von vorn an. Danach wird der
     Produktionszugang beantragt; die Prüfung dauert meist unter einer Woche.
     In diesem Fall die zwölf Leute *jetzt* sammeln — die 14 Tage laufen
     nicht schneller, weil die App fertig ist.
   - **Privatperson, Konto von vor dem 13.11.2023:** frei wie eine
     Organisation.

2. **App anlegen**: Name, Sprache Deutsch, kostenlos, App (kein Spiel).
3. **Play App Signing bestätigen.** Beim ersten Upload fragt Google, ob es den
   Signaturschlüssel verwahren soll. Ja. Unser Schlüssel
   (`ressourcen/schluessel/upload.p12`) ist dann der *Upload*-Schlüssel: Geht
   er verloren, lässt er sich bei Google zurücksetzen. Ohne Play App Signing
   wäre er unersetzlich und die App bei Verlust tot.
4. **AAB hochladen**: aus dem Lauf „Store-Paket bauen“ das Artefakt
   `bauzeuge-<Fassung>.aab` herunterladen und in einen Release ziehen.

   Reihenfolge: **Interner Test** zuerst (bis zu 100 Tester, sofort
   verfügbar, keine Wartezeit), danach je nach Kontotyp geschlossener Test
   oder direkt Produktion. Der interne Test zählt **nicht** auf die 12 × 14
   Tage an — dafür braucht es den *geschlossenen* Test.

   Vor dem Hochladen lässt sich das Paket auf dem eigenen Telefon prüfen: Der
   Ablauf baut mit der Option „Zusätzlich ein signiertes APK“ ein
   installierbares `bauzeuge-<Fassung>.apk` mit demselben Schlüssel und
   demselben Inhalt. Was dort läuft, läuft auch aus dem Store.
5. **Datensicherheit** nach Abschnitt 2 ausfüllen.
6. **Inhaltsklassifizierung** nach Abschnitt 3 beantworten.
7. **Store-Eintrag** nach Abschnitt 1 füllen, Grafiken nach Abschnitt 4
   hochladen.
8. **Länder wählen** — vermutlich nur Deutschland, Österreich, Schweiz: Die
   App rechnet mit deutschen Bauvorschriften, deutscher Grunderwerbsteuer und
   deutschen Wetterdaten.
9. **Zur Prüfung einreichen.** Beim ersten Mal dauert das erfahrungsgemäß
   mehrere Tage.

**Vor jedem weiteren Upload:** `versionCode` in `version.json` erhöhen. Play
nimmt dieselbe Zahl kein zweites Mal an, auch nicht nach dem Löschen eines
Entwurfs.

---

## 6. Der Upload-Schlüssel

Er liegt unter `ressourcen/schluessel/` und ist von Git ausgenommen:

| Datei | Inhalt |
|---|---|
| `upload.p12` | der Schlüssel, RSA 4096, gültig bis 2056 |
| `upload-passwort.txt` | das Passwort dazu |
| `upload.p12.base64.txt` | dieselbe Datei als Base64, wie sie im GitHub-Secret steht |

Als Repository-Secrets hinterlegt: `ANDROID_KEYSTORE`,
`ANDROID_KEYSTORE_PASSWORT`, `ANDROID_KEY_ALIAS` (= `upload`).

**Beide Dateien gehören in die Datensicherung**, am besten dorthin, wo auch
die Zugangsdaten des Hosters liegen. Wer den Schlüssel hat, kann
Aktualisierungen unter dem Namen BauZeuge hochladen.
