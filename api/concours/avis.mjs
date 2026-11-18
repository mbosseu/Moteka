// POST /api/concours/avis : confirme l'avis Google du participant, passe ses tickets a 2.
// Identification : { id } renvoye par l'inscription, ou { telephone, email } qui doivent correspondre tous les deux.
import { clePhone, nettoyerEmail } from '../_lib/concours.mjs';
import { marquerAvis, supabaseConfigure, trouverParId, trouverParTelEtEmail } from '../_lib/supabase.mjs';
import { brevoConfigure, envoyerMail } from '../_lib/brevo.mjs';
import { destinatairesInternes, mailInterne } from '../_lib/mails.mjs';
import { lireCorps, repondre, verifierMethode } from '../_lib/http.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (!verifierMethode(req, res)) return;
  const corps = lireCorps(req);
  if (!supabaseConfigure()) {
    return repondre(res, 503, { ok: false, message: 'Service momentanément indisponible. Réessayez dans quelques minutes.' });
  }

  const id = String(corps.id || '').trim();
  const phone_key = clePhone(corps.telephone);
  const email = nettoyerEmail(corps.email);
  if (!UUID.test(id) && !(phone_key && email)) {
    return repondre(res, 400, { ok: false, message: 'Inscrivez-vous d’abord, puis confirmez votre avis.' });
  }

  try {
    const participant = UUID.test(id) ? await trouverParId(id) : await trouverParTelEtEmail({ phone_key, email });
    if (!participant) {
      return repondre(res, 404, { ok: false, message: 'Inscription introuvable. Inscrivez-vous d’abord, puis confirmez votre avis.' });
    }
    if (participant.avis) {
      return repondre(res, 200, { ok: true, deja: true, tickets: participant.tickets, avis: true, message: 'Votre avis était déjà compté.' });
    }
    const maj = (await marquerAvis(participant.id)) || { ...participant, avis: true, tickets: 2 };
    if (brevoConfigure()) {
      const note = mailInterne({ participant: maj, contexte: 'Avis Google confirmé' });
      await Promise.allSettled(destinatairesInternes().map((to) => envoyerMail({ to, ...note })));
    }
    return repondre(res, 200, { ok: true, tickets: maj.tickets, avis: true, message: 'Merci pour votre avis : vous avez maintenant 2 tickets.' });
  } catch (err) {
    console.error('[concours] avis', err);
    return repondre(res, 500, { ok: false, message: 'Une erreur est survenue. Réessayez dans un instant.' });
  }
}
