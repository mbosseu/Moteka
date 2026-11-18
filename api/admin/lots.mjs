// GET /api/admin/lots : liste des lots (avec attribution).
// PUT { id, nom?, description?, image_url?, actif? } : modification d'un lot.
import { lireCorps } from '../_lib/http.mjs';
import { accepter, erreurServeur, exigerSession, memeOrigine, repondre } from '../_lib/admin-http.mjs';
import { lireLots, lireTirages, modifierLot } from '../_lib/admin-db.mjs';
import { validerLot } from '../_lib/admin-tirage.mjs';

export default async function handler(req, res) {
  if (!accepter(req, res, ['GET', 'PUT'])) return;
  if (!exigerSession(req, res)) return;
  try {
    if (req.method === 'PUT') {
      if (!memeOrigine(req, res)) return;
      const corps = lireCorps(req);
      if (!corps.id) return repondre(res, 400, { ok: false, message: 'Lot manquant.' });
      const { champs, erreur } = validerLot(corps);
      if (erreur) return repondre(res, 400, { ok: false, message: erreur });
      const lot = await modifierLot(corps.id, champs);
      if (!lot) return repondre(res, 404, { ok: false, message: 'Lot introuvable.' });
      return repondre(res, 200, { ok: true, lot });
    }
    const [lots, tirages] = await Promise.all([lireLots(), lireTirages()]);
    const attribution = new Map(tirages.map((t) => [String(t.lot_id), t.date_tirage]));
    return repondre(res, 200, {
      ok: true,
      lots: lots.map((l) => ({ ...l, attribue_le: attribution.get(String(l.id)) || null })),
    });
  } catch (err) {
    return erreurServeur(res, err, 'lots');
  }
}
