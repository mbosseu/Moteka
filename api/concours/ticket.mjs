// GET /api/concours/ticket?n=208&c=... : verifie le QR d'un ticket (anti-triche).
import { repondre } from '../_lib/http.mjs';
import { lireParticipants, lireTickets } from '../_lib/admin-db.mjs';
import { nomPublic } from '../_lib/admin-tirage.mjs';
import { verifierCodeTicket } from '../_lib/ticket-pdf.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return repondre(res, 405, { ok: false, message: 'Méthode non autorisée' });
  }
  const q = new URL(req.url, 'http://local').searchParams;
  const numero = Number(q.get('n') || q.get('numero'));
  const code = String(q.get('c') || q.get('code') || '').trim();
  if (!Number.isFinite(numero) || !code) {
    return repondre(res, 400, { ok: false, valide: false, message: 'QR incomplet.' });
  }
  try {
    const tickets = await lireTickets();
    const ticket = tickets.find((t) => Number(t.numero) === numero);
    if (!ticket || !verifierCodeTicket(numero, ticket.participant_id, code)) {
      return repondre(res, 200, { ok: true, valide: false, message: 'Ticket inconnu ou QR falsifié.' });
    }
    const participants = await lireParticipants();
    const p = participants.find((x) => String(x.id) === String(ticket.participant_id));
    return repondre(res, 200, {
      ok: true,
      valide: true,
      numero,
      motif: ticket.motif || '',
      titulaire: nomPublic(p?.prenom, p?.nom),
      message: 'Ticket authentique.',
    });
  } catch (err) {
    console.error('[concours] ticket', err);
    return repondre(res, 500, { ok: false, valide: false, message: 'Vérification indisponible.' });
  }
}
