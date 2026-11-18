// Textes des mails : texte brut, court, ton personnel (meme approche que les mails David du concours).
import { LIBELLES_MOTIFS, LIEN_AVIS_GOOGLE, formaterTelephone, prenomPropre, ticketsAGagner } from './concours.mjs';

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

/** "422, 423 et 424" a partir d'une liste de tickets ou de numeros. */
export function listeNumeros(tickets = []) {
  const n = tickets.map((t) => (typeof t === 'object' && t ? t.numero : t)).filter((v) => v !== undefined && v !== null);
  return n.join(', ');
}

function motifsObtenus(tickets = []) {
  return tickets.map((t) => (typeof t === 'object' && t ? t.motif : '')).filter(Boolean);
}

function lignesManque(tickets, lienPage) {
  const reste = ticketsAGagner(motifsObtenus(tickets));
  if (!reste.length) return ['Tu as le maximum : 3 tickets. Rien d’autre à faire.'];
  const lignes = [`Tu peux encore gagner ${reste.length} ticket${reste.length > 1 ? 's' : ''} :`];
  if (reste.includes('amis')) lignes.push('- invite 2 ami(e)s depuis la page du jeu');
  if (reste.includes('avis')) lignes.push(`- laisse un avis Google au garage Moteka : ${LIEN_AVIS_GOOGLE}`);
  const lien = nettoyerLien(lienPage);
  if (lien) lignes.push(`Tout se fait ici : ${lien}`);
  return lignes;
}

const LIGNE_TIRAGE =
  'Tirage au sort chaque soir du lundi 23 au vendredi 27 novembre, en story : la roulette sort un numéro, et si c’est le tien, tu grattes ton ticket pour découvrir ton lot Moteka.';

const LIGNE_AVIS_RECU =
  'Ton avis Google est bien reçu, merci : ta capture est enregistrée et ton ticket avis est compté. L’équipe vérifie les captures, garde bien ton avis en ligne.';

export function mailConfirmation({ prenom, tickets = [], lienPage }) {
  const nb = tickets.length;
  const avecAvis = motifsObtenus(tickets).includes('avis');
  const lignes = [
    'C’est David. C’est bon, ton inscription au jeu FIGHT & Furious est bien prise.',
    '',
    ...(avecAvis ? [LIGNE_AVIS_RECU, ''] : []),
    `Tes tickets : ${listeNumeros(tickets)}`,
    `(${nb} ticket${nb > 1 ? 's' : ''} pour le tirage, garde bien ces numéros)`,
    '',
    LIGNE_TIRAGE,
    '',
    ...lignesManque(tickets, lienPage),
  ];
  return enveloppe({ prenom, lignes });
}

export function mailNouveauTicket({ prenom, nouveaux = [], tickets = [], lienPage }) {
  const motif = nouveaux[0] && nouveaux[0].motif;
  const raison = motif === 'avis' ? 'Ton avis Google est bien reçu, merci : ta capture est enregistrée.' : motif === 'amis' ? 'Merci d’avoir invité tes ami(e)s.' : 'Bonne nouvelle.';
  const lignes = [
    `${raison} Tu gagnes un ticket de plus : ${listeNumeros(nouveaux)}.`,
    '',
    `Tous tes tickets : ${listeNumeros(tickets)}`,
  ];
  const reste = ticketsAGagner(motifsObtenus(tickets));
  if (reste.length) lignes.push('', ...lignesManque(tickets, lienPage));
  return enveloppe({ prenom, lignes, sujet: `Nouveau ticket : ${listeNumeros(nouveaux)}` });
}

/** Preuve d'avis refusee depuis le back-office : le ticket avis est retire, le participant peut en renvoyer une. */
export function mailAvisRefuse({ prenom, lienPage }) {
  const lien = nettoyerLien(lienPage);
  return enveloppe({
    prenom,
    sujet: 'Ta capture d’avis Google',
    lignes: [
      'C’est David. On a regardé la capture d’écran de ton avis Google pour le jeu FIGHT & Furious, et elle n’a pas pu être retenue (avis introuvable ou capture illisible).',
      'Le ticket avis est donc retiré pour le moment. Tes autres tickets restent valables.',
      '',
      `Tu peux en renvoyer une : publie ton avis sur la fiche du garage Moteka (${LIEN_AVIS_GOOGLE}), fais une capture où l’on voit bien ton avis, puis envoie-la depuis la page du jeu${lien ? ` : ${lien}` : '.'}`,
    ],
  });
}

/** Libelle lisible du statut de l'avis (mails internes, export). */
export function libelleAvis(p = {}) {
  const statut = p.avis_statut || (p.avis ? 'a_verifier' : 'aucun');
  if (statut === 'a_verifier') return 'preuve envoyée, à vérifier dans le back-office';
  if (statut === 'valide') return 'preuve validée';
  if (statut === 'refuse') return 'preuve refusée';
  return 'non';
}

export function mailAmi({ prenomParrain, prenomAmi, lienPage }) {
  const qui = prenomPropre(prenomParrain) || 'Un ami';
  return enveloppe({
    prenom: prenomAmi || '',
    sujet: `${qui} a pensé à toi`,
    lignes: [
      `C’est David, du Boxing Center. ${qui} m’a donné ton mail.`,
      '',
      'On fait un week-end de boxe du 11 au 13 décembre au garage Moteka, et un tirage au sort chaque soir du 23 au 27 novembre.',
      'Location 24 h d’une grosse voiture, révision complète, vidange et d’autres lots à gagner.',
      'Si tu veux tenter ta chance aussi, l’inscription est gratuite :',
      nettoyerLien(lienPage),
    ],
  });
}

export function mailInterne({ participant, tickets = [], contexte = 'Nouvelle inscription', preuveJointe = false }) {
  const p = participant || {};
  const amis = Array.isArray(p.amis) && p.amis.length
    ? p.amis.map((a) => [a.prenom, a.email, formaterTelephone(a.telephone)].filter(Boolean).join(' / ')).join(' ; ')
    : 'aucun';
  const nomComplet = `${prenomPropre(p.prenom)} ${String(p.nom || '').toUpperCase()}`.trim();
  const detail = tickets.length
    ? tickets.map((t) => `${t.numero} (${LIBELLES_MOTIFS[t.motif] || t.motif})`).join(', ')
    : 'aucun';
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
      `Ami(e)s invité(e)s : ${amis}`,
      `Avis Google : ${libelleAvis(p)}`,
      `Tickets : ${detail}`,
      `Source : ${p.source || ''}`,
      ...(preuveJointe ? ['', 'La capture de l’avis Google est en pièce jointe. À valider ou refuser dans le back-office.'] : []),
    ].join('\n'),
  };
}

export function destinatairesInternes() {
  const brut = process.env.CONCOURS_NOTIF_EMAILS || 'boxingcenter31@gmail.com,contact@moteka.fr';
  return brut.split(',').map((e) => e.trim()).filter(Boolean);
}
