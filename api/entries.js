// api/entries.js
// Vercel Serverless Function — handles GET and POST for entries

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── AUTH ──
  const ADMIN_SECRET = process.env.ADMIN_SECRET || 'doppel2024';
  const auth = req.headers.authorization;
  if (req.method !== 'GET') {
    if (!auth || auth !== `Bearer ${ADMIN_SECRET}`) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  // ── GET: return all published entries (public) or all entries (admin) ──
  if (req.method === 'GET') {
    const raw = await kv.get('entries') || '[]';
    let entries = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const isAdmin = auth === `Bearer ${ADMIN_SECRET}`;
    if (!isAdmin) {
      entries = entries.filter(e => e.status === 'published');
    }
    return res.status(200).json(entries);
  }

  // ── POST: save / update entry ──
  if (req.method === 'POST') {
    const raw = await kv.get('entries') || '[]';
    let entries = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const entry = req.body;

    if (!entry || !entry.title) {
      return res.status(400).json({ error: 'invalid entry' });
    }

    // auto-assign id if new
    if (!entry.id) {
      const maxId = entries.reduce((m, e) => Math.max(m, e.id || 0), 0);
      entry.id = maxId + 1;
    }

    entry.updatedAt = new Date().toISOString();

    const idx = entries.findIndex(e => e.id === entry.id);
    if (idx > -1) {
      entries[idx] = entry;
    } else {
      entries.unshift(entry);
    }

    await kv.set('entries', JSON.stringify(entries));
    return res.status(200).json({ ok: true, entry });
  }

  // ── DELETE ──
  if (req.method === 'DELETE') {
    const { id } = req.query;
    const raw = await kv.get('entries') || '[]';
    let entries = typeof raw === 'string' ? JSON.parse(raw) : raw;
    entries = entries.filter(e => e.id !== parseInt(id));
    await kv.set('entries', JSON.stringify(entries));
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
