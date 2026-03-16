// api/entries.js
// Vercel Serverless Function — usa Upstash Redis REST API

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const ADMIN_SECRET = process.env.ADMIN_SECRET || 'doppel2024';
  const REDIS_URL    = process.env.KV_REST_API_URL;
  const REDIS_TOKEN  = process.env.KV_REST_API_TOKEN;

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(500).json({ error: 'Redis not configured' });
  }

  async function redisGet(key) {
    const r = await fetch(`${REDIS_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
    const json = await r.json();
    return json.result ? JSON.parse(json.result) : [];
  }

  async function redisSet(key, value) {
    await fetch(`${REDIS_URL}/set/${key}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(JSON.stringify(value))
    });
  }

  const auth = req.headers.authorization;
  const isAdmin = auth === `Bearer ${ADMIN_SECRET}`;

  if (req.method === 'GET') {
    const entries = await redisGet('entries');
    const result = isAdmin ? entries : entries.filter(e => e.status === 'published');
    return res.status(200).json(result);
  }

  if (!isAdmin) return res.status(401).json({ error: 'unauthorized' });

  if (req.method === 'POST') {
    const entries = await redisGet('entries');
    const entry = req.body;
    if (!entry || !entry.title) return res.status(400).json({ error: 'invalid entry' });
    if (!entry.id) {
      const maxId = entries.reduce((m, e) => Math.max(m, e.id || 0), 0);
      entry.id = maxId + 1;
    }
    entry.updatedAt = new Date().toISOString();
    const idx = entries.findIndex(e => e.id === entry.id);
    if (idx > -1) entries[idx] = entry;
    else entries.unshift(entry);
    await redisSet('entries', entries);
    return res.status(200).json({ ok: true, entry });
  }

  if (req.method === 'DELETE') {
    const id = parseInt(req.query.id);
    let entries = await redisGet('entries');
    entries = entries.filter(e => e.id !== id);
    await redisSet('entries', entries);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'method not allowed' });
}