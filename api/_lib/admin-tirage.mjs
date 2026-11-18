// Logique pure du back-office : eligibilite au tirage, choix du lot, assemblage des participants, export CSV.
import crypto from 'node:crypto';

/** Date du jour a Paris au format AAAA-MM-JJ. */
export function dateParis(maintenant = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(maintenant);
  const v = (t) => parts.find((p) => p.type === t)?.value;
  return `${v('year')}-${v('month')}-${v('day')}`;
}

// Periode du jeu : un tirage par soir du lundi 23 au vendredi 27 novembre 2026 inclus.
export const PERIODE_TIRAGES = { debut: '2026-11-23', fin: '2026-11-27' };

/** Vrai si la date (AAAA-MM-JJ) est un soir de tirage autorise. */
export function dateDansPeriode(date, periode = PERIODE_TIRAGES) {
  return dateValide(date) && date >= periode.debut && date <= periode.fin;
}

export function dateValide(texte) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(texte || ''))) return false;
  const d = new Date(`${texte}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texte;
}

/**
 * Tickets encore eligibles : ni le ticket ni aucun autre ticket du meme participant ne doit avoir gagne.
 * Un participant gagne donc une seule fois sur toute la duree du jeu.
 */
export function ticketsEligibles(tickets, tirages) {
  const numerosGagnants = new Set();
  const participantsGagnants = new Set();
  for (const t of tirages || []) {
    if (t.numero != null) numerosGagnants.add(Number(t.numero));
    if (t.participant_id) participantsGagnants.add(String(t.participant_id));
  }
  return (tickets || []).filter(
    (t) => t && t.participant_id && !numerosGagnants.has(Number(t.numero)) && !participantsGagnants.has(String(t.participant_id))
  );
}

/** Tire un ticket au hasard (crypto.randomInt, distribution uniforme sur les tickets). */
export function tirerTicket(eligibles, aleatoire = crypto.randomInt) {
  if (!eligibles?.length) return null;
  const i = aleatoire(eligibles.length);
  return eligibles[i] || null;
}

/** Retrouve le ticket gagnant choisi manuellement (numero ou participant_id). */
export function resoudreTicketGagnant(eligibles, choix = {}) {
  if (!eligibles?.length) return { erreur: 'Aucun ticket éligible.' };
  const numeroRaw = choix.numero;
  const pid =
    choix.participant_id != null && choix.participant_id !== '' ? String(choix.participant_id) : '';
  if (numeroRaw != null && numeroRaw !== '') {
    const n = Number(numeroRaw);
    if (!Number.isFinite(n)) return { erreur: 'Numéro de ticket invalide.' };
    const ticket = eligibles.find((t) => Number(t.numero) === n);
    if (!ticket) return { erreur: 'Ce numéro de ticket n\'est pas éligible pour ce tirage.' };
    return { ticket };
  }
  if (pid) {
    const tickets = eligibles.filter((t) => String(t.participant_id) === pid);
    if (!tickets.length) return { erreur: 'Ce participant n\'a aucun ticket éligible.' };
    tickets.sort((a, b) => Number(a.numero) - Number(b.numero));
    return { ticket: tickets[0] };
  }
  return { erreur: 'Indiquez le gagnant (numéro de ticket ou participant).' };
}

/**
 * Lot a attribuer : celui demande (actif et pas encore attribue) ou, a defaut, le prochain lot actif
 * non attribue dans l'ordre. Renvoie { lot } ou { erreur }.
 */
export function choisirLot(lots, tirages, lotDemande = null) {
  const attribues = new Set((tirages || []).map((t) => String(t.lot_id)));
  const disponibles = (lots || [])
    .filter((l) => l.actif !== false && !attribues.has(String(l.id)))
    .sort((a, b) => Number(a.ordre) - Number(b.ordre));
  if (lotDemande != null && lotDemande !== '') {
    const lot = disponibles.find((l) => String(l.id) === String(lotDemande));
    if (!lot) return { erreur: 'Ce lot est inactif, inconnu ou déjà attribué.' };
    return { lot };
  }
  if (!disponibles.length) return { erreur: 'Tous les lots ont déjà été attribués.' };
  return { lot: disponibles[0] };
}

/** "Prenom N." : ce qui peut etre montre a l'ecran pendant le direct. */
export function nomPublic(prenom, nom) {
  const p = String(prenom || '').trim();
  const initiale = String(nom || '').trim().charAt(0).toUpperCase();
  return initiale ? `${p} ${initiale}.` : p;
}

/** Participants avec leurs tickets et leur eventuel gain, du plus recent au plus ancien. */
export function assemblerParticipants(participants, tickets, tirages = [], lots = []) {
  const parParticipant = new Map();
  for (const t of tickets || []) {
    const cle = String(t.participant_id);
    if (!parParticipant.has(cle)) parParticipant.set(cle, []);
    parParticipant.get(cle).push({ numero: Number(t.numero), motif: t.motif });
  }
  const lotsParId = new Map((lots || []).map((l) => [String(l.id), l]));
  const gains = new Map((tirages || []).map((t) => [String(t.participant_id), t]));
  return (participants || [])
    .map((p) => {
      const g = gains.get(String(p.id));
      return {
        ...p,
        amis: Array.isArray(p.amis) ? p.amis : [],
        tickets: (parParticipant.get(String(p.id)) || []).sort((a, b) => a.numero - b.numero),
        gain: g ? { date_tirage: g.date_tirage, numero: Number(g.numero), lot: lotsParId.get(String(g.lot_id))?.nom || '' } : null,
      };
    })
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

export function statistiques(participants, tickets, tirages = []) {
  return {
    inscrits: (participants || []).length,
    tickets: (tickets || []).length,
    eligibles: ticketsEligibles(tickets, tirages).length,
    tirages: (tirages || []).length,
  };
}

function cellule(valeur) {
  let v = valeur == null ? '' : String(valeur);
  // Protection contre l'injection de formules dans Excel / LibreOffice.
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function emailsAmis(amis) {
  return (Array.isArray(amis) ? amis : [])
    .map((a) => (typeof a === 'string' ? a : a?.email || ''))
    .filter(Boolean)
    .join(' ');
}

/** Export CSV (separateur point-virgule, BOM UTF-8 pour Excel). */
export function csvParticipants(liste) {
  const entete = ['Prénom', 'Nom', 'Téléphone', 'Email', 'Tickets', 'Nombre de tickets', 'Avis Google', 'Ami(e)s invité(e)s', 'Source', 'Inscription', 'Gain'];
  const lignes = (liste || []).map((p) =>
    [
      p.prenom,
      p.nom,
      p.telephone,
      p.email,
      (p.tickets || []).map((t) => t.numero).join(' '),
      (p.tickets || []).length,
      statutAvisCourt(p),
      emailsAmis(p.amis),
      p.source,
      p.created_at,
      p.gain ? `${p.gain.date_tirage} ticket ${p.gain.numero} ${p.gain.lot}` : '',
    ]
      .map(cellule)
      .join(';')
  );
  return `﻿${[entete.map(cellule).join(';'), ...lignes].join('\r\n')}\r\n`;
}

/** Historique lisible des tirages (plus recent en premier). */
export function historiqueTirages(tirages, participants, lots) {
  const pParId = new Map((participants || []).map((p) => [String(p.id), p]));
  const lParId = new Map((lots || []).map((l) => [String(l.id), l]));
  return [...(tirages || [])]
    .sort((a, b) => String(b.date_tirage).localeCompare(String(a.date_tirage)))
    .map((t) => {
      const p = pParId.get(String(t.participant_id));
      const l = lParId.get(String(t.lot_id));
      return {
        id: t.id,
        date_tirage: t.date_tirage,
        numero: Number(t.numero),
        gagnant: p ? nomPublic(p.prenom, p.nom) : '',
        prenom: p?.prenom || '',
        nom: p?.nom || '',
        telephone: p?.telephone || '',
        email: p?.email || '',
        lot: l ? { id: l.id, nom: l.nom, description: l.description, ordre: l.ordre } : null,
        created_at: t.created_at,
      };
    });
}

/** Nettoie les champs modifiables d'un lot. Renvoie { champs } ou { erreur }. */
export function validerLot(corps) {
  const champs = {};
  if ('nom' in corps) {
    const nom = String(corps.nom || '').trim();
    if (!nom || nom.length > 120) return { erreur: 'Le nom du lot est obligatoire (120 caractères au plus).' };
    champs.nom = nom;
  }
  if ('description' in corps) {
    const d = String(corps.description || '').trim();
    if (d.length > 600) return { erreur: 'Description trop longue (600 caractères au plus).' };
    champs.description = d;
  }
  if ('image_url' in corps) {
    const u = String(corps.image_url || '').trim();
    if (u && !/^https:\/\/|^\/[^/]/.test(u)) return { erreur: "L'image doit être une adresse https ou un chemin du site." };
    champs.image_url = u || null;
  }
  if ('actif' in corps) champs.actif = Boolean(corps.actif);
  if (!Object.keys(champs).length) return { erreur: 'Aucune modification.' };
  return { champs };
}

/* ---------- Preuve d'avis Google ---------- */

const LIBELLES_STATUT_AVIS = { aucun: 'non', a_verifier: 'à vérifier', valide: 'validé', refuse: 'refusé' };

/** Statut lisible de l'avis (liste, export). */
export function statutAvisCourt(p = {}) {
  if (p.avis_statut && LIBELLES_STATUT_AVIS[p.avis_statut]) return LIBELLES_STATUT_AVIS[p.avis_statut];
  return p.avis ? 'oui' : 'non';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Corps de POST /api/admin/avis : { id, decision: 'valider' | 'refuser' }. */
export function validerDecisionAvis(corps = {}) {
  const id = String(corps.id || '').trim();
  const decision = String(corps.decision || '').trim();
  if (!UUID.test(id)) return { erreur: 'Participant inconnu.' };
  if (decision !== 'valider' && decision !== 'refuser') return { erreur: 'Décision inconnue (valider ou refuser).' };
  return { id, decision };
}

/**
 * Ce qu'il faut faire pour une decision sur la preuve d'avis.
 * participant : { avis_statut }, ticket : ticket avis existant ou null, tirages : tirages gagnes par ce ticket.
 * Renvoie { erreur, statut } ou { deja } ou { champs, supprimerTicket, ajouterTicket, mail }.
 * Refuser retire le ticket avis, sauf s'il a deja gagne un tirage.
 */
export function planDecisionAvis({ decision, participant, ticket = null, tirages = [] }) {
  if (!participant) return { statut: 404, erreur: 'Participant introuvable.' };
  const actuel = participant.avis_statut || 'aucun';
  if (actuel === 'aucun') return { statut: 409, erreur: 'Ce participant n’a envoyé aucune preuve d’avis.' };
  if (decision === 'valider') {
    if (actuel === 'valide' && ticket) return { deja: true };
    return { champs: { avis: true, avis_statut: 'valide' }, supprimerTicket: false, ajouterTicket: !ticket, mail: false };
  }
  if (actuel === 'refuse' && !ticket) return { deja: true };
  if (ticket && (tirages || []).length) {
    return {
      statut: 409,
      erreur: `Le ticket avis n. ${ticket.numero} a déjà gagné un tirage : impossible de refuser la preuve. Annulez d’abord ce tirage si besoin.`,
    };
  }
  return { champs: { avis: false, avis_statut: 'refuse' }, supprimerTicket: Boolean(ticket), ajouterTicket: false, mail: true };
}
