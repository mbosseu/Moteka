// POST /api/admin/login : { email, password } -> cookie de session HttpOnly.
import { lireCorps } from '../_lib/http.mjs';
import { accepter, memeOrigine, repondre } from '../_lib/admin-http.mjs';
import { connexionBloquee, effacerEchecs, ipRequete, noterEchec, verifierConnexion } from '../_lib/admin-auth.mjs';
import { poserSession, secretSession } from '../_lib/admin-session.mjs';

export default async function handler(req, res) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
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
