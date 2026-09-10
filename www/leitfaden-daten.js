// Der Bauleitfaden: was in welcher Reihenfolge zu tun ist.
//
// Die Reihenfolge ist der eigentliche Inhalt. Fast jeder teure Fehler am Bau
// entsteht dadurch, dass etwas zu spaet kommt: der Anwalt nach der
// Unterschrift, das Bodengutachten nach dem Kauf, die Elektroplanung nach dem
// Putz. Deshalb steht hier nicht, was man alles tun koennte, sondern was
// wann faellig ist und warum.
//
// Vorlage und Zustand sind getrennt. Diese Datei ist die Vorlage und liegt im
// Programm; abgehakt wird im Speicher "leitfaden", und zwar unter derselben
// Kennung. So kann die Vorlage wachsen, ohne dass eine Wanderung noetig wird,
// und ein neuer Punkt taucht bei allen einfach auf.
//
// "ziel" verweist auf den Bereich der App, in dem der Punkt erledigt wird.
// Ohne diesen Verweis waere der Leitfaden eine Liste zum Abhaken statt ein
// Wegweiser.

export const PHASEN = [
  {
    id: 'geld',
    titel: 'Finanzierung und Grundlagen',
    text: 'Bevor irgendetwas gekauft wird, muss die Zahl stehen, die du dauerhaft tragen kannst.',
    punkte: [
      { id: 'haushaltsrechnung', titel: 'Haushaltsrechnung aufstellen',
        text: 'Einnahmen minus alle festen Ausgaben, ehrlich gerechnet. Was übrig bleibt, ist die Obergrenze, nicht das Ziel.' },
      { id: 'eigenkapital', titel: 'Eigenkapital zusammenzählen',
        text: 'Nur, was wirklich verfügbar ist. Drei Nettogehälter bleiben als Reserve liegen und gehören nicht ins Haus.' },
      { id: 'rate', titel: 'Tragbare Monatsrate festlegen',
        text: 'Sie muss auch in einem Jahr mit Elternzeit, Krankheit oder Kurzarbeit noch gehen.' },
      { id: 'baukosten-schaetzen', titel: 'Baukosten grob schätzen',
        text: 'Erst die Größenordnung, dann die Suche. Wer umgekehrt vorgeht, verliebt sich in Unbezahlbares.',
        ziel: '#/baukosten' },
      { id: 'budget-anlegen', titel: 'Budget in der App anlegen',
        text: 'Eigenkapital, Zuschüsse und Darlehen. Daraus rechnet sich alles Weitere bis zum Restbudget.',
        ziel: '#/finanzierung' },
      { id: 'foerderung', titel: 'Förderungen prüfen',
        text: 'KfW, BAFA und das Land. Vor der Auftragsvergabe beantragen, danach ist es zu spät.',
        ziel: '#/finanzierung' },
      { id: 'angebote-bank', titel: 'Mindestens drei Finanzierungsangebote einholen',
        text: 'Ein halber Prozentpunkt macht auf dreißig Jahre den Preis eines Autos aus.' },
      { id: 'zinsbindung', titel: 'Zinsbindung, Tilgung und Sondertilgung festlegen',
        text: 'Sondertilgungsrecht kostet meist nichts und ist später Gold wert.' },
      { id: 'finanzierungsbestaetigung', titel: 'Finanzierungsbestätigung einholen',
        text: 'Ohne sie unterschreibst du keinen Kaufvertrag und keinen Bauvertrag.' },
      { id: 'puffer', titel: 'Puffer von zehn bis fünfzehn Prozent einplanen',
        text: 'Nicht optional. Er ist der Unterschied zwischen einer Änderung und einem Baustopp.' },
      { id: 'erwerbsnebenkosten', titel: 'Erwerbsnebenkosten einrechnen',
        text: 'Grunderwerbsteuer, Notar, Grundbuch und gegebenenfalls Makler. Zusammen schnell zehn Prozent.' },
      { id: 'versicherungen-bau', titel: 'Bauherrenhaftpflicht und Bauleistungsversicherung',
        text: 'Beide vor dem ersten Spatenstich. Als Bauherr haftest du für die Baustelle.' },
    ],
  },
  {
    id: 'grundstueck',
    titel: 'Grundstück und Verträge',
    text: 'Hier werden die teuersten Fehler gemacht, weil alles unterschrieben wird, bevor es geprüft ist.',
    punkte: [
      { id: 'lage', titel: 'Lage und Anbindung prüfen',
        text: 'Zu verschiedenen Tageszeiten hinfahren. Lärm, Verkehr und Sonnenstand sieht man nicht im Exposé.' },
      { id: 'bebauungsplan', titel: 'Bebauungsplan einsehen',
        text: 'Er bestimmt, was du bauen darfst: Höhe, Dachform, Grundflächenzahl und Geschossflächenzahl.' },
      { id: 'erschliessung', titel: 'Erschließungszustand klären',
        text: 'Strom, Wasser, Abwasser, Gas und Glasfaser. "Erschlossen" heißt nicht immer, dass alles anliegt.' },
      { id: 'erschliessungskosten', titel: 'Erschließungskosten schriftlich erfragen',
        text: 'Bei der Gemeinde. Offene Beiträge gehen auf den Käufer über und werden fünfstellig.' },
      { id: 'altlasten', titel: 'Altlastenauskunft einholen',
        text: 'Beim Landkreis. Ein belasteter Boden macht ein günstiges Grundstück zum teuersten.' },
      { id: 'bodengutachten', titel: 'Bodengutachten beauftragen',
        text: 'Vor dem Kauf, nicht danach. Fels, Grundwasser oder Auffüllung verändern die Gründung um einen fünfstelligen Betrag.' },
      { id: 'grundbuch', titel: 'Grundbuchauszug prüfen',
        text: 'Abteilung II ist die wichtige: Wegerechte, Leitungsrechte und Dienstbarkeiten binden dich dauerhaft.' },
      { id: 'kaufpreis', titel: 'Kaufpreis verhandeln und Nebenkosten rechnen',
        text: 'Der Bodenrichtwert der Gemeinde ist die Verhandlungsgrundlage.' },
      { id: 'notar', titel: 'Notarentwurf vor dem Termin prüfen lassen',
        text: 'Du hast zwei Wochen Zeit. Nutze sie, im Termin wird nur noch vorgelesen.' },
      { id: 'grunderwerbsteuer', titel: 'Grunderwerbsteuer einplanen',
        text: 'Je nach Bundesland 3,5 bis 6,5 Prozent, fällig wenige Wochen nach dem Kauf.' },
      { id: 'bauweise', titel: 'Bauweise entscheiden',
        text: 'Massiv, Fertighaus oder Architektenhaus. Die Entscheidung bestimmt Preis, Bauzeit und wie viel du selbst steuerst.' },
      { id: 'bauvertrag-anwalt', titel: 'Bauvertrag von einem Fachanwalt prüfen lassen',
        text: 'Ein paar hundert Euro gegen ein Risiko im sechsstelligen Bereich. Der beste Euro am ganzen Bau.' },
      { id: 'leistungsbeschreibung', titel: 'Bau- und Leistungsbeschreibung Position für Position prüfen',
        text: 'Was nicht drinsteht, ist nicht dabei. Genau daraus entstehen später die Nachträge.' },
      { id: 'zahlungsplan', titel: 'Zahlungsplan an den Baufortschritt koppeln',
        text: 'Niemals Vorkasse. Immer erst die Leistung, dann das Geld.' },
    ],
  },
  {
    id: 'behoerden',
    titel: 'Behörden und Genehmigungen',
    text: 'Der Teil, der am längsten dauert und den man deshalb früh anstößt.',
    punkte: [
      { id: 'bauantrag', titel: 'Bauantrag oder Bauanzeige einreichen',
        text: 'Je nach Bundesland und Bebauungsplan. Rechne mit zwei bis sechs Monaten Bearbeitung.' },
      { id: 'statik', titel: 'Statik beauftragen',
        text: 'Gehört zum Antrag und bestimmt Wandstärken, Decken und Fundamente.' },
      { id: 'geg', titel: 'GEG-Nachweis erstellen lassen',
        text: 'Der Energienachweis. Er entscheidet auch darüber, welche Förderung möglich ist.' },
      { id: 'entwaesserung', titel: 'Entwässerungsantrag stellen',
        text: 'Regen- und Schmutzwasser getrennt. Versickerung braucht oft eine eigene Erlaubnis.' },
      { id: 'hausanschluesse', titel: 'Hausanschlüsse beantragen',
        text: 'Strom, Wasser, Abwasser, gegebenenfalls Gas und Telekommunikation. Vorlaufzeiten von Monaten sind normal.' },
      { id: 'baustrom', titel: 'Baustrom und Bauwasser anmelden',
        text: 'Ohne beides steht die Baustelle, bevor sie angefangen hat.' },
      { id: 'genehmigung-pruefen', titel: 'Baugenehmigung prüfen und Auflagen notieren',
        text: 'Auflagen sind bindend und werden bei der Abnahme kontrolliert.' },
      { id: 'vermessung', titel: 'Vermessung und Absteckung beauftragen',
        text: 'Amtlich. Ein falsch gesetztes Haus ist nicht heilbar.' },
      { id: 'bg-bau', titel: 'Bauvorhaben bei der Berufsgenossenschaft anmelden',
        text: 'Pflicht, sobald Helfer mitarbeiten. Sie sind darüber unfallversichert, und gefragt wird nach den geleisteten Stunden.',
        ziel: '#/tagebuch' },
    ],
  },
  {
    id: 'planung',
    titel: 'Planung, Bemusterung und Kostenkontrolle',
    text: 'Jetzt werden die Entscheidungen getroffen, die man später nicht mehr ändern kann, ohne aufzustemmen.',
    punkte: [
      { id: 'grundrisse', titel: 'Grundrisse endgültig prüfen',
        text: 'Möbel maßstäblich einzeichnen. Türanschläge und Fensterbrüstungen jetzt festlegen.' },
      { id: 'elektroplanung', titel: 'Elektroplanung festlegen',
        text: 'Steckdosen, Schalter und Leitungswege Raum für Raum. Nach dem Putz kostet jede Dose ein Vielfaches.',
        ziel: '#/anschlussplan' },
      { id: 'sanitaer-heizung', titel: 'Sanitär- und Heizungsplanung festlegen',
        text: 'Auch Anschlüsse, die du erst später brauchst: Außenzapfstelle, Waschmaschine, Wärmepumpe.' },
      { id: 'bemusterung', titel: 'Bemusterung: Aufpreise sofort schriftlich festhalten',
        text: 'Der häufigste Punkt, an dem das Budget kippt. Nichts mündlich stehen lassen.' },
      { id: 'kostenaufstellung', titel: 'Kostenaufstellung anlegen',
        text: 'Jede Position mit geplanter und tatsächlicher Summe. Nur so siehst du Abweichungen, solange sie noch klein sind.',
        ziel: '#/baukasse' },
      { id: 'angebote-vergleichen', titel: 'Je Gewerk mindestens drei Angebote vergleichen',
        text: 'Die Spanne liegt am Bau regelmäßig im zweistelligen Prozentbereich.',
        ziel: '#/angebote' },
      { id: 'bauzeitenplan', titel: 'Bauzeitenplan aufstellen',
        text: 'Die Reihenfolge zählt: Elektro vor Putz, Estrich vor Fliesen. Wer das plant, zahlt keinen Rückbau.',
        ziel: '#/ablauf' },
    ],
  },
  {
    id: 'bau',
    titel: 'Bauausführung',
    text: 'Ab hier zählt die Dokumentation. Was am selben Tag festgehalten wurde, gilt später als Beweis.',
    punkte: [
      { id: 'baustelle', titel: 'Baustelleneinrichtung und Zufahrt klären',
        text: 'Platz für Kran, Container und Anlieferung. Auch Nachbargrundstücke rechtzeitig ansprechen.' },
      { id: 'tagebuch-fuehren', titel: 'Bautagebuch täglich führen',
        text: 'Wetter, Anwesende, Fortschritt. Bei Streit hat das Tagebuch die höchste Beweiskraft.',
        ziel: '#/tagebuch' },
      { id: 'helferstunden', titel: 'Helferstunden erfassen',
        text: 'Je Person und Tag. Genau danach fragt die Berufsgenossenschaft.',
        ziel: '#/tagebuch' },
      { id: 'gruendung', titel: 'Baugrube und Gründung prüfen',
        text: 'Sohle, Dämmung und Bewehrung vor dem Betonieren ansehen und fotografieren.' },
      { id: 'rohbau-masse', titel: 'Rohbaumaße und Öffnungen kontrollieren',
        text: 'Fenster- und Türöffnungen nachmessen, solange sich noch etwas ändern lässt.' },
      { id: 'fotos-vor-verschluss', titel: 'Vor dem Verschließen alles fotografieren',
        text: 'Leitungen, Rohre und Dosen in den Wänden. In zehn Jahren ist das die einzige Quelle, wo etwas liegt.',
        ziel: '#/raeume' },
      { id: 'richtfest', titel: 'Richtfest',
        text: 'Der eine Tag, an dem nichts geprüft werden muss.' },
      { id: 'fenster-pruefen', titel: 'Fenster und Türen bei Anlieferung prüfen',
        text: 'Kratzer und Schäden sofort auf dem Lieferschein vermerken, sonst waren sie nie da.' },
      { id: 'estrich', titel: 'Estrich trocknen lassen und Feuchte messen',
        text: 'Das Messprotokoll aufheben. Zu früh verlegter Belag ist ein Schaden, den niemand bezahlen will.' },
      { id: 'abschlaege', titel: 'Abschlagsrechnungen gegen den Baufortschritt prüfen',
        text: 'Nur zahlen, was auch fertig ist. Einmal überzahlt, ist das Druckmittel weg.',
        ziel: '#/baukasse' },
      { id: 'maengel-ruegen', titel: 'Mängel sofort schriftlich rügen',
        text: 'Mit Foto, Datum und Frist. Mündlich gerügt ist rechtlich nicht gerügt.',
        ziel: '#/maengel' },
      { id: 'nachtraege', titel: 'Nachträge nur schriftlich und vor der Ausführung freigeben',
        text: 'Ein Nachtrag, der erst auf der Schlussrechnung auftaucht, ist eine Verhandlung, die du schon verloren hast.' },
    ],
  },
  {
    id: 'abnahme',
    titel: 'Abnahme und Nachlauf',
    text: 'Die Abnahme dreht die Beweislast um. Danach musst du beweisen, dass ein Mangel schon vorher da war.',
    punkte: [
      { id: 'abnahmetermin', titel: 'Abnahme mit einem Sachverständigen',
        text: 'Ein paar hundert Euro. Er sieht in zwei Stunden, was dir in zwei Jahren auffällt.' },
      { id: 'abnahmeprotokoll', titel: 'Abnahmeprotokoll: alle Mängel eintragen',
        text: 'Und den Vorbehalt der Vertragsstrafe erklären, falls der Termin überschritten wurde.' },
      { id: 'restzahlung', titel: 'Restzahlung erst nach mangelfreier Abnahme',
        text: 'Der Einbehalt ist das einzige Druckmittel, das nach der Abnahme noch wirkt.' },
      { id: 'verjaehrung', titel: 'Verjährungsfristen notieren',
        text: 'Bei Bauwerken meist fünf Jahre ab Abnahme. Kurz vorher noch einmal alles durchgehen.' },
      { id: 'maengel-nachhalten', titel: 'Mängelbeseitigung mit Frist nachhalten',
        text: 'Jede Nachbesserung wieder abnehmen und dokumentieren.',
        ziel: '#/maengel' },
      { id: 'sicherheitseinbehalt', titel: 'Sicherheitseinbehalt oder Gewährleistungsbürgschaft',
        text: 'Üblich sind fünf Prozent über die Gewährleistungszeit.' },
      { id: 'unterlagen', titel: 'Alle Unterlagen sammeln',
        text: 'Pläne, Statik, Nachweise, Aufmaße, Bedienungsanleitungen und Wartungspflichten an einer Stelle.' },
      { id: 'schlussrechnung', titel: 'Schlussrechnung prüfen und Kostenaufstellung abschließen',
        text: 'Gegen den Zahlungsplan und alle Nachträge rechnen.',
        ziel: '#/baukasse' },
      { id: 'versicherungen-umstellen', titel: 'Versicherungen umstellen',
        text: 'Bauleistung endet, Wohngebäude und Hausrat beginnen. Keine Lücke lassen.' },
      { id: 'einzug', titel: 'Einzug: Zähler ablesen und Übergabe protokollieren',
        text: 'Strom, Wasser und Gas mit Foto. Das erspart den ersten Streit mit dem Versorger.' },
    ],
  },
];

/** Alle Punkte flach, in der Reihenfolge des Leitfadens. */
export const ALLE_PUNKTE = PHASEN.flatMap((p) =>
  p.punkte.map((punkt) => ({ ...punkt, phaseId: p.id, phase: p.titel }))
);

/**
 * Rechnet den Stand aus.
 *
 * @param {Array<{id: string, erledigt?: boolean}>} stand  gespeicherte Haken
 * @returns {{phasen: Array, erledigt: number, gesamt: number, naechster: object|null}}
 */
export function leitfadenStand(stand) {
  const haken = new Map((stand || []).map((s) => [s.id, s]));

  const phasen = PHASEN.map((phase) => {
    const punkte = phase.punkte.map((punkt) => ({
      ...punkt,
      phaseId: phase.id,
      erledigt: Boolean(haken.get(punkt.id)?.erledigt),
      am: haken.get(punkt.id)?.am || null,
      notiz: haken.get(punkt.id)?.notiz || '',
    }));
    const fertig = punkte.filter((p) => p.erledigt).length;
    return { ...phase, punkte, fertig, gesamt: punkte.length };
  });

  const erledigt = phasen.reduce((s, p) => s + p.fertig, 0);
  const gesamt = phasen.reduce((s, p) => s + p.gesamt, 0);

  // Die laufende Phase ist die erste, die noch nicht fertig ist. Sie bleibt
  // es auch, wenn in einer spaeteren schon etwas abgehakt wurde: Am Bau
  // arbeitet man vor, aber der Fortschritt bemisst sich am Rueckstand.
  const laufend = phasen.find((p) => p.fertig < p.gesamt) || phasen[phasen.length - 1];
  const naechster = laufend.punkte.find((p) => !p.erledigt) || null;

  return { phasen, erledigt, gesamt, laufend, naechster };
}
