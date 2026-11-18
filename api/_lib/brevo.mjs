// Envoi de mails via l'API Brevo, en texte brut uniquement (boite Principale Gmail, pas Promotions).

const API = 'https://api.brevo.com/v3/smtp/email';
const EXPEDITEUR_DEFAUT = 'suzinabot@gmail.com';
const NOM_DEFAUT = 'David';
const REPONSE_DEFAUT = 'boxingcenter31@gmail.com';

function cle() {
  return String(process.env.BREVO_API_KEY || '')
    .trim()
    .replace(/^["']|["']$/g, '');
}

export function brevoConfigure() {
  return cle().startsWith('xkeysib-');
}

/**
 * Envoie un mail texte. attachments (facultatif) : [{ name: 'avis-google.jpg', content: '<base64>' }],
 * extensions acceptees par Brevo (jpg, png...).
 */
export async function envoyerMail({ to, subject, text, fromName, replyTo, attachments }) {
  if (!to) throw new Error('Destinataire manquant');
  if (!brevoConfigure()) throw new Error('BREVO_API_KEY manquant');
  const nom = fromName || process.env.BREVO_SENDER_NAME || NOM_DEFAUT;
  const corps = {
    sender: { name: nom, email: process.env.BREVO_SENDER_EMAIL || EXPEDITEUR_DEFAUT },
    to: [{ email: to }],
    replyTo: { email: replyTo || process.env.BREVO_REPLY_TO || REPONSE_DEFAUT, name: nom },
    subject: subject || 'Message Boxing Center',
    textContent: text,
  };
  const pieces = (Array.isArray(attachments) ? attachments : []).filter((a) => a && a.name && a.content);
  if (pieces.length) corps.attachment = pieces.map((a) => ({ name: String(a.name), content: String(a.content) }));
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'api-key': cle(), 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(corps),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Brevo HTTP ${res.status}`);
  return { envoye: true, messageId: data.messageId };
}
