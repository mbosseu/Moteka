// Session du back-office Moteka : jeton HS256 (meme format que BOXPLUS) dans un cookie HttpOnly signe.
import crypto from 'node:crypto';

export const COOKIE = 'moteka_admin_session';
export const DUREE_SEC = 60 * 60 * 12;
const SECRETS_FAIBLES = new Set(['', 'change-me', 'change-me-in-production']);

function enProduction() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production' || String(process.env.VERCEL || '') === '1';
}

let secretDev = '';

/** Secret de signature : MOTEKA_ADMIN_SESSION_SECRET, sinon SESSION_SECRET. Obligatoire en production. */
export function secretSession(env = process.env) {
  for (const brut of [env.MOTEKA_ADMIN_SESSION_SECRET, env.SESSION_SECRET]) {
    const v = String(brut || '').trim();
    if (v && !SECRETS_FAIBLES.has(v) && v.length >= 16) return v;
  }
  // Hors production uniquement (developpement local) : secret aleatoire le temps du processus.
  if (env !== process.env || enProduction()) return '';
  if (!secretDev) secretDev = crypto.randomBytes(32).toString('hex');
  return secretDev;
}

export function egaliteConstante(a, b) {
  const x = Buffer.from(String(a || ''), 'utf8');
  const y = Buffer.from(String(b || ''), 'utf8');
  if (!x.length || !y.length) return false;
  const cle = crypto.randomBytes(32);
  const hx = crypto.createHmac('sha256', cle).update(x).digest();
  const hy = crypto.createHmac('sha256', cle).update(y).digest();
  return crypto.timingSafeEqual(hx, hy);
}

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

export function signerJeton(charge, secret) {
  if (!secret) throw new Error('session_secret_missing');
  const donnees = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(charge)}`;
  const sig = crypto.createHmac('sha256', secret).update(donnees).digest('base64url');
  return `${donnees}.${sig}`;
}

/** Renvoie la charge si la signature et l'expiration sont valides, sinon null. */
export function verifierJeton(jeton, secret, maintenant = Date.now()) {
  if (!secret) return null;
  const parts = String(jeton || '').split('.');
  if (parts.length !== 3) return null;
  const attendu = crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest('base64url');
  const a = Buffer.from(parts[2]);
  const b = Buffer.from(attendu);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const charge = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!charge || typeof charge !== 'object') return null;
    if (!charge.exp || Math.floor(maintenant / 1000) > charge.exp) return null;
    return charge;
  } catch {
    return null;
  }
}

export function lireCookie(req, nom = COOKIE) {
  const brut = req.headers?.cookie || '';
  for (const morceau of brut.split(';')) {
    const i = morceau.indexOf('=');
    if (i < 0) continue;
    if (morceau.slice(0, i).trim() === nom) {
      try { return decodeURIComponent(morceau.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

function drapeaux() {
  const parts = ['Path=/', 'HttpOnly', 'SameSite=Strict'];
  if (enProduction()) parts.push('Secure');
  return parts;
}

export function poserSession(res, utilisateur) {
  const jeton = signerJeton(
    {
      email: utilisateur.email,
      role: utilisateur.role,
      name: utilisateur.name || '',
      exp: Math.floor(Date.now() / 1000) + DUREE_SEC,
    },
    secretSession()
  );
  res.setHeader('Set-Cookie', [`${COOKIE}=${encodeURIComponent(jeton)}`, ...drapeaux(), `Max-Age=${DUREE_SEC}`].join('; '));
}

export function effacerSession(res) {
  res.setHeader('Set-Cookie', [`${COOKIE}=`, ...drapeaux(), 'Max-Age=0'].join('; '));
}

export function lireSession(req) {
  const charge = verifierJeton(lireCookie(req), secretSession());
  return charge ? { email: charge.email, role: charge.role, name: charge.name } : null;
}
