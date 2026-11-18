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

function echapper(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Version HTML minimale du texte (meme contenu, sans image ni mise en forme) :
 * les liens deviennent cliquables dans tous les clients mail.
 */
export function texteVersHtml(texte) {
  const morceaux = String(texte || '').split(/(https?:\/\/[^\s<>"]+)/g);
  const html = morceaux
    .map((m, i) => {
      if (i % 2 === 0) return echapper(m);
      const fin = (m.match(/[.,;:!?)]+$/) || [''])[0];
      const url = fin ? m.slice(0, -fin.length) : m;
      return `<a href="${echapper(url)}">${echapper(url)}</a>${echapper(fin)}`;
    })
    .join('')
    .replace(/\r?\n/g, '<br>\n');
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5">${html}</div>`;
}

/**
 * Envoie un mail texte (avec sa version HTML minimale pour les liens cliquables). attachments (facultatif) : [{ name: 'avis-google.jpg', content: '<base64>' }],
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
    htmlContent: texteVersHtml(text),
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
