// Fristen je Firma: Ende der Gewaehrleistung und der Festpreisbindung.
//
// Rechnen ohne Bildschirm, damit Firmenseite und Uebersicht dasselbe sagen
// und sich die Rechnung ohne Browser pruefen laesst (test/fristen.mjs).
//
// Die Fristen sind die gesetzlichen Regelfaelle, keine Rechtsauskunft: Was
// im Vertrag steht, gilt. Deshalb laesst sich das Ende auch selbst eintragen.

export const GEWAEHRLEISTUNG = [
  // § 634a Abs. 1 Nr. 2 BGB: Maengelansprueche bei einem Bauwerk.
  { id: 'bgb', jahre: 5, name: 'Bauwerk nach BGB: 5 Jahre ab Abnahme' },
  // § 13 Abs. 4 VOB/B, wenn die VOB/B wirksam vereinbart ist.
  { id: 'vob', jahre: 4, name: 'VOB/B vereinbart: 4 Jahre ab Abnahme' },
  // § 634a Abs. 1 Nr. 1 BGB: Arbeiten, die kein Bauwerk sind.
  { id: 'kurz', jahre: 2, name: 'Arbeiten, die kein Bauwerk sind: 2 Jahre' },
  { id: 'eigen', jahre: null, name: 'Ende selbst eintragen (laut Vertrag)' },
];

/** ISO-Datum plus ganze Jahre. Der 29. Februar wird in Nichtschaltjahren der 28. */
export function plusJahre(iso, jahre) {
  const [j, m, t] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(j + jahre, m - 1, t));
  if (d.getUTCMonth() !== m - 1) d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

const TAG = 86400000;
export const tageBis = (von, bis) =>
  Math.round((new Date(bis + 'T00:00:00Z') - new Date(von + 'T00:00:00Z')) / TAG);

/** Ende der Gewaehrleistung einer Firma oder null, wenn nichts eingetragen ist. */
export function gewaehrleistungsEnde(kontakt) {
  if (kontakt.gewaehrleistung === 'eigen') return kontakt.gewaehrleistungBis || null;
  const art = GEWAEHRLEISTUNG.find((g) => g.id === kontakt.gewaehrleistung);
  if (!art || !art.jahre || !kontakt.abnahme) return null;
  return plusJahre(kontakt.abnahme, art.jahre);
}

/**
 * Fristen, um die man sich jetzt kuemmern sollte.
 *
 * Gewaehrleistung: ab sechs Monaten vor dem Ende. Das reicht fuer eine
 * Begehung mit Sachverstaendigem und eine Ruege, die vor Ablauf ankommt.
 * Festpreis: ab zwei Monaten vor dem Ende. Danach darf der Preis steigen,
 * wenn der Vertrag es so vorsieht.
 * Beide bleiben noch 30 Tage nach Ablauf stehen, damit ein verpasstes Ende
 * nicht still verschwindet.
 */
export function faelligeFristen(kontakte, heute) {
  const fristen = [];
  for (const k of kontakte) {
    const ende = gewaehrleistungsEnde(k);
    if (ende) {
      const tage = tageBis(heute, ende);
      if (tage <= 183 && tage >= -30) fristen.push({ kontakt: k, art: 'gewaehrleistung', datum: ende, tage });
    }
    if (k.festpreisBis) {
      const tage = tageBis(heute, k.festpreisBis);
      if (tage <= 61 && tage >= -30) fristen.push({ kontakt: k, art: 'festpreis', datum: k.festpreisBis, tage });
    }
  }
  return fristen.sort((a, b) => a.tage - b.tage);
}
