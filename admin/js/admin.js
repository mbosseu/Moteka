// Back-office du jeu concours FIGHT & Furious x Moteka.
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const etat = { participants: [], lots: [], tirages: [], tirageDuSoir: null };

  function echapper(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  let minuterieToast = 0;
  function toast(texte, erreur) {
    const t = $('#toast');
    t.textContent = texte;
    t.classList.toggle('erreur', Boolean(erreur));
    t.classList.add('visible');
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(() => t.classList.remove('visible'), 3800);
  }

  async function api(chemin, options = {}) {
    const res = await fetch(chemin, {
      credentials: 'same-origin',
      ...options,
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
    });
    let data = {};
    try { data = await res.json(); } catch { /* reponse vide */ }
    if (res.status === 401 && !chemin.endsWith('/login')) {
      afficherConnexion();
      throw new Error(data.message || 'Session expirée');
    }
    if (!res.ok || data.ok === false) throw new Error(data.message || `Erreur ${res.status}`);
    return data;
  }

  const dateFr = (iso) => {
    if (!iso) return '';
    const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
    return d.toLocaleString('fr-FR', iso.length === 10 ? { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' } : { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };
  const MOTIFS = { inscription: 'inscription', amis: 'ami(e)s', avis: 'avis' };

  /* ---------- Connexion ---------- */
  function afficherConnexion() {
    $('#connexion').hidden = false;
    $('#tableau').hidden = true;
    $('#compte').hidden = true;
  }

  function afficherTableau(user) {
    $('#connexion').hidden = true;
    $('#tableau').hidden = false;
    $('#compte').hidden = false;
    $('#compte-nom').textContent = user.name || user.email;
    toutCharger();
  }

  $('#form-connexion').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const bouton = f.querySelector('button');
    bouton.disabled = true;
    $('#message-connexion').textContent = '';
    try {
      const data = await api('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email: f.email.value, password: f.password.value }),
      });
      f.password.value = '';
      afficherTableau(data.user);
    } catch (err) {
      $('#message-connexion').textContent = err.message;
    } finally {
      bouton.disabled = false;
    }
  });

  $('#deconnexion').addEventListener('click', async () => {
    try { await api('/api/admin/logout', { method: 'POST' }); } catch { /* deja deconnecte */ }
    afficherConnexion();
  });

  /* ---------- Onglets ---------- */
  document.querySelectorAll('.onglets button').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.onglets button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      for (const nom of ['participants', 'lots', 'historique']) $(`#panneau-${nom}`).hidden = nom !== b.dataset.onglet;
    });
  });

  /* ---------- Participants ---------- */
  function normaliser(t) {
    return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function rendreParticipants() {
    const q = normaliser($('#recherche').value.trim());
    const qChiffres = q.replace(/\D/g, '');
    const liste = etat.participants.filter((p) => {
      if (!q) return true;
      const texte = normaliser(`${p.prenom} ${p.nom} ${p.email} ${p.source || ''}`);
      if (texte.includes(q)) return true;
      if (qChiffres && String(p.telephone || '').replace(/\D/g, '').includes(qChiffres)) return true;
      return qChiffres && p.tickets.some((t) => String(t.numero) === qChiffres);
    });
    $('#compte-resultats').textContent = q ? `${liste.length} résultat(s) sur ${etat.participants.length}` : '';
    $('#liste-participants').innerHTML = liste.length
      ? liste
          .map((p) => {
            const amis = (p.amis || []).map((a) => (typeof a === 'string' ? a : a && (a.email || a.prenom)) || '').filter(Boolean);
            return `<tr>
              <td>${echapper(dateFr(p.created_at))}${p.source ? `<small>${echapper(p.source)}</small>` : ''}</td>
              <td><strong>${echapper(p.prenom)} ${echapper(p.nom)}</strong></td>
              <td><a href="tel:${echapper(p.telephone)}">${echapper(p.telephone)}</a><small>${echapper(p.email)}</small></td>
              <td>${p.tickets.map((t) => `<span class="ticket">n. ${t.numero}<i>${echapper(MOTIFS[t.motif] || t.motif || '')}</i></span>`).join('') || '<small>aucun</small>'}</td>
              <td>${p.avis ? '<span class="oui">oui</span>' : 'non'}</td>
              <td>${amis.length ? amis.map((a) => `<small>${echapper(a)}</small>`).join('') : '<small>-</small>'}</td>
              <td>${p.gain ? `<span class="gain">${echapper(p.gain.lot)}</span><small>${echapper(dateFr(p.gain.date_tirage))}, n. ${p.gain.numero}</small>` : ''}</td>
            </tr>`;
          })
          .join('')
      : '<tr><td colspan="7" class="aide">Aucun participant.</td></tr>';
  }

  async function chargerParticipants() {
    const data = await api('/api/admin/participants');
    etat.participants = data.participants || [];
    $('#stat-inscrits').textContent = data.stats.inscrits;
    $('#stat-tickets').textContent = data.stats.tickets;
    $('#stat-eligibles').textContent = data.stats.eligibles;
    $('#stat-tirages').textContent = data.stats.tirages;
    rendreParticipants();
  }

  let minuterieRecherche = 0;
  $('#recherche').addEventListener('input', () => {
    clearTimeout(minuterieRecherche);
    minuterieRecherche = setTimeout(rendreParticipants, 120);
  });
  $('#rafraichir').addEventListener('click', () => toutCharger().then(() => toast('Données actualisées')));

  /* ---------- Lots ---------- */
  function rendreLots() {
    $('#liste-lots').innerHTML = etat.lots
      .map(
        (l) => `<form class="carte lot" data-id="${echapper(l.id)}">
          <div class="lot-tete">
            <span class="lot-ordre">${echapper(l.ordre)}</span>
            <span class="etat ${l.attribue_le ? 'attribue' : ''}">${l.attribue_le ? `Gagné le ${echapper(dateFr(l.attribue_le))}` : l.actif ? 'Disponible' : 'Inactif'}</span>
          </div>
          <label>Nom<input name="nom" maxlength="120" required value="${echapper(l.nom)}"></label>
          <label>Description<textarea name="description" maxlength="600">${echapper(l.description)}</textarea></label>
          <label>Image (facultatif)<input name="image_url" placeholder="https://..." value="${echapper(l.image_url || '')}"></label>
          <label class="case"><input type="checkbox" name="actif" ${l.actif ? 'checked' : ''}> Lot actif</label>
          <button class="bouton bouton-rouge bouton-petit" type="submit">Enregistrer</button>
        </form>`
      )
      .join('');
    const select = $('#choix-lot');
    const valeur = select.value;
    select.innerHTML =
      '<option value="">Prochain lot dans l\'ordre</option>' +
      etat.lots
        .filter((l) => l.actif && !l.attribue_le)
        .map((l) => `<option value="${echapper(l.id)}">${echapper(l.ordre)}. ${echapper(l.nom)}</option>`)
        .join('');
    select.value = [...select.options].some((o) => o.value === valeur) ? valeur : '';
    majLienTirage();
  }

  $('#liste-lots').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const bouton = f.querySelector('button');
    bouton.disabled = true;
    try {
      await api('/api/admin/lots', {
        method: 'PUT',
        body: JSON.stringify({ id: f.dataset.id, nom: f.nom.value, description: f.description.value, image_url: f.image_url.value, actif: f.actif.checked }),
      });
      toast('Lot enregistré');
      await chargerLots();
    } catch (err) {
      toast(err.message, true);
    } finally {
      bouton.disabled = false;
    }
  });

  async function chargerLots() {
    const data = await api('/api/admin/lots');
    etat.lots = data.lots || [];
    rendreLots();
  }

  /* ---------- Historique ---------- */
  function rendreTirages() {
    $('#liste-tirages').innerHTML = etat.tirages.length
      ? etat.tirages
          .map(
            (t) => `<tr>
              <td>${echapper(dateFr(t.date_tirage))}</td>
              <td><span class="ticket">n. ${t.numero}</span></td>
              <td><strong>${echapper(t.prenom)} ${echapper(t.nom)}</strong></td>
              <td><a href="tel:${echapper(t.telephone)}">${echapper(t.telephone)}</a><small>${echapper(t.email)}</small></td>
              <td>${t.lot ? `<span class="gain">${echapper(t.lot.nom)}</span>` : ''}</td>
              <td><button type="button" class="bouton bouton-contour bouton-petit" data-annuler="${echapper(t.id)}">Annuler</button></td>
            </tr>`
          )
          .join('')
      : '<tr><td colspan="6" class="aide">Aucun tirage pour le moment.</td></tr>';
  }

  $('#liste-tirages').addEventListener('click', async (e) => {
    const id = e.target?.dataset?.annuler;
    if (!id) return;
    if (!window.confirm('Annuler ce tirage ? Le lot et le gagnant redeviendront disponibles. Cette action est définitive.')) return;
    try {
      await api(`/api/admin/tirages?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      toast('Tirage annulé');
      await toutCharger();
    } catch (err) {
      toast(err.message, true);
    }
  });

  async function chargerTirages() {
    const data = await api('/api/admin/tirages');
    etat.tirages = data.tirages || [];
    rendreTirages();
  }

  /* ---------- Tirage du soir ---------- */
  function majLienTirage() {
    const lot = $('#choix-lot').value;
    $('#lancer-tirage').href = `/admin/tirage?mode=reel${lot ? `&lot=${encodeURIComponent(lot)}` : ''}`;
  }
  $('#choix-lot').addEventListener('change', majLienTirage);

  async function chargerEtatTirage() {
    const data = await api('/api/admin/tirage');
    const bouton = $('#lancer-tirage');
    const horsPeriode = data.dans_periode === false;
    if (horsPeriode) {
      $('#etat-tirage').textContent = `Tirages réels du lundi 23 au vendredi 27 novembre 2026 (un par soir). ${data.numeros.length} ticket(s) éligible(s). En attendant, utilisez la répétition.`;
    }
    if (horsPeriode || data.deja_tire) {
      if (!horsPeriode) $('#etat-tirage').textContent = `Le tirage du ${dateFr(data.date)} a déjà eu lieu (voir l'historique).`;
      bouton.setAttribute('aria-disabled', 'true');
      bouton.style.pointerEvents = 'none';
      bouton.style.opacity = '.45';
    } else {
      const lot = data.prochain_lot ? data.prochain_lot.nom : 'aucun lot restant';
      $('#etat-tirage').textContent = `${data.numeros.length} ticket(s) éligible(s) sur ${data.total_tickets}. Prochain lot : ${lot}.`;
      bouton.removeAttribute('aria-disabled');
      bouton.style.pointerEvents = '';
      bouton.style.opacity = '';
    }
  }

  async function toutCharger() {
    const r = await Promise.allSettled([chargerParticipants(), chargerLots(), chargerTirages(), chargerEtatTirage()]);
    const echec = r.find((x) => x.status === 'rejected');
    if (echec) toast(echec.reason?.message || 'Chargement incomplet', true);
  }

  /* ---------- Demarrage ---------- */
  api('/api/admin/me')
    .then((d) => afficherTableau(d.user))
    .catch(() => afficherConnexion());
})();
