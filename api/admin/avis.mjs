// POST /api/admin/avis { id, decision: 'valider' | 'refuser' } : decision sur la preuve d'avis Google d'un participant.
// Refuser retire le ticket avis (impossible s'il a deja gagne un tirage) et previent le participant par mail.
import { lienPage, lireCorps } from '../_lib/http.mjs';
import { accepter, erreurServeur, exigerSession, memeOrigine, repondre } from '../_lib/admin-http.mjs';
import {
  ajouterTicketAvis,
  lireParticipantAvis,
  lireTicketAvis,
  majAvisParticipant,
  supprimerTicketAvis,
  tiragesDuNumero,
} from '../_lib/admin-db.mjs';
import { planDecisionAvis, validerDecisionAvis } from '../_lib/admin-tirage.mjs';
import { brevoConfigure, envoyerMail } from '../_lib/brevo.mjs';
import { mailAvisRefuse } from '../_lib/mails.mjs';

export default async function handler(req, res) {
  if (!accepter(req, res, ['POST'])) return;
  const session = exigerSession(req, res);
  if (!session) return;
  if (!memeOrigine(req, res)) return;
  const { id, decision, erreur } = validerDecisionAvis(lireCorps(req));
  if (erreur) return repondre(res, 400, { ok: false, message: erreur });

  try {
    const participant = await lireParticipantAvis(id);
    const ticket = participant ? await lireTicketAvis(id) : null;
    const tirages = ticket ? await tiragesDuNumero(ticket.numero) : [];
    const plan = planDecisionAvis({ decision, participant, ticket, tirages });
    if (plan.erreur) return repondre(res, plan.statut || 400, { ok: false, message: plan.erreur });
    if (plan.deja) {
      return repondre(res, 200, { ok: true, deja: true, avis_statut: participant.avis_statut, message: 'Déjà fait.' });
    }

    if (plan.supprimerTicket) await supprimerTicketAvis(id);
    const nouveauTicket = plan.ajouterTicket ? await ajouterTicketAvis(id) : null;
    const maj = await majAvisParticipant(id, plan.champs);

    let mail = false;
    if (plan.mail && brevoConfigure() && participant.email) {
      try {
        await envoyerMail({ to: participant.email, ...mailAvisRefuse({ prenom: participant.prenom, lienPage: lienPage(req) }) });
        mail = true;
      } catch (err) {
        console.error('[admin] mail avis refuse', err?.message || err);
      }
    }
    console.warn('[admin] avis', decision, id, 'par', session.email);
    return repondre(res, 200, {
      ok: true,
      avis_statut: maj?.avis_statut || plan.champs.avis_statut,
      ticket_retire: plan.supprimerTicket ? ticket.numero : null,
      ticket_ajoute: nouveauTicket ? nouveauTicket.numero : null,
      mail,
      message:
        decision === 'refuser'
          ? `Preuve refusée${plan.supprimerTicket ? `, ticket n. ${ticket.numero} retiré` : ''}${mail ? ', participant prévenu par mail' : ''}.`
          : `Preuve validée${nouveauTicket ? `, ticket n. ${nouveauTicket.numero} ajouté` : ''}.`,
    });
  } catch (err) {
    return erreurServeur(res, err, 'avis');
  }
}
