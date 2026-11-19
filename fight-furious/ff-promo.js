/**
 * Bandeau FIGHT & Furious pour les sites Boxing Center.
 * Codes src (courts, dans ?src=) :
 *   cbx combat-boxe.com
 *   mdb materiel-de-boxe.fr
 *   btq boutique.boxingcenter.fr
 *   gal gala.boxingcenter.fr
 *   stg stage-boxeur (Les Vacances des Boxeurs)
 *   trp Boxing Trophy
 *   tmb toulouse-minimes-boxing-club.fr
 *   bcc boxingcenter.fr
 *   ff  fight-and-furious.boxingcenter.fr (direct)
 *
 * Usage : <script src="https://fight-and-furious.boxingcenter.fr/ff-promo.js" data-src="cbx" defer></script>
 * Option : data-focus="concours" pour ancrer le jeu concours.
 */
(function () {
  'use strict';
  var EVENT = 'https://fight-and-furious.boxingcenter.fr';
  var BILLETS = 'https://boutique.boxingcenter.fr/billetterie';
  var CLE = 'ff-promo-off-v2';

  if (typeof location === 'undefined') return;
  if (/(^|\.)fight-and-furious\.boxingcenter\.fr$/i.test(location.hostname)) return;
  if (document.getElementById('ff-promo')) return;
  if (/^\/(admin|billet|checkout|inscription|paiement|contrat|success)(\/|$)/i.test(location.pathname)) return;

  try {
    if (sessionStorage.getItem(CLE) === '1') return;
  } catch (e) {
    /* ignore */
  }

  var el = document.currentScript;
  var src = '';
  var focus = '';
  if (el) {
    src = String(el.getAttribute('data-src') || '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 12);
    focus = String(el.getAttribute('data-focus') || '').toLowerCase();
  }
  if (!src) src = 'web';

  var eventUrl = EVENT + '/?src=' + encodeURIComponent(src);
  if (focus === 'concours') eventUrl += '#concours';
  var billetsUrl = BILLETS + '?src=' + encodeURIComponent(src);

  function css() {
    if (document.getElementById('ff-promo-css')) return;
    var s = document.createElement('style');
    s.id = 'ff-promo-css';
    s.textContent =
      '#ff-promo-veil{position:fixed;inset:0;z-index:2147482999;background:rgba(0,0,0,.55)}' +
      '#ff-promo{position:fixed;z-index:2147483000;left:0;right:0;bottom:0;width:100%;max-width:none;margin:0;background:#0a0a0a;color:#fff;border:0;border-top:6px solid #e11d2e;border-radius:16px 16px 0 0;padding:20px 16px 18px;padding-bottom:max(18px,env(safe-area-inset-bottom));font-family:system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 -16px 48px rgba(0,0,0,.55)}' +
      '#ff-promo[hidden],#ff-promo-veil[hidden]{display:none}' +
      '#ff-promo .ff-promo__kicker{margin:0 0 6px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#e11d2e;font-weight:700}' +
      '#ff-promo .ff-promo__title{margin:0 0 8px;font-size:clamp(26px,7vw,36px);line-height:1.05;font-weight:800;letter-spacing:.02em}' +
      '#ff-promo .ff-promo__txt{margin:0 0 16px;font-size:16px;line-height:1.4;color:#f4f4f5;max-width:36em}' +
      '#ff-promo .ff-promo__row{display:flex;flex-wrap:wrap;gap:10px}' +
      '#ff-promo a.ff-promo__btn{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:0 18px;border-radius:10px;font-size:16px;font-weight:700;text-decoration:none;flex:1 1 160px;box-sizing:border-box}' +
      '#ff-promo a.ff-promo__btn--on{background:#e11d2e;color:#fff}' +
      '#ff-promo a.ff-promo__btn--ghost{background:#fff;color:#111}' +
      '#ff-promo .ff-promo__close{position:absolute;top:8px;right:8px;width:48px;height:48px;border:0;background:#1f1f1f;color:#fff;font-size:26px;line-height:1;cursor:pointer;border-radius:10px}' +
      '@media (min-width:760px){#ff-promo{left:50%;right:auto;bottom:24px;transform:translateX(-50%);width:min(560px,calc(100% - 32px));border:2px solid #e11d2e;border-radius:16px;padding:28px 24px 22px}}' +
      '@media (prefers-reduced-motion:reduce){#ff-promo,#ff-promo-veil{transition:none}}';
    document.head.appendChild(s);
  }

  function fermer() {
    var box = document.getElementById('ff-promo');
    var veil = document.getElementById('ff-promo-veil');
    if (box) box.remove();
    if (veil) veil.remove();
    try {
      sessionStorage.setItem(CLE, '1');
    } catch (e) {
      /* ignore */
    }
  }

  function injecter() {
    if (document.getElementById('ff-promo')) return;
    css();
    var veil = document.createElement('div');
    veil.id = 'ff-promo-veil';
    veil.setAttribute('aria-hidden', 'true');
    var box = document.createElement('aside');
    box.id = 'ff-promo';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'FIGHT and Furious');
    box.innerHTML =
      '<button type="button" class="ff-promo__close" aria-label="Fermer">x</button>' +
      '<p class="ff-promo__kicker">11 au 13 decembre 2026</p>' +
      '<p class="ff-promo__title">FIGHT &amp; Furious</p>' +
      '<p class="ff-promo__txt">Gala Boxing Center x Moteka. Billets en ligne et jeu concours avec tirages. Cliquez pour ouvrir l\'evenement.</p>' +
      '<div class="ff-promo__row">' +
      '<a class="ff-promo__btn ff-promo__btn--on" href="' +
      eventUrl.replace(/"/g, '') +
      '">Voir l\'evenement</a>' +
      '<a class="ff-promo__btn ff-promo__btn--ghost" href="' +
      billetsUrl.replace(/"/g, '') +
      '">Acheter un billet</a>' +
      '</div>';
    document.body.appendChild(veil);
    document.body.appendChild(box);
    box.querySelector('.ff-promo__close').addEventListener('click', fermer);
    veil.addEventListener('click', fermer);
  }

  var delay = 400;
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) delay = 0;
  } catch (e) {
    delay = 400;
  }

  function go() {
    setTimeout(injecter, delay);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
  else go();
})();
