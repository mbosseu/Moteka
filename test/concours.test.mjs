import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculerTickets,
  clePhone,
  formaterTelephone,
  motifsManquants,
  motifsTickets,
  normaliserTelephone,
  ticketsAGagner,
  validerAmis,
  validerInscription,
} from '../api/_lib/concours.mjs';
import { listeNumeros, mailAmi, mailConfirmation, mailInterne, mailNouveauTicket } from '../api/_lib/mails.mjs';

test('normalisation des numeros francais', () => {
  for (const v of ['06 12 34 56 78', '06.12.34.56.78', '+33 6 12 34 56 78', '0033612345678', '33612345678', '612345678', '+33 (0)6 12 34 56 78']) {
    assert.equal(normaliserTelephone(v), '0612345678', v);
  }
  assert.equal(normaliserTelephone('05 16 47 20 35'), '0516472035');
  for (const v of ['', '123', '0012345678', '06 11 11 11 11', '+1 202 555 0143', 'abc']) {
    assert.equal(normaliserTelephone(v), '', v);
  }
  assert.equal(clePhone('+33 6 12 34 56 78'), '612345678');
  assert.equal(formaterTelephone('0612345678'), '06 12 34 56 78');
});

const deuxAmis = [
  { prenom: 'Paul', email: 'Paul@Exemple.fr', telephone: '' },
  { prenom: 'Zoe', email: 'zoe@exemple.fr', telephone: '07 12 34 56 78' },
];

test('motifs et calcul des tickets', () => {
  assert.deepEqual(motifsTickets(), ['inscription']);
  assert.deepEqual(motifsTickets({ amis: deuxAmis }), ['inscription', 'amis']);
  assert.deepEqual(motifsTickets({ amis: [deuxAmis[0]] }), ['inscription']);
  assert.deepEqual(motifsTickets({ avis: true }), ['inscription', 'avis']);
  assert.deepEqual(motifsTickets({ amis: deuxAmis, avis: true }), ['inscription', 'amis', 'avis']);
  assert.equal(calculerTickets(), 1);
  assert.equal(calculerTickets({ amis: deuxAmis, avis: true }), 3);
  // ajout apres coup : seuls les motifs pas encore obtenus sont attribues, dans l'ordre
  assert.deepEqual(motifsManquants(['inscription', 'amis', 'avis'], ['inscription', 'avis']), ['amis']);
  assert.deepEqual(motifsManquants(['inscription', 'avis'], ['inscription', 'avis']), []);
  assert.deepEqual(motifsManquants(['avis', 'inscription'], []), ['inscription', 'avis']);
  assert.deepEqual(ticketsAGagner(['inscription']), ['amis', 'avis']);
  assert.deepEqual(ticketsAGagner(['inscription', 'amis', 'avis']), []);
});

test('validation des amis', () => {
  assert.deepEqual(validerAmis({}), { erreurs: [], amis: [] });
  assert.deepEqual(validerAmis({ amis: [{}, { prenom: ' ', email: '' }] }).amis, []);
  const ok = validerAmis({ amis: deuxAmis }, { emailParticipant: 'lea@exemple.fr' });
  assert.equal(ok.erreurs.length, 0);
  assert.deepEqual(ok.amis, [
    { prenom: 'Paul', email: 'paul@exemple.fr', telephone: '' },
    { prenom: 'Zoe', email: 'zoe@exemple.fr', telephone: '0712345678' },
  ]);
  // champs a plat ami1_prenom...
  assert.equal(validerAmis({ ami1_prenom: 'Paul', ami1_email: 'p@x.fr', ami2_prenom: 'Zoe', ami2_email: 'z@x.fr' }).amis.length, 2);
  const champs = (r) => r.erreurs.map((e) => e.champ);
  assert.deepEqual(champs(validerAmis({ amis: [deuxAmis[0]] })), ['ami2_prenom', 'ami2_email']);
  assert.deepEqual(champs(validerAmis({ amis: [{ email: 'a@b.fr' }, deuxAmis[1]] })), ['ami1_prenom']);
  assert.deepEqual(champs(validerAmis({ amis: [{ prenom: 'A', email: 'faux' }, deuxAmis[1]] })), ['ami1_email']);
  assert.deepEqual(champs(validerAmis({ amis: [deuxAmis[0], { ...deuxAmis[1], email: 'paul@exemple.fr' }] })), ['ami2_email']);
  assert.deepEqual(champs(validerAmis({ amis: deuxAmis }, { emailParticipant: 'zoe@exemple.fr' })), ['ami2_email']);
  assert.deepEqual(champs(validerAmis({ amis: [deuxAmis[0], { ...deuxAmis[1], telephone: '12' }] })), ['ami2_telephone']);
  assert.equal(validerAmis({ amis: [{ prenom: 'A', email: 'faux' }, deuxAmis[1]] }).amis.length, 0);
});

const base = { prenom: 'Lea', nom: 'Martin', telephone: '06 12 34 56 78', email: 'Lea@Exemple.fr', reglement: true };

test('inscription valide', () => {
  const r = validerInscription(base);
  assert.equal(r.ok, true);
  assert.equal(r.donnees.email, 'lea@exemple.fr');
  assert.equal(r.donnees.telephone, '0612345678');
  assert.equal(r.donnees.phone_key, '612345678');
  assert.deepEqual(r.donnees.amis, []);
  assert.deepEqual(motifsTickets(r.donnees), ['inscription']);
  const complet = validerInscription({ ...base, amis: deuxAmis, avis: true });
  assert.equal(complet.ok, true);
  assert.equal(complet.donnees.amis.length, 2);
  assert.deepEqual(motifsTickets(complet.donnees), ['inscription', 'amis', 'avis']);
});

test('champs obligatoires et erreurs', () => {
  const r = validerInscription({});
  const champs = r.erreurs.map((e) => e.champ);
  assert.equal(r.ok, false);
  for (const c of ['prenom', 'nom', 'telephone', 'email', 'reglement']) assert.ok(champs.includes(c), c);
  assert.equal(validerInscription({ ...base, email: 'pas-un-mail' }).ok, false);
  assert.equal(validerInscription({ ...base, telephone: '12' }).ok, false);
  assert.equal(validerInscription({ ...base, reglement: false }).ok, false);
  assert.equal(validerInscription({ ...base, amis: [deuxAmis[0]] }).ok, false);
  assert.equal(validerInscription({ ...base, amis: [deuxAmis[0], { prenom: 'X', email: 'lea@exemple.fr' }] }).ok, false);
});

const tickets = [
  { numero: 422, motif: 'inscription' },
  { numero: 423, motif: 'amis' },
];

test('mails en texte brut', () => {
  assert.equal(listeNumeros(tickets), '422, 423');
  const c = mailConfirmation({ prenom: 'lea', tickets, lienPage: 'https://exemple.fr/' });
  assert.match(c.text, /^Salut Lea,/);
  assert.match(c.text, /Tes tickets : 422, 423/);
  assert.match(c.text, /share\.google/);
  assert.doesNotMatch(c.text, /invite 2 ami/);
  assert.doesNotMatch(c.text, /</);
  const plein = mailConfirmation({ prenom: 'lea', tickets: [...tickets, { numero: 424, motif: 'avis' }] });
  assert.match(plein.text, /Tes tickets : 422, 423, 424/);
  assert.doesNotMatch(plein.text, /share\.google/);
  const seul = mailConfirmation({ prenom: 'lea', tickets: [tickets[0]] });
  assert.match(seul.text, /invite 2 ami/);
  const n = mailNouveauTicket({ prenom: 'lea', nouveaux: [{ numero: 430, motif: 'avis' }], tickets: [...tickets, { numero: 430, motif: 'avis' }] });
  assert.match(n.subject, /430/);
  assert.match(n.text, /422, 423, 430/);
  const ami = mailAmi({ prenomParrain: 'lea', prenomAmi: 'paul', lienPage: 'https://exemple.fr/' });
  assert.match(ami.text, /^Salut Paul,/);
  assert.match(ami.text, /https:\/\/exemple\.fr$/m);
  const i = mailInterne({ participant: { ...base, telephone: '0612345678', amis: [{ prenom: 'Paul', email: 'a@b.fr', telephone: '' }] }, tickets });
  assert.match(i.text, /06 12 34 56 78/);
  assert.match(i.text, /Paul \/ a@b\.fr/);
  assert.match(i.text, /422 \(Inscription\), 423/);
});
