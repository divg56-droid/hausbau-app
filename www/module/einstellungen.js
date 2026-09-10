// Einstellungen, Sicherung und Loeschung.

import {
  el, feld, eingabe, knopf, karte, kopfzeile, wertzeile, hinweisKasten, melde, heute,
} from '../hilfen.js';
import { daten, einstellung } from '../daten.js';

// Alle Speicher ausser den Einstellungen selbst; Bilder werden gesondert
// behandelt, weil sie als Blob nicht in JSON passen.
// Die Liste muss vollstaendig sein: Was hier fehlt, fehlt in der Sicherung und
// bleibt beim Loeschen stehen. Sie steht deshalb in derselben Reihenfolge wie
// SPEICHER in daten.js, damit ein neuer Speicher beim Vergleich auffaellt.
const SPEICHER = [
  'darlehen', 'leitfaden', 'posten', 'angebote', 'belege', 'geschosse',
  'raeume', 'pins', 'maengel', 'aufgaben', 'todos', 'tagebuch', 'kontakte',
];

export async function zeige(rahmen) {
  await zeichne(rahmen);
}

async function zeichne(rahmen) {
  rahmen.replaceChildren();

  const projektname = eingabe({
    value: (await einstellung('projektname')) || '',
    placeholder: 'z. B. Neubau Musterweg 3',
  });
  const baustelle = (await einstellung('baustelle')) || {};
  const ortfeld = eingabe({ value: baustelle.ort || '', placeholder: 'z. B. Kaiserslautern' });
  const ortstand = el('p', { klasse: 'unterzeile' });
  ortstand.textContent = baustelle.lat
    ? 'Gefunden: ' + (baustelle.name || baustelle.ort)
    : 'Noch kein Ort bestimmt.';

  const absender = (await einstellung('absender')) || {};
  const bauherr = eingabe({ value: absender.name || '', placeholder: 'Vor- und Nachname' });
  const strasse = eingabe({ value: absender.strasse || '' });
  const plzOrt = eingabe({ value: absender.plzOrt || '' });
  const vorhaben = eingabe({ value: absender.vorhaben || '' });

  const bestand = {};
  for (const name of [...SPEICHER, 'bilder']) {
    bestand[name] = (await daten.alle(name)).length;
  }

  rahmen.append(
    kopfzeile('Einstellungen', 'Projekt, Datensicherung und Löschen.'),

    karte([
      el('h2', { text: 'Projekt' }),
      feld('Projektname', projektname, 'Erscheint in der Kopfzeile jedes PDF.'),
      knopf('Speichern', async () => {
        await einstellung('projektname', projektname.value.trim());
        melde('Gespeichert.');
      }, 'knopf-haupt'),
    ]),

    karte([
      el('h2', { text: 'Darstellung' }),
      el('p', {
        klasse: 'unterzeile',
        text: 'Der Schalter oben rechts wechselt zwischen hell und dunkel. ' +
          'Hier kommst du zurück auf die Einstellung des Geräts.',
      }),
      themawahl(),
    ]),

    karte([
      el('h2', { text: 'Baustelle' }),
      el('p', {
        klasse: 'unterzeile',
        text:
          'Der Ort wird für das Wetter im Bautagebuch gebraucht und einmal in ' +
          'Koordinaten übersetzt. Danach genügt ein Tippen, um die Messwerte ' +
          'des Deutschen Wetterdienstes zum jeweiligen Tag zu holen.',
      }),
      feld('Ort der Baustelle', ortfeld, 'Stadt oder Gemeinde, z. B. Kaiserslautern.'),
      ortstand,
      knopf('Ort bestimmen', async () => {
        const name = ortfeld.value.trim();
        if (!name) { ortstand.textContent = 'Bitte einen Ort eintragen.'; return; }
        ortstand.textContent = 'Wird gesucht …';
        try {
          const { ortSuchen } = await import('../wetter.js');
          const treffer = await ortSuchen(name);
          await einstellung('baustelle', {
            ort: name, name: treffer.name, lat: treffer.lat, lon: treffer.lon,
          });
          ortstand.textContent = 'Gefunden: ' + treffer.name;
          melde('Ort gespeichert.');
        } catch (fehler) {
          ortstand.textContent = fehler.message;
        }
      }, 'knopf-haupt'),
    ]),

    karte([
      el('h2', { text: 'Angaben für Schreiben' }),
      el('p', {
        klasse: 'unterzeile',
        text: 'Kommen in den Kopf der Mängelrüge. Ohne sie fehlt dem Schreiben der Absender.',
      }),
      feld('Name', bauherr),
      feld('Straße und Hausnummer', strasse),
      feld('PLZ und Ort', plzOrt),
      feld('Bauvorhaben', vorhaben, 'Anschrift der Baustelle, falls abweichend.'),
      knopf('Speichern', async () => {
        await einstellung('absender', {
          name: bauherr.value.trim(),
          strasse: strasse.value.trim(),
          plzOrt: plzOrt.value.trim(),
          vorhaben: vorhaben.value.trim(),
        });
        melde('Gespeichert.');
      }, 'knopf-haupt'),
    ]),

    karte([
      el('h2', { text: 'Was gespeichert ist' }),
      wertzeile('Finanzierungsposten', String(bestand.darlehen)),
      wertzeile('Abgehakte Leitfaden-Punkte', String(bestand.leitfaden)),
      wertzeile('Aufgaben und Checklistenpunkte', String(bestand.todos)),
      wertzeile('Kostenpositionen', String(bestand.posten)),
      wertzeile('Angebote', String(bestand.angebote)),
      wertzeile('Rechnungen', String(bestand.belege)),
      wertzeile('Geschosse', String(bestand.geschosse)),
      wertzeile('Räume', String(bestand.raeume)),
      wertzeile('Markierungen', String(bestand.pins)),
      wertzeile('Mängel', String(bestand.maengel)),
      wertzeile('Arbeitsschritte', String(bestand.aufgaben)),
      wertzeile('Tageseinträge', String(bestand.tagebuch)),
      wertzeile('Kontakte', String(bestand.kontakte)),
      wertzeile('Fotos', String(bestand.bilder), true),
    ]),

    karte([
      el('h2', { text: 'Sicherung' }),
      el('p', {
        klasse: 'unterzeile',
        text:
          'Die Sicherung enthält alle Daten samt Fotos in einer Datei. Sie kann groß ' +
          'werden. Lege sie über das Teilen-Menü in einer Cloud oder auf dem Rechner ab.',
      }),
      knopf('Sicherung erstellen', sicherungErstellen),
      knopf('Sicherung einlesen', () => sicherungEinlesen(rahmen)),
    ]),

    karte([
      el('h2', { text: 'Daten als CSV' }),
      el('p', {
        klasse: 'unterzeile',
        text:
          'Für Excel oder LibreOffice: Semikolon als Trenner, Zahlen mit Komma, ' +
          'sonst rechnet die Tabelle nicht. Fotos sind darin nicht enthalten, ' +
          'dafür ist die Sicherung da.',
      }),
      el('div', { klasse: 'knopf-reihe' }, [
        knopf('Kostenpositionen', () => csvPosten()),
        knopf('Rechnungen', () => csvBelege()),
      ]),
      el('div', { klasse: 'knopf-reihe' }, [
        knopf('Mängel', () => csvMaengel()),
        knopf('Bauablauf', () => csvAufgaben()),
      ]),
      el('div', { klasse: 'knopf-reihe' }, [
        knopf('Kontakte', () => csvKontakte()),
      ]),
      el('p', {
        klasse: 'unterzeile',
        text: 'Angebote und Bautagebuch exportierst du in ihrem eigenen Bereich, ' +
          'dort sind die Spalten passend.',
      }),
    ]),

    karte([
      el('h2', { text: 'Alles löschen' }),
      hinweisKasten(
        'Löscht sämtliche Daten dieser App auf diesem Gerät, auch alle Fotos. ' +
          'Das lässt sich nicht rückgängig machen.',
        'warn'
      ),
      knopf('Alle Daten löschen', async () => {
        if (!window.confirm('Wirklich alle Daten unwiderruflich löschen?')) return;
        if (!window.confirm('Sicher? Fotos, Mängel, Rechnungen und Pläne sind danach weg.')) return;
        for (const name of [...SPEICHER, 'bilder', 'einstellungen']) await daten.leeren(name);
        melde('Alles gelöscht.');
        location.hash = '';
      }, 'knopf-warn'),
    ]),

    karte([
      el('h2', { text: 'Über die App' }),
      el('p', {
        klasse: 'unterzeile',
        text:
          'BauZeuge, Testversion. Ohne Konto bleibt alles auf diesem Gerät ' +
          'und nichts wird übertragen. Mit Konto gehen die Daten zum Abgleich ' +
          'an BauZeuge.de, und nur dorthin. Die Baukosten haben den ' +
          'Stand 08.2026. ' +
          'Ergebnisse sind Prognosen auf Grundlage realer Marktdaten, keine Angebote.',
      }),
    ])
  );
}

// ------------------------------------------------------------------ Darstellung

/**
 * Die drei Zustaende nebeneinander. Der Schalter im Kopf kennt nur hell und
 * dunkel, weil er zeigt, was zu sehen ist; "automatisch" gibt es nur hier.
 */
function themawahl() {
  const knoepfe = el('div', { klasse: 'geschossleiste' });

  const zeichnen = async () => {
    const { themaLesen, themaSetzen } = await import('../thema.js');
    const jetzt = themaLesen();
    knoepfe.replaceChildren(...[
      ['auto', 'Automatisch'],
      ['hell', 'Hell'],
      ['dunkel', 'Dunkel'],
    ].map(([wert, name]) =>
      el('button', {
        type: 'button', text: name,
        klasse: jetzt === wert ? 'aktiv' : null,
        onclick: () => { themaSetzen(wert); zeichnen(); },
      })
    ));
  };
  zeichnen();
  return knoepfe;
}

// ------------------------------------------------------------------------ CSV

async function csvSicher(kopf, zeilen, dateiname, titel) {
  try {
    if (!zeilen.length) {
      melde('Dazu ist noch nichts erfasst.');
      return;
    }
    const { csvTeilen } = await import('../csv.js');
    await csvTeilen(kopf, zeilen, dateiname, titel);
  } catch (fehler) {
    console.error(fehler);
    melde('CSV konnte nicht geteilt werden.');
  }
}

async function csvPosten() {
  const [posten, belege] = await Promise.all([daten.alle('posten'), daten.alle('belege')]);
  const { postenRechnen } = await import('./baukasse.js');
  const { kostengruppeLang } = await import('../din276.js');
  await csvSicher(
    ['Position', 'Gewerk', 'Kostengruppe', 'Bezeichnung der Kostengruppe',
      'Geplant', 'Tatsaechlich', 'Bezahlt', 'Abweichung', 'Status', 'Notiz'],
    posten.map((p) => {
      const r = postenRechnen(p, belege);
      return [
        p.name, p.gewerk || '', p.kostengruppe || '',
        p.kostengruppe ? kostengruppeLang(p.kostengruppe).slice(4) : '',
        r.geplant, r.tatsaechlich, r.gezahlt, r.differenz, r.statusName, p.notiz || '',
      ];
    }),
    'kostenpositionen.csv', 'Kostenpositionen'
  );
}

async function csvBelege() {
  const [belege, posten, kontakte] = await Promise.all([
    daten.alle('belege'), daten.alle('posten'), daten.alle('kontakte'),
  ]);
  await csvSicher(
    ['Datum', 'Beschreibung', 'Betrag', 'Firma laut Rechnung', 'Kontakt', 'Position'],
    [...belege]
      .sort((a, b) => String(a.datum).localeCompare(String(b.datum)))
      .map((b) => {
        const k = kontakte.find((x) => x.id === b.kontaktId);
        const p = posten.find((x) => x.id === b.postenId);
        return [
          b.datum || '', b.beschreibung || '', b.betrag || 0,
          b.kontaktName || '', k ? k.name : '', p ? p.name : '',
        ];
      }),
    'rechnungen.csv', 'Rechnungen'
  );
}

async function csvMaengel() {
  const [maengel, kontakte, raeume] = await Promise.all([
    daten.alle('maengel'), daten.alle('kontakte'), daten.alle('raeume'),
  ]);
  const { STATUS } = await import('./maengel.js');
  await csvSicher(
    ['Titel', 'Raum', 'Gewerk', 'Status', 'Angelegt am', 'Frist', 'Firma', 'Fotos', 'Beschreibung'],
    maengel.map((m) => {
      const k = kontakte.find((x) => x.id === m.kontaktId);
      const r = raeume.find((x) => x.id === m.raumId);
      return [
        m.titel || '',
        r ? r.name : (m.raum || ''),
        m.gewerk || '',
        (STATUS[m.status] || {}).name || m.status || '',
        m.angelegt || '', m.frist || '',
        k ? k.firma || k.name : '',
        (m.bildIds || []).length,
        m.beschreibung || '',
      ];
    }),
    'maengel.csv', 'Mängelliste'
  );
}

async function csvAufgaben() {
  const [roh, kontakte] = await Promise.all([daten.alle('aufgaben'), daten.alle('kontakte')]);
  const { terminePlanen } = await import('./ablauf.js');
  await csvSicher(
    ['Arbeitsschritt', 'Phase', 'Beginn', 'Ende', 'Dauer in Tagen', 'Wer', 'Status', 'Notiz'],
    terminePlanen(roh).map((a) => {
      const k = kontakte.find((x) => x.id === a.kontaktId);
      return [
        a.titel || '', a.phase || '', a.start || '', a.ende || '', a.dauer || 0,
        k ? k.name : '',
        a.status === 'fertig' ? 'Fertig' : a.status === 'laeuft' ? 'Läuft' : 'Offen',
        a.notiz || '',
      ];
    }),
    'bauablauf.csv', 'Bauablauf'
  );
}

async function csvKontakte() {
  const kontakte = await daten.alle('kontakte');
  await csvSicher(
    ['Name', 'Firma', 'Gewerk', 'Art', 'Strasse', 'PLZ und Ort', 'Telefon', 'E-Mail', 'Notiz'],
    kontakte.map((k) => [
      k.name || '', k.firma || '', k.gewerk || '', k.art || '',
      k.strasse || '', k.plzOrt || '', k.telefon || '', k.epost || '', k.notiz || '',
    ]),
    'kontakte.csv', 'Kontakte'
  );
}

// ------------------------------------------------------------------ Sicherung

async function sicherungErstellen() {
  melde('Sicherung wird erstellt …');
  const inhalt = { version: 1, erstellt: heute(), einstellungen: {}, speicher: {}, bilder: [] };

  for (const eintrag of await daten.alle('einstellungen')) {
    inhalt.einstellungen[eintrag.name] = eintrag.wert;
  }
  for (const name of SPEICHER) inhalt.speicher[name] = await daten.alle(name);

  for (const bild of await daten.alle('bilder')) {
    inhalt.bilder.push({
      id: bild.id,
      typ: bild.typ,
      name: bild.name,
      angelegt: bild.angelegt,
      daten: await blobZuBase64(bild.blob),
    });
  }

  const blob = new Blob([JSON.stringify(inhalt)], { type: 'application/json' });
  const { pdfTeilen } = await import('../pdf.js');
  try {
    await pdfTeilen(blob, 'bauzeuge-sicherung-' + heute() + '.json', 'Sicherung');
    melde('Sicherung bereit.');
  } catch (fehler) {
    console.error(fehler);
    melde('Sicherung konnte nicht geteilt werden.');
  }
}

function sicherungEinlesen(rahmen) {
  const dateifeld = el('input', { type: 'file', accept: 'application/json,.json', klasse: 'versteckt' });
  dateifeld.addEventListener('change', async () => {
    const datei = dateifeld.files[0];
    dateifeld.remove();
    if (!datei) return;
    if (!window.confirm('Die Sicherung ersetzt alle vorhandenen Daten. Fortfahren?')) return;

    try {
      const inhalt = JSON.parse(await datei.text());
      if (!inhalt || inhalt.version !== 1) throw new Error('Unbekanntes Format.');

      for (const name of [...SPEICHER, 'bilder']) await daten.leeren(name);

      for (const bild of inhalt.bilder || []) {
        await daten.sichern('bilder', {
          id: bild.id,
          typ: bild.typ,
          name: bild.name,
          angelegt: bild.angelegt,
          blob: base64ZuBlob(bild.daten, bild.typ),
        }, { zeitBehalten: true });
      }
      for (const name of SPEICHER) {
        for (const satz of inhalt.speicher[name] || []) {
          await daten.sichern(name, satz, { zeitBehalten: true });
        }
      }
      for (const [name, wert] of Object.entries(inhalt.einstellungen || {})) {
        await einstellung(name, wert);
      }
      melde('Sicherung eingelesen.');
      await zeichne(rahmen);
    } catch (fehler) {
      console.error(fehler);
      melde('Datei konnte nicht gelesen werden.');
    }
  });
  document.body.append(dateifeld);
  dateifeld.click();
}

function blobZuBase64(blob) {
  return new Promise((fertig, fehler) => {
    const leser = new FileReader();
    leser.onerror = () => fehler(leser.error);
    leser.onload = () => fertig(String(leser.result).split(',')[1]);
    leser.readAsDataURL(blob);
  });
}

function base64ZuBlob(base64, typ) {
  const roh = atob(base64);
  const bytes = new Uint8Array(roh.length);
  for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
  return new Blob([bytes], { type: typ || 'image/jpeg' });
}
