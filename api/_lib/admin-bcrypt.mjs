// Verification de mots de passe bcrypt ($2a$, $2b$, $2y$) en JavaScript pur, sans dependance.
// Compatible avec les hachages produits par bcryptjs (back-office BOXPLUS, table app_users).
//
// Les constantes de Blowfish (tableau P et 4 boites S) sont, par definition de l'algorithme,
// les 8336 premiers chiffres hexadecimaux de la partie fractionnaire de pi. Plutot que d'embarquer
// 1042 mots en dur, on les calcule une seule fois (formule de Machin en BigInt, quelques ms),
// puis on controle les premiers mots connus (P[0] = 0x243f6a88, S0[0] = 0xd1310ba6).

import crypto from 'node:crypto';

const ALPHABET = './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const INDEX = new Map([...ALPHABET].map((c, i) => [c, i]));
const MAGIC = 'OrpheanBeholderScryDoubt';

let constantes = null;

function arctanInverse(x, echelle) {
  const x2 = x * x;
  let terme = echelle / x;
  let somme = terme;
  let n = 1n;
  let signe = -1n;
  while (terme !== 0n) {
    terme /= x2;
    n += 2n;
    somme += signe * (terme / n);
    signe = -signe;
  }
  return somme;
}

/** Chiffres hexadecimaux de la partie fractionnaire de pi (Machin : pi = 16 atan(1/5) - 4 atan(1/239)). */
export function chiffresHexPi(nombre) {
  const garde = 16;
  const echelle = 1n << BigInt(4 * (nombre + garde));
  const pi = 16n * arctanInverse(5n, echelle) - 4n * arctanInverse(239n, echelle);
  const fraction = pi - 3n * echelle;
  return fraction.toString(16).padStart(nombre + garde, '0').slice(0, nombre);
}

function initialiserConstantes() {
  if (constantes) return constantes;
  const hex = chiffresHexPi(1042 * 8);
  const mots = new Uint32Array(1042);
  for (let i = 0; i < 1042; i += 1) mots[i] = parseInt(hex.slice(i * 8, i * 8 + 8), 16) >>> 0;
  if (mots[0] !== 0x243f6a88 || mots[18] !== 0xd1310ba6 || mots[1041] !== 0x3ac372e6) {
    throw new Error('bcrypt_constantes_invalides');
  }
  constantes = { P: mots.slice(0, 18), S: mots.slice(18) };
  return constantes;
}

/** Decodage base64 propre a bcrypt (alphabet ./A-Za-z0-9, sans remplissage). */
export function decoderBase64Bcrypt(texte, longueur) {
  const octets = [];
  let i = 0;
  const lire = () => {
    const v = INDEX.get(texte[i]);
    i += 1;
    if (v === undefined) throw new Error('base64_bcrypt_invalide');
    return v;
  };
  while (octets.length < longueur && i < texte.length) {
    const c1 = lire();
    const c2 = lire();
    octets.push(((c1 << 2) | (c2 >> 4)) & 0xff);
    if (octets.length >= longueur || i >= texte.length) break;
    const c3 = lire();
    octets.push((((c2 & 0x0f) << 4) | (c3 >> 2)) & 0xff);
    if (octets.length >= longueur || i >= texte.length) break;
    const c4 = lire();
    octets.push((((c3 & 0x03) << 6) | c4) & 0xff);
  }
  return Uint8Array.from(octets);
}

export function encoderBase64Bcrypt(octets, longueur = octets.length) {
  let sortie = '';
  let i = 0;
  while (i < longueur) {
    const a = octets[i++];
    sortie += ALPHABET[(a >> 2) & 0x3f];
    let c = (a & 0x03) << 4;
    if (i >= longueur) { sortie += ALPHABET[c]; break; }
    const b = octets[i++];
    c |= (b >> 4) & 0x0f;
    sortie += ALPHABET[c];
    c = (b & 0x0f) << 2;
    if (i >= longueur) { sortie += ALPHABET[c]; break; }
    const d = octets[i++];
    c |= (d >> 6) & 0x03;
    sortie += ALPHABET[c];
    sortie += ALPHABET[d & 0x3f];
  }
  return sortie;
}

function chiffrer(etat, lr, off) {
  const { P, S } = etat;
  let l = lr[off];
  let r = lr[off + 1];
  l ^= P[0];
  for (let i = 1; i <= 16; i += 2) {
    r ^= (((S[l >>> 24] + S[0x100 | ((l >>> 16) & 0xff)]) ^ S[0x200 | ((l >>> 8) & 0xff)]) + S[0x300 | (l & 0xff)]);
    r ^= P[i];
    l ^= (((S[r >>> 24] + S[0x100 | ((r >>> 16) & 0xff)]) ^ S[0x200 | ((r >>> 8) & 0xff)]) + S[0x300 | (r & 0xff)]);
    l ^= P[i + 1];
  }
  lr[off] = (r ^ P[17]) >>> 0;
  lr[off + 1] = l >>> 0;
}

function motCyclique(donnees, pos) {
  let mot = 0;
  for (let i = 0; i < 4; i += 1) {
    mot = (mot << 8) | donnees[pos.i];
    pos.i = (pos.i + 1) % donnees.length;
  }
  return mot >>> 0;
}

function etendreCle(etat, cle, sel) {
  const { P, S } = etat;
  const pc = { i: 0 };
  for (let i = 0; i < 18; i += 1) P[i] = (P[i] ^ motCyclique(cle, pc)) >>> 0;
  const lr = new Uint32Array(2);
  const ps = { i: 0 };
  const remplir = (tableau, taille) => {
    for (let i = 0; i < taille; i += 2) {
      if (sel) {
        lr[0] ^= motCyclique(sel, ps);
        lr[1] ^= motCyclique(sel, ps);
      }
      chiffrer(etat, lr, 0);
      tableau[i] = lr[0];
      tableau[i + 1] = lr[1];
    }
  };
  remplir(P, 18);
  remplir(S, 1024);
}

/** Calcule le hachage bcrypt brut (23 octets significatifs) pour une cle et un sel de 16 octets. */
function bcryptBrut(cle, sel, cout) {
  const base = initialiserConstantes();
  const etat = { P: base.P.slice(), S: base.S.slice() };
  etendreCle(etat, cle, sel);
  const tours = 2 ** cout;
  for (let i = 0; i < tours; i += 1) {
    etendreCle(etat, cle, null);
    etendreCle(etat, sel, null);
  }
  const lr = new Uint32Array(6);
  for (let i = 0; i < 6; i += 1) {
    lr[i] = ((MAGIC.charCodeAt(i * 4) << 24) | (MAGIC.charCodeAt(i * 4 + 1) << 16) | (MAGIC.charCodeAt(i * 4 + 2) << 8) | MAGIC.charCodeAt(i * 4 + 3)) >>> 0;
  }
  for (let i = 0; i < 64; i += 1) {
    for (let j = 0; j < 6; j += 2) chiffrer(etat, lr, j);
  }
  const sortie = new Uint8Array(24);
  for (let i = 0; i < 6; i += 1) {
    sortie[i * 4] = lr[i] >>> 24;
    sortie[i * 4 + 1] = (lr[i] >>> 16) & 0xff;
    sortie[i * 4 + 2] = (lr[i] >>> 8) & 0xff;
    sortie[i * 4 + 3] = lr[i] & 0xff;
  }
  return sortie;
}

const FORMAT = /^\$2([abxy])\$(\d{2})\$([./A-Za-z0-9]{22})([./A-Za-z0-9]{31})$/;

/** Produit un hachage bcrypt complet a partir d'un mot de passe et d'un prefixe "$2b$10$<22 car. de sel>". */
export function hacherAvecSel(motDePasse, prefixe) {
  const m = /^\$2([abxy])\$(\d{2})\$([./A-Za-z0-9]{22})/.exec(String(prefixe || ''));
  if (!m) throw new Error('prefixe_bcrypt_invalide');
  const cout = Number(m[2]);
  if (cout < 4 || cout > 16) throw new Error('cout_bcrypt_non_supporte');
  const sel = decoderBase64Bcrypt(m[3], 16);
  // Comme bcryptjs : octets UTF-8 + octet nul final, tronques a 72 octets.
  const brut = Buffer.concat([Buffer.from(String(motDePasse), 'utf8'), Buffer.from([0])]);
  const cle = Uint8Array.from(brut.subarray(0, 72));
  const resultat = bcryptBrut(cle, sel, cout);
  return `$2${m[1]}$${m[2]}$${m[3]}${encoderBase64Bcrypt(resultat, 23)}`;
}

/** Genere un hachage bcrypt (utile pour creer un compte de test). */
export function hacherBcrypt(motDePasse, cout = 10) {
  const sel = encoderBase64Bcrypt(crypto.randomBytes(16), 16);
  return hacherAvecSel(motDePasse, `$2b$${String(cout).padStart(2, '0')}$${sel}`);
}

/** Compare un mot de passe a un hachage bcrypt, en temps constant sur le resultat. */
export function verifierBcrypt(motDePasse, hachage) {
  const h = String(hachage || '');
  if (!FORMAT.test(h) || !motDePasse) return false;
  let calcule;
  try {
    calcule = hacherAvecSel(motDePasse, h.slice(0, 29));
  } catch {
    return false;
  }
  const a = Buffer.from(calcule, 'utf8');
  const b = Buffer.from(h, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
