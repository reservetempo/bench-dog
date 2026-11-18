// Montreal's time, sun and weather, turned into what the town should look like.
// No three.js here: the top bar uses it too.
//
// For checking looks, the page takes overrides in its address, for example
// /?wx=73&snow=12&temp=-6&hour=21.5&season=winter&cloud=90&wind=30
// (wx = WMO weather code, snow = snow on the ground in cm, hour = Montreal time of day).

export const MONTREAL = { lat: 45.5019, lon: -73.5674, tz: 'America/Toronto' };

const RAD = Math.PI / 180;

// The sun's height above the horizon and its compass bearing, in degrees, for a time and place.
export function sunPosition(date, lat, lon) {
  const d = date.getTime() / 86400000 - 10957.5; // days since 2000-01-01 12:00 UTC
  const g = (357.529 + 0.98560028 * d) * RAD;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const e = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (((18.697374558 + 24.06570982441908 * d) % 24) + 24) % 24;
  const ha = (gmst * 15 + lon) * RAD - ra;
  const phi = lat * RAD;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha));
  const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(ha));
  return { elevation: alt / RAD, azimuth: ((az / RAD) + 360) % 360 };
}

let partsFormat = null;
export function montrealParts(date) {
  partsFormat ||= new Intl.DateTimeFormat('en-CA', {
    timeZone: MONTREAL.tz,
    hourCycle: 'h23',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });
  const out = {};
  for (const p of partsFormat.formatToParts(date)) if (p.type !== 'literal') out[p.type] = Number(p.value);
  return out; // { month, day, hour, minute }
}

export function clockText(date) {
  const { hour, minute } = montrealParts(date);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

// What the trees look like, from Montreal's calendar.
export function seasonFor({ month, day }) {
  const md = month * 100 + day;
  if (md >= 401 && md < 601) return 'spring';
  if (md >= 601 && md < 915) return 'summer';
  if (md >= 915 && md < 1101) return 'autumn';
  if (md >= 1101 && md < 1201) return 'late-autumn';
  return 'winter';
}

// WMO weather codes, as Open-Meteo reports them.
const CODES = {
  0: ['clear', 'clear', 0],
  1: ['mostly clear', 'clear', 0],
  2: ['partly cloudy', 'clouds', 0],
  3: ['overcast', 'clouds', 0],
  45: ['fog', 'fog', 0],
  48: ['freezing fog', 'fog', 0],
  51: ['light drizzle', 'rain', 0.2],
  53: ['drizzle', 'rain', 0.3],
  55: ['heavy drizzle', 'rain', 0.4],
  56: ['freezing drizzle', 'rain', 0.3],
  57: ['freezing drizzle', 'rain', 0.4],
  61: ['light rain', 'rain', 0.4],
  63: ['rain', 'rain', 0.65],
  65: ['heavy rain', 'rain', 1],
  66: ['freezing rain', 'sleet', 0.5],
  67: ['freezing rain', 'sleet', 0.8],
  71: ['light snow', 'snow', 0.35],
  73: ['snow', 'snow', 0.65],
  75: ['heavy snow', 'snow', 1],
  77: ['snow grains', 'snow', 0.25],
  80: ['light showers', 'rain', 0.45],
  81: ['showers', 'rain', 0.7],
  82: ['heavy showers', 'rain', 1],
  85: ['snow showers', 'snow', 0.6],
  86: ['heavy snow showers', 'snow', 1],
  95: ['thunderstorm', 'storm', 1],
  96: ['thunderstorm, hail', 'storm', 1],
  99: ['thunderstorm, hail', 'storm', 1],
};

export function weatherInfo(code) {
  const [text, kind, intensity] = CODES[code] || CODES[0];
  return { text, kind, intensity };
}

export function parseOverrides(search) {
  const q = new URLSearchParams(search);
  const num = (k) => (q.has(k) && q.get(k) !== '' && Number.isFinite(Number(q.get(k))) ? Number(q.get(k)) : null);
  const season = q.get('season');
  return {
    code: num('wx'),
    cloud: num('cloud'),
    snowCm: num('snow'),
    temp: num('temp'),
    hour: num('hour'),
    wind: num('wind'),
    season: ['spring', 'summer', 'autumn', 'late-autumn', 'winter'].includes(season) ? season : null,
  };
}

// Move a date so that Montreal's clock reads `hour` (decimal hours), keeping the day.
function atMontrealHour(date, hour) {
  const { hour: h, minute: m } = montrealParts(date);
  return new Date(date.getTime() + (hour - (h + m / 60)) * 3600e3);
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function computeConditions({ date, weather, overrides = {} }) {
  const o = overrides;
  const when = o.hour != null ? atMontrealHour(date, o.hour) : date;
  const sun = sunPosition(when, MONTREAL.lat, MONTREAL.lon);
  const code = o.code ?? weather?.code ?? 1;
  const info = weatherInfo(code);
  const live = Boolean(weather) || o.code != null;

  let cloud = clamp01((o.cloud ?? weather?.cloudCover ?? 15) / 100);
  if (code === 3) cloud = Math.max(cloud, 0.92);
  if (!['clear', 'clouds'].includes(info.kind)) cloud = Math.max(cloud, 0.88);
  if (code === 2) cloud = Math.min(Math.max(cloud, 0.35), 0.75);
  if (code <= 1) cloud = Math.min(cloud, 0.3);

  const temp = o.temp ?? weather?.temperature ?? null;
  const depthM = o.snowCm != null ? o.snowCm / 100 : weather?.snowDepth ?? 0;
  let snowCover = clamp01((depthM - 0.002) / 0.025);
  if (info.kind === 'snow') snowCover = Math.max(snowCover, 0.3 + 0.4 * info.intensity);

  let precip = null;
  if (info.kind === 'rain' || info.kind === 'storm') precip = { kind: 'rain', intensity: info.intensity };
  else if (info.kind === 'snow') precip = { kind: 'snow', intensity: info.intensity };
  else if (info.kind === 'sleet') precip = { kind: 'sleet', intensity: info.intensity };

  const windSpeed = o.wind ?? weather?.windSpeed ?? 8; // km/h
  const windFrom = weather?.windDirection ?? 250; // degrees the wind blows from
  const to = (windFrom + 180) * RAD;

  const season = o.season || seasonFor(montrealParts(when));
  const day = sun.elevation > -4;
  let icon = 'sun';
  if (info.kind === 'storm') icon = 'storm';
  else if (info.kind === 'snow' || info.kind === 'sleet') icon = 'snow';
  else if (info.kind === 'rain') icon = 'rain';
  else if (info.kind === 'fog') icon = 'fog';
  else if (cloud > 0.8) icon = 'cloud';
  else if (cloud > 0.3) icon = day ? 'partly' : 'partlyNight';
  else icon = day ? 'sun' : 'moon';

  return {
    date: when,
    sun,
    code,
    text: info.text,
    icon,
    live,
    temp,
    cloud,
    precip,
    storm: info.kind === 'storm',
    fog: info.kind === 'fog' ? 1 : info.kind === 'rain' && info.intensity < 0.45 ? 0.25 : 0,
    snowCover,
    season,
    wind: { speed: windSpeed, x: Math.sin(to), z: -Math.cos(to) },
  };
}
