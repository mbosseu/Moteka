// Logique pure du jeu concours FIGHT & Furious x Moteka (sans I/O, testable).

export const LIEN_AVIS_GOOGLE = 'https://share.google/NXCxR50ujCB4D3GBW';
export const AMIS_MAX = 2;

const NOM_MAX = 80;
const EMAIL_MAX = 120;
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function nettoyerTexte(valeur, max = NOM_MAX) {
  return String(valeur ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max);
}

export function nettoyerEmail(valeur) {
  return String(valeur ?? '')
    .trim()
    .toLowerCase()
    .slice(0, EMAIL_MAX);
}

export function emailValide(valeur) {
  const v = String(valeur || '');
  return EMAIL_OK.test(v) && !v.includes('..');
}

export function vrai(valeur) {
  return valeur === true || valeur === 'true' || valeur === '1' || valeur === 'on' || valeur === 1;
}

/**
 * Normalise un numero francais au format 0XXXXXXXXX (10 chiffres).
 * Accepte : 06 12 34 56 78, 06.12.34.56.78, +33 6 12 34 56 78, 0033612345678, 33612345678, 612345678.
 * Renvoie '' si le numero n'est pas un numero francais valide.
 */
export function normaliserTelephone(entree) {
  let chiffres = String(entree ?? '').replace(/\D/g, '');
  if (!chiffres) return '';
  if (chiffres.startsWith('0033')) chiffres = chiffres.slice(4);
  else if (chiffres.startsWith('33') && chiffres.length === 11) chiffres = chiffres.slice(2);
  else if (chiffres.startsWith('330') && chiffres.length === 12) chiffres = chiffres.slice(3);
  if (chiffres.length === 10 && chiffres.startsWith('0')) chiffres = chiffres.slice(1);
  if (chiffres.length === 10 && chiffres.startsWith('0')) return '';
  if (chiffres.length !== 9 || !/^[1-9]/.test(chiffres)) return '';
  if (new Set(chiffres).size <= 2) return '';
  return `0${chiffres}`;
}

/** Cle de dedoublonnage : les 9 derniers chiffres du numero normalise. */
export function clePhone(entree) {
  const n = normaliserTelephone(entree);
  return n ? n.slice(-9) : '';
}

/** Affichage lisible : 06 12 34 56 78. */
export function formaterTelephone(entree) {
  const n = normaliserTelephone(entree);
  return n ? n.replace(/(\d{2})(?=\d)/g, '$1 ') : '';
}

/** Motifs de tickets, dans l'ordre d'attribution. */
export const MOTIFS = ['inscription', 'amis', 'avis'];

export const LIBELLES_MOTIFS = {
  inscription: 'Inscription',
  amis: '2 ami(e)s invité(e)s',
  avis: 'Avis Google Moteka',
};

/**
 * Motifs de tickets auxquels un participant a droit.
 * Inscription = 1 ticket, 2 ami(e)s invite(e)s = 1 ticket, avis Google = 1 ticket (3 au maximum).
 */
export function motifsTickets({ amis = [], avis = false } = {}) {
  const motifs = ['inscription'];
  if (Array.isArray(amis) && amis.length >= AMIS_MAX) motifs.push('amis');
  if (avis) motifs.push('avis');
  return motifs;
}

/** Motifs encore a attribuer : ceux auxquels il a droit moins ceux deja obtenus. */
export function motifsManquants(droits = [], obtenus = []) {
  return MOTIFS.filter((m) => droits.includes(m) && !obtenus.includes(m));
}

/** Ce qu'il reste a faire pour gagner plus de tickets. */
export function ticketsAGagner(obtenus = []) {
  return MOTIFS.filter((m) => m !== 'inscription' && !obtenus.includes(m));
}

export function calculerTickets(options = {}) {
  return motifsTickets(options).length;
}

function lireAmisBruts(corps) {
  if (Array.isArray(corps.amis)) return corps.amis.slice(0, AMIS_MAX);
  return [1, 2].map((i) => ({
    prenom: corps[`ami${i}_prenom`],
    email: corps[`ami${i}_email`],
    telephone: corps[`ami${i}_telephone`],
  }));
}

/**
 * Valide le bloc ami(e)s : soit vide, soit 2 ami(e)s complet(e)s
 * (prenom et email obligatoires, telephone facultatif).
 * Renvoie { erreurs, amis } ; amis = [] si le bloc est vide.
 */
export function validerAmis(corps = {}, { emailParticipant = '' } = {}) {
  const erreurs = [];
  const bruts = lireAmisBruts(corps).map((a) => (a && typeof a === 'object' ? a : {}));
  while (bruts.length < AMIS_MAX) bruts.push({});
  const amis = bruts.map((a) => ({
    prenom: nettoyerTexte(a.prenom),
    email: nettoyerEmail(a.email),
    telBrut: String(a.telephone ?? '').trim(),
  }));
  const remplis = amis.filter((a) => a.prenom || a.email || a.telBrut);
  if (!remplis.length) return { erreurs, amis: [] };

  const vus = [];
  amis.forEach((a, i) => {
    const n = i + 1;
    if (!a.prenom) erreurs.push({ champ: `ami${n}_prenom`, message: `Prénom de l'ami(e) ${n} requis` });
    if (!a.email) erreurs.push({ champ: `ami${n}_email`, message: `Email de l'ami(e) ${n} requis` });
    else if (!emailValide(a.email)) erreurs.push({ champ: `ami${n}_email`, message: `Email de l'ami(e) ${n} invalide` });
    else if (emailParticipant && a.email === emailParticipant) {
      erreurs.push({ champ: `ami${n}_email`, message: "L'email d'un(e) ami(e) doit être différent du vôtre" });
    } else if (vus.includes(a.email)) {
      erreurs.push({ champ: `ami${n}_email`, message: 'Les 2 ami(e)s doivent avoir des emails différents' });
    }
    if (a.email) vus.push(a.email);
    if (a.telBrut && !normaliserTelephone(a.telBrut)) {
      erreurs.push({ champ: `ami${n}_telephone`, message: `Téléphone de l'ami(e) ${n} invalide` });
    }
  });
  if (erreurs.length) return { erreurs, amis: [] };
  return {
    erreurs,
    amis: amis.map((a) => ({ prenom: a.prenom, email: a.email, telephone: normaliserTelephone(a.telBrut) })),
  };
}

/**
 * Valide le corps d'une inscription.
 * Renvoie { ok, erreurs: [{ champ, message }], donnees }.
 */
export function validerInscription(corps = {}) {
  const erreurs = [];
  const prenom = nettoyerTexte(corps.prenom);
  const nom = nettoyerTexte(corps.nom);
  const telBrut = String(corps.telephone ?? corps.tel ?? '').trim();
  const email = nettoyerEmail(corps.email);
  const source = nettoyerTexte(corps.source, 40) || 'site';

  if (!prenom) erreurs.push({ champ: 'prenom', message: 'Prénom requis' });
  if (!nom) erreurs.push({ champ: 'nom', message: 'Nom requis' });

  const telephone = normaliserTelephone(telBrut);
  if (!telBrut) erreurs.push({ champ: 'telephone', message: 'Téléphone requis' });
  else if (!telephone) erreurs.push({ champ: 'telephone', message: 'Numéro de téléphone invalide' });

  if (!email) erreurs.push({ champ: 'email', message: 'Email requis' });
  else if (!emailValide(email)) erreurs.push({ champ: 'email', message: 'Email invalide' });

  const blocAmis = validerAmis(corps, { emailParticipant: email });
  erreurs.push(...blocAmis.erreurs);

  if (!vrai(corps.reglement)) {
    erreurs.push({ champ: 'reglement', message: 'Merci d’accepter le règlement' });
  }

  const avis = vrai(corps.avis);
  return {
    ok: erreurs.length === 0,
    erreurs,
    donnees: {
      prenom,
      nom,
      telephone,
      phone_key: telephone ? telephone.slice(-9) : '',
      email,
      amis: blocAmis.amis,
      avis,
      source,
    },
  };
}

/** Prenom avec majuscules propres (jean-pierre -> Jean-Pierre). */
export function prenomPropre(valeur) {
  const brut = String(valeur || '').trim();
  if (!brut) return '';
  return brut
    .split(/([\s'-]+)/)
    .map((part, i) => (i % 2 === 1 || !part ? part : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()))
    .join('');
}
