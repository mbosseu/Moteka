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
  var CLE = 'ff-promo-off';

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
      '#ff-promo{position:fixed;z-index:2147483000;left:12px;right:12px;bottom:12px;max-width:440px;margin:0 auto;background:#111;color:#f4f4f5;border:1px solid #333;border-radius:12px;padding:14px 14px 12px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.4)}' +
      '#ff-promo[hidden]{display:none}' +
      '#ff-promo .ff-promo__kicker{margin:0 0 4px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#c4c4c4}' +
      '#ff-promo .ff-promo__title{margin:0 0 6px;font-size:18px;line-height:1.2;font-weight:700}' +
      '#ff-promo .ff-promo__txt{margin:0 0 12px;font-size:14px;line-height:1.4;color:#d4d4d8}' +
      '#ff-promo .ff-promo__row{display:flex;flex-wrap:wrap;gap:8px}' +
      '#ff-promo a.ff-promo__btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 14px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;flex:1 1 140px;box-sizing:border-box}' +
      '#ff-promo a.ff-promo__btn--on{background:#e11d2e;color:#fff}' +
      '#ff-promo a.ff-promo__btn--ghost{background:transparent;color:#f4f4f5;border:1px solid #52525b}' +
      '#ff-promo .ff-promo__close{position:absolute;top:6px;right:6px;width:44px;height:44px;border:0;background:transparent;color:#a1a1aa;font-size:22px;line-height:1;cursor:pointer}' +
      '@media (min-width:900px){#ff-promo{left:auto;right:20px;bottom:20px;margin:0;width:400px}}' +
      '@media (prefers-reduced-motion:reduce){#ff-promo{transition:none}}';
    document.head.appendChild(s);
  }

  function fermer() {
    var box = document.getElementById('ff-promo');
    if (box) box.remove();
    try {
      sessionStorage.setItem(CLE, '1');
    } catch (e) {
      /* ignore */
    }
  }

  function injecter() {
    if (document.getElementById('ff-promo')) return;
    css();
    var box = document.createElement('aside');
    box.id = 'ff-promo';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'FIGHT and Furious');
    box.innerHTML =
      '<button type="button" class="ff-promo__close" aria-label="Fermer">x</button>' +
      '<p class="ff-promo__kicker">Boxing Center x Moteka</p>' +
      '<p class="ff-promo__title">FIGHT &amp; Furious</p>' +
      '<p class="ff-promo__txt">Gala de boxe du 11 au 13 decembre 2026. Billets en ligne et jeu concours avec tirages.</p>' +
      '<div class="ff-promo__row">' +
      '<a class="ff-promo__btn ff-promo__btn--on" href="' +
      eventUrl.replace(/"/g, '') +
      '">L\'evenement</a>' +
      '<a class="ff-promo__btn ff-promo__btn--ghost" href="' +
      billetsUrl.replace(/"/g, '') +
      '">Billetterie</a>' +
      '</div>';
    document.body.appendChild(box);
    box.querySelector('.ff-promo__close').addEventListener('click', fermer);
  }

  var delay = 1600;
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) delay = 0;
  } catch (e) {
    delay = 1600;
  }

  function go() {
    setTimeout(injecter, delay);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
  else go();
})();
