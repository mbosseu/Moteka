/**
 * Section + bandeau persistants FIGHT & Furious.
 * Pas de fermeture : le bloc reste dans la page et le bandeau reste en bas.
 * Si une section .ff-section est deja dans le HTML, le script n'en ajoute pas une deuxieme.
 *
 * Codes src : cbx, mdb, btq, gal, stg, trp, tmb, bcc, ff
 */
(function () {
  'use strict';
  var EVENT = 'https://fight-and-furious.boxingcenter.fr';
  var BILLETS = 'https://boutique.boxingcenter.fr/billetterie';

  if (typeof location === 'undefined') return;
  if (/(^|\.)fight-and-furious\.boxingcenter\.fr$/i.test(location.hostname)) return;
  if (/^\/(admin|billet|checkout|inscription|paiement|contrat|success)(\/|$)/i.test(location.pathname)) return;

  var el = document.currentScript;
  var src = 'web';
  var focus = '';
  if (el) {
    src = String(el.getAttribute('data-src') || 'web')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 12) || 'web';
    focus = String(el.getAttribute('data-focus') || '').toLowerCase();
  }

  var eventUrl = EVENT + '/?src=' + encodeURIComponent(src);
  if (focus === 'concours') eventUrl += '#concours';
  var billetsUrl = BILLETS + '?src=' + encodeURIComponent(src);
  var concoursUrl = EVENT + '/?src=' + encodeURIComponent(src) + '#concours';

  function css() {
    if (document.getElementById('ff-promo-css')) return;
    var s = document.createElement('style');
    s.id = 'ff-promo-css';
    s.textContent =
      'body.ff-promo-on{padding-bottom:76px}' +
      '.ff-section{background:#0a0a0a;color:#fff;padding:36px 16px;border-top:6px solid #e11d2e;border-bottom:6px solid #e11d2e}' +
      '.ff-section__in{max-width:1100px;margin:0 auto}' +
      '.ff-section__k{margin:0 0 8px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#e11d2e;font-weight:700}' +
      '.ff-section h2,.ff-section__t{margin:0 0 10px;font-size:clamp(28px,6vw,42px);line-height:1.05;font-weight:800;color:#fff}' +
      '.ff-section p,.ff-section__p{margin:0 0 18px;font-size:16px;line-height:1.45;color:#f4f4f5;max-width:38em}' +
      '.ff-section__row{display:flex;flex-wrap:wrap;gap:10px}' +
      '.ff-section a.ff-btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 18px;border-radius:10px;font-size:16px;font-weight:700;text-decoration:none;box-sizing:border-box}' +
      '.ff-section a.ff-btn--on{background:#e11d2e;color:#fff}' +
      '.ff-section a.ff-btn--ghost{background:#fff;color:#111}' +
      '.ff-section a.ff-btn--line{background:transparent;color:#fff;border:2px solid #fff}' +
      '#ff-promo{position:fixed;z-index:2147483000;left:0;right:0;bottom:0;background:#0a0a0a;color:#fff;border-top:4px solid #e11d2e;padding:10px 12px;padding-bottom:max(10px,env(safe-area-inset-bottom));font-family:system-ui,-apple-system,Segoe UI,sans-serif;display:flex;flex-wrap:wrap;align-items:center;gap:10px;justify-content:space-between}' +
      '#ff-promo .ff-promo__copy{margin:0;font-size:14px;font-weight:700;line-height:1.3}' +
      '#ff-promo .ff-promo__copy span{display:block;font-size:12px;font-weight:500;color:#d4d4d8}' +
      '#ff-promo .ff-promo__row{display:flex;flex-wrap:wrap;gap:8px}' +
      '#ff-promo a.ff-promo__btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 14px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none}' +
      '#ff-promo a.ff-promo__btn--on{background:#e11d2e;color:#fff}' +
      '#ff-promo a.ff-promo__btn--ghost{background:#fff;color:#111}' +
      '@media (min-width:760px){.ff-section{padding:48px 24px}#ff-promo{padding:12px 24px}}' +
      '@media print{.ff-section,#ff-promo{display:none!important}body.ff-promo-on{padding-bottom:0}}';
    document.head.appendChild(s);
  }

  function sectionHtml() {
    return (
      '<div class="ff-section__in">' +
      '<p class="ff-section__k">11 au 13 decembre 2026</p>' +
      '<h2 class="ff-section__t">FIGHT &amp; Furious</h2>' +
      '<p class="ff-section__p">Gala de boxe Boxing Center x Moteka. Billets en ligne et jeu concours avec tirages jusqu\'au 28 novembre.</p>' +
      '<div class="ff-section__row">' +
      '<a class="ff-btn ff-btn--on" href="' + eventUrl.replace(/"/g, '') + '">Voir l\'evenement</a>' +
      '<a class="ff-btn ff-btn--ghost" href="' + billetsUrl.replace(/"/g, '') + '">Acheter un billet</a>' +
      '<a class="ff-btn ff-btn--line" href="' + concoursUrl.replace(/"/g, '') + '">Jeu concours</a>' +
      '</div></div>'
    );
  }

  function injecterSection() {
    if (document.querySelector('.ff-section')) return;
    var sec = document.createElement('section');
    sec.className = 'ff-section';
    sec.id = 'fight-and-furious';
    sec.setAttribute('aria-label', 'FIGHT and Furious');
    sec.innerHTML = sectionHtml();
    var foot = document.querySelector('footer');
    if (foot && foot.parentNode) foot.parentNode.insertBefore(sec, foot);
    else document.body.appendChild(sec);
  }

  function injecterBandeau() {
    if (document.getElementById('ff-promo')) return;
    var bar = document.createElement('div');
    bar.id = 'ff-promo';
    bar.setAttribute('role', 'complementary');
    bar.setAttribute('aria-label', 'FIGHT and Furious');
    bar.innerHTML =
      '<p class="ff-promo__copy">FIGHT &amp; Furious<span>Gala 11-13 dec. 2026 · billets et concours</span></p>' +
      '<div class="ff-promo__row">' +
      '<a class="ff-promo__btn ff-promo__btn--on" href="' + eventUrl.replace(/"/g, '') + '">Evenement</a>' +
      '<a class="ff-promo__btn ff-promo__btn--ghost" href="' + billetsUrl.replace(/"/g, '') + '">Billets</a>' +
      '</div>';
    document.body.appendChild(bar);
    document.body.classList.add('ff-promo-on');
  }

  function go() {
    css();
    injecterSection();
    injecterBandeau();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
  else go();
})();
