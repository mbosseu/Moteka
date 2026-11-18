// Acces Supabase (PostgREST) pour le back-office : participants, tickets, lots, tirages, comptes admin.

function config(prefixe = '') {
  const url = String(process.env[`${prefixe}SUPABASE_URL`] || '').trim().replace(/\/$/, '');
  const cle = String(process.env[`${prefixe}SUPABASE_SERVICE_ROLE_KEY`] || '').trim();
  return { url, cle };
}

/** Base des comptes admin : celle de BOXPLUS si ADMIN_USERS_SUPABASE_* est renseigne, sinon celle du concours. */
function configComptes() {
  const dediee = config('ADMIN_USERS_');
  return dediee.url && dediee.cle ? dediee : config();
}

export function baseConfiguree() {
  const c = config();
  return Boolean(c.url && c.cle);
}

async function requete(chemin, options = {}, cfg = config()) {
  if (!cfg.url || !cfg.cle) {
    const err = new Error('supabase_non_configure');
    err.status = 503;
    throw err;
  }
  const res = await fetch(`${cfg.url}/rest/v1/${chemin}`, {
    ...options,
    headers: {
      apikey: cfg.cle,
      Authorization: `Bearer ${cfg.cle}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });
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

/** Lit toutes les lignes d'une requete, par pages de 1000. */
async function toutLire(chemin) {
  const lignes = [];
  const pas = 1000;
  for (let debut = 0; debut < 200000; debut += pas) {
    const page = await requete(chemin, { headers: { Range: `${debut}-${debut + pas - 1}`, 'Range-Unit': 'items' } });
    if (!Array.isArray(page)) break;
    lignes.push(...page);
    if (page.length < pas) break;
  }
  return lignes;
}

export async function compteAdminParEmail(email) {
  const lignes = await requete(
    `app_users?select=email,password_hash,role,name&email=eq.${encodeURIComponent(email)}&limit=1`,
    {},
    configComptes()
  );
  return Array.isArray(lignes) && lignes[0] ? lignes[0] : null;
}

// Jamais avis_preuve dans une liste : la capture (lourde) se charge a la demande via lirePreuveAvis().
export const lireParticipants = () =>
  toutLire('moteka_concours?select=id,prenom,nom,telephone,email,amis,avis,avis_statut,avis_le,source,created_at&order=created_at.asc');

export const lireTickets = () => toutLire('moteka_tickets?select=numero,participant_id,motif,created_at&order=numero.asc');

export const lireLots = () => toutLire('moteka_lots?select=id,ordre,nom,description,image_url,actif&order=ordre.asc');

export const lireTirages = () =>
  toutLire('moteka_tirages?select=id,date_tirage,numero,participant_id,lot_id,created_at&order=date_tirage.desc');

export async function lireParticipant(id) {
  const lignes = await requete(`moteka_concours?select=id,prenom,nom&id=eq.${encodeURIComponent(id)}&limit=1`);
  return Array.isArray(lignes) && lignes[0] ? lignes[0] : null;
}

export async function modifierLot(id, champs) {
  const lignes = await requete(`moteka_lots?id=eq.${encodeURIComponent(id)}&select=id,ordre,nom,description,image_url,actif`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(champs),
  });
  return Array.isArray(lignes) ? lignes[0] || null : lignes;
}

export async function enregistrerTirage(ligne) {
  const lignes = await requete('moteka_tirages?select=id,date_tirage,numero,participant_id,lot_id,created_at', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(ligne),
  });
  return Array.isArray(lignes) ? lignes[0] : lignes;
}

export async function supprimerTirage(id) {
  await requete(`moteka_tirages?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** Retire un participant (tricheur) : d'abord ses tirages (lot redevient dispo), puis tickets, puis la fiche. */
export async function supprimerParticipant(id) {
  const cle = encodeURIComponent(id);
  await requete(`moteka_tirages?participant_id=eq.${cle}`, { method: 'DELETE' });
  await requete(`moteka_tickets?participant_id=eq.${cle}`, { method: 'DELETE' });
  await requete(`moteka_concours?id=eq.${cle}`, { method: 'DELETE' });
}

/* ---------- Preuve d'avis Google ---------- */

/** Capture de l'avis d'un participant (data URL), chargee a la demande. */
export async function lirePreuveAvis(id) {
  const lignes = await requete(`moteka_concours?select=id,avis_preuve&id=eq.${encodeURIComponent(id)}&limit=1`);
  return Array.isArray(lignes) && lignes[0] ? lignes[0] : null;
}

/** Participant pour une decision sur l'avis (sans la capture). */
export async function lireParticipantAvis(id) {
  const lignes = await requete(
    `moteka_concours?select=id,prenom,nom,email,avis,avis_statut,avis_le&id=eq.${encodeURIComponent(id)}&limit=1`
  );
  return Array.isArray(lignes) && lignes[0] ? lignes[0] : null;
}

export async function majAvisParticipant(id, champs) {
  const lignes = await requete(`moteka_concours?id=eq.${encodeURIComponent(id)}&select=id,avis,avis_statut,avis_le`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ ...champs, updated_at: new Date().toISOString() }),
  });
  return Array.isArray(lignes) ? lignes[0] || null : lignes;
}

export async function lireTicketAvis(participantId) {
  const lignes = await requete(
    `moteka_tickets?select=numero,participant_id,motif&participant_id=eq.${encodeURIComponent(participantId)}&motif=eq.avis&limit=1`
  );
  return Array.isArray(lignes) && lignes[0] ? lignes[0] : null;
}

export async function tiragesDuNumero(numero) {
  const lignes = await requete(`moteka_tirages?select=id,date_tirage,numero&numero=eq.${encodeURIComponent(numero)}`);
  return Array.isArray(lignes) ? lignes : [];
}

export async function supprimerTicketAvis(participantId) {
  await requete(`moteka_tickets?participant_id=eq.${encodeURIComponent(participantId)}&motif=eq.avis`, { method: 'DELETE' });
}

/** Ajoute le ticket avis (validation d'une preuve auparavant refusee). Renvoie le ticket ou null s'il existe deja. */
export async function ajouterTicketAvis(participantId) {
  try {
    const lignes = await requete('moteka_tickets?select=numero,motif', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ participant_id: participantId, motif: 'avis' }),
    });
    return Array.isArray(lignes) ? lignes[0] : lignes;
  } catch (err) {
    if (err.code === '23505') return null;
    throw err;
  }
}
