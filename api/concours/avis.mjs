// POST /api/concours/avis : recoit la preuve (capture d'ecran) de l'avis Google et attribue le ticket avis (une seule fois).
// Corps : { avis_preuve: 'data:image/jpeg;base64,...' } + identification :
// { id } renvoye par l'inscription, ou { telephone, email } qui doivent correspondre tous les deux.
// Le ticket est attribue a l'envoi ; l'equipe peut ensuite refuser la preuve depuis le back-office (ticket retire).
import { avisEnCours, validerPreuve } from '../_lib/concours.mjs';
import { listerTickets, supabaseConfigure } from '../_lib/supabase.mjs';
import { lireCorps, repondre, verifierMethode } from '../_lib/http.mjs';
import { completerParticipation, identifier, ticketsPublics } from '../_lib/participation.mjs';

export default async function handler(req, res) {
  if (!verifierMethode(req, res)) return;
  const corps = lireCorps(req);

  const preuve = validerPreuve(corps.avis_preuve ?? corps.preuve);
  if (preuve.erreur) {
    return repondre(res, 400, { ok: false, message: preuve.erreur, erreurs: [{ champ: 'avis_preuve', message: preuve.erreur }] });
  }
  if (!supabaseConfigure()) {
    return repondre(res, 503, { ok: false, message: 'Service momentanément indisponible. Réessayez dans quelques minutes.' });
  }

  try {
    const { participant, erreur } = await identifier(corps);
    if (erreur) return repondre(res, erreur.statut, { ok: false, message: `${erreur.message} Puis envoyez la capture de votre avis.` });

    if (avisEnCours(participant)) {
      return repondre(res, 200, {
        ok: true,
        deja: true,
        avis: true,
        avis_statut: participant.avis_statut,
        tickets: ticketsPublics(await listerTickets(participant.id)),
        nouveaux: [],
        message: 'Votre avis était déjà reçu : votre ticket avis est compté.',
      });
    }

    const r = await completerParticipation(participant, { avisPreuve: preuve.preuve }, req, 'Preuve d’avis Google reçue');
    const nouveau = r.nouveaux.find((t) => t.motif === 'avis');
    return repondre(res, 200, {
      ok: true,
      deja: !nouveau,
      avis: true,
      avis_statut: r.participant.avis_statut || 'a_verifier',
      tickets: ticketsPublics(r.tickets),
      nouveaux: ticketsPublics(r.nouveaux),
      message: nouveau
        ? `Capture reçue, merci pour votre avis : ticket n° ${nouveau.numero} ajouté.`
        : 'Capture reçue, merci pour votre avis.',
    });
  } catch (err) {
    console.error('[concours] avis', err);
    return repondre(res, 500, { ok: false, message: 'Une erreur est survenue. Réessayez dans un instant.' });
  }
}
