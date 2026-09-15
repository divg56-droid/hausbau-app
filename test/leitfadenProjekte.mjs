/* Haken im Bauleitfaden gehoeren zum Projekt.
 *
 *     node test/leitfadenProjekte.mjs [http://localhost:4301]
 *
 * Anlass: Die Kennung des Satzes war die des Punktes, in allen Projekten
 * gleich. Ein Haken im zweiten Projekt zog den Satz aus dem ersten heraus.
 */
import { browserStarten } from './browser.mjs';

const BASIS = process.argv[2] || 'http://localhost:4301';
let fehler = 0;
const pruef = (n, b, z = '') => { console.log((b ? '  ok   ' : '  FEHL ') + n + (b ? '' : '  ' + z)); if (!b) fehler++; };

const s = await browserStarten({ basis: BASIS });
try {
  await s.laden('/');
  const r = await s.werten(`(async () => {
    const d = await import('/daten.js');
    const { projektAnlegen } = await import('/projekte.js');
    const { leitfadenStand, punkteFuer } = await import('/leitfaden-daten.js');
    const punkt = punkteFuer('schluesselfertig')[0];
    const haken = async (erledigt) => {
      const projekt = await d.projektAktiv();
      await d.daten.sichern('leitfaden', {
        id: projekt === d.ERSTES_PROJEKT ? punkt.id : punkt.id + '@' + projekt,
        punkt: punkt.id, projektId: projekt, erledigt, am: null, notiz: '',
      });
    };
    const stand = async () => leitfadenStand(await d.daten.alle('leitfaden'), 'schluesselfertig')
      .phasen.flatMap((p) => p.punkte).find((p) => p.id === punkt.id).erledigt;

    await d.einstellung('projektname', 'Eins');
    await haken(true);
    const erstes = await d.projektAktiv();
    await projektAnlegen('Zwei');
    const imZweitenVorher = await stand();
    await haken(true);
    await haken(false);
    await d.projektWechseln(erstes);
    const imErstenDanach = await stand();
    return { imZweitenVorher, imErstenDanach };
  })()`);
  pruef('Neues Projekt übernimmt keine Haken', r.imZweitenVorher === false, JSON.stringify(r));
  pruef('Abhaken im zweiten Projekt lässt das erste unberührt', r.imErstenDanach === true, JSON.stringify(r));

  // Und der echte Weg: abhaken() in leitfaden.js muss dieselbe Kennung bauen.
  const quelle = await (await fetch(BASIS + '/module/leitfaden.js')).text();
  pruef('leitfaden.js schreibt die Projektkennung mit',
    quelle.includes("punkt.id + '@' + projekt") && quelle.includes('projektId: projekt'));
} finally {
  s.schliessen();
}
console.log(fehler ? `\n${fehler} Fehler.` : '\nHaken bleiben im Projekt.');
process.exitCode = fehler ? 1 : 0;
