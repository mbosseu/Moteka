// Orchestration commune : identification d'un participant, tickets bonus (amis, avis) et mails associes.
import { clePhone, motifsManquants, motifsTickets, nettoyerEmail } from './concours.mjs';
import { attribuerTickets, listerTickets, majParticipant, trouverParId, trouverParTelEtEmail } from './supabase.mjs';
import { brevoConfigure, envoyerMail } from './brevo.mjs';
import { destinatairesInternes, mailAmi, mailInterne, mailNouveauTicket } from './mails.mjs';
import { lienPage } from './http.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reduit un ticket a ce que le navigateur doit connaitre. */
export function ticketsPublics(tickets = []) {
  return tickets.map((t) => ({ numero: t.numero, motif: t.motif }));
}

/**
 * Retrouve un participant : { id } renvoye par l'inscription,
 * ou { telephone, email } qui doivent correspondre tous les deux.
 * Renvoie { participant } ou { erreur: { statut, message } }.
 */
export async function identifier(corps = {}) {
  const id = String(corps.id || '').trim();
  const phone_key = clePhone(corps.telephone);
  const email = nettoyerEmail(corps.email);
  if (!UUID.test(id) && !(phone_key && email)) {
    return { erreur: { statut: 400, message: 'Inscrivez-vous d’abord au jeu.' } };
  }
  const participant = UUID.test(id) ? await trouverParId(id) : await trouverParTelEtEmail({ phone_key, email });
  if (!participant) {
    return { erreur: { statut: 404, message: 'Inscription introuvable. Inscrivez-vous d’abord au jeu.' } };
  }
  return { participant };
}

export async function envoyerTous(taches) {
  const resultats = await Promise.allSettled(taches);
  const erreurs = resultats.filter((r) => r.status === 'rejected').map((r) => String(r.reason?.message || r.reason));
  if (erreurs.length) console.error('[concours] mails en erreur', erreurs);
  return { envoyes: resultats.length - erreurs.length, erreurs };
}

export function invitationsAmis(participant, amis, req) {
  const lien = lienPage(req);
  return (amis || []).map((ami) =>
    envoyerMail({ to: ami.email, ...mailAmi({ prenomParrain: participant.prenom, prenomAmi: ami.prenom, lienPage: lien }) })
  );
}

/**
 * Ajoute apres coup les ami(e)s et/ou l'avis d'un participant deja inscrit.
 * Chaque ticket bonus n'est attribue qu'une seule fois (contrainte unique participant_id + motif).
 * Renvoie { participant, tickets, nouveaux }.
 */
export async function completerParticipation(participant, { amis = [], avis = false } = {}, req, contexte) {
  const avant = await listerTickets(participant.id);
  const obtenus = avant.map((t) => t.motif);

  const champs = {};
  const amisAjoutes = amis.length && !obtenus.includes('amis') ? amis : [];
  if (amisAjoutes.length) champs.amis = amisAjoutes;
  if (avis && !participant.avis) champs.avis = true;
  const maj = Object.keys(champs).length ? (await majParticipant(participant.id, champs)) || { ...participant, ...champs } : participant;

  const droits = motifsTickets({ amis: maj.amis, avis: maj.avis });
  const manquants = motifsManquants(droits, obtenus);
  if (!manquants.length) return { participant: maj, tickets: avant, nouveaux: [] };

  const { nouveaux, tickets } = await attribuerTickets(participant.id, manquants);
  const complet = { ...maj, tickets: tickets.length };

  if (brevoConfigure() && nouveaux.length) {
    const taches = [
      envoyerMail({ to: maj.email, ...mailNouveauTicket({ prenom: maj.prenom, nouveaux, tickets, lienPage: lienPage(req) }) }),
      ...invitationsAmis(maj, amisAjoutes, req),
    ];
    const titre = contexte || (nouveaux.some((t) => t.motif === 'avis') ? 'Avis Google confirmé' : 'Ami(e)s invité(e)s');
    const note = mailInterne({ participant: complet, tickets, contexte: titre });
    for (const to of destinatairesInternes()) taches.push(envoyerMail({ to, ...note, replyTo: maj.email }));
    await envoyerTous(taches);
  }
  return { participant: complet, tickets, nouveaux };
}
