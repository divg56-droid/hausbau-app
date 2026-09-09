// Wetter zum Tageseintrag, automatisch.
//
// Quelle ist Bright Sky, das die Messwerte des Deutschen Wetterdienstes als
// JSON ausliefert. Kein Schluessel noetig, und die Daten des DWD sind frei
// verwendbar - anders als bei den meisten Wetterdiensten, die fuer
// gewerbliche Nutzung Geld verlangen.
//
// Warum Messwerte und nicht Vorhersage: Im Bautagebuch geht es um einen Tag,
// der schon vorbei ist. Was gestern wirklich war, entscheidet, ob eine
// Verzoegerung belegt ist.

import { apiBasis } from './konto.js';

const BRIGHTSKY = 'https://api.brightsky.dev/weather';

// Ab dieser Windgeschwindigkeit in km/h ruhen Kran- und Geruestarbeiten
// ueblicherweise; das entspricht etwa Windstaerke 8.
const STURM_AB = 62;

/**
 * Ortsname zu Koordinaten, ueber den eigenen Server.
 * @returns {Promise<{name:string, lat:number, lon:number}>}
 */
export async function ortSuchen(name) {
  const antwort = await fetch(apiBasis() + '/ort.php?ort=' + encodeURIComponent(name));
  let daten = {};
  try {
    daten = await antwort.json();
  } catch {
    /* leere Antwort */
  }
  if (!antwort.ok) throw new Error(daten.fehler || 'Der Ort ließ sich nicht bestimmen.');
  return daten;
}

/**
 * Fasst die Stundenwerte eines Tages zu dem zusammen, was ins Tagebuch gehoert.
 *
 * @returns {Promise<{wetter:string, temperatur:number, min:number, max:number,
 *                    niederschlag:number, wind:number, station:string}>}
 */
export async function wetterHolen(lat, lon, datum) {
  const adresse = `${BRIGHTSKY}?lat=${lat}&lon=${lon}&date=${datum}`;
  let antwort;
  try {
    antwort = await fetch(adresse);
  } catch {
    throw new Error('Der Wetterdienst ist nicht erreichbar.');
  }
  if (!antwort.ok) throw new Error('Der Wetterdienst antwortete mit ' + antwort.status + '.');

  const daten = await antwort.json();
  const stunden = (daten.weather || []).filter((s) => (s.timestamp || '').startsWith(datum));
  if (!stunden.length) throw new Error('Für diesen Tag liegen keine Messwerte vor.');

  const zahlen = (feld) => stunden.map((s) => s[feld]).filter((w) => typeof w === 'number');
  const temperaturen = zahlen('temperature');
  const wind = zahlen('wind_speed');
  const niederschlag = zahlen('precipitation').reduce((a, b) => a + b, 0);

  // Fuer die Anzeige zaehlt die Arbeitszeit, nicht die Nacht.
  const tagsueber = stunden.filter((s) => {
    const stunde = Number((s.timestamp || '').slice(11, 13));
    return stunde >= 7 && stunde <= 18 && typeof s.temperature === 'number';
  });
  const mittel = tagsueber.length
    ? tagsueber.reduce((a, s) => a + s.temperature, 0) / tagsueber.length
    : temperaturen.reduce((a, b) => a + b, 0) / (temperaturen.length || 1);

  const min = temperaturen.length ? Math.min(...temperaturen) : null;
  const max = temperaturen.length ? Math.max(...temperaturen) : null;
  const windSpitze = wind.length ? Math.max(...wind) : 0;
  const lagen = stunden.map((s) => s.condition).filter(Boolean);
  const zeichen = stunden.map((s) => s.icon).filter(Boolean);

  // Reihenfolge nach Bedeutung fuer die Baustelle: Was Arbeiten stoppt,
  // gewinnt gegen das, was nur schoen oder haesslich ist.
  let wetter;
  if (lagen.includes('snow')) wetter = 'schnee';
  else if (windSpitze >= STURM_AB) wetter = 'sturm';
  else if (lagen.includes('rain') || lagen.includes('sleet') || niederschlag >= 0.5) wetter = 'regen';
  else if (min !== null && min <= 0) wetter = 'frost';
  else {
    const heiter = zeichen.filter((z) => z && z.startsWith('clear')).length;
    wetter = heiter > zeichen.length / 2 ? 'sonnig' : 'bewoelkt';
  }

  return {
    wetter,
    temperatur: Math.round(mittel),
    min: min === null ? null : Math.round(min),
    max: max === null ? null : Math.round(max),
    niederschlag: Math.round(niederschlag * 10) / 10,
    wind: Math.round(windSpitze),
    station: (daten.sources && daten.sources[0] && daten.sources[0].station_name) || '',
  };
}

/** Ein Satz fuer das Feld "liegengeblieben", wenn das Wetter Arbeiten stoppte. */
export function wetterHinweis(w) {
  if (w.wetter === 'sturm') return `Sturm mit Böen bis ${w.wind} km/h.`;
  if (w.wetter === 'schnee') return 'Schneefall.';
  if (w.wetter === 'frost') return `Frost, tiefste Temperatur ${w.min} °C.`;
  if (w.wetter === 'regen' && w.niederschlag >= 5) return `Regen, ${w.niederschlag} mm am Tag.`;
  return '';
}
