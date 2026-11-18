// Montreal's current weather for the homepage town, from Open-Meteo (free, no key).
// Fetched on the server and cached for 10 minutes, so visitors don't each call Open-Meteo.

export const revalidate = 600;

const SOURCE =
  'https://api.open-meteo.com/v1/forecast?latitude=45.5019&longitude=-73.5674' +
  '&current=temperature_2m,is_day,precipitation,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,snow_depth' +
  '&daily=sunrise,sunset&timezone=America%2FToronto&forecast_days=1';

export async function GET() {
  try {
    const res = await fetch(SOURCE, { next: { revalidate: 600 } });
    if (!res.ok) throw new Error(`Open-Meteo answered ${res.status}`);
    const data = await res.json();
    const c = data.current;
    return Response.json(
      {
        time: c.time,
        temperature: c.temperature_2m,
        isDay: c.is_day === 1,
        code: c.weather_code,
        cloudCover: c.cloud_cover,
        precipitation: c.precipitation,
        snowfall: c.snowfall,
        snowDepth: c.snow_depth ?? 0,
        windSpeed: c.wind_speed_10m,
        windDirection: c.wind_direction_10m,
        sunrise: data.daily?.sunrise?.[0] ?? null,
        sunset: data.daily?.sunset?.[0] ?? null,
      },
      { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' } }
    );
  } catch (err) {
    console.error('weather:', err);
    return Response.json({ error: 'Weather is unavailable right now.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
