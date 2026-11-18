/* FIGHT & Furious · jeu concours : inscription, ticket bonus avis Google */
(() => {
  const section = document.getElementById("concours");
  if (!section) return;
  const $ = (s, r = section) => r.querySelector(s);

  const LIEN_AVIS = "https://share.google/NXCxR50ujCB4D3GBW";
  const CLE = "ff-concours";
  const ATTENTE_MIN = 8000; // temps minimum hors de la page pour compter l'avis automatiquement

  const form = $(".concours-form");
  const erreur = $(".concours-erreur");
  const envoyer = $(".concours-envoyer");
  const merci = $(".concours-merci");
  const avisBloc = $(".concours-avis");
  const avisBouton = $(".concours-avis-bouton");
  const avisConfirmer = $(".concours-avis-confirmer");
  const avisEtat = $(".concours-avis-etat");

  const lire = () => { try { return JSON.parse(localStorage.getItem(CLE)) || {}; } catch (e) { return {}; } };
  const ecrire = o => { try { localStorage.setItem(CLE, JSON.stringify(Object.assign(lire(), o))); } catch (e) {} };

  let etat = lire();
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

  function afficherErreur(message, champ) {
    erreur.textContent = message;
    erreur.hidden = !message;
    form.querySelectorAll("[aria-invalid]").forEach(el => el.removeAttribute("aria-invalid"));
    if (champ && form.elements[champ]) {
      form.elements[champ].setAttribute("aria-invalid", "true");
      form.elements[champ].focus();
    }
  }

  function majTickets(n) {
    const b = $("[data-tickets]"), mot = $("[data-tickets-mot]");
    if (b) b.textContent = n;
    if (mot) mot.textContent = n > 1 ? "tickets" : "ticket";
  }

  function montrerMerci(texte, tickets) {
    form.hidden = true;
    merci.hidden = false;
    $(".concours-merci-texte").textContent = texte;
    majTickets(tickets);
    merci.focus({ preventScroll: true });
  }

  function avisFait(message) {
    avisBloc.classList.add("est-fait");
    avisConfirmer.hidden = true;
    avisEtat.textContent = message;
  }

  function validerLocal() {
    const f = form.elements;
    const prenom = f.prenom.value.trim(), nom = f.nom.value.trim();
    const email = f.email.value.trim().toLowerCase();
    const tel = normaliserTel(f.telephone.value);
    const amis = [f.ami1.value, f.ami2.value].map(v => v.trim().toLowerCase()).filter(Boolean);
    if (!prenom) return ["Merci d'indiquer votre prénom.", "prenom"];
    if (!nom) return ["Merci d'indiquer votre nom.", "nom"];
    if (!f.telephone.value.trim()) return ["Merci d'indiquer votre téléphone.", "telephone"];
    if (!tel) return ["Numéro de téléphone invalide (exemple : 06 12 34 56 78).", "telephone"];
    if (!email) return ["Merci d'indiquer votre email.", "email"];
    if (!emailOk(email)) return ["Adresse email invalide.", "email"];
    for (let i = 0; i < amis.length; i++) {
      const champ = f.ami1.value.trim().toLowerCase() === amis[i] ? "ami1" : "ami2";
      if (!emailOk(amis[i])) return ["L'email de votre ami(e) est invalide.", champ];
      if (amis[i] === email) return ["L'email d'un(e) ami(e) doit être différent du vôtre.", champ];
    }
    if (!f.reglement.checked) return ["Merci d'accepter le règlement du jeu.", "reglement"];
    return null;
  }

  async function appeler(url, donnees) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(donnees) });
    const data = await res.json().catch(() => ({}));
    return { statut: res.status, data };
  }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const pb = validerLocal();
    if (pb) return afficherErreur(pb[0], pb[1]);
    afficherErreur("");
    const f = form.elements;
    const donnees = {
      prenom: f.prenom.value.trim(),
      nom: f.nom.value.trim(),
      telephone: f.telephone.value.trim(),
      email: f.email.value.trim().toLowerCase(),
      ami_emails: [f.ami1.value, f.ami2.value].map(v => v.trim().toLowerCase()).filter(Boolean),
      reglement: f.reglement.checked,
      avis: Boolean(etat.avisAvant),
      site_web: f.site_web.value,
      source: new URLSearchParams(location.search).get("src") || "site",
    };
    envoyer.disabled = true;
    envoyer.textContent = "Envoi en cours";
    try {
      const { statut, data } = await appeler("/api/concours/inscription", donnees);
      if (data.ok) {
        etat = { id: data.id, tickets: data.tickets, avis: data.avis, telephone: donnees.telephone, email: donnees.email };
        ecrire(etat);
        montrerMerci("Votre inscription est enregistrée. Un mail de confirmation vient de partir. Tirage au sort chaque jour dès le lundi 23 novembre.", data.tickets);
        if (data.avis) avisFait("Votre avis Google est compté : 2 tickets.");
        else avisEtat.textContent = "";
      } else if (statut === 409 && data.doublon) {
        etat = { telephone: donnees.telephone, email: donnees.email, avis: Boolean(data.avis), deja: true };
        ecrire(etat);
        montrerMerci(data.message || "Vous êtes déjà inscrit(e).", data.avis ? 2 : 1);
        if (data.avis) avisFait("Votre avis Google est déjà compté.");
        else if (etat.avisAvant) confirmerAvis();
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

  async function confirmerAvis() {
    if (envoiAvisEnCours) return;
    // pas encore inscrit : l'avis sera compté avec l'inscription
    if (!etat.id && !(etat.telephone && etat.email)) {
      etat.avisAvant = true;
      ecrire({ avisAvant: true });
      avisConfirmer.hidden = true;
      avisEtat.textContent = "Merci pour votre avis. Validez votre inscription ci-dessus : vous aurez directement 2 tickets.";
      return;
    }
    envoiAvisEnCours = true;
    avisEtat.textContent = "Confirmation de votre avis";
    try {
      const corps = etat.id ? { id: etat.id } : { telephone: etat.telephone, email: etat.email };
      const { data } = await appeler("/api/concours/avis", corps);
      if (data.ok) {
        etat.avis = true; etat.tickets = data.tickets || 2;
        ecrire({ avis: true, tickets: etat.tickets });
        majTickets(etat.tickets);
        avisFait(data.message || "Merci pour votre avis : vous avez maintenant 2 tickets.");
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

  // visiteur déjà inscrit sur cet appareil
  if (etat.id || etat.deja) {
    montrerMerci("Vous êtes déjà inscrit(e) au jeu depuis cet appareil. Bonne chance pour les tirages.", etat.avis ? 2 : (etat.tickets || 1));
    if (etat.avis) avisFait("Votre avis Google est compté : 2 tickets.");
  } else if (etat.avisAvant) {
    avisEtat.textContent = "Avis Google noté. Validez votre inscription pour obtenir vos 2 tickets.";
  }
})();
