# Eine neue Fassung in den Play Store bringen

Reihenfolge, nicht Sammlung. Beide Punkte unter 1 sind am 21.10.2026
schiefgegangen und haben je einen Fehlversuch gekostet.

## 1. Vorher

**`version.json` hochzählen.** `versionCode` muss größer sein als beim
letzten Upload — Play nimmt dieselbe Zahl kein zweites Mal an, auch nicht
nach dem Löschen eines Entwurfs. Welche Zahl zuletzt oben war, steht in der
Console unter *Testen und veröffentlichen* bei „Neuester Produktionsrelease".

`versionName` nach Gefühl: neue Funktionen heben die mittlere Stelle
(1.1.3 → 1.2.0), Nachbesserungen die letzte (1.2.0 → 1.2.1).

Wird ein Upload abgewiesen, trotzdem hochzählen. Play führt eine abgewiesene
Nummer unter Umständen als verbraucht, und ein zweiter Fehlversuch kostet
mehr als eine übersprungene Zahl.

## 2. Bauen

Die Action **„Store-Paket bauen"** von Hand auslösen (Actions → Store-Paket
bauen → Run workflow). Sie läuft nicht bei jedem Push, und das mit Absicht:
Der Upload-Schlüssel gehört nicht in einen Lauf, den ein beliebiger Commit
anstößt.

**Nicht „APK bauen" nehmen.** Das ist der Testbau und liefert eine
Debug-APK. Der Store will ein signiertes AAB.

Ergebnis: ein Anhang `bauzeuge-store-<name>` am Lauf. Herunterladen,
**entpacken** — GitHub packt jeden Anhang in ein ZIP, Play will die `.aab`
selbst.

## 3. Hochladen

Console → *Produktion* → neuen Release erstellen → die `.aab` ins Feld
ziehen. „Aus der Bibliothek hinzufügen" hilft nicht, dort liegen nur schon
hochgeladene Pakete.

## Was Play schon abgewiesen hat

- **targetSdk zu niedrig.** Capacitor stellt 35 ein, verlangt wird 36.
  Zieht store.yml nach.
- **minSdk zu niedrig.** Capacitor stellt 23 ein; der *automatische Schutz
  von Google Play* verlangt 24. Zieht store.yml seit dem 21.10.2026 nach.
  Die Alternative wäre, den automatischen Schutz abzuschalten — dann ginge
  auch 23. Entschieden wurde für 24: Android 6.0 ist von 2015, die WebView
  dort bekommt seit Chrome 119 keine Aktualisierung mehr, und die App
  benutzt `color-mix()` (Chrome 111). Kostet 1.159 Gerätemodelle.
- **Unsigniertes Paket.** Kam vor, als `find` das Zwischenergebnis statt des
  fertigen Bundles griff. store.yml bricht seitdem ab, wenn ein Schlüssel da
  war und das Paket trotzdem unsigniert ist.

## Offen

Die Erklärung „Die App enthält keine Werbung" im Datensicherheitsformular
steht noch auf dem alten Stand. Siehe EINTRAG.md.
