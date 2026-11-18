// Session du back-office, regroupee en une seule fonction (limite de 12 fonctions du plan Vercel) :
//   POST /api/admin/login  : { email, password } -> cookie de session HttpOnly
//   GET  /api/admin/me     : utilisateur connecte          (reecrit vers login?action=me)
//   POST /api/admin/logout : efface le cookie de session   (reecrit vers login?action=logout)
import { lireCorps } from '../_lib/http.mjs';
import { accepter, exigerSession, memeOrigine, repondre } from '../_lib/admin-http.mjs';
import { connexionBloquee, effacerEchecs, ipRequete, noterEchec, verifierConnexion } from '../_lib/admin-auth.mjs';
import { effacerSession, poserSession, secretSession } from '../_lib/admin-session.mjs';

export function actionSession(req) {
  const url = String(req.url || '');
  let action = '';
  try {
    action = new URL(url, 'http://local').searchParams.get('action') || '';
  } catch {
    action = '';
  }
  if (!action) action = (req.query && req.query.action) || '';
  if (!action) {
    if (/\/api\/admin\/me(\?|$)/.test(url)) action = 'me';
    else if (/\/api\/admin\/logout(\?|$)/.test(url)) action = 'logout';
  }
  return ['me', 'logout'].includes(action) ? action : 'login';
}

function moi(req, res) {
  if (!accepter(req, res, ['GET'])) return;
  const session = exigerSession(req, res);
  if (!session) return;
  return repondre(res, 200, { ok: true, user: session });
}

function deconnexion(req, res) {
  if (!accepter(req, res, ['POST'])) return;
  effacerSession(res);
  return repondre(res, 200, { ok: true });
}

async function connexion(req, res) {
  if (!accepter(req, res, ['POST'])) return;
  if (!memeOrigine(req, res)) return;
  if (!secretSession()) {
    console.error('[admin] MOTEKA_ADMIN_SESSION_SECRET (ou SESSION_SECRET) manquant');
    return repondre(res, 503, { ok: false, message: 'Back-office non configuré (secret de session manquant).' });
  }
  const ip = ipRequete(req);
  if (connexionBloquee(ip)) {
    return repondre(res, 429, { ok: false, message: 'Trop d’essais. Réessayez dans quelques minutes.' });
  }
  const { email, password } = lireCorps(req);
  const utilisateur = await verifierConnexion(email, password);
  if (!utilisateur) {
    noterEchec(ip);
    return repondre(res, 401, { ok: false, message: 'Email ou mot de passe incorrect' });
  }
  effacerEchecs(ip);
  poserSession(res, utilisateur);
  return repondre(res, 200, { ok: true, user: { email: utilisateur.email, name: utilisateur.name, role: utilisateur.role } });
}

export default async function handler(req, res) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const action = actionSession(req);
  if (action === 'me') return moi(req, res);
  if (action === 'logout') return deconnexion(req, res);
  return connexion(req, res);
}
