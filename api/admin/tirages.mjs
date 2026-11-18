// GET /api/admin/tirages : historique des tirages.
// DELETE ?id= : annule un tirage (le lot et le gagnant redeviennent disponibles).
import { accepter, erreurServeur, exigerSession, memeOrigine, repondre } from '../_lib/admin-http.mjs';
import { lireLots, lireParticipants, lireTirages, supprimerTirage } from '../_lib/admin-db.mjs';
import { historiqueTirages } from '../_lib/admin-tirage.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (!accepter(req, res, ['GET', 'DELETE'])) return;
  const session = exigerSession(req, res);
  if (!session) return;
  try {
    if (req.method === 'DELETE') {
      if (!memeOrigine(req, res)) return;
      const id = new URL(req.url, 'http://local').searchParams.get('id') || '';
      if (!UUID.test(id)) return repondre(res, 400, { ok: false, message: 'Tirage inconnu.' });
      await supprimerTirage(id);
      console.warn('[admin] tirage annule', id, 'par', session.email);
      return repondre(res, 200, { ok: true });
    }
    const [tirages, participants, lots] = await Promise.all([lireTirages(), lireParticipants(), lireLots()]);
    return repondre(res, 200, { ok: true, tirages: historiqueTirages(tirages, participants, lots) });
  } catch (err) {
    return erreurServeur(res, err, 'tirages');
  }
}
