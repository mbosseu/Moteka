// Utilitaires communs aux fonctions /api/admin/*.
import { repondre } from './http.mjs';
import { lireSession } from './admin-session.mjs';

export { repondre };

/** Verifie la methode HTTP ; repond 405 sinon. */
export function accepter(req, res, methodes) {
  if (methodes.includes(req.method)) return true;
  res.setHeader('Allow', methodes.join(', '));
  repondre(res, 405, { ok: false, message: 'Méthode non autorisée' });
  return false;
}

/** Session obligatoire : renvoie l'utilisateur, ou repond 401 et renvoie null. */
export function exigerSession(req, res) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const session = lireSession(req);
  if (!session) {
    repondre(res, 401, { ok: false, message: 'Session expirée, reconnectez-vous.' });
    return null;
  }
  return session;
}

/** Requete d'origine croisee refusee pour les ecritures (en plus du cookie SameSite=Strict). */
export function memeOrigine(req, res) {
  const origine = req.headers.origin;
  if (!origine) return true;
  const hote = req.headers['x-forwarded-host'] || req.headers.host || '';
  try {
    if (new URL(origine).host === hote) return true;
  } catch {
    /* origine illisible */
  }
  repondre(res, 403, { ok: false, message: 'Origine refusée' });
  return false;
}

export function erreurServeur(res, err, contexte) {
  console.error(`[admin] ${contexte}`, err?.message || err);
  if (err?.message === 'supabase_non_configure') {
    return repondre(res, 503, { ok: false, message: 'Base de données non configurée (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' });
  }
  if (err?.code === '42P01' || err?.code === 'PGRST205') {
    return repondre(res, 503, { ok: false, message: 'Tables manquantes : exécutez supabase/002_moteka_tirages.sql.' });
  }
  return repondre(res, 500, { ok: false, message: 'Erreur serveur, réessayez.' });
}
