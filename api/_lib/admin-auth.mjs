// Connexion au back-office : memes comptes que le back-office de la boutique BOXPLUS.
// 1. Super administrateur : SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD (variables d'environnement).
// 2. Sinon : table app_users (email, password_hash bcrypt, role, name) de la base Supabase BOXPLUS.
import { verifierBcrypt } from './admin-bcrypt.mjs';
import { compteAdminParEmail } from './admin-db.mjs';
import { egaliteConstante } from './admin-session.mjs';

const roleBase = (role) => (role === 'super_admin' ? 'admin' : role || 'admin');

/**
 * Verifie un couple email / mot de passe. Renvoie { email, role, name } ou null.
 * `chercherCompte` est injectable pour les tests.
 */
export async function verifierConnexion(email, motDePasse, { env = process.env, chercherCompte = compteAdminParEmail } = {}) {
  const normalise = String(email || '').trim().toLowerCase();
  if (!normalise || !motDePasse || normalise.length > 200 || String(motDePasse).length > 200) return null;

  const superEmail = String(env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const superMdp = String(env.SUPER_ADMIN_PASSWORD || '');
  if (superEmail && egaliteConstante(normalise, superEmail)) {
    if (superMdp && egaliteConstante(motDePasse, superMdp)) {
      return { email: normalise, role: 'super_admin', name: 'Super administrateur' };
    }
    return null;
  }

  try {
    const compte = await chercherCompte(normalise);
    if (!compte || !compte.password_hash) return null;
    if (!verifierBcrypt(String(motDePasse), compte.password_hash)) return null;
    return { email: compte.email, role: roleBase(compte.role), name: compte.name || compte.email };
  } catch (err) {
    console.error('[admin] verification du compte impossible', err?.message || err);
    return null;
  }
}

// Limitation des essais (memoire de l'instance, au mieux) : 8 echecs en 15 minutes par adresse IP.
const echecs = new Map();
const FENETRE_MS = 15 * 60 * 1000;
const MAX_ECHECS = 8;

export function ipRequete(req) {
  return String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim() || 'inconnue';
}

export function connexionBloquee(ip, maintenant = Date.now()) {
  const e = echecs.get(ip);
  if (!e) return false;
  if (maintenant - e.debut > FENETRE_MS) {
    echecs.delete(ip);
    return false;
  }
  return e.nombre >= MAX_ECHECS;
}

export function noterEchec(ip, maintenant = Date.now()) {
  const e = echecs.get(ip);
  if (!e || maintenant - e.debut > FENETRE_MS) echecs.set(ip, { debut: maintenant, nombre: 1 });
  else e.nombre += 1;
}

export function effacerEchecs(ip) {
  echecs.delete(ip);
}
