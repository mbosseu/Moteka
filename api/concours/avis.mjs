// POST /api/concours/avis : confirme l'avis Google du participant et lui attribue son ticket avis (une seule fois).
// Identification : { id } renvoye par l'inscription, ou { telephone, email } qui doivent correspondre tous les deux.
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
    if (erreur) return repondre(res, erreur.statut, { ok: false, message: `${erreur.message} Puis confirmez votre avis.` });

    const r = await completerParticipation(participant, { avis: true }, req, 'Avis Google confirmé');
    const nouveau = r.nouveaux.find((t) => t.motif === 'avis');
    return repondre(res, 200, {
      ok: true,
      deja: !nouveau,
      avis: true,
      tickets: ticketsPublics(r.tickets),
      nouveaux: ticketsPublics(r.nouveaux),
      message: nouveau
        ? `Merci pour votre avis : ticket n° ${nouveau.numero} ajouté.`
        : 'Votre avis était déjà compté.',
    });
  } catch (err) {
    console.error('[concours] avis', err);
    return repondre(res, 500, { ok: false, message: 'Une erreur est survenue. Réessayez dans un instant.' });
  }
}
