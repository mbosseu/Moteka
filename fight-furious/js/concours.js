/* FIGHT & Furious · jeu concours : inscription (ticket 1), 2 ami(e)s (ticket 2), avis Google (ticket 3) */
(() => {
  const section = document.getElementById("concours");
  if (!section) return;
  const $ = (s, r = section) => r.querySelector(s);

  const LIEN_AVIS = "https://share.google/NXCxR50ujCB4D3GBW";
  const CLE = "ff-concours";
  const ATTENTE_MIN = 8000; // temps minimum hors de la page pour compter l'avis automatiquement
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
  const avisConfirmer = $(".concours-avis-confirmer");
  const avisEtat = $(".concours-avis-etat");

  const lire = () => { try { return JSON.parse(localStorage.getItem(CLE)) || {}; } catch (e) { return {}; } };
  const ecrire = o => { try { localStorage.setItem(CLE, JSON.stringify(Object.assign(lire(), o))); } catch (e) {} };

  let etat = lire();
  if (!Array.isArray(etat.tickets)) delete etat.tickets;
  let ouvertA = 0;
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
    if (!m.includes("avis")) reste.push("laissez un avis Google");
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
    if (m.includes("avis")) avisFait("Votre avis Google est compté.");
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
    avisBloc.classList.add("est-fait");
    avisConfirmer.hidden = true;
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
      avis: Boolean(etat.avisAvant),
      site_web: form.elements.site_web.value,
      source: new URLSearchParams(location.search).get("src") || "site",
    };
    envoyer.disabled = true;
    envoyer.textContent = "Envoi en cours";
    try {
      const { statut, data } = await appeler("/api/concours/inscription", donnees);
      if (data.ok) {
        etat = { id: data.id, tickets: data.tickets || [], telephone: donnees.telephone, email: donnees.email };
        ecrire(etat);
        if (data.deja) amisBloc.querySelectorAll("input").forEach(i => { i.value = ""; });
        montrerMerci(data.deja
          ? (data.message || "Vous êtes déjà inscrit(e) : voici vos tickets.")
          : "Votre inscription est enregistrée. Vos numéros de tombola viennent de partir par email. Tirage au sort chaque soir dès le lundi 23 novembre.");
        if (!motifs().includes("avis")) avisEtat.textContent = "";
      } else if (statut === 409 && data.doublon) {
        afficherErreur(data.message || "Vous êtes déjà inscrit(e).");
      } else {
        afficherErreur(data.message || "Une erreur est survenue. Réessayez dans un instant.", data.erreurs && data.erreurs[0] && data.erreurs[0].champ);
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

  /* ---------- avis Google ---------- */
  async function confirmerAvis() {
    if (envoiAvisEnCours) return;
    // pas encore inscrit : l'avis sera compté avec l'inscription
    if (!etat.id && !(etat.telephone && etat.email)) {
      etat.avisAvant = true;
      ecrire({ avisAvant: true });
      avisConfirmer.hidden = true;
      avisEtat.textContent = "Merci pour votre avis. Validez votre inscription ci-dessus : votre ticket avis sera ajouté directement.";
      return;
    }
    envoiAvisEnCours = true;
    avisEtat.textContent = "Confirmation de votre avis";
    try {
      const { data } = await appeler("/api/concours/avis", identite());
      if (data.ok) {
        enregistrerTickets(data.tickets);
        avisFait(data.message || "Merci pour votre avis : un ticket de plus.");
      } else {
        avisEtat.textContent = data.message || "Impossible de confirmer l'avis pour le moment.";
        avisConfirmer.hidden = false;
      }
    } catch (err) {
      avisEtat.textContent = "Connexion impossible. Réessayez dans un instant.";
      avisConfirmer.hidden = false;
    } finally {
      envoiAvisEnCours = false;
    }
  }

  avisBouton.addEventListener("click", () => {
    ouvertA = Date.now();
    window.open(LIEN_AVIS, "_blank", "noopener");
    avisEtat.textContent = "Publiez votre avis dans l'onglet Google, puis revenez ici.";
  });

  avisConfirmer.addEventListener("click", () => { ouvertA = 0; confirmerAvis(); });

  // au retour sur l'onglet : avis compté si l'absence a duré assez longtemps, sinon on propose de confirmer
  function auRetour() {
    if (!ouvertA || document.visibilityState !== "visible") return;
    const duree = Date.now() - ouvertA;
    ouvertA = 0;
    if (duree >= ATTENTE_MIN) confirmerAvis();
    else {
      avisEtat.textContent = "Une fois votre avis publié, confirmez-le ici.";
      avisConfirmer.hidden = false;
    }
  }
  document.addEventListener("visibilitychange", auRetour);
  window.addEventListener("focus", auRetour);

  // le lien vers le règlement ouvre le bloc replié
  section.querySelectorAll(".lien-reglement").forEach(a => a.addEventListener("click", () => {
    const d = document.getElementById("reglement");
    if (d) d.open = true;
  }));

  // visiteur déjà inscrit sur cet appareil (ancien format sans liste de tickets : on repart de zéro)
  if (etat.id && Array.isArray(etat.tickets) && etat.tickets.length) {
    montrerMerci("Vous êtes inscrit(e) au jeu depuis cet appareil. Bonne chance pour les tirages.");
  } else if (etat.avisAvant) {
    avisEtat.textContent = "Avis Google noté. Validez votre inscription pour obtenir votre ticket avis en plus.";
  }
})();
