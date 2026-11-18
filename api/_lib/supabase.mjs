// Acces a la table public.moteka_concours via l'API REST PostgREST de Supabase (sans dependance).

const TABLE = 'moteka_concours';

function base() {
  return String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
}

function cle() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
}

export function supabaseConfigure() {
  return Boolean(base() && cle());
}

function entetes(extra = {}) {
  const k = cle();
  return { apikey: k, Authorization: `Bearer ${k}`, 'Content-Type': 'application/json', Accept: 'application/json', ...extra };
}

async function requete(chemin, options = {}) {
  const res = await fetch(`${base()}/rest/v1/${chemin}`, { ...options, headers: entetes(options.headers) });
  const texte = await res.text();
  let data = null;
  try { data = texte ? JSON.parse(texte) : null; } catch { data = texte; }
  if (!res.ok) {
    const err = new Error((data && data.message) || `Supabase HTTP ${res.status}`);
    err.code = data && data.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

const COLONNES = 'id,prenom,nom,telephone,email,ami_emails,avis,tickets,source,created_at';

/** Cherche un participant par cle telephone ou email. */
export async function trouverDoublon({ phone_key, email }) {
  const filtres = [];
  if (phone_key) filtres.push(`phone_key.eq.${encodeURIComponent(phone_key)}`);
  if (email) filtres.push(`email.eq.${encodeURIComponent(`"${email.replace(/"/g, '')}"`)}`);
  if (!filtres.length) return null;
  const lignes = await requete(`${TABLE}?select=${COLONNES}&or=(${filtres.join(',')})&limit=1`);
  return Array.isArray(lignes) && lignes[0] ? lignes[0] : null;
}

export async function trouverParId(id) {
  const lignes = await requete(`${TABLE}?select=${COLONNES}&id=eq.${encodeURIComponent(id)}&limit=1`);
  return Array.isArray(lignes) && lignes[0] ? lignes[0] : null;
}

/** Cherche un participant dont le telephone ET l'email correspondent. */
export async function trouverParTelEtEmail({ phone_key, email }) {
  const lignes = await requete(
    `${TABLE}?select=${COLONNES}&phone_key=eq.${encodeURIComponent(phone_key)}&email=eq.${encodeURIComponent(email)}&limit=1`
  );
  return Array.isArray(lignes) && lignes[0] ? lignes[0] : null;
}

export async function creerParticipant(donnees) {
  const lignes = await requete(`${TABLE}?select=${COLONNES}`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(donnees),
  });
  return Array.isArray(lignes) ? lignes[0] : lignes;
}

export async function marquerAvis(id) {
  const lignes = await requete(`${TABLE}?id=eq.${encodeURIComponent(id)}&select=${COLONNES}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ avis: true, tickets: 2, updated_at: new Date().toISOString() }),
  });
  return Array.isArray(lignes) ? lignes[0] : lignes;
}
