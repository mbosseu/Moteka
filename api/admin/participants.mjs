// GET /api/admin/participants : participants, tickets et statistiques. ?format=csv pour l'export.
import { accepter, erreurServeur, exigerSession, repondre } from '../_lib/admin-http.mjs';
import { lireLots, lireParticipants, lireTickets, lireTirages } from '../_lib/admin-db.mjs';
import { assemblerParticipants, csvParticipants, dateParis, statistiques } from '../_lib/admin-tirage.mjs';

export default async function handler(req, res) {
  if (!accepter(req, res, ['GET'])) return;
  if (!exigerSession(req, res)) return;
  try {
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
