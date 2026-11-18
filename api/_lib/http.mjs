// Petits utilitaires HTTP communs aux fonctions Vercel.

export function lireCorps(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === 'string') {
    try { return JSON.parse(b); } catch { return {}; }
  }
  if (Buffer.isBuffer(b)) {
    try { return JSON.parse(b.toString('utf8')); } catch { return {}; }
  }
  return b;
}

export function repondre(res, statut, donnees) {
  res.statusCode = statut;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(donnees));
}

export function lienPage(req) {
  const env = String(process.env.PUBLIC_URL || '').trim();
  if (env) return (/^https?:\/\//i.test(env) ? env : `https://${env}`).replace(/\/$/, '');
  const hote = req.headers['x-forwarded-host'] || req.headers.host || '';
  return hote ? `https://${hote}` : '';
}

export function verifierMethode(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Allow', 'POST, OPTIONS');
    res.end();
    return false;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    repondre(res, 405, { ok: false, message: 'Méthode non autorisée' });
    return false;
  }
  return true;
}
