// POST /api/concours/amis : un participant deja inscrit invite ses 2 ami(e)s et gagne son ticket amis (une seule fois).
// Identification : { id } ou { telephone, email }. Corps : { amis: [{ prenom, email, telephone }, { ... }] }.
import { validerAmis } from '../_lib/concours.mjs';
import { supabaseConfigure } from '../_lib/supabase.mjs';
import { lireCorps, repondre, verifierMethode } from '../_lib/http.mjs';
import { completerParticipation, identifier, ticketsPublics } from '../_lib/participation.mjs';

export default async function handler(req, res) {
  if (!verifierMethode(req, res)) return;
  const corps = lireCorps(req);
  if (!supabaseConfigure()) {
    return repondre(res, 503, { ok: false, message: 'Service momentanément indisponible. Réessayez dans quelques minutes.' });
  }

  try {
    const { participant, erreur } = await identifier(corps);
    if (erreur) return repondre(res, erreur.statut, { ok: false, message: erreur.message });

    const { erreurs, amis } = validerAmis(corps, { emailParticipant: participant.email });
    if (erreurs.length) return repondre(res, 400, { ok: false, message: erreurs[0].message, erreurs });
    if (!amis.length) {
      return repondre(res, 400, { ok: false, message: 'Indiquez vos 2 ami(e)s pour gagner ce ticket.', erreurs: [{ champ: 'ami1_prenom' }] });
    }

    const r = await completerParticipation(participant, { amis }, req, 'Ami(e)s invité(e)s');
    const nouveau = r.nouveaux.find((t) => t.motif === 'amis');
    return repondre(res, 200, {
      ok: true,
      deja: !nouveau,
      avis: Boolean(r.participant.avis),
      tickets: ticketsPublics(r.tickets),
      nouveaux: ticketsPublics(r.nouveaux),
      message: nouveau
        ? `Invitations envoyées : ticket n° ${nouveau.numero} ajouté.`
        : 'Vos ami(e)s étaient déjà invité(e)s : ce ticket est déjà compté.',
    });
  } catch (err) {
    console.error('[concours] amis', err);
    return repondre(res, 500, { ok: false, message: 'Une erreur est survenue. Réessayez dans un instant.' });
  }
}
