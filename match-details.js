export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { matchId, date } = req.query;
  const isMatch = typeof matchId === 'string' && /^\d{1,10}$/.test(matchId) && date === undefined;
  const isDate = typeof date === 'string' && /^\d{8}$/.test(date) && matchId === undefined;
  if (!isMatch && !isDate) return res.status(400).json({ error: 'Pass a match ID or a date (YYYYMMDD)' });

  const endpoint = isMatch ? 'matchDetails?matchId=' + matchId : 'matches?date=' + date;
  try {
    const upstream = await fetch('https://www.fotmob.com/api/data/' + endpoint, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) return res.status(upstream.status === 404 ? 404 : 502).json({ error: 'Match data unavailable' });

    const data = await upstream.json();
    res.setHeader('Cache-Control', isMatch && data.header?.status?.finished
      ? 'public, s-maxage=3600' : 'public, s-maxage=10');
    if (isMatch) {
      const { lineup, playerStats, matchFacts } = data.content || {};
      return res.status(200).json({
        header: data.header,
        content: { lineup, playerStats, matchFacts: { events: matchFacts?.events } },
      });
    }
    const matches = (data.leagues || []).flatMap(league => league.matches || [])
      .filter(match => match.home?.id === 8633 || match.away?.id === 8633);
    return res.status(200).json({ matches });
  } catch {
    return res.status(502).json({ error: 'Match data unavailable' });
  }
}
