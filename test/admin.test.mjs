import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chiffresHexPi, hacherBcrypt, verifierBcrypt } from '../api/_lib/admin-bcrypt.mjs';
import { lireCookie, secretSession, signerJeton, verifierJeton } from '../api/_lib/admin-session.mjs';
import { verifierConnexion, connexionBloquee, noterEchec, effacerEchecs } from '../api/_lib/admin-auth.mjs';
import {
  assemblerParticipants,
  choisirLot,
  csvParticipants,
  dateDansPeriode,
  dateParis,
  dateValide,
  historiqueTirages,
  nomPublic,
  planDecisionAvis,
  statistiques,
  statutAvisCourt,
  validerDecisionAvis,
  ticketsEligibles,
  resoudreTicketGagnant,
  tirerTicket,
  validerLot,
} from '../api/_lib/admin-tirage.mjs';

/* ---------- bcrypt ---------- */
test('constantes Blowfish calculees depuis pi', () => {
  assert.equal(chiffresHexPi(16), '243f6a8885a308d3');
});

test('bcrypt : vecteurs produits par bcryptjs (BOXPLUS) et vecteur OpenBSD', () => {
  assert.equal(verifierBcrypt('Moteka-Test-2026', '$2a$06$Ve9QZzA6OxMZM1H3jG98PuSwudA7ITpzQ.XCZqXBhog8kQrfyx3fm'), true);
  assert.equal(verifierBcrypt('moteka-test-2026', '$2a$06$Ve9QZzA6OxMZM1H3jG98PuSwudA7ITpzQ.XCZqXBhog8kQrfyx3fm'), false);
  assert.equal(verifierBcrypt('Été à Fenouillet', '$2a$05$WLnmJGmunkXu4NbPrhVAK.M8zDXnY5BVJziluPkkfm8UlDY0HBxMm'), true);
  assert.equal(verifierBcrypt('U*U', '$2a$05$CCCCCCCCCCCCCCCCCCCCC.E5YPO9kmyuRGyh0XouQYb4YMJKvyOeW'), true);
});

test('bcrypt : hachage genere puis verifie, formats invalides refuses', () => {
  const h = hacherBcrypt('secret-de-test', 4);
  assert.match(h, /^\$2b\$04\$[./A-Za-z0-9]{53}$/);
  assert.equal(verifierBcrypt('secret-de-test', h), true);
  assert.equal(verifierBcrypt('secret-de-tesT', h), false);
  for (const mauvais of ['', 'abc', '$2a$06$court', null]) assert.equal(verifierBcrypt('x', mauvais), false);
  assert.equal(verifierBcrypt('', h), false);
});

/* ---------- session ---------- */
const SECRET = 'secret-de-test-tres-long-0123456789';

test('jeton de session : signature, falsification, expiration', () => {
  const exp = Math.floor(Date.now() / 1000) + 60;
  const j = signerJeton({ email: 'a@b.fr', role: 'admin', exp }, SECRET);
  assert.equal(verifierJeton(j, SECRET).email, 'a@b.fr');
  assert.equal(verifierJeton(j, 'autre-secret-tres-long-0123456789'), null);
  const [h, c, s] = j.split('.');
  const falsifie = Buffer.from(JSON.stringify({ email: 'pirate@x.fr', role: 'admin', exp })).toString('base64url');
  assert.equal(verifierJeton(`${h}.${falsifie}.${s}`, SECRET), null);
  assert.equal(verifierJeton(`${h}.${c}`, SECRET), null);
  assert.equal(verifierJeton(j, SECRET, (exp + 1) * 1000), null);
  const sansExp = signerJeton({ email: 'a@b.fr' }, SECRET);
  assert.equal(verifierJeton(sansExp, SECRET), null);
  assert.equal(verifierJeton(j, ''), null);
});

test('secret de session : variables reconnues, valeurs faibles refusees', () => {
  assert.equal(secretSession({ MOTEKA_ADMIN_SESSION_SECRET: SECRET }), SECRET);
  assert.equal(secretSession({ SESSION_SECRET: SECRET }), SECRET);
  assert.equal(secretSession({ SESSION_SECRET: 'change-me' }), '');
  assert.equal(secretSession({ SESSION_SECRET: 'court' }), '');
  assert.equal(secretSession({}), '');
});

test('lecture du cookie', () => {
  const req = { headers: { cookie: 'a=1; moteka_admin_session=abc.def.ghi; b=2' } };
  assert.equal(lireCookie(req), 'abc.def.ghi');
  assert.equal(lireCookie({ headers: {} }), null);
});

/* ---------- connexion (memes comptes que BOXPLUS) ---------- */
test('connexion : super administrateur par variables d environnement', async () => {
  const env = { SUPER_ADMIN_EMAIL: 'Chef@Exemple.fr', SUPER_ADMIN_PASSWORD: 'mot-de-passe-test' };
  const chercherCompte = async () => assert.fail('ne doit pas interroger la base');
  const ok = await verifierConnexion(' chef@exemple.fr ', 'mot-de-passe-test', { env, chercherCompte });
  assert.equal(ok.role, 'super_admin');
  assert.equal(await verifierConnexion('chef@exemple.fr', 'faux', { env, chercherCompte }), null);
});

test('connexion : compte app_users avec hachage bcrypt', async () => {
  const hash = '$2a$06$Ve9QZzA6OxMZM1H3jG98PuSwudA7ITpzQ.XCZqXBhog8kQrfyx3fm';
  const chercherCompte = async (email) => (email === 'staff@exemple.fr' ? { email, password_hash: hash, role: 'super_admin', name: 'Staff' } : null);
  const u = await verifierConnexion('STAFF@exemple.fr', 'Moteka-Test-2026', { env: {}, chercherCompte });
  assert.deepEqual(u, { email: 'staff@exemple.fr', role: 'admin', name: 'Staff' });
  assert.equal(await verifierConnexion('staff@exemple.fr', 'mauvais', { env: {}, chercherCompte }), null);
  assert.equal(await verifierConnexion('inconnu@exemple.fr', 'Moteka-Test-2026', { env: {}, chercherCompte }), null);
  assert.equal(await verifierConnexion('', '', { env: {}, chercherCompte }), null);
  const enPanne = async () => { throw new Error('reseau'); };
  assert.equal(await verifierConnexion('staff@exemple.fr', 'x', { env: {}, chercherCompte: enPanne }), null);
});

test('limitation des essais de connexion', () => {
  const ip = '203.0.113.9';
  for (let i = 0; i < 8; i += 1) noterEchec(ip, 1000);
  assert.equal(connexionBloquee(ip, 2000), true);
  assert.equal(connexionBloquee(ip, 1000 + 16 * 60 * 1000), false);
  noterEchec(ip, 0);
  effacerEchecs(ip);
  assert.equal(connexionBloquee(ip, 1), false);
});

/* ---------- eligibilite et tirage ---------- */
const tickets = [
  { numero: 100, participant_id: 'p1', motif: 'inscription' },
  { numero: 101, participant_id: 'p2', motif: 'inscription' },
  { numero: 102, participant_id: 'p1', motif: 'amis' },
  { numero: 103, participant_id: 'p3', motif: 'inscription' },
  { numero: 104, participant_id: 'p1', motif: 'avis' },
  { numero: 105, participant_id: null, motif: 'inscription' },
];
const lots = [
  { id: 'l2', ordre: 2, nom: 'Révision complète', actif: true },
  { id: 'l1', ordre: 1, nom: 'Location 24 h', actif: true },
  { id: 'l3', ordre: 3, nom: 'Vidange offerte', actif: false },
  { id: 'l4', ordre: 4, nom: 'Nettoyage complet', actif: true },
];

test('eligibilite : sans tirage, tous les tickets rattaches', () => {
  assert.deepEqual(ticketsEligibles(tickets, []).map((t) => t.numero), [100, 101, 102, 103, 104]);
});

test('eligibilite : un gagnant ne peut plus regagner, avec aucun de ses tickets', () => {
  const tirages = [{ numero: 102, participant_id: 'p1', lot_id: 'l1' }];
  assert.deepEqual(ticketsEligibles(tickets, tirages).map((t) => t.numero), [101, 103]);
  const deux = [...tirages, { numero: 103, participant_id: 'p3', lot_id: 'l2' }];
  assert.deepEqual(ticketsEligibles(tickets, deux).map((t) => t.numero), [101]);
});

test('gagnant manuel : numero ou participant_id parmi les eligibles', () => {
  const eligibles = ticketsEligibles(tickets, []);
  assert.equal(resoudreTicketGagnant(eligibles, { numero: 102 }).ticket.numero, 102);
  assert.equal(resoudreTicketGagnant(eligibles, { participant_id: 'p1' }).ticket.numero, 100);
  assert.ok(resoudreTicketGagnant(eligibles, { numero: 999 }).erreur);
  assert.ok(resoudreTicketGagnant(eligibles, {}).erreur);
  assert.ok(resoudreTicketGagnant([], { numero: 100 }).erreur);
});

test('tirage : uniforme sur les tickets eligibles (un participant a autant de chances que de tickets)', () => {
  const eligibles = ticketsEligibles(tickets, []);
  assert.equal(tirerTicket(eligibles, () => 0).numero, 100);
  assert.equal(tirerTicket(eligibles, (n) => n - 1).numero, 104);
  assert.equal(tirerTicket([], () => 0), null);
  const compte = new Map();
  for (let i = 0; i < 6000; i += 1) {
    const t = tirerTicket(eligibles);
    compte.set(t.participant_id, (compte.get(t.participant_id) || 0) + 1);
  }
  assert.ok(compte.get('p1') > compte.get('p2') * 2);
});

test('choix du lot : ordre, lot demande, lots attribues ou inactifs exclus', () => {
  assert.equal(choisirLot(lots, []).lot.id, 'l1');
  assert.equal(choisirLot(lots, [{ lot_id: 'l1' }]).lot.id, 'l2');
  assert.equal(choisirLot(lots, [{ lot_id: 'l1' }, { lot_id: 'l2' }]).lot.id, 'l4');
  assert.equal(choisirLot(lots, [], 'l4').lot.id, 'l4');
  assert.ok(choisirLot(lots, [{ lot_id: 'l4' }], 'l4').erreur);
  assert.ok(choisirLot(lots, [], 'l3').erreur);
  assert.ok(choisirLot(lots, [{ lot_id: 'l1' }, { lot_id: 'l2' }, { lot_id: 'l4' }]).erreur);
});

test('periode des tirages : du 23 au 27 novembre 2026 inclus', () => {
  for (const d of ['2026-11-23', '2026-11-25', '2026-11-27']) assert.equal(dateDansPeriode(d), true, d);
  for (const d of ['2026-11-22', '2026-11-28', '2026-12-11', '2026-02-30', 'demain']) assert.equal(dateDansPeriode(d), false, d);
});

test('dates : jour de Paris et validation', () => {
  assert.equal(dateParis(new Date('2026-11-23T23:30:00Z')), '2026-11-24');
  assert.equal(dateParis(new Date('2026-11-23T18:00:00Z')), '2026-11-23');
  assert.equal(dateValide('2026-11-23'), true);
  assert.equal(dateValide('2026-02-30'), false);
});

test('nom public et assemblage des participants', () => {
  assert.equal(nomPublic('Camille', ' dupont'), 'Camille D.');
  assert.equal(nomPublic('Camille', ''), 'Camille');
  const participants = [
    { id: 'p1', prenom: 'Ana', nom: 'Roux', created_at: '2026-11-20T10:00:00Z', amis: [{ email: 'x@y.fr' }] },
    { id: 'p2', prenom: 'Bob', nom: 'Lenoir', created_at: '2026-11-21T10:00:00Z', amis: null },
  ];
  const tirages = [{ id: 't1', date_tirage: '2026-11-23', numero: 104, participant_id: 'p1', lot_id: 'l1', created_at: '' }];
  const liste = assemblerParticipants(participants, tickets, tirages, lots);
  assert.equal(liste[0].prenom, 'Bob');
  assert.deepEqual(liste[1].tickets.map((t) => t.numero), [100, 102, 104]);
  assert.equal(liste[1].gain.lot, 'Location 24 h');
  assert.deepEqual(liste[0].amis, []);
  assert.deepEqual(statistiques(participants, tickets, tirages), { inscrits: 2, tickets: 6, eligibles: 2, tirages: 1 });
  const h = historiqueTirages(tirages, participants, lots);
  assert.equal(h[0].gagnant, 'Ana R.');
  assert.equal(h[0].lot.nom, 'Location 24 h');
});

test('export CSV : BOM, separateur, echappement et anti-formules', () => {
  const csv = csvParticipants([
    { prenom: '=HYPERLIEN("x")', nom: 'Du;pont', telephone: '+33 6 12 34 56 78', email: 'a@b.fr', tickets: [{ numero: 100 }, { numero: 102 }], avis: true, amis: ['c@d.fr'], created_at: '2026-11-20' },
  ]);
  assert.ok(csv.startsWith('﻿Prénom;Nom;'));
  const ligne = csv.split('\r\n')[1];
  assert.ok(ligne.startsWith(`"'=HYPERLIEN(""x"")";"Du;pont";'+33 6 12 34 56 78;a@b.fr;100 102;2;oui;c@d.fr`));
});

test('validation des lots', () => {
  assert.deepEqual(validerLot({ nom: ' Vidange offerte ', description: 'x' }).champs, { nom: 'Vidange offerte', description: 'x' });
  assert.ok(validerLot({ nom: '' }).erreur);
  assert.ok(validerLot({}).erreur);
  assert.ok(validerLot({ image_url: 'javascript:alert(1)' }).erreur);
  assert.equal(validerLot({ image_url: '' }).champs.image_url, null);
  assert.equal(validerLot({ actif: 0 }).champs.actif, false);
});

test('preuve d avis : decision valider / refuser', () => {
  const id = '6f1c2a3b-1234-4abc-8def-0123456789ab';
  assert.deepEqual(validerDecisionAvis({ id, decision: 'refuser' }), { id, decision: 'refuser' });
  assert.ok(validerDecisionAvis({ id: 'x', decision: 'refuser' }).erreur);
  assert.ok(validerDecisionAvis({ id, decision: 'supprimer' }).erreur);

  const ticket = { numero: 130, motif: 'avis' };
  assert.equal(planDecisionAvis({ decision: 'refuser', participant: null }).statut, 404);
  assert.equal(planDecisionAvis({ decision: 'refuser', participant: { avis_statut: 'aucun' } }).statut, 409);
  const refus = planDecisionAvis({ decision: 'refuser', participant: { avis_statut: 'a_verifier' }, ticket });
  assert.deepEqual(refus, { champs: { avis: false, avis_statut: 'refuse' }, supprimerTicket: true, ajouterTicket: false, mail: true });
  // ticket avis deja gagnant : refus impossible
  const gagne = planDecisionAvis({ decision: 'refuser', participant: { avis_statut: 'a_verifier' }, ticket, tirages: [{ numero: 130 }] });
  assert.equal(gagne.statut, 409);
  assert.match(gagne.erreur, /130/);
  assert.deepEqual(planDecisionAvis({ decision: 'refuser', participant: { avis_statut: 'refuse' } }), { deja: true });
  const valide = planDecisionAvis({ decision: 'valider', participant: { avis_statut: 'a_verifier' }, ticket });
  assert.deepEqual(valide.champs, { avis: true, avis_statut: 'valide' });
  assert.equal(valide.ajouterTicket, false);
  // revalider une preuve refusee : le ticket avis revient
  assert.equal(planDecisionAvis({ decision: 'valider', participant: { avis_statut: 'refuse' } }).ajouterTicket, true);
  assert.deepEqual(planDecisionAvis({ decision: 'valider', participant: { avis_statut: 'valide' }, ticket }), { deja: true });

  assert.equal(statutAvisCourt({ avis_statut: 'a_verifier' }), 'à vérifier');
  assert.equal(statutAvisCourt({ avis_statut: 'refuse', avis: false }), 'refusé');
  assert.equal(statutAvisCourt({ avis: true }), 'oui');
  assert.equal(statutAvisCourt({}), 'non');
});
