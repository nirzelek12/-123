// Keep the provider request on the server (the browser need not have CORS access).
export default async function handler(req, res) {
  const id = req.query.matchId;
  if (req.method !== 'GET' || !/^\d{1,12}$/.test(String(id))) return res.status(400).end();
  try {
    const upstream = await fetch('https://www.fotmob.com/api/data/matchDetails?matchId=' + id,
      {signal: AbortSignal.timeout(10000)});
    if (!upstream.ok) return res.status(502).end();
    const data = await upstream.json();
    res.setHeader('Cache-Control', 'public, s-maxage=8');
    return res.json(data);
  } catch { return res.status(502).end(); }
}
