// GET /api/admin/preuve?id=... : renvoie l'image de la preuve d'avis Google d'un participant (session obligatoire).
import { accepter, erreurServeur, exigerSession, repondre } from '../_lib/admin-http.mjs';
import { lirePreuveAvis } from '../_lib/admin-db.mjs';
import { lirePreuve } from '../_lib/concours.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (!accepter(req, res, ['GET'])) return;
  if (!exigerSession(req, res)) return;
  const id = new URL(req.url, 'http://local').searchParams.get('id') || '';
  if (!UUID.test(id)) return repondre(res, 400, { ok: false, message: 'Participant inconnu.' });
  try {
    const ligne = await lirePreuveAvis(id);
    const image = ligne && lirePreuve(ligne.avis_preuve);
    if (!image) return repondre(res, 404, { ok: false, message: 'Aucune preuve d’avis pour ce participant.' });
    const octets = Buffer.from(image.base64, 'base64');
    res.statusCode = 200;
    res.setHeader('Content-Type', image.type);
    res.setHeader('Content-Length', String(octets.length));
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `inline; filename="avis-${id.slice(0, 8)}.${image.type.split('/')[1].replace('jpeg', 'jpg')}"`);
    return res.end(octets);
  } catch (err) {
    return erreurServeur(res, err, 'preuve');
  }
}
