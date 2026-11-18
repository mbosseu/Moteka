// POST /api/admin/logout : efface le cookie de session.
import { accepter, repondre } from '../_lib/admin-http.mjs';
import { effacerSession } from '../_lib/admin-session.mjs';

export default function handler(req, res) {
  if (!accepter(req, res, ['POST'])) return;
  effacerSession(res);
  return repondre(res, 200, { ok: true });
}
