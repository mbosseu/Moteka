// PDF nominatif + QR unique (HMAC) pour chaque ticket concours.
import crypto from 'node:crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';

const ROUGE = rgb(0.82, 0.08, 0.08);

function secretTickets() {
  return String(process.env.MOTEKA_TICKET_SECRET || process.env.MOTEKA_ADMIN_SESSION_SECRET || '').trim();
}

export function ticketsPdfPossibles() {
  return secretTickets().length >= 16;
}

function asciiPdf(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Code court, unique par numero + participant, impossible a forger sans le secret. */
export function codeTicket(numero, participantId) {
  const secret = secretTickets();
  if (!secret) return '';
  return crypto.createHmac('sha256', secret).update(`${Number(numero)}:${participantId}`).digest('hex').slice(0, 20);
}

export function verifierCodeTicket(numero, participantId, code) {
  const attendu = codeTicket(numero, participantId);
  if (!attendu || !code) return false;
  const a = Buffer.from(String(code).toLowerCase());
  const b = Buffer.from(attendu.toLowerCase());
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function urlTicketQr(baseUrl, numero, code) {
  const base = String(baseUrl || '').replace(/\/$/, '');
  return `${base}/ticket?n=${encodeURIComponent(numero)}&c=${encodeURIComponent(code)}`;
}

async function pageTicket(pdf, font, gras, { prenom, nom, numero, motif, urlQr }) {
  const page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: rgb(0.04, 0.04, 0.05) });
  page.drawRectangle({ x: 0, y: height - 96, width, height: 6, color: ROUGE });
  page.drawText('FIGHT & Furious', { x: 48, y: height - 48, size: 22, font: gras, color: rgb(1, 1, 1) });
  page.drawText('Boxing Center x Moteka', { x: 48, y: height - 72, size: 12, font, color: rgb(0.85, 0.85, 0.85) });

  page.drawText('TICKET DE TIRAGE', { x: 48, y: height - 140, size: 14, font: gras, color: ROUGE });
  page.drawText(`n. ${numero}`, { x: 48, y: height - 200, size: 42, font: gras, color: rgb(0.1, 0.1, 0.1) });

  const titulaire = asciiPdf(`${prenom} ${nom}`);
  page.drawText(titulaire || 'Participant', { x: 48, y: height - 248, size: 16, font, color: rgb(0.15, 0.15, 0.15) });
  if (motif) {
    page.drawText(asciiPdf(`Obtenu : ${motif}`), { x: 48, y: height - 272, size: 11, font, color: rgb(0.4, 0.4, 0.4) });
  }

  const png = await QRCode.toBuffer(urlQr, { type: 'png', margin: 1, width: 320, errorCorrectionLevel: 'M' });
  const img = await pdf.embedPng(png);
  const taille = 220;
  page.drawImage(img, { x: (width - taille) / 2, y: 280, width: taille, height: taille });

  page.drawText('QR unique : un numero copie sans ce PDF ne suffit pas.', {
    x: 48,
    y: 230,
    size: 11,
    font,
    color: rgb(0.25, 0.25, 0.25),
  });
  page.drawText('Presente ce document si on te le demande le soir du tirage.', {
    x: 48,
    y: 212,
    size: 11,
    font,
    color: rgb(0.25, 0.25, 0.25),
  });
  page.drawText('Garage Moteka, Fenouillet  ·  23-27 novembre 2026', {
    x: 48,
    y: 48,
    size: 10,
    font,
    color: rgb(0.45, 0.45, 0.45),
  });
}

/**
 * PDF A4, une page par ticket. Renvoie { name, content } pret pour Brevo, ou null.
 */
export async function pieceJointeTicketsPdf({ prenom, nom, participantId, tickets = [], baseUrl }) {
  if (!ticketsPdfPossibles() || !tickets.length) return null;
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const gras = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (const t of tickets) {
    const numero = Number(t.numero);
    const pid = t.participant_id || participantId;
    const code = codeTicket(numero, pid);
    if (!code) return null;
    await pageTicket(pdf, font, gras, {
      prenom,
      nom,
      numero,
      motif: t.motif || '',
      urlQr: urlTicketQr(baseUrl, numero, code),
    });
  }
  const bytes = await pdf.save();
  return {
    name: tickets.length > 1 ? 'tickets-fight-furious.pdf' : `ticket-${tickets[0].numero}-fight-furious.pdf`,
    content: Buffer.from(bytes).toString('base64'),
  };
}
