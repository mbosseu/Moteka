// GET /api/admin/participants : participants, tickets et statistiques. ?format=csv pour l'export.
// DELETE ?id= : retire un participant, ses tickets et un eventuel tirage gagne.
import { accepter, erreurServeur, exigerSession, memeOrigine, repondre } from '../_lib/admin-http.mjs';
import { lireLots, lireParticipant, lireParticipants, lireTickets, lireTirages, supprimerParticipant } from '../_lib/admin-db.mjs';
import { assemblerParticipants, csvParticipants, dateParis, statistiques } from '../_lib/admin-tirage.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (!accepter(req, res, ['GET', 'DELETE'])) return;
  const session = exigerSession(req, res);
  if (!session) return;
  try {
    if (req.method === 'DELETE') {
      if (!memeOrigine(req, res)) return;
      const id = new URL(req.url, 'http://local').searchParams.get('id') || '';
      if (!UUID.test(id)) return repondre(res, 400, { ok: false, message: 'Participant inconnu.' });
      const cible = await lireParticipant(id);
      if (!cible) return repondre(res, 404, { ok: false, message: 'Participant introuvable.' });
      await supprimerParticipant(id);
      console.warn('[admin] participant supprime', id, cible.prenom, cible.nom, 'par', session.email);
      return repondre(res, 200, { ok: true });
    }
    const [participants, tickets, tirages, lots] = await Promise.all([lireParticipants(), lireTickets(), lireTirages(), lireLots()]);
    const liste = assemblerParticipants(participants, tickets, tirages, lots);
    const format = new URL(req.url, 'http://local').searchParams.get('format');
    if (format === 'csv') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Disposition', `attachment; filename="moteka-participants-${dateParis()}.csv"`);
      return res.end(csvParticipants(liste));
    }
    return repondre(res, 200, { ok: true, stats: statistiques(participants, tickets, tirages), participants: liste });
  } catch (err) {
    return erreurServeur(res, err, 'participants');
  }
}
