/* Audit de mise en page (outil de développement, non chargé par le site).
   À coller dans la console : vérifie le débordement horizontal et le texte masqué par la barre du bas
   aux positions de lecture de chaque section. Renvoie une liste de problèmes (vide = tout est bon). */
(async () => {
  const pause = ms => new Promise(r => setTimeout(r, ms));
  const opa = el => { let o = 1; for (let e = el; e; e = e.parentElement) o *= +getComputedStyle(e).opacity; return o; };
  const SEL = "h1,h2,h3,p,li,dt,dd,a.bouton,.mot,.chrono > div,.carte,.fleche,blockquote,.ecoute-bouton";
  const pbs = new Set();
  const barre = document.querySelector(".barre");
  async function verifier(lieu) {
    barre.classList.remove("est-cachee"); await pause(450); barre.classList.remove("est-cachee");
    const br = barre.getBoundingClientRect();
    document.querySelectorAll(SEL).forEach(el => {
      if (el.closest(".barre,.allumage,.lecteur,.tiroir,.carrousel-piste")) return;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || opa(el) < .1) return;
      const nom = (String(el.className) || el.tagName) + " « " + (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 28) + " »";
      if (r.left < br.right && r.right > br.left && r.top < br.bottom && r.bottom > br.top) pbs.add(lieu + " · sous la barre : " + nom);
      if (r.top < innerHeight && r.bottom > 0 && (r.right > innerWidth + 1 || r.left < -1)) pbs.add(lieu + " · déborde de l'écran : " + nom);
    });
  }
  if (document.documentElement.scrollWidth > innerWidth + 1) pbs.add("défilement horizontal de la page (" + document.documentElement.scrollWidth + "px)");
  scrollTo(0, 0); await pause(500); await verifier("en-tête");
  for (const s of [".mots", ".disc-defile"]) {
    const z = document.querySelector(s), t = z.getBoundingClientRect().top + scrollY;
    if (z.offsetHeight <= innerHeight * 1.2) continue;
    for (const f of [.2, .6, .9]) { scrollTo(0, t + (z.offsetHeight - innerHeight) * f); await pause(400); await verifier(s); }
  }
  const st = ScrollTrigger.getAll().find(t => t.pin && t.trigger.classList.contains("carrousel"));
  if (st) for (const f of [0, .5, 1]) { scrollTo(0, st.start + (st.end - st.start) * f); await pause(500); await verifier("programme"); }
  for (const p of document.querySelectorAll(".panneau")) { scrollTo(0, p.getBoundingClientRect().top + scrollY - innerHeight * .09); await pause(450); await verifier("panneau"); }
  for (const s of [".ecoute", ".compte-cadre", ".pack.est-actif", ".fiche-grille", ".final", ".pied"]) {
    const z = document.querySelector(s); if (!z) continue;
    scrollTo(0, z.getBoundingClientRect().top + scrollY - Math.max(0, (innerHeight - z.offsetHeight) / 2)); await pause(500); await verifier(s);
  }
  window.__audit = [...pbs];
  return window.__audit;
})();
