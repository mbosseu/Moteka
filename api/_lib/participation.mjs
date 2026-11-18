// Orchestration commune : identification d'un participant, tickets bonus (amis, avis) et mails associes.
import { avisEnCours, clePhone, motifsManquants, motifsTickets, nettoyerEmail, pieceJointePreuve } from './concours.mjs';
import { attribuerTickets, listerTickets, majParticipant, trouverParId, trouverParTelEtEmail } from './supabase.mjs';
import { brevoConfigure, envoyerMail } from './brevo.mjs';
import { destinatairesInternes, mailAmi, mailInterne, mailNouveauTicket } from './mails.mjs';
import { lienPage } from './http.mjs';
import { pieceJointeTicketsPdf } from './ticket-pdf.mjs';

async function pdfTickets(participant, tickets, req) {
  try {
    return await pieceJointeTicketsPdf({
      prenom: participant.prenom,
      nom: participant.nom,
      participantId: participant.id,
      tickets,
      baseUrl: lienPage(req),
    });
  } catch (err) {
    console.error('[concours] pdf tickets', err?.message || err);
    return null;
  }
}

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

/** Colonnes a enregistrer quand une preuve d'avis valide est recue. */
export function champsPreuveAvis(preuve, maintenant = new Date()) {
  return { avis: true, avis_preuve: preuve, avis_statut: 'a_verifier', avis_le: maintenant.toISOString() };
}

/** Mails internes (avec la capture en piece jointe si elle est fournie). */
export function notesInternes(participant, tickets, { contexte, preuve, replyTo } = {}) {
  const piece = preuve ? pieceJointePreuve(preuve) : null;
  const note = mailInterne({ participant, tickets, contexte, preuveJointe: Boolean(piece) });
  return destinatairesInternes().map((to) =>
    envoyerMail({ to, ...note, replyTo: replyTo || participant.email, ...(piece ? { attachments: [piece] } : {}) })
  );
}

/**
 * Ajoute apres coup les ami(e)s et/ou la preuve d'avis d'un participant deja inscrit.
 * avisPreuve : data URL deja validee (validerPreuve). Elle n'est prise que si aucune preuve n'est
 * en attente ou validee (premiere preuve, ou nouvelle preuve apres un refus).
 * Chaque ticket bonus n'est attribue qu'une seule fois (contrainte unique participant_id + motif).
 * Renvoie { participant, tickets, nouveaux }.
 */
export async function completerParticipation(participant, { amis = [], avisPreuve = '' } = {}, req, contexte) {
  const avant = await listerTickets(participant.id);
  const obtenus = avant.map((t) => t.motif);

  const champs = {};
  const amisAjoutes = amis.length && !obtenus.includes('amis') ? amis : [];
  if (amisAjoutes.length) champs.amis = amisAjoutes;
  const preuveAjoutee = avisPreuve && !avisEnCours(participant) ? avisPreuve : '';
  if (preuveAjoutee) Object.assign(champs, champsPreuveAvis(preuveAjoutee));
  const maj = Object.keys(champs).length
    ? (await majParticipant(participant.id, champs)) || { ...participant, ...champs, avis_preuve: undefined }
    : participant;

  const droits = motifsTickets({ amis: maj.amis, avis: maj.avis });
  const manquants = motifsManquants(droits, obtenus);
  if (!manquants.length) return { participant: maj, tickets: avant, nouveaux: [] };

  const { nouveaux, tickets } = await attribuerTickets(participant.id, manquants);
  const complet = { ...maj, tickets: tickets.length };

  if (brevoConfigure() && nouveaux.length) {
    const taches = [
      envoyerMail({
        to: maj.email,
        ...mailNouveauTicket({ prenom: maj.prenom, nouveaux, tickets, lienPage: lienPage(req) }),
        attachments: [await pdfTickets(maj, tickets, req)].filter(Boolean),
      }),
      ...invitationsAmis(maj, amisAjoutes, req),
    ];
    const avisNouveau = nouveaux.some((t) => t.motif === 'avis');
    const titre = contexte || (avisNouveau ? 'Preuve d’avis Google reçue' : 'Ami(e)s invité(e)s');
    taches.push(...notesInternes(complet, tickets, { contexte: titre, preuve: avisNouveau ? preuveAjoutee : '' }));
    await envoyerTous(taches);
  }
  return { participant: complet, tickets, nouveaux };
}
