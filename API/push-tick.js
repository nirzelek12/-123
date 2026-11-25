// Vercel supplies the bearer token for scheduled requests when CRON_SECRET is set.
export default async function handler(req, res) {
  if (!process.env.CRON_SECRET || req.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET)
    return res.status(401).end();
  try {
    const result = await fetch('https://workflows.zite.com/public/8wsdtq9hgp/api/pushTick', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({inputs:{reason:'scheduled'}, mode:'live'}),
      signal: AbortSignal.timeout(15000)
    });
    return res.status(result.ok ? 204 : 502).end();
  } catch { return res.status(502).end(); }
}
