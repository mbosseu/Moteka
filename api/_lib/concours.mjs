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

/** Inscription = 1 ticket, avis Google confirme = 1 ticket de plus. */
export function calculerTickets({ avis = false } = {}) {
  return 1 + (avis ? 1 : 0);
}

function lireAmis(corps) {
  const brut = Array.isArray(corps.ami_emails)
    ? corps.ami_emails
    : Array.isArray(corps.amis)
      ? corps.amis
      : [corps.ami1, corps.ami2, corps.ami_email_1, corps.ami_email_2];
  return brut.map((e) => nettoyerEmail(typeof e === 'object' && e ? e.email : e)).filter(Boolean);
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

  const amisBruts = lireAmis(corps);
  const amis = [];
  amisBruts.forEach((ami, i) => {
    if (i >= AMIS_MAX) return;
    if (!emailValide(ami)) {
      erreurs.push({ champ: `ami${i + 1}`, message: `Email de l'ami(e) ${i + 1} invalide` });
      return;
    }
    if (ami === email) {
      erreurs.push({ champ: `ami${i + 1}`, message: "L'email d'un(e) ami(e) doit être différent du vôtre" });
      return;
    }
    if (!amis.includes(ami)) amis.push(ami);
  });

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
      ami_emails: amis,
      avis,
      tickets: calculerTickets({ avis }),
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
