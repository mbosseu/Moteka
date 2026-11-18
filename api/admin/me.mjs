// GET /api/admin/me : utilisateur connecte.
import { accepter, exigerSession, repondre } from '../_lib/admin-http.mjs';

export default function handler(req, res) {
  if (!accepter(req, res, ['GET'])) return;
  const session = exigerSession(req, res);
  if (!session) return;
  return repondre(res, 200, { ok: true, user: session });
}
