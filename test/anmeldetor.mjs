/* Ohne Konto gibt es nur das Beispiel.
 *
 *     node test/anmeldetor.mjs [http://localhost:4301]
 *
 * Geprueft wird das Tor, nicht die Anmeldung selbst: Wer nicht angemeldet
 * ist, findet auf dem ersten Bildschirm zwei Wege -- anmelden oder das
 * Beispiel ansehen -- und keinen dritten, der ein eigenes Bauvorhaben ohne
 * Konto anlegt. Mit Konto ist es umgekehrt.
 */
import { browserStarten } from './browser.mjs';

const BASIS = process.argv[2] || 'http://localhost:4301';
const w = (ms) => new Promise((g) => setTimeout(g, ms));
let fehler = 0;
const pruef = (n, b, z = '') => { console.log((b ? '  ok   ' : '  FEHL ') + n + (b ? '' : '  ' + z)); if (!b) fehler++; };

const knoepfe = (s) => s.werten(`[...document.querySelectorAll('button')].map((b) => b.textContent.trim())`);
const druecken = (s, text) => s.werten(
  `(() => { const b = [...document.querySelectorAll('button')]`
  + `.find((x) => x.textContent.trim() === ${JSON.stringify(text)}); if (!b) return false; b.click(); return true; })()`
);

// ------------------------------------------------------------ ohne Konto
{
  const s = await browserStarten({ basis: BASIS });
  try {
    await s.groesse(1280, 1400, 1);
    await s.laden('/');
    await w(1200);

    const k = await knoepfe(s);
    const text = await s.werten(`document.getElementById('inhalt').innerText`);

    pruef('Der erste Weg ist die Anmeldung', k.includes('Anmelden und loslegen'), k.join(' | '));
    pruef('Das Beispiel steht daneben', k.includes('Beispielprojekt ansehen'));
    pruef('Ohne Konto kein eigenes Bauvorhaben',
      !k.some((t) => t.includes('Bauprojekt anlegen')), k.join(' | '));
    pruef('Die 30 Tage stehen dabei', /30 Tage/.test(text), text.slice(0, 300));
    pruef('Kein Versprechen mehr, dass alles lokal bleibt',
      !/ohne Konto und ohne/.test(text), text.slice(0, 400));

    // Die Bauweise-Kacheln fuehren in dasselbe Blatt -- auch sie duerfen
    // ohne Konto kein Projekt anlegen, sondern muessen zur Anmeldung.
    const kachel = await s.werten(
      `(() => { const e = document.querySelector('.einstieg'); if (!e) return false; e.click(); return true; })()`
    );
    if (kachel) {
      await w(700);
      pruef('Die Bauweise-Kachel führt zur Anmeldung',
        (await s.werten(`location.hash`)) === '#/konto/neu',
        await s.werten(`location.hash`));
      pruef('Und oeffnet kein Blatt', !(await s.werten(`!!document.querySelector('.blatt')`)));
    } else {
      pruef('Ohne Konto stehen auch keine Bauweise-Kacheln da', true);
    }

    // Das Beispiel muss ohne Anmeldung aufgehen, sonst gibt es nichts zu sehen.
    await s.laden('/');
    await w(1000);
    await druecken(s, 'Beispielprojekt ansehen');
    await w(1500);
    pruef('Das Beispiel oeffnet sich ohne Konto',
      /Beispielprojekt/.test(await s.werten(`document.getElementById('inhalt').innerText`)),
      (await s.werten(`document.getElementById('inhalt').innerText`)).slice(0, 200));

    const klagen = s.klagenHolen().filter((x) => !/abgleich\.php|konto\.php|ERR_FAILED/.test(x.text || ''));
    pruef('Keine Konsolenfehler', klagen.length === 0, JSON.stringify(klagen).slice(0, 300));
  } finally {
    await s.schliessen();
  }
}

// ------------------------------------------------------------- mit Konto
{
  const s = await browserStarten({ basis: BASIS });
  try {
    await s.groesse(1280, 1400, 1);
    await s.vorschalten(`localStorage.setItem('hausbau.marke', 'probe');`);
    await s.laden('/');
    await w(1500);

    const k = await knoepfe(s);
    pruef('Mit Konto steht das Bauvorhaben vorn',
      k.some((t) => t.includes('Bauprojekt anlegen')), k.join(' | '));
    pruef('Und die Anmeldung ist weg', !k.includes('Anmelden und loslegen'), k.join(' | '));

    await druecken(s, '+ Bauprojekt anlegen');
    await w(700);
    pruef('Mit Konto oeffnet sich das Blatt', await s.werten(`!!document.querySelector('.blatt')`));
  } finally {
    await s.schliessen();
  }
}

console.log(fehler ? `\n${fehler} Fehler.` : '\nDas Tor steht richtig.');
process.exitCode = fehler ? 1 : 0;
