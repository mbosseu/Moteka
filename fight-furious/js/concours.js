/* FIGHT & Furious · jeu concours : inscription (ticket 1), 2 ami(e)s (ticket 2), avis Google (ticket 3) */
(() => {
  const section = document.getElementById("concours");
  if (!section) return;
  const $ = (s, r = section) => r.querySelector(s);

  const LIEN_AVIS = "https://share.google/NXCxR50ujCB4D3GBW";
  const CLE = "ff-concours";
  const PREUVE_MAX = 1900000; // longueur max de la data URL envoyee (environ 1,4 Mo d'image)
  const LIBELLES = { inscription: "Inscription", amis: "2 ami(e)s", avis: "Avis Google" };

  const form = $(".concours-form");
  const erreur = $(".concours-form-erreur");
  const envoyer = $(".concours-envoyer");
  const merci = $(".concours-merci");
  const amisBloc = $(".concours-amis");
  const amisErreur = $(".concours-amis-erreur");
  const amisEnvoyer = $(".concours-amis-envoyer");
  const avisBloc = $(".concours-avis");
  const avisBouton = $(".concours-avis-bouton");
  const avisFichier = $(".concours-avis-fichier");
  const avisInput = $(".concours-avis-input");
  const avisApercu = $(".concours-avis-apercu");
  const avisMiniature = $(".concours-avis-miniature");
  const avisNom = $(".concours-avis-nom");
  const avisRetirer = $(".concours-avis-retirer");
  const avisErreur = $(".concours-avis-erreur");
  const avisEnvoyer = $(".concours-avis-envoyer");
  const avisEtat = $(".concours-avis-etat");

  const lire = () => { try { return JSON.parse(localStorage.getItem(CLE)) || {}; } catch (e) { return {}; } };
  const ecrire = o => { try { localStorage.setItem(CLE, JSON.stringify(Object.assign(lire(), o))); } catch (e) {} };

  let etat = lire();
  if (!Array.isArray(etat.tickets)) delete etat.tickets;
  if (etat.avisAvant) { delete etat.avisAvant; try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch (e) {} }
  let preuve = ""; // capture compressée (data URL JPEG), jamais stockée dans localStorage
  let preparationPreuve = null;
  let envoiAvisEnCours = false;

  function normaliserTel(v) {
    let c = String(v || "").replace(/\D/g, "");
    if (c.startsWith("0033")) c = c.slice(4);
    else if (c.startsWith("33") && c.length === 11) c = c.slice(2);
    else if (c.startsWith("330") && c.length === 12) c = c.slice(3);
    if (c.length === 10 && c.startsWith("0")) c = c.slice(1);
    if (c.length !== 9 || !/^[1-9]/.test(c)) return "";
    return "0" + c;
  }
  const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && !v.includes("..");
  const champ = nom => section.querySelector('[name="' + nom + '"]');
  const valeur = nom => (champ(nom) ? champ(nom).value.trim() : "");

  function marquer(zone, message, nom) {
    zone.textContent = message;
    zone.hidden = !message;
    section.querySelectorAll("[aria-invalid]").forEach(el => el.removeAttribute("aria-invalid"));
    const el = nom && champ(nom);
    if (el) {
      if (nom.startsWith("ami")) amisBloc.open = true;
      el.setAttribute("aria-invalid", "true");
      el.focus();
    }
  }
  const afficherErreur = (message, nom) => marquer(erreur, message, nom);

  /* ---------- tickets de tombola ---------- */
  const motifs = () => (etat.tickets || []).map(t => t.motif);

  function dessinerTickets() {
    const tickets = (etat.tickets || []).slice().sort((a, b) => a.numero - b.numero);
    const n = tickets.length;
    const b = $("[data-tickets]"), mot = $("[data-tickets-mot]");
    if (b) b.textContent = n;
    if (mot) mot.textContent = n > 1 ? "tickets" : "ticket";
    const liste = $(".mes-tickets");
    liste.innerHTML = "";
    tickets.forEach(t => {
      const li = document.createElement("li");
      li.className = "tombola";
      const haut = document.createElement("span");
      haut.className = "tombola-motif";
      haut.textContent = LIBELLES[t.motif] || "Ticket";
      const num = document.createElement("b");
      num.className = "tombola-num";
      num.textContent = t.numero;
      const bas = document.createElement("span");
      bas.className = "tombola-pied";
      bas.textContent = "FIGHT & Furious x Moteka";
      li.append(haut, num, bas);
      li.setAttribute("aria-label", "Ticket numéro " + t.numero + ", " + (LIBELLES[t.motif] || ""));
      liste.append(li);
    });

    const m = motifs();
    const reste = [];
    if (!m.includes("amis")) reste.push("invitez 2 ami(e)s");
    if (!m.includes("avis")) reste.push("envoyez la capture de votre avis Google");
    $(".concours-manque").textContent = reste.length
      ? "Pour gagner " + (reste.length > 1 ? "2 tickets de plus" : "1 ticket de plus") + " : " + reste.join(" et ") + "."
      : "Vous avez le maximum : 3 tickets. Bonne chance pour les tirages.";

    // le bloc ami(e)s passe sous les tickets tant que ce ticket n'est pas gagné
    if (!m.includes("amis")) {
      $(".concours-amis-plus").append(amisBloc);
      amisEnvoyer.hidden = false;
    } else {
      amisBloc.hidden = true;
    }
    // idem pour l'avis Google : la capture s'envoie depuis l'écran de confirmation
    if (m.includes("avis")) {
      avisFait("Capture reçue : votre ticket avis est compté. Chaque capture est vérifiée par l'équipe.");
    } else {
      $(".concours-avis-plus").append(avisBloc);
      avisBloc.classList.remove("est-fait");
      avisFichier.hidden = false;
      avisEnvoyer.hidden = false;
    }
  }

  function montrerMerci(texte) {
    form.hidden = true;
    merci.hidden = false;
    $(".concours-merci-texte").textContent = texte;
    dessinerTickets();
  }

  function enregistrerTickets(tickets) {
    if (!Array.isArray(tickets)) return;
    etat.tickets = tickets;
    ecrire({ tickets });
    if (!merci.hidden) dessinerTickets();
  }

  function avisFait(message) {
    if (!merci.hidden) $(".concours-avis-plus").append(avisBloc);
    avisBloc.classList.add("est-fait");
    avisFichier.hidden = true;
    avisEnvoyer.hidden = true;
    oublierPreuve();
    avisErreur.hidden = true;
    avisEtat.textContent = message;
  }

  /* ---------- validation locale ---------- */
  function lireAmis() {
    return [1, 2].map(i => ({
      prenom: valeur("ami" + i + "_prenom"),
      email: valeur("ami" + i + "_email").toLowerCase(),
      telephone: valeur("ami" + i + "_telephone"),
    }));
  }

  function validerAmis(amis, emailPerso) {
    if (!amis.some(a => a.prenom || a.email || a.telephone)) return null;
    for (let i = 0; i < amis.length; i++) {
      const a = amis[i], n = i + 1, p = "ami" + n + "_";
      if (!a.prenom) return ["Indiquez le prénom de l'ami(e) " + n + " (ou videz le bloc ami(e)s).", p + "prenom"];
      if (!a.email) return ["Indiquez l'email de l'ami(e) " + n + " (ou videz le bloc ami(e)s).", p + "email"];
      if (!emailOk(a.email)) return ["L'email de l'ami(e) " + n + " est invalide.", p + "email"];
      if (emailPerso && a.email === emailPerso) return ["L'email d'un(e) ami(e) doit être différent du vôtre.", p + "email"];
      if (i === 1 && a.email === amis[0].email) return ["Les 2 ami(e)s doivent avoir des emails différents.", p + "email"];
      if (a.telephone && !normaliserTel(a.telephone)) return ["Le téléphone de l'ami(e) " + n + " est invalide (il est facultatif).", p + "telephone"];
    }
    return null;
  }

  function validerLocal() {
    const f = form.elements;
    const email = valeur("email").toLowerCase();
    if (!valeur("prenom")) return ["Merci d'indiquer votre prénom.", "prenom"];
    if (!valeur("nom")) return ["Merci d'indiquer votre nom.", "nom"];
    if (!valeur("telephone")) return ["Merci d'indiquer votre téléphone.", "telephone"];
    if (!normaliserTel(valeur("telephone"))) return ["Numéro de téléphone invalide (exemple : 06 12 34 56 78).", "telephone"];
    if (!email) return ["Merci d'indiquer votre email.", "email"];
    if (!emailOk(email)) return ["Adresse email invalide.", "email"];
    const pbAmis = validerAmis(lireAmis(), email);
    if (pbAmis) return pbAmis;
    if (!f.reglement.checked) return ["Merci d'accepter le règlement du jeu.", "reglement"];
    return null;
  }

  async function appeler(url, donnees) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(donnees) });
    const data = await res.json().catch(() => ({}));
    return { statut: res.status, data };
  }
  const identite = () => (etat.id ? { id: etat.id } : { telephone: etat.telephone, email: etat.email });
  const amisRemplis = amis => amis.some(a => a.prenom || a.email || a.telephone);

  /* ---------- inscription ---------- */
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const pb = validerLocal();
    if (pb) return afficherErreur(pb[0], pb[1]);
    afficherErreur("");
    const amis = lireAmis();
    const donnees = {
      prenom: valeur("prenom"),
      nom: valeur("nom"),
      telephone: valeur("telephone"),
      email: valeur("email").toLowerCase(),
      amis: amisRemplis(amis) ? amis : [],
      reglement: form.elements.reglement.checked,
      site_web: form.elements.site_web.value,
      source: new URLSearchParams(location.search).get("src") || "site",
    };
    envoyer.disabled = true;
    envoyer.textContent = "Envoi en cours";
    try {
      if (preparationPreuve) await preparationPreuve.catch(() => {});
      const preuveJointe = preuve;
      if (preuveJointe) donnees.avis_preuve = preuveJointe;
      const { statut, data } = await appeler("/api/concours/inscription", donnees);
      if (data.ok) {
        etat = { id: data.id, tickets: data.tickets || [], telephone: donnees.telephone, email: donnees.email };
        ecrire(etat);
        if (data.deja) amisBloc.querySelectorAll("input").forEach(i => { i.value = ""; });
        montrerMerci(data.deja
          ? (data.message || "Vous êtes déjà inscrit(e) : voici vos tickets.")
          : "Votre inscription est enregistrée. Vos numéros de tombola viennent de partir par email. Tirage au sort chaque soir du lundi 23 au samedi 28 novembre.");
        if (!motifs().includes("avis")) {
          avisEtat.textContent = preuveJointe ? "Votre capture n'a pas pu être prise en compte. Renvoyez-la ci-dessous." : "";
        }
      } else if (statut === 409 && data.doublon) {
        afficherErreur(data.message || "Vous êtes déjà inscrit(e).");
      } else {
        const champErreur = data.erreurs && data.erreurs[0] && data.erreurs[0].champ;
        if (champErreur === "avis_preuve") oublierPreuve();
        afficherErreur(data.message || "Une erreur est survenue. Réessayez dans un instant.", champErreur);
      }
    } catch (err) {
      afficherErreur("Connexion impossible. Vérifiez votre réseau et réessayez.");
    } finally {
      envoyer.disabled = false;
      envoyer.textContent = "Valider mon inscription";
    }
  });

  /* ---------- ami(e)s après coup ---------- */
  amisEnvoyer.addEventListener("click", async () => {
    const amis = lireAmis();
    if (!amisRemplis(amis)) return marquer(amisErreur, "Renseignez vos 2 ami(e)s pour gagner ce ticket.", "ami1_prenom");
    const pb = validerAmis(amis, etat.email);
    if (pb) return marquer(amisErreur, pb[0], pb[1]);
    marquer(amisErreur, "");
    amisEnvoyer.disabled = true;
    amisEnvoyer.textContent = "Envoi en cours";
    try {
      const { data } = await appeler("/api/concours/amis", Object.assign(identite(), { amis }));
      if (data.ok) {
        enregistrerTickets(data.tickets);
        $(".concours-merci-texte").textContent = data.message || "Invitations envoyées.";
      } else {
        marquer(amisErreur, data.message || "Impossible d'envoyer les invitations pour le moment.", data.erreurs && data.erreurs[0] && data.erreurs[0].champ);
      }
    } catch (err) {
      marquer(amisErreur, "Connexion impossible. Réessayez dans un instant.");
    } finally {
      amisEnvoyer.disabled = false;
      amisEnvoyer.textContent = "Inviter mes 2 ami(e)s";
    }
  });

  /* ---------- avis Google : preuve par capture d'écran ---------- */
  // Image redimensionnée à 1080 px max et recompressée en JPEG (qualité 0.72), comme le concours Boxing Center.
  function chargerImageBalise(fichier) {
    return new Promise((ok, ko) => {
      const url = URL.createObjectURL(fichier);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); ok(img); };
      img.onerror = () => { URL.revokeObjectURL(url); ko(new Error("image illisible")); };
      img.src = url;
    });
  }
  function chargerImage(fichier) {
    if (window.createImageBitmap) return createImageBitmap(fichier).catch(() => chargerImageBalise(fichier));
    return chargerImageBalise(fichier);
  }
  function dessiner(image, max, qualite) {
    const l = image.naturalWidth || image.width, h = image.naturalHeight || image.height;
    const echelle = Math.min(1, max / Math.max(l, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(l * echelle));
    canvas.height = Math.max(1, Math.round(h * echelle));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", qualite);
  }
  async function fichierVersPreuve(fichier) {
    const image = await chargerImage(fichier);
    if (!(image.naturalWidth || image.width)) throw new Error("image vide");
    let url = dessiner(image, 1080, 0.72);
    if (url.length > PREUVE_MAX) url = dessiner(image, 800, 0.6);
    if (image.close) image.close();
    if (!/^data:image\/jpeg;base64,/.test(url) || url.length > PREUVE_MAX) throw new Error("image trop lourde");
    return url;
  }

  function oublierPreuve() {
    preuve = "";
    preparationPreuve = null;
    avisInput.value = "";
    avisApercu.hidden = true;
    avisMiniature.removeAttribute("src");
  }

  avisInput.addEventListener("change", () => {
    const fichier = avisInput.files && avisInput.files[0];
    marquer(avisErreur, "");
    if (!fichier) return;
    if (fichier.type && !/^image\//.test(fichier.type)) {
      oublierPreuve();
      return marquer(avisErreur, "Ce fichier n'est pas une image. Choisissez la capture d'écran de votre avis.");
    }
    if (fichier.size > 30 * 1024 * 1024) {
      oublierPreuve();
      return marquer(avisErreur, "Image trop lourde. Choisissez une capture d'écran.");
    }
    preuve = "";
    avisEtat.textContent = "Préparation de la capture";
    const tache = fichierVersPreuve(fichier);
    preparationPreuve = tache;
    tache.then(url => {
      if (preparationPreuve !== tache) return;
      preuve = url;
      preparationPreuve = null;
      avisMiniature.src = url;
      avisNom.textContent = "Capture prête" + (fichier.name ? " : " + fichier.name : "");
      avisApercu.hidden = false;
      avisEtat.textContent = merci.hidden
        ? "Votre capture sera envoyée avec votre inscription."
        : "Capture prête. Appuyez sur Envoyer ma capture.";
    }).catch(() => {
      if (preparationPreuve !== tache) return;
      oublierPreuve();
      avisEtat.textContent = "";
      marquer(avisErreur, "Image illisible. Réessayez avec une autre capture d'écran.");
    });
  });

  avisRetirer.addEventListener("click", () => {
    oublierPreuve();
    avisEtat.textContent = "";
    avisInput.focus();
  });

  avisBouton.addEventListener("click", () => {
    window.open(LIEN_AVIS, "_blank", "noopener");
    avisEtat.textContent = "Publiez votre avis dans l'onglet Google, faites une capture d'écran, puis revenez la charger ici.";
  });

  // envoi après coup, depuis l'écran de confirmation
  avisEnvoyer.addEventListener("click", async () => {
    if (envoiAvisEnCours) return;
    if (preparationPreuve) await preparationPreuve.catch(() => {});
    if (!preuve) return marquer(avisErreur, "Chargez d'abord la capture d'écran de votre avis Google.", "avis_preuve");
    marquer(avisErreur, "");
    envoiAvisEnCours = true;
    avisEnvoyer.disabled = true;
    avisEnvoyer.textContent = "Envoi en cours";
    try {
      const { data } = await appeler("/api/concours/avis", Object.assign(identite(), { avis_preuve: preuve }));
      if (data.ok) {
        enregistrerTickets(data.tickets);
        avisFait(data.message || "Capture reçue, merci pour votre avis.");
      } else {
        if (data.erreurs && data.erreurs[0] && data.erreurs[0].champ === "avis_preuve") oublierPreuve();
        marquer(avisErreur, data.message || "Impossible d'envoyer la capture pour le moment.");
      }
    } catch (err) {
      marquer(avisErreur, "Connexion impossible. Réessayez dans un instant.");
    } finally {
      envoiAvisEnCours = false;
      avisEnvoyer.disabled = false;
      avisEnvoyer.textContent = "Envoyer ma capture";
    }
  });

  // le lien vers le règlement ouvre le bloc replié
  section.querySelectorAll(".lien-reglement").forEach(a => a.addEventListener("click", () => {
    const d = document.getElementById("reglement");
    if (d) d.open = true;
  }));

  // visiteur déjà inscrit sur cet appareil (ancien format sans liste de tickets : on repart de zéro)
  if (etat.id && Array.isArray(etat.tickets) && etat.tickets.length) {
    montrerMerci("Vous êtes inscrit(e) au jeu depuis cet appareil. Bonne chance pour les tirages.");
  }
})();
