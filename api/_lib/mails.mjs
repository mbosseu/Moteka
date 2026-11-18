// Textes des mails : texte brut, court, ton personnel (meme approche que les mails David du concours).
import { LIEN_AVIS_GOOGLE, formaterTelephone, prenomPropre } from './concours.mjs';

export const NOM_EXPEDITEUR = 'David';
const SIGNATURE = 'David de Boxing Center';

function enveloppe({ prenom, lignes, sujet }) {
  const qui = prenomPropre(prenom);
  return {
    fromName: NOM_EXPEDITEUR,
    subject: sujet || (qui ? `${qui}, c’est David` : 'C’est David'),
    text: [qui ? `Salut ${qui},` : 'Salut,', '', ...lignes, '', 'À plus tard,', SIGNATURE].join('\n'),
  };
}

function nettoyerLien(lien) {
  return String(lien || '').replace(/\/$/, '');
}

export function mailConfirmation({ prenom, tickets, avis }) {
  const lignes = [
    'C’est David. C’est bon, ton inscription pour FIGHT & Furious est bien prise.',
    '',
    `Tu as ${tickets} ticket${tickets > 1 ? 's' : ''} pour le tirage au sort.`,
    'On tire au sort tous les jours à partir du lundi 23 novembre, jusqu’au gala du 11 décembre.',
  ];
  if (!avis) {
    lignes.push(
      '',
      'Petit plus : si tu laisses un avis Google au garage Moteka, tu passes à 2 tickets.',
      'La fiche est ici :',
      LIEN_AVIS_GOOGLE,
      'Ensuite repasse sur la page pour le confirmer.'
    );
  }
  lignes.push('', 'Si on te tire au sort, je te préviens directement.');
  return enveloppe({ prenom, lignes });
}

export function mailAmi({ prenomParrain, lienPage }) {
  const qui = prenomPropre(prenomParrain) || 'Un ami';
  return enveloppe({
    prenom: '',
    sujet: `${qui} a pensé à toi`,
    lignes: [
      `C’est David, du Boxing Center. ${qui} m’a donné ton mail.`,
      '',
      'On fait un week-end de boxe du 11 au 13 décembre avec le garage Moteka, et un tirage au sort tous les jours.',
      'Si tu veux tenter ta chance aussi, c’est ici :',
      nettoyerLien(lienPage),
    ],
  });
}

export function mailInterne({ participant, contexte = 'Nouvelle inscription' }) {
  const p = participant || {};
  const amis = Array.isArray(p.ami_emails) && p.ami_emails.length ? p.ami_emails.join(', ') : 'aucun';
  const nomComplet = `${prenomPropre(p.prenom)} ${String(p.nom || '').toUpperCase()}`.trim();
  return {
    fromName: 'Jeu FIGHT & Furious',
    subject: `${contexte} : ${nomComplet}`,
    text: [
      `${contexte} au jeu FIGHT & Furious.`,
      '',
      `Prénom : ${p.prenom || ''}`,
      `Nom : ${p.nom || ''}`,
      `Téléphone : ${formaterTelephone(p.telephone) || p.telephone || ''}`,
      `Email : ${p.email || ''}`,
      `Ami(e)s : ${amis}`,
      `Avis Google : ${p.avis ? 'oui' : 'non'}`,
      `Tickets : ${p.tickets ?? ''}`,
      `Source : ${p.source || ''}`,
    ].join('\n'),
  };
}

export function destinatairesInternes() {
  const brut = process.env.CONCOURS_NOTIF_EMAILS || 'boxingcenter31@gmail.com,contact@moteka.fr';
  return brut.split(',').map((e) => e.trim()).filter(Boolean);
}
