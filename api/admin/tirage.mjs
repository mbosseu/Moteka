// GET /api/admin/tirage : etat du tirage du soir (numeros des tickets eligibles pour la roulette, lots restants).
// POST /api/admin/tirage { lot_id?, date?, numero?, participant_id? } : enregistre le gagnant choisi (ticket eligible).
import { lireCorps } from '../_lib/http.mjs';
import { accepter, erreurServeur, exigerSession, memeOrigine, repondre } from '../_lib/admin-http.mjs';
import { enregistrerTirage, lireLots, lireParticipant, lireParticipants, lireTickets, lireTirages } from '../_lib/admin-db.mjs';
import {
  PERIODE_TIRAGES,
  choisirLot,
  dateDansPeriode,
  dateParis,
  dateValide,
  estLotMasterclass,
  estLotPremium,
  nomPublic,
  planningTirages,
  resoudreTicketGagnant,
  ticketsEligibles,
} from '../_lib/admin-tirage.mjs';

function lotPublic(l) {
  return l
    ? { id: l.id, ordre: l.ordre, nom: l.nom, description: l.description || '', image_url: l.image_url || null, masterclass: estLotMasterclass(l), premium: estLotPremium(l) }
    : null;
}

export default async function handler(req, res) {
  if (!accepter(req, res, ['GET', 'POST'])) return;
  const session = exigerSession(req, res);
  if (!session) return;
  try {
    const [tickets, tirages, lots] = await Promise.all([lireTickets(), lireTirages(), lireLots()]);
    const eligibles = ticketsEligibles(tickets, tirages);
    const aujourdhui = dateParis();

    if (req.method === 'GET') {
      const attribues = new Set(tirages.map((t) => String(t.lot_id)));
      const participants = await lireParticipants();
      const parId = new Map(participants.map((p) => [String(p.id), p]));
      const candidats = eligibles
        .map((t) => {
          const p = parId.get(String(t.participant_id));
          const prenom = p?.prenom || '';
          const nom = p?.nom || '';
          const initiale = String(nom).trim().charAt(0).toUpperCase();
          const label = `${prenom} ${nom}`.trim() || nomPublic(prenom, nom);
          return {
            numero: Number(t.numero),
            participant_id: t.participant_id,
            prenom,
            nom,
            initiale,
            label,
            motif: t.motif || '',
          };
        })
        .sort((a, b) => a.numero - b.numero);
      return repondre(res, 200, {
        ok: true,
        date: aujourdhui,
        deja_tire: tirages.some((t) => t.date_tirage === aujourdhui),
        dans_periode: dateDansPeriode(aujourdhui),
        periode: PERIODE_TIRAGES,
        numeros: eligibles.map((t) => Number(t.numero)),
        candidats,
        total_tickets: tickets.length,
        lots_restants: lots.filter((l) => l.actif !== false && !attribues.has(String(l.id))).map(lotPublic),
        prochain_lot: lotPublic(choisirLot(lots, tirages, null, aujourdhui).lot || null),
        planning: planningTirages(lots, tirages),
      });
    }

    if (!memeOrigine(req, res)) return;
    const corps = lireCorps(req);
    const date = corps.date ? String(corps.date) : aujourdhui;
    if (!dateValide(date)) return repondre(res, 400, { ok: false, message: 'Date de tirage invalide.' });
    if (!dateDansPeriode(date)) {
      return repondre(res, 403, {
        ok: false,
        message: 'Les tirages réels ont lieu uniquement du lundi 23 au samedi 28 novembre 2026. Utilisez la répétition (démo) en dehors de ces dates.',
      });
    }
    if (tirages.some((t) => t.date_tirage === date)) {
      return repondre(res, 409, { ok: false, message: `Le tirage du ${date} a déjà eu lieu. Consultez l'historique.` });
    }
    const { lot, erreur } = choisirLot(lots, tirages, corps.lot_id || null, date);
    if (erreur) return repondre(res, 409, { ok: false, message: erreur });
    const { ticket, erreur: errGagnant } = resoudreTicketGagnant(eligibles, {
      numero: corps.numero,
      participant_id: corps.participant_id,
    });
    if (errGagnant) return repondre(res, 400, { ok: false, message: errGagnant });

    let enregistre;
    try {
      enregistre = await enregistrerTirage({
        date_tirage: date,
        numero: Number(ticket.numero),
        participant_id: ticket.participant_id,
        lot_id: lot.id,
      });
    } catch (err) {
      if (err.code === '23505') {
        return repondre(res, 409, { ok: false, message: 'Un tirage vient déjà d’être enregistré (date, lot ou gagnant). Rechargez la page.' });
      }
      throw err;
    }
    const participant = await lireParticipant(ticket.participant_id);
    console.info('[admin] tirage', date, 'ticket', ticket.numero, 'lot', lot.id, 'par', session.email, 'parmi', eligibles.length);
    return repondre(res, 201, {
      ok: true,
      tirage: {
        id: enregistre?.id,
        date_tirage: date,
        numero: Number(ticket.numero),
        prenom: participant?.prenom || '',
        initiale: String(participant?.nom || '').trim().charAt(0).toUpperCase(),
        gagnant: nomPublic(participant?.prenom, participant?.nom),
        lot: lotPublic(lot),
        parmi: eligibles.length,
      },
      numeros: eligibles.map((t) => Number(t.numero)),
    });
  } catch (err) {
    return erreurServeur(res, err, 'tirage');
  }
}
