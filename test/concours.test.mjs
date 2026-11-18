import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculerTickets,
  clePhone,
  formaterTelephone,
  normaliserTelephone,
  validerInscription,
} from '../api/_lib/concours.mjs';
import { mailAmi, mailConfirmation, mailInterne } from '../api/_lib/mails.mjs';

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

test('calcul des tickets', () => {
  assert.equal(calculerTickets(), 1);
  assert.equal(calculerTickets({ avis: false }), 1);
  assert.equal(calculerTickets({ avis: true }), 2);
});

const base = { prenom: 'Lea', nom: 'Martin', telephone: '06 12 34 56 78', email: 'Lea@Exemple.fr', reglement: true };

test('inscription valide', () => {
  const r = validerInscription({ ...base, ami_emails: ['ami@exemple.fr', 'ami@exemple.fr', ''] });
  assert.equal(r.ok, true);
  assert.equal(r.donnees.email, 'lea@exemple.fr');
  assert.equal(r.donnees.telephone, '0612345678');
  assert.equal(r.donnees.phone_key, '612345678');
  assert.deepEqual(r.donnees.ami_emails, ['ami@exemple.fr']);
  assert.equal(r.donnees.tickets, 1);
  assert.equal(validerInscription({ ...base, avis: true }).donnees.tickets, 2);
});

test('champs obligatoires et erreurs', () => {
  const r = validerInscription({});
  const champs = r.erreurs.map((e) => e.champ);
  assert.equal(r.ok, false);
  for (const c of ['prenom', 'nom', 'telephone', 'email', 'reglement']) assert.ok(champs.includes(c), c);
  assert.equal(validerInscription({ ...base, email: 'pas-un-mail' }).ok, false);
  assert.equal(validerInscription({ ...base, telephone: '12' }).ok, false);
  assert.equal(validerInscription({ ...base, reglement: false }).ok, false);
  assert.equal(validerInscription({ ...base, ami_emails: ['faux'] }).ok, false);
  assert.equal(validerInscription({ ...base, ami_emails: ['lea@exemple.fr'] }).ok, false);
});

test('mails en texte brut', () => {
  const c = mailConfirmation({ prenom: 'lea', tickets: 1, avis: false });
  assert.match(c.text, /^Salut Lea,/);
  assert.match(c.text, /share\.google/);
  assert.doesNotMatch(c.text, /</);
  assert.doesNotMatch(mailConfirmation({ prenom: 'lea', tickets: 2, avis: true }).text, /share\.google/);
  assert.match(mailAmi({ prenomParrain: 'lea', lienPage: 'https://exemple.fr/' }).text, /https:\/\/exemple\.fr$/m);
  const i = mailInterne({ participant: { ...base, telephone: '0612345678', ami_emails: ['a@b.fr'], tickets: 1 } });
  assert.match(i.text, /06 12 34 56 78/);
  assert.match(i.text, /a@b\.fr/);
});
