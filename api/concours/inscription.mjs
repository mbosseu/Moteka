// POST /api/concours/inscription : inscription au jeu concours FIGHT & Furious x Moteka.
import { validerInscription } from '../_lib/concours.mjs';
import { creerParticipant, supabaseConfigure, trouverDoublon } from '../_lib/supabase.mjs';
import { brevoConfigure, envoyerMail } from '../_lib/brevo.mjs';
import { destinatairesInternes, mailAmi, mailConfirmation, mailInterne } from '../_lib/mails.mjs';
import { lienPage, lireCorps, repondre, verifierMethode } from '../_lib/http.mjs';

const MESSAGE_DOUBLON =
  'Vous êtes déjà inscrit(e) au jeu avec ce numéro ou cet email. Pas besoin de recommencer : votre participation compte bien pour chaque tirage.';

async function envoyerMails(participant, req) {
  if (!brevoConfigure()) return { envoyes: 0, erreurs: ['brevo_non_configure'] };
  const lien = lienPage(req);
  const taches = [];
  const conf = mailConfirmation(participant);
  taches.push(envoyerMail({ to: participant.email, ...conf }));
  for (const ami of participant.ami_emails || []) {
    taches.push(envoyerMail({ to: ami, ...mailAmi({ prenomParrain: participant.prenom, lienPage: lien }) }));
  }
  const interne = mailInterne({ participant });
  for (const dest of destinatairesInternes()) {
    taches.push(envoyerMail({ to: dest, ...interne, replyTo: participant.email }));
  }
  const resultats = await Promise.allSettled(taches);
  const erreurs = resultats.filter((r) => r.status === 'rejected').map((r) => String(r.reason?.message || r.reason));
  if (erreurs.length) console.error('[concours] mails en erreur', erreurs);
  return { envoyes: resultats.length - erreurs.length, erreurs };
}

export default async function handler(req, res) {
  if (!verifierMethode(req, res)) return;
  const corps = lireCorps(req);

  // champ piege anti-robots : rempli = on fait semblant que tout va bien
  if (String(corps.site_web || '').trim()) {
    return repondre(res, 200, { ok: true, tickets: 1, message: 'Inscription enregistrée.' });
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
      return repondre(res, 409, { ok: false, doublon: true, avis: Boolean(existant.avis), message: MESSAGE_DOUBLON });
    }
    const participant = await creerParticipant(donnees);
    const mails = await envoyerMails(participant || donnees, req);
    return repondre(res, 201, {
      ok: true,
      id: participant?.id,
      tickets: participant?.tickets ?? donnees.tickets,
      avis: Boolean(participant?.avis ?? donnees.avis),
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
