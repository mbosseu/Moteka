/* FIGHT & Furious · Boxing Center × Moteka · animations */
(() => {
  gsap.registerPlugin(ScrollTrigger);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const html = document.documentElement;
  const mobile = matchMedia("(max-width: 860px)");
  const reduit = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const EO = "expo.out";
  const regime = Son.etat; // { rpm, charge, volume } partagé avec le moteur sonore

  /* ================= Compte-tours ================= */
  const CT = { cx: 220, cy: 220, r: 174, max: 10000, rouge: 8000 };
  const angle = rpm => (-135 + rpm / CT.max * 270) * Math.PI / 180;
  const point = (rpm, r) => [CT.cx + r * Math.sin(angle(rpm)), CT.cy - r * Math.cos(angle(rpm))];
  const arc = (a, b, r) => {
    const [x1, y1] = point(a, r), [x2, y2] = point(b, r);
    const grand = (b - a) / CT.max * 270 > 180 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${grand} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };
  (() => {
    const svg = $(".compte-tours-svg"), ns = "http://www.w3.org/2000/svg";
    $(".ct-piste", svg).setAttribute("d", arc(0, CT.max, CT.r));
    $(".ct-aiguille", svg).setAttribute("d", arc(0, CT.max, CT.r));
    $(".ct-rouge", svg).setAttribute("d", arc(CT.rouge, CT.max, CT.r));
    for (let rpm = 0; rpm <= CT.max; rpm += 500) {
      const maj = rpm % 1000 === 0;
      const [x1, y1] = point(rpm, maj ? 146 : 154), [x2, y2] = point(rpm, 162);
      const l = document.createElementNS(ns, "line");
      Object.entries({ x1, y1, x2, y2 }).forEach(([k, v]) => l.setAttribute(k, v));
      if (maj) l.classList.add("majeure");
      if (rpm >= CT.rouge) l.classList.add("rouge");
      $(".ct-graduations", svg).append(l);
      if (maj) {
        const [tx, ty] = point(rpm, 196);
        const t = document.createElementNS(ns, "text");
        t.setAttribute("x", tx); t.setAttribute("y", ty); t.textContent = rpm / 1000;
        if (rpm >= CT.rouge) t.classList.add("rouge");
        $(".ct-chiffres", svg).append(t);
      }
    }
  })();
  const aiguille = $(".ct-aiguille"), lecture = $(".ct-regime");
  const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const longueurArc = 2 * Math.PI * CT.r * .75;
  aiguille.style.strokeDasharray = longueurArc;
  function afficherRegime() {
    aiguille.style.strokeDashoffset = longueurArc * (1 - clamp(regime.rpm / CT.max));
    aiguille.classList.toggle("en-rouge", regime.rpm >= CT.rouge);
    lecture.textContent = fmt(Math.round(regime.rpm / 50) * 50);
  }
  afficherRegime();

  /* ================= Fond de l'allumage : ondes qui pulsent au régime ================= */
  const fond = (() => {
    const c = $(".allumage-fond"), g = c.getContext("2d");
    let w, h, actif = true, dernier = performance.now(), cumul = 0, n = 0;
    const ondes = [];
    const taille = () => { w = c.width = Math.round(innerWidth / 2); h = c.height = Math.round(innerHeight / 2); };
    taille(); addEventListener("resize", taille);
    function image(t) {
      if (!actif) return;
      const dt = Math.min(.05, (t - dernier) / 1000); dernier = t;
      const e = clamp(regime.rpm / 3000);
      const cx = w / 2, cy = h / 2, rmax = Math.hypot(w, h) * .62;
      cumul += dt;
      if (cumul > (regime.rpm < 300 ? 2.4 : lerp(.9, .25, e))) { cumul = 0; ondes.push({ r: Math.min(w, h) * .12, rouge: n++ % 3 !== 2 }); }
      g.globalCompositeOperation = "source-over"; g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = "lighter";
      const amb = .5 + e * .5;
      let rg = g.createRadialGradient(w * .85, h * .92, 0, w * .85, h * .92, rmax * .75);
      rg.addColorStop(0, `rgba(209,20,20,${.2 * amb})`); rg.addColorStop(1, "rgba(209,20,20,0)");
      g.fillStyle = rg; g.fillRect(0, 0, w, h);
      rg = g.createRadialGradient(w * .12, h * .15, 0, w * .12, h * .15, rmax * .7);
      rg.addColorStop(0, `rgba(43,91,215,${.08 * amb})`); rg.addColorStop(1, "rgba(43,91,215,0)");
      g.fillStyle = rg; g.fillRect(0, 0, w, h);
      const vitesse = lerp(38, 160, e) * (h / 450);
      for (let i = ondes.length - 1; i >= 0; i--) {
        const o = ondes[i]; o.r += vitesse * dt;
        const vie = 1 - o.r / rmax;
        if (vie <= 0) { ondes.splice(i, 1); continue; }
        const bande = 16 * (h / 450) + o.r * .07, a = vie * vie * (.15 + e * .22);
        const col = o.rouge ? "209,20,20" : "120,150,230";
        const gr = g.createRadialGradient(cx, cy, Math.max(0, o.r - bande), cx, cy, o.r + bande);
        gr.addColorStop(0, `rgba(${col},0)`); gr.addColorStop(.5, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      }
      requestAnimationFrame(image);
    }
    requestAnimationFrame(image);
    return { arreter() { actif = false; } };
  })();

  /* ================= Intro ================= */
  const allumage = $("#allumage"), bouton = $(".demarrer");
  const herosVideo = $(".heros-video"), herosCadre = $(".heros-cadre");
  const motY = 0;
  gsap.set(".entre", { opacity: 0, filter: "blur(14px)", yPercent: 18 });
  gsap.set(".heros-titre .ligne", { yPercent: 120, opacity: 0, filter: "blur(14px)" });
  gsap.set([".heros-logos", ".heros-texte", ".heros-film", ".heros-chiffres > div", ".perimetre", ".heros-defiler"], { opacity: 0 });
  gsap.set(herosCadre, { scale: .6, opacity: 0 });
  const entree = gsap.timeline({ defaults: { duration: 1.2, ease: EO } })
    .to(".allumage-logos", { opacity: 1, filter: "blur(0px)", yPercent: 0 }, .1)
    .to(".allumage-gauche", { opacity: 1, filter: "blur(0px)", yPercent: motY }, .25)
    .to(".allumage-droite", { opacity: 1, filter: "blur(0px)", yPercent: motY }, .4)
    .to(".compte-tours", { opacity: 1, filter: "blur(0px)", yPercent: 0 }, .55)
    .to(".allumage-mention", { opacity: 1, filter: "blur(0px)", yPercent: 0 }, .7);

  const derriere = [$("main"), $(".pied"), $(".nav"), $(".barre")];
  derriere.forEach(el => { el.inert = true; });
  let demarre = false, lance = false;
  bouton.addEventListener("click", demarrer);
  // Sur l'écran d'allumage, défiler équivaut à cliquer sur FIGHT : molette, glissé au doigt, touches de défilement
  (() => {
    let toucheY = null;
    const declencher = () => { if (!demarre) demarrer(); };
    allumage.addEventListener("wheel", e => { if (Math.abs(e.deltaY) > 2) declencher(); }, { passive: true });
    allumage.addEventListener("touchstart", e => { toucheY = e.touches[0].clientY; }, { passive: true });
    allumage.addEventListener("touchmove", e => { if (toucheY !== null && Math.abs(e.touches[0].clientY - toucheY) > 24) declencher(); }, { passive: true });
    addEventListener("keydown", e => { if (!demarre && ["ArrowDown", "PageDown", " ", "End"].includes(e.key) && e.target !== bouton) { e.preventDefault(); declencher(); } });
    // La molette ne compte pas comme un geste pour le navigateur : le son reste bloqué jusqu'au premier clic ou toucher
    const reveillerSon = () => { if (Son.pret && !Son.coupe) Son.init(); };
    ["pointerdown", "keydown", "touchend"].forEach(ev => addEventListener(ev, reveillerSon, { passive: true }));
  })();
  bouton.focus({ preventScroll: true });

  function demarrer() {
    if (demarre) return;
    demarre = true;
    entree.progress(1);
    bouton.classList.add("est-presse");
    setTimeout(() => bouton.classList.remove("est-presse"), 180);
    Son.init();
    regime.volume = 1;
    // démarreur, explosion, coup d'accélérateur « FIGHT », retour au ralenti
    gsap.timeline({ onUpdate: afficherRegime })
      .to(regime, { rpm: 220, duration: .12, ease: "none" }, .05)
      .to(regime, { rpm: 150, duration: .09, ease: "sine.inOut", repeat: 5, yoyo: true }, .17)
      .to(regime, { rpm: 2800, duration: .28, ease: "power3.out" }, .7)
      .to(regime, { rpm: 1100, duration: .6, ease: "power2.inOut" }, .98)
      .to(regime, { rpm: 8600, charge: 1, duration: .55, ease: "power2.in" }, 1.7)
      .to(regime, { rpm: 1000, charge: 0, duration: 1.1, ease: "power2.out" }, 2.3);
    const sortie = { opacity: 0, filter: "blur(10px)", duration: .5, ease: EO };
    gsap.timeline()
      .to(".allumage-logos", { ...sortie, yPercent: -12 }, 2.2)
      .to(".allumage-gauche", { ...sortie, xPercent: -30 }, 2.3)
      .to(".allumage-droite", { ...sortie, xPercent: 30 }, 2.3)
      .to(".allumage-mention", { ...sortie, yPercent: -12 }, 2.4)
      .to(".compte-tours", { ...sortie, scale: 1.15 }, 2.5);
    setTimeout(() => Son.cloche(3), 2350);
    setTimeout(lancer, 2900);
  }

  function lancer() {
    gsap.to(allumage, { opacity: 0, duration: .6, ease: EO, onComplete: () => { allumage.remove(); fond.arreter(); } });
    if (herosVideo.play) herosVideo.play().catch(() => {});
    gsap.to(regime, { volume: .45, duration: 2 });
    gsap.timeline({ defaults: { ease: EO } })
      .to(herosCadre, { opacity: 1, duration: .5 }, 0)
      .to(herosCadre, { scale: 1, duration: 1.3 }, .2)
      .to(".heros-titre .ligne", { yPercent: 0, opacity: 1, filter: "blur(0px)", duration: 1.2, stagger: .14 }, .7)
      .fromTo(".heros-logos", { y: -10 }, { y: 0, opacity: 1, duration: .6 }, .8)
      .add(deverrouiller, .9)
      .fromTo(".heros-texte", { filter: "blur(10px)" }, { opacity: 1, filter: "blur(0px)", duration: .6 }, 1)
      .to(".heros-film", { opacity: 1, duration: .8 }, 1.1)
      .fromTo(".heros-chiffres > div", { x: 20 }, { x: 0, opacity: 1, duration: .8, stagger: .08 }, 1.1)
      .fromTo(".perimetre", { y: -12 }, { y: 0, opacity: 1, duration: .8 }, 1.2)
      .to(".heros-defiler", { opacity: 1, duration: .8 }, 1.3)
      .add(() => { lance = true; $(".nav").classList.add("est-visible"); $(".barre").classList.add("est-visible"); }, 1.2);
  }

  function deverrouiller() {
    html.classList.remove("verrou");
    derriere.forEach(el => { el.inert = false; });
    $(".heros-titre").focus({ preventScroll: true });
    ScrollTrigger.refresh();
  }

  /* ================= Moteur de fond : le défilement fait monter le régime ================= */
  let moteurCoupe = false; // passe à true en arrivant sur la section « mots »
  let ecoute = false, dernierY = scrollY, dernierT = performance.now();
  (function accelerer(t) {
    const dt = Math.max(1, t - dernierT);
    const v = Math.abs(scrollY - dernierY) / dt * 1000; // px/s
    dernierY = scrollY; dernierT = t;
    if (lance && !ecoute && !moteurCoupe) {
      const cible = 950 + Math.min(6200, v * 2.2);
      regime.rpm += (cible - regime.rpm) * (cible > regime.rpm ? .08 : .03);
      regime.charge += ((v > 400 ? .5 : 0) - regime.charge) * .05;
    }
    requestAnimationFrame(accelerer);
  })(performance.now());

  /* ================= Héros au défilement ================= */
  gsap.timeline({ scrollTrigger: { trigger: ".heros", start: "top top", end: "bottom top", scrub: true } })
    .to(".heros-video", { yPercent: 8, ease: "none" }, 0)
    .to(herosCadre, { scale: .92, opacity: .3, ease: "none" }, 0)
    .to(".heros-contenu", { y: -80, ease: "none" }, 0);

  /* ================= Titres balayés, apparitions ================= */
  $$(".balaye").forEach(el => {
    const haut = document.createElement("span");
    haut.className = "balaye-haut"; haut.setAttribute("aria-hidden", "true"); haut.innerHTML = el.innerHTML;
    el.append(haut);
    gsap.to(haut, { clipPath: "inset(0 0% 0 0)", duration: 1.2, ease: EO, scrollTrigger: { trigger: el, start: "top 82%", once: true } });
  });
  $$(".apparait").forEach(el => {
    gsap.fromTo(el, { opacity: 0, y: 30, filter: "blur(12px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 1, ease: EO, scrollTrigger: { trigger: el, start: "top 85%", once: true } });
  });

  /* ================= Le moteur se tait en arrivant sur les mots, repart si on remonte à l'en-tête ================= */
  ScrollTrigger.create({
    trigger: ".mots", start: "top 60%", end: "max", // actif jusqu'en bas : on ne peut pas « sauter » le déclencheur
    onEnter: () => { moteurCoupe = true; gsap.killTweensOf(regime, "volume,rpm"); gsap.to(regime, { volume: 0, rpm: 0, duration: 1.4, ease: "power2.out", overwrite: "auto" }); },
    onLeaveBack: () => { moteurCoupe = false; gsap.killTweensOf(regime, "volume"); if (demarre) gsap.to(regime, { volume: .45, duration: 1.2, overwrite: "auto" }); },
  });

  /* ================= Mots : machine à écrire puis quatre mots ================= */
  (() => {
    const phrase = "Tout ce qu’il faut pour un week-end de combat…";
    const tape = $(".mots-tape"), mots = $$(".mots-pile .mot"), points = $$(".mots-points i");
    let courant = -1, tapeAvant = 0;
    function montrer(i) {
      if (i === courant) return;
      const ancien = mots[courant]; courant = i;
      gsap.killTweensOf(mots);
      if (ancien) gsap.to(ancien, { opacity: 0, filter: "blur(28px)", scale: 1.08, duration: .4, ease: EO });
      mots.forEach((m, k) => { if (k !== i && m !== ancien) gsap.set(m, { opacity: 0 }); });
      if (mots[i]) {
        gsap.fromTo(mots[i], { opacity: 0, filter: "blur(32px)", scale: .92 }, { opacity: 1, filter: "blur(0px)", scale: 1, duration: .55, ease: EO, delay: ancien ? .25 : 0 });
        Son.clic();
      }
      points.forEach((p, k) => p.classList.toggle("est-actif", k === i));
    }
    ScrollTrigger.create({
      trigger: ".mots", start: "top top", end: "bottom bottom",
      onUpdate(st) {
        const p = st.progress, n = Math.round(clamp(p / .2 * 1.15) * phrase.length);
        if (n !== tapeAvant) { tape.textContent = phrase.slice(0, n); tapeAvant = n; }
        montrer(p < .2 ? -1 : Math.min(3, Math.floor((p - .2) / .8 * 4)));
      },
    });
  })();

  /* ================= Curseur et pastille « Lire » ================= */
  const curseur = $(".curseur"), pastille = $(".pastille");
  const cx = gsap.quickTo(curseur, "x", { duration: .15 }), cy = gsap.quickTo(curseur, "y", { duration: .15 });
  const px = gsap.quickTo(pastille, "x", { duration: .45, ease: "power3" }), py = gsap.quickTo(pastille, "y", { duration: .45, ease: "power3" });
  addEventListener("pointermove", e => { cx(e.clientX); cy(e.clientY); px(e.clientX); py(e.clientY); });
  const carteFilm = $(".film-carte");
  carteFilm.addEventListener("pointerenter", () => { pastille.classList.add("est-visible"); curseur.classList.add("sur-pastille"); });
  carteFilm.addEventListener("pointerleave", () => { pastille.classList.remove("est-visible"); curseur.classList.remove("sur-pastille"); });

  /* ================= Film : aperçu muet, lecteur plein écran ================= */
  const apercus = $$(".film-apercu");
  gsap.fromTo(carteFilm, { clipPath: "inset(18% 22% 18% 22%)" }, { clipPath: "inset(0% 0% 0% 0%)", ease: "none", scrollTrigger: { trigger: ".film", start: "top bottom", end: "center center", scrub: true } });
  gsap.to(apercus, { scale: 1, ease: "none", scrollTrigger: { trigger: ".film", start: "top bottom", end: "bottom top", scrub: true } });
  ScrollTrigger.create({ trigger: ".film", start: "top bottom", end: "bottom top", onToggle: st => apercus.forEach(v => st.isActive ? v.play().catch(() => {}) : v.pause()) });
  const lecteur = $(".lecteur"), lecteurVideo = $(".lecteur-video");
  let volumeAvant = .45;
  function ouvrirFilm(e) {
    // chaque bouton indique sa vidéo (data-film) : le film FIGHT & Furious ou les images du gala
    const src = e && e.currentTarget && e.currentTarget.dataset.film;
    if (src && !lecteurVideo.currentSrc.endsWith(src)) { lecteurVideo.src = src; lecteurVideo.load(); }
    lecteur.hidden = false; volumeAvant = regime.volume;
    gsap.to(regime, { volume: 0, duration: .4 });
    gsap.fromTo(lecteur, { opacity: 0 }, { opacity: 1, duration: .4 });
    lecteurVideo.muted = Son.coupe; lecteurVideo.currentTime = 0; lecteurVideo.play().catch(() => {});
    $(".lecteur-fermer").focus();
  }
  function fermerFilm() {
    lecteurVideo.pause();
    gsap.to(lecteur, { opacity: 0, duration: .3, onComplete: () => { lecteur.hidden = true; } });
    gsap.to(regime, { volume: volumeAvant, duration: .6 });
  }
  $$("[data-film]").forEach(b => b.addEventListener("click", ouvrirFilm));
  $(".lecteur-fermer").addEventListener("click", fermerFilm);
  lecteur.addEventListener("click", e => { if (e.target === lecteur) fermerFilm(); });
  addEventListener("keydown", e => { if (e.key === "Escape" && !lecteur.hidden) fermerFilm(); });

  /* ================= Écoute : maintenir pour faire rugir ================= */
  (() => {
    const b = $(".ecoute-bouton"), onde = $(".ecoute-onde"), g = onde.getContext("2d");
    let volAvant = .45, anime = false;
    function dessiner() {
      const d = Son.niveau();
      g.clearRect(0, 0, onde.width, onde.height);
      const n = 40, larg = onde.width / n;
      for (let i = 0; i < n; i++) {
        const v = d.length ? Math.abs(d[Math.floor(i / n * d.length)] - 128) / 128 : 0;
        const hBar = Math.max(3, (ecoute ? v * 2.4 : .08 + Math.sin(i * .7) * .04) * onde.height);
        g.fillStyle = ecoute ? "#ff2a2a" : "rgba(244,242,239,.45)";
        g.fillRect(i * larg + 1, (onde.height - hBar) / 2, larg - 2, Math.min(onde.height, hBar));
      }
      if (anime) requestAnimationFrame(dessiner);
    }
    ScrollTrigger.create({ trigger: ".ecoute", start: "top bottom", end: "bottom top", onToggle: st => { anime = st.isActive; if (anime) dessiner(); } });
    function debut(e) {
      e.preventDefault();
      if (!Son.pret) Son.init();
      ecoute = true; b.classList.add("est-actif");
      volAvant = regime.volume;
      gsap.killTweensOf(regime);
      gsap.to(regime, { volume: 1, charge: 1, duration: .2 });
      gsap.to(regime, { rpm: 8800, duration: 2.2, ease: "power2.in" });
    }
    function fin() {
      if (!ecoute) return;
      b.classList.remove("est-actif");
      gsap.killTweensOf(regime);
      gsap.to(regime, { rpm: 950, charge: 0, duration: 1.2, ease: "power2.out", onComplete: () => { ecoute = false; } });
      gsap.to(regime, { volume: volAvant, duration: 1.4 });
    }
    b.addEventListener("pointerdown", debut);
    ["pointerup", "pointerleave", "pointercancel"].forEach(ev => b.addEventListener(ev, fin));
    b.addEventListener("keydown", e => { if ((e.key === " " || e.key === "Enter") && !e.repeat) debut(e); });
    b.addEventListener("keyup", e => { if (e.key === " " || e.key === "Enter") fin(); });
    b.addEventListener("contextmenu", e => e.preventDefault());
  })();
  gsap.fromTo(".ecoute-image img", { scale: 1.2 }, { scale: 1, ease: "none", scrollTrigger: { trigger: ".ecoute", start: "top bottom", end: "bottom top", scrub: true } });

  /* ================= Carrousel du programme ================= */
  (() => {
    const piste = $(".carrousel-piste"), cartes = $$(".carte", piste), barre = $(".carrousel-barre i");
    const [prec, suiv] = $$(".fleche");
    let k = 0;
    const visibles = () => Math.max(1, Math.floor(($(".carrousel").clientWidth) / (cartes[0].offsetWidth + 18)));
    const maxK = () => Math.max(0, cartes.length - visibles());
    function aller(n, anime = true) {
      if (html.classList.contains("programme-defile") || html.classList.contains("programme-pile")) return;
      k = clamp(n, 0, maxK());
      const x = -(cartes[k].offsetLeft);
      gsap.to(piste, { x, duration: anime ? .9 : 0, ease: EO });
      barre.style.width = `${100 / (maxK() + 1)}%`;
      barre.style.transform = `translateX(${k * 100}%)`;
      prec.disabled = k === 0; suiv.disabled = k === maxK();
    }
    prec.addEventListener("click", () => { aller(k - 1); Son.clic(); });
    suiv.addEventListener("click", () => { aller(k + 1); Son.clic(); });
    // glisser au doigt / à la souris
    let x0 = null;
    piste.addEventListener("pointerdown", e => { x0 = e.clientX; });
    addEventListener("pointerup", e => { if (x0 === null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 50) aller(k + (dx < 0 ? 1 : -1)); });
    addEventListener("resize", () => aller(k, false));
    aller(0, false);
    if (!mobile.matches) gsap.from(cartes, { x: 120, opacity: 0, duration: 1.1, stagger: .08, ease: EO, scrollTrigger: { trigger: ".carrousel", start: "top 80%", once: true } });
  })();

  /* ================= Programme : les cartes avancent au défilement (ordinateur) ================= */
  gsap.matchMedia().add("(min-width: 861px)", () => {
    const zone = $(".carrousel"), piste = $(".carrousel-piste"), barre = $(".carrousel-barre i");
    html.classList.add("programme-defile");
    gsap.set(piste, { x: 0 });
    barre.style.width = "100%"; barre.style.transformOrigin = "left";
    const distance = () => Math.max(0, piste.scrollWidth - zone.clientWidth + 24);
    const t = gsap.to(piste, {
      x: () => -distance(), ease: "none",
      scrollTrigger: {
        trigger: zone, start: "center 52%", end: () => "+=" + Math.max(distance() * 2.4, innerHeight * 2),
        pin: true, scrub: .7, invalidateOnRefresh: true,
        onUpdate: st => { barre.style.transform = `scaleX(${Math.max(.04, st.progress)})`; },
      },
    });
    return () => { html.classList.remove("programme-defile"); barre.removeAttribute("style"); }; // gsap.matchMedia annule lui-même l'animation et le pin
  });

  /* ================= Programme sur téléphone : cartes empilées, qui apparaissent une à une ================= */
  gsap.matchMedia().add("(max-width: 860px)", () => {
    html.classList.add("programme-pile");
    gsap.set(".carrousel-piste", { x: 0 });
    $$(".carte").forEach(c => gsap.fromTo(c, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: .8, ease: EO, scrollTrigger: { trigger: c, start: "top 88%", once: true } }));
    return () => html.classList.remove("programme-pile");
  });

  /* ================= Disciplines : trois états au défilement ================= */
  (() => {
    const etats = $$(".disc-etat"), imgs = $$(".disc-image img"), points = $$(".disc-points i");
    let courant = 0;
    function montrer(i) {
      if (i === courant) return; courant = i;
      etats.forEach((e, k) => e.classList.toggle("est-actif", k === i));
      imgs.forEach((e, k) => e.classList.toggle("est-actif", k === i));
      points.forEach((e, k) => e.classList.toggle("est-actif", k === i));
    }
    const mm = gsap.matchMedia();
    mm.add("(min-width: 861px)", () => {
      ScrollTrigger.create({ trigger: ".disc-defile", start: "top top", end: "bottom bottom", onUpdate: st => montrer(Math.min(2, Math.floor(st.progress * 3))) });
      gsap.fromTo(".disc-image", { scale: 1.06 }, { scale: 1, ease: "none", scrollTrigger: { trigger: ".disc-defile", start: "top top", end: "bottom bottom", scrub: true } });
    });
    mm.add("(max-width: 860px)", () => {
      etats.forEach(e => e.classList.add("est-actif"));
      const id = setInterval(() => { courant = -1; const n = (imgs.findIndex(i => i.classList.contains("est-actif")) + 1) % 3; imgs.forEach((e, k) => e.classList.toggle("est-actif", k === n)); points.forEach((e, k) => e.classList.toggle("est-actif", k === n)); }, 3200);
      return () => clearInterval(id);
    });
    $$("[data-compte]").forEach(el => {
      const fin = +el.dataset.compte, suf = el.dataset.suffixe || "", o = { v: 0 };
      gsap.to(o, { v: fin, duration: 1.8, ease: "power2.out", onUpdate: () => { el.textContent = Math.round(o.v) + suf; }, scrollTrigger: { trigger: el, start: "top 90%", once: true } });
    });
  })();

  /* ================= Compte à rebours : les cordes du ring se tendent, le chrono tourne ================= */
  (() => {
    const cordes = $$(".compte-cadre .corde"), poteaux = $$(".compte-cadre .poteau");
    gsap.set(cordes, { scaleX: 0, scaleY: 0 });
    gsap.set(poteaux, { scale: 0 });
    const t = gsap.timeline({ scrollTrigger: { trigger: ".compte", start: "top 60%", end: "center center", scrub: .6 } });
    t.to(poteaux[0], { scale: 1, duration: .1 })
      .to(cordes[0], { scaleX: 1, scaleY: 1, duration: .25, ease: "none" })
      .to(poteaux[1], { scale: 1, duration: .1 }, "<.2")
      .to(cordes[1], { scaleX: 1, scaleY: 1, duration: .25, ease: "none" })
      .to(poteaux[2], { scale: 1, duration: .1 }, "<.2")
      .to(cordes[2], { scaleX: 1, scaleY: 1, duration: .25, ease: "none" })
      .to(poteaux[3], { scale: 1, duration: .1 }, "<.2")
      .to(cordes[3], { scaleX: 1, scaleY: 1, duration: .25, ease: "none" });
    gsap.fromTo(".compte-photo", { scale: 1.2 }, { scale: 1, ease: "none", scrollTrigger: { trigger: ".compte", start: "top bottom", end: "bottom top", scrub: true } });
    gsap.from([".compte-etiquette", ".chrono > div", ".compte-quand", ".compte-cadre .bouton"], { opacity: 0, y: 30, filter: "blur(10px)", stagger: .08, duration: 1, ease: EO, scrollTrigger: { trigger: ".compte-cadre", start: "top 75%", once: true } });

    const cible = new Date("2026-12-11T19:00:00+01:00").getTime();
    const champs = { j: $("[data-j]"), h: $("[data-h]"), m: $("[data-m]"), s: $("[data-s]") };
    const deux = n => String(n).padStart(2, "0");
    function tic() {
      let d = Math.max(0, Math.floor((cible - Date.now()) / 1000));
      const j = Math.floor(d / 86400); d %= 86400;
      champs.j.textContent = deux(j); champs.h.textContent = deux(Math.floor(d / 3600));
      champs.m.textContent = deux(Math.floor(d % 3600 / 60)); champs.s.textContent = deux(d % 60);
    }
    tic(); setInterval(tic, 1000);
  })();

  /* ================= Phrase qui entre et sort par le flou ================= */
  gsap.timeline({ scrollTrigger: { trigger: ".reveur", start: "top bottom", end: "bottom top", scrub: true } })
    .fromTo(".reveur-1", { opacity: 0, filter: "blur(24px)", y: 60 }, { opacity: 1, filter: "blur(0px)", y: 0, ease: "none", duration: .35 }, 0)
    .fromTo(".reveur-2", { opacity: 0, filter: "blur(24px)", y: 60 }, { opacity: 1, filter: "blur(0px)", y: 0, ease: "none", duration: .35 }, .12)
    .to([".reveur-1", ".reveur-2"], { opacity: 0, filter: "blur(24px)", y: -60, ease: "none", duration: .3, stagger: .06 }, .65);

  /* ================= Arrêt au stand : panneaux empilés ================= */
  gsap.matchMedia().add("(min-width: 861px)", () => {
    const panneaux = $$(".panneau");
    panneaux.forEach((p, i) => {
      gsap.set(p, { position: "sticky", top: `${9 + i * 1.5}vh` });
      const suivant = panneaux[i + 1];
      if (!suivant) return;
      gsap.to(p, { scale: .92, filter: "brightness(.45)", ease: "none", scrollTrigger: { trigger: suivant, start: "top bottom", end: "top 12%", scrub: true } });
    });
    return () => panneaux.forEach(p => gsap.set(p, { clearProps: "position,top,scale,filter" }));
  });
  $$(".panneau > img").forEach(img => gsap.fromTo(img, { scale: 1.15 }, { scale: 1, ease: "none", scrollTrigger: { trigger: img.parentNode, start: "top bottom", end: "top top", scrub: true } }));

  /* ================= Billetterie : apparition du bloc unique ================= */
  gsap.from(["#billets .pack-accroche", "#billets .tarif", "#billets .pack li", "#billets .pack .bouton"], { opacity: 0, x: 30, filter: "blur(8px)", stagger: .06, duration: .8, ease: EO, scrollTrigger: { trigger: "#billets .pack", start: "top 80%", once: true } });

  /* ================= Fiche technique, final ================= */
  gsap.from(".fiche-grille > div", { opacity: 0, y: 24, stagger: .05, duration: .9, ease: EO, scrollTrigger: { trigger: ".fiche-grille", start: "top 85%", once: true } });
  gsap.from(".affiche-cadre", { rotate: -4, y: 80, opacity: 0, duration: 1.3, ease: EO, scrollTrigger: { trigger: ".affiche", start: "top 85%", once: true } });
  gsap.fromTo(".final-image img", { scale: 1.25 }, { scale: 1, ease: "none", scrollTrigger: { trigger: ".final", start: "top bottom", end: "bottom bottom", scrub: true } });
  gsap.from(".pied-titre .ligne", { yPercent: 100, opacity: 0, filter: "blur(14px)", stagger: .12, duration: 1.2, ease: EO, scrollTrigger: { trigger: ".pied", start: "top 80%", once: true } });

  /* ================= Navigation, chapitres, progression, son ================= */
  gsap.to(".progression i", { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: .3 } });
  const nom = $(".barre-nom");
  $$("[data-chapitre]").forEach(s => ScrollTrigger.create({
    trigger: s, start: "top 55%", end: "bottom 55%",
    onToggle: st => { if (st.isActive && nom.textContent !== s.dataset.chapitre) { gsap.fromTo(nom, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .4 }); nom.textContent = s.dataset.chapitre; } },
  }));
  // la barre se cache quand on descend (lecture), revient quand on remonte ou qu'on s'arrête
  (() => {
    const barre = $(".barre");
    let avant = scrollY, minuterie = 0;
    addEventListener("scroll", () => {
      const d = scrollY - avant; avant = scrollY;
      if (menu.getAttribute("aria-expanded") === "true") return;
      if (d > 3 && scrollY > 300) barre.classList.add("est-cachee");
      else if (d < -3) barre.classList.remove("est-cachee");
      clearTimeout(minuterie);
      minuterie = setTimeout(() => barre.classList.remove("est-cachee"), 1400);
    }, { passive: true });
  })();
  const menu = $(".barre-chapitre"), tiroir = $("#tiroir");
  const fermerMenu = () => { menu.setAttribute("aria-expanded", "false"); tiroir.hidden = true; };
  menu.addEventListener("click", () => {
    const ouvert = menu.getAttribute("aria-expanded") === "true";
    if (ouvert) return fermerMenu();
    menu.setAttribute("aria-expanded", "true"); tiroir.hidden = false;
    gsap.from($$("a", tiroir), { opacity: 0, y: 10, stagger: .03, duration: .4, ease: EO });
  });
  document.addEventListener("click", e => { if (!e.target.closest(".barre")) fermerMenu(); });
  $$('a[href^="#"]').forEach(a => a.addEventListener("click", e => {
    const cible = $(a.getAttribute("href"));
    if (!cible) return;
    e.preventDefault(); fermerMenu();
    cible.scrollIntoView({ behavior: reduit ? "auto" : "smooth" });
  }));
  const boutonSon = $(".son");
  boutonSon.addEventListener("click", () => {
    const coupe = !Son.coupe;
    if (!Son.pret && !coupe) Son.init();
    Son.couper(coupe);
    boutonSon.setAttribute("aria-pressed", String(!coupe));
    boutonSon.setAttribute("aria-label", coupe ? "Activer le son" : "Couper le son");
  });
  // couper le moteur quand l'onglet est caché
  document.addEventListener("visibilitychange", () => { if (Son.pret) Son.couper(document.hidden || boutonSon.getAttribute("aria-pressed") === "false"); });
  // la vidéo du héros ne tourne que lorsqu'elle se voit
  ScrollTrigger.create({ trigger: ".heros", start: "top bottom", end: "bottom top", onToggle: st => { if (!lance) return; if (!herosVideo.play) return; st.isActive ? herosVideo.play().catch(() => {}) : herosVideo.pause(); } });
})();
