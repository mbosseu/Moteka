// POST /api/concours/inscription : inscription au jeu concours FIGHT & Furious x Moteka.
// Ticket 1 a l'inscription, ticket 2 si 2 ami(e)s sont invite(e)s, ticket 3 si la capture de l'avis Google est jointe (avis_preuve).
import { motifsTickets, validerInscription } from '../_lib/concours.mjs';
import { attribuerTickets, creerParticipant, supabaseConfigure, trouverDoublon } from '../_lib/supabase.mjs';
import { brevoConfigure, envoyerMail } from '../_lib/brevo.mjs';
import { mailConfirmation } from '../_lib/mails.mjs';
import { lienPage, lireCorps, repondre, verifierMethode } from '../_lib/http.mjs';
import { champsPreuveAvis, completerParticipation, envoyerTous, invitationsAmis, notesInternes, ticketsPublics } from '../_lib/participation.mjs';
import { pieceJointeTicketsPdf } from '../_lib/ticket-pdf.mjs';

const MESSAGE_DOUBLON =
  'Vous êtes déjà inscrit(e) au jeu avec ce numéro ou cet email. Pas besoin de recommencer : vos tickets comptent pour chaque tirage.';

async function envoyerMails(participant, tickets, req, preuve) {
  if (!brevoConfigure()) return { envoyes: 0, erreurs: ['brevo_non_configure'] };
  const taches = [
    envoyerMail({
      to: participant.email,
      ...mailConfirmation({ prenom: participant.prenom, tickets, lienPage: lienPage(req) }),
      attachments: [await pieceJointeTicketsPdf({ prenom: participant.prenom, nom: participant.nom, participantId: participant.id, tickets, baseUrl: lienPage(req) }).catch((err) => {
        console.error('[concours] pdf tickets', err?.message || err);
        return null;
      })].filter(Boolean),
    }),
    ...invitationsAmis(participant, participant.amis, req),
    ...notesInternes({ ...participant, tickets: tickets.length }, tickets, { preuve }),
  ];
  return envoyerTous(taches);
}

export default async function handler(req, res) {
  if (!verifierMethode(req, res)) return;
  const corps = lireCorps(req);

  // champ piege anti-robots : rempli = on fait semblant que tout va bien
  if (String(corps.site_web || '').trim()) {
    return repondre(res, 200, { ok: true, tickets: [], message: 'Inscription enregistrée.' });
  }

  const { ok, erreurs, donnees } = validerInscription(corps);
  if (!ok) {
    return repondre(res, 400, { ok: false, message: erreurs[0].message, erreurs });
  }
  if (!supabaseConfigure()) {
    console.error('[concours] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant');
    return repondre(res, 503, { ok: false, message: 'Inscriptions momentanément indisponibles. Réessayez dans quelques minutes.' });
  }

  try {
    const existant = await trouverDoublon(donnees);
    if (existant) {
      // meme telephone ET meme email : c'est bien lui, on complete ses tickets bonus au besoin
      if (existant.email === donnees.email && String(existant.telephone || '').slice(-9) === donnees.phone_key) {
        const r = await completerParticipation(existant, { amis: donnees.amis, avisPreuve: donnees.avis_preuve }, req);
        return repondre(res, 200, {
          ok: true,
          deja: true,
          id: existant.id,
          tickets: ticketsPublics(r.tickets),
          nouveaux: ticketsPublics(r.nouveaux),
          avis: Boolean(r.participant.avis),
          avis_statut: r.participant.avis_statut || 'aucun',
          message: r.nouveaux.length
            ? 'Vous étiez déjà inscrit(e) : vos nouveaux tickets sont ajoutés.'
            : 'Vous êtes déjà inscrit(e) : voici vos tickets.',
        });
      }
      return repondre(res, 409, { ok: false, doublon: true, message: MESSAGE_DOUBLON });
    }

    const { prenom, nom, telephone, phone_key, email, amis, avis_preuve, source } = donnees;
    const ligne = { prenom, nom, telephone, phone_key, email, amis, source, ...(avis_preuve ? champsPreuveAvis(avis_preuve) : {}) };
    const participant = await creerParticipant(ligne);
    const { tickets } = await attribuerTickets(participant.id, motifsTickets(donnees));
    const { avis_preuve: _preuve, ...sansPreuve } = donnees;
    const mails = await envoyerMails({ ...sansPreuve, ...participant }, tickets, req, avis_preuve);
    return repondre(res, 201, {
      ok: true,
      id: participant.id,
      tickets: ticketsPublics(tickets),
      avis: Boolean(participant.avis),
      avis_statut: participant.avis_statut || 'aucun',
      mails: mails.envoyes,
      message: 'Inscription enregistrée.',
    });
  } catch (err) {
    if (err.code === '23505') {
      return repondre(res, 409, { ok: false, doublon: true, message: MESSAGE_DOUBLON });
    }
    console.error('[concours] inscription', err);
    return repondre(res, 500, { ok: false, message: 'Une erreur est survenue. Réessayez dans un instant.' });
  }
}
