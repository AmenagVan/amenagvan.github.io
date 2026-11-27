/* ==========================================================
   Aménag'Van — appli de gestion (bêta)
   Rôle : recevoir les demandes du site, tenir les fiches clients,
   préparer les rendez-vous (Google Agenda) et les exports vers Indy.
   Les devis et factures se font dans Indy (gratuit, facture électronique).
   Données stockées sur l'appareil (localStorage) : rien n'est envoyé,
   sauf la lecture des demandes sur le script Google de l'atelier.
   ========================================================== */
"use strict";

const CLE = "amenagvan-gestion-v1";
const URL_INDY = "https://app.indy.fr/";

/* ---------------- Données ---------------- */
function base() {
  return {
    reglages: {
      nom: "Aménag'Van",
      compteAgenda: "ethan79pro@gmail.com",
      lieuAtelier: "Atelier Aménag'Van, 79700 Mauléon",
      urlRdv: "",
      urlDemandes: "",
      cleDemandes: "",
      dernierIdDemande: 0,
      derniereSynchro: "",
      derniereSauvegarde: "",
    },
    clients: [],
    demandes: [],
    rdv: [],
  };
}

const CLIENT_VIDE = {
  id: "", type: "particulier", societe: "", prenom: "", nom: "", tel: "", email: "",
  adresse: "", cp: "", ville: "", vehicule: "", immat: "", notes: "", exporteIndy: "",
};

let db = charger();
function charger() {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return base();
    const d = JSON.parse(brut);
    const b = base();
    // Les anciennes données (devis/factures de la 1re bêta) sont conservées telles quelles
    const r = { ...b, ...d, reglages: { ...b.reglages, ...d.reglages } };
    r.clients = (r.clients || []).map((c) => {
      // 1re bêta : « nom » contenait prénom + nom → on sépare (le 1er mot devient le prénom)
      if (!("prenom" in c) && /\s/.test(String(c.nom || "").trim())) {
        const [prenom, ...reste] = c.nom.trim().split(/\s+/);
        c = { ...c, prenom, nom: reste.join(" ") };
      }
      return { ...CLIENT_VIDE, ...c };
    });
    r.demandes = r.demandes || [];
    r.rdv = r.rdv || [];
    return r;
  } catch (e) {
    alert("Les données enregistrées sont illisibles. Restaurez une sauvegarde depuis Réglages.");
    return base();
  }
}
function sauver() {
  localStorage.setItem(CLE, JSON.stringify(db));
}

/* ---------------- Utilitaires ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const id = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const isoLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const aujourdhui = () => isoLocal(new Date());
const dateFr = (iso) => (iso ? new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("fr-FR") : "—");
const jourLong = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const dateHeure = (iso) => (iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—");
function plusJours(iso, j) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + Number(j || 0));
  return isoLocal(d);
}
const client = (cid) => db.clients.find((c) => c.id === cid);
const nomComplet = (c) => (c ? [c.prenom, c.nom].filter(Boolean).join(" ") || c.societe || "Sans nom" : "Client supprimé");
const chiffres = (t) => String(t || "").replace(/\D/g, "");
const lienTel = (t) => { const n = chiffres(t); return n ? (n.startsWith("33") ? "+" + n : n) : ""; };

/* ---------------- Navigation ---------------- */
const VUES = {};
let vueCourante = { nom: "accueil", args: [] };
const rafraichir = () => aller(vueCourante.nom, ...vueCourante.args);
function aller(nom, ...args) {
  vueCourante = { nom, args };
  document.querySelectorAll("#menu button").forEach((b) =>
    b.classList.toggle("actif", b.dataset.vue === nom.split("-")[0])
  );
  $("#vue").innerHTML = "";
  VUES[nom](...args);
  majPastilleMenu();
  window.scrollTo(0, 0);
}
$("#menu").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-vue]");
  if (b) aller(b.dataset.vue);
});

/* ---------------- Rendez-vous ---------------- */
const TYPES_RDV = {
  rdv: "Rendez-vous",
  diagnostic: "Diagnostic du van",
  chantier: "Chantier",
  livraison: "Remise des clés",
  autre: "Autre",
};
const rdvAVenir = () =>
  db.rdv.filter((r) => (r.fin || r.debut).slice(0, 10) >= aujourdhui()).sort((a, b) => a.debut.localeCompare(b.debut));

function lienAgenda(r) {
  const c = client(r.clientId);
  const compact = (s) => s.replace(/[-:]/g, "");
  const dates = r.journee
    ? `${compact(r.debut)}/${compact(plusJours(r.fin || r.debut, 1))}`
    : `${compact(r.debut)}00/${compact(r.fin)}00`;
  const details = [
    c && `Client : ${nomComplet(c)}`,
    c?.tel && `Tél : ${c.tel}`,
    c?.email && `E-mail : ${c.email}`,
    c?.vehicule && `Véhicule : ${c.vehicule}${c.immat ? " (" + c.immat + ")" : ""}`,
    r.notes,
    c?.notes && `Notes client : ${c.notes}`,
  ].filter(Boolean).join("\n");
  const p = new URLSearchParams({ action: "TEMPLATE", text: r.titre, dates, ctz: "Europe/Paris", details, location: r.lieu || "" });
  if (db.reglages.compteAgenda) p.set("authuser", db.reglages.compteAgenda);
  return "https://calendar.google.com/calendar/render?" + p.toString();
}
function lienOuvrirAgenda() {
  const compte = db.reglages.compteAgenda;
  return "https://calendar.google.com/calendar/r" + (compte ? "?authuser=" + encodeURIComponent(compte) : "");
}
function horaire(r) {
  if (r.journee) return r.fin && r.fin !== r.debut ? `du ${dateFr(r.debut)} au ${dateFr(r.fin)}` : `${dateFr(r.debut)}, journée`;
  return `${dateFr(r.debut)}, ${r.debut.slice(11, 16).replace(":", "h")} – ${r.fin.slice(11, 16).replace(":", "h")}`;
}
function listeRdv(liste, avecClient = true) {
  if (!liste.length) return `<p class="note">Aucun rendez-vous prévu.</p>`;
  return `<ul class="liste-rdv">${liste.map((r) => `
    <li class="carte">
      <div class="rdv-quand"><strong>${esc(horaire(r))}</strong><span class="pastille">${esc(TYPES_RDV[r.type] || "Rendez-vous")}</span></div>
      <div>${esc(r.titre)}${avecClient && client(r.clientId) ? ` · <a href="#" data-client="${r.clientId}">${esc(nomComplet(client(r.clientId)))}</a>` : ""}</div>
      ${r.lieu ? `<div class="note">${esc(r.lieu)}</div>` : ""}
      <div class="actions" style="justify-content:flex-start;margin-top:.4rem">
        <a class="btn secondaire petit" href="${esc(lienAgenda(r))}" target="_blank" rel="noopener">Ajouter / revoir dans Google Agenda</a>
        <button class="btn danger petit" data-action="suppr-rdv" data-id="${r.id}">Retirer</button>
      </div>
    </li>`).join("")}</ul>`;
}

// Fenêtre « Planifier un rendez-vous » ; enregistre le rdv et ouvre Google Agenda pré-rempli
function ouvrirRdv(cid, apres) {
  const c = client(cid);
  const dlg = $("#fenetre");
  const r = db.reglages;
  const demain = plusJours(aujourdhui(), 1);
  const options = db.clients.slice().sort((a, b) => nomComplet(a).localeCompare(nomComplet(b), "fr"))
    .map((x) => `<option value="${x.id}" ${x.id === cid ? "selected" : ""}>${esc(nomComplet(x))}</option>`).join("");
  const adresseClient = c ? [c.adresse, [c.cp, c.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ") : "";
  $("#fenetre-form").innerHTML = `
    <h2 style="margin-top:0">Planifier un rendez-vous</h2>
    <div class="grille">
      <label class="plein">Client<select name="clientId" required><option value="">— Choisir —</option>${options}</select></label>
      <label>Type<select name="type">${Object.entries(TYPES_RDV).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
      <label>Date<input type="date" name="date" value="${demain}" required></label>
      <label class="case plein"><input type="checkbox" name="journee"> Toute la journée / plusieurs jours (chantier)</label>
      <label data-heure>Heure<input type="time" name="heure" value="09:00" step="900"></label>
      <label data-heure>Durée<select name="duree"><option value="30">30 min</option><option value="60" selected>1 h</option><option value="120">2 h</option><option value="240">Demi-journée (4 h)</option></select></label>
      <label data-jours hidden>Jusqu'au (inclus)<input type="date" name="fin" value="${demain}"></label>
      <label class="plein">Lieu<select name="lieuChoix">
        <option value="atelier">${esc(r.lieuAtelier || "Atelier")}</option>
        ${adresseClient ? `<option value="client">Chez le client : ${esc(adresseClient)}</option>` : ""}
      </select></label>
      <label class="plein">Note (facultatif)<input name="notes" placeholder="ex. apporter le van vide, prévoir les clés"></label>
    </div>
    <p class="note">Google Agenda s'ouvre ensuite avec le rendez-vous pré-rempli : il suffit de cliquer sur « Enregistrer ».</p>
    <p class="note erreur" id="erreur-rdv" role="alert"></p>
    <div class="barre-actions"><button class="btn" type="submit">Planifier</button><button class="btn secondaire" type="button" data-fermer>Annuler</button></div>`;
  const f = $("#fenetre-form");
  const majChamps = () => {
    const j = f.journee.checked;
    f.querySelectorAll("[data-heure]").forEach((x) => (x.hidden = j));
    f.querySelectorAll("[data-jours]").forEach((x) => (x.hidden = !j));
    if (j && f.fin.value < f.date.value) f.fin.value = f.date.value;
  };
  f.journee.addEventListener("change", majChamps);
  f.date.addEventListener("change", majChamps);
  f.type.addEventListener("change", () => { if (f.type.value === "chantier" && !f.journee.checked) { f.journee.checked = true; majChamps(); } });
  f.querySelector("[data-fermer]").addEventListener("click", () => dlg.close());
  f.onsubmit = (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    const err = $("#erreur-rdv");
    const cl = client(d.clientId);
    if (!cl) { err.textContent = "Choisissez un client."; return; }
    if (!d.date) { err.textContent = "Choisissez une date."; return; }
    const journee = !!d.journee;
    let debut, fin;
    if (journee) {
      debut = d.date;
      fin = d.fin && d.fin >= d.date ? d.fin : d.date;
    } else {
      if (!d.heure) { err.textContent = "Choisissez une heure."; return; }
      debut = `${d.date}T${d.heure}`;
      const fd = new Date(`${d.date}T${d.heure}:00`);
      fd.setMinutes(fd.getMinutes() + Number(d.duree || 60));
      fin = `${isoLocal(fd)}T${pad(fd.getHours())}:${pad(fd.getMinutes())}`;
    }
    const adr = [cl.adresse, [cl.cp, cl.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const rdv = {
      id: id(), clientId: cl.id, type: d.type, journee, debut, fin,
      titre: `${TYPES_RDV[d.type]} — ${nomComplet(cl)}${cl.vehicule ? " (" + cl.vehicule + ")" : ""}`,
      lieu: d.lieuChoix === "client" && adr ? adr : r.lieuAtelier,
      notes: (d.notes || "").trim(),
    };
    db.rdv.push(rdv);
    if (apres) apres(rdv);
    sauver();
    window.open(lienAgenda(rdv), "_blank", "noopener"); // dans le clic : pas bloqué par le navigateur
    dlg.close();
    rafraichir();
  };
  majChamps();
  dlg.showModal();
}

/* ---------------- Tableau de bord ---------------- */
VUES.accueil = () => {
  const prochains = rdvAVenir();
  const semaine = prochains.filter((r) => r.debut.slice(0, 10) <= plusJours(aujourdhui(), 7));
  const aExporter = db.clients.filter((c) => !c.exporteIndy).length;
  $("#vue").innerHTML = `
    <h1>Tableau de bord</h1>
    ${rappelSauvegarde() ? `<div class="alerte">Pensez à <a href="#" data-aller="reglages">exporter une sauvegarde</a> : les données ne sont que sur cet appareil.</div>` : ""}
    ${nouvellesDemandes() ? `<a href="#" class="alerte nouvelles" data-aller="demandes"><strong>${nouvellesDemandes()} nouvelle(s) demande(s)</strong> reçue(s) depuis le site → les voir</a>` : ""}
    <div class="tuiles">
      <a href="#" class="carte tuile" data-aller="demandes"><div class="libelle">Nouvelles demandes</div><div class="valeur">${nouvellesDemandes()}</div></a>
      <a href="#" class="carte tuile" data-aller="planning"><div class="libelle">Rendez-vous dans les 7 jours</div><div class="valeur">${semaine.length}</div></a>
      <a href="#" class="carte tuile" data-aller="clients"><div class="libelle">Clients</div><div class="valeur">${db.clients.length}</div></a>
      <a href="#" class="carte tuile" data-aller="clients"><div class="libelle">Clients pas encore dans Indy</div><div class="valeur">${aExporter}</div></a>
    </div>

    <div class="barre-actions">
      <button class="btn" data-action="nouveau-rdv">+ Rendez-vous</button>
      <button class="btn secondaire" data-action="nouveau-client">+ Client</button>
      <a class="btn secondaire" href="${URL_INDY}" target="_blank" rel="noopener">Ouvrir Indy (devis, factures)</a>
      <a class="btn secondaire" href="${esc(lienOuvrirAgenda())}" target="_blank" rel="noopener">Ouvrir Google Agenda</a>
    </div>

    <h2>Prochains rendez-vous</h2>
    ${listeRdv(prochains.slice(0, 5))}
    ${prochains.length > 5 ? `<p><a href="#" data-aller="planning">Voir les ${prochains.length} rendez-vous →</a></p>` : ""}
  `;
};

/* ---------------- Planning ---------------- */
VUES.planning = () => {
  const prochains = rdvAVenir();
  const parJour = {};
  prochains.forEach((r) => (parJour[r.debut.slice(0, 10)] ??= []).push(r));
  const passes = db.rdv.filter((r) => !prochains.includes(r)).sort((a, b) => b.debut.localeCompare(a.debut)).slice(0, 10);
  $("#vue").innerHTML = `
    <div class="entete">
      <h1>Planning</h1>
      <div class="actions">
        <a class="btn secondaire" href="${esc(lienOuvrirAgenda())}" target="_blank" rel="noopener">Ouvrir Google Agenda</a>
        <button class="btn" data-action="nouveau-rdv">+ Rendez-vous</button>
      </div>
    </div>
    <p class="note">Les rendez-vous planifiés depuis l'appli. Google Agenda reste la référence : un rendez-vous modifié ou supprimé là-bas ne se met pas à jour ici.</p>
    ${Object.keys(parJour).length ? Object.entries(parJour).map(([jour, liste]) => `
      <h2 class="jour">${jour === aujourdhui() ? "Aujourd'hui" : jour === plusJours(aujourdhui(), 1) ? "Demain" : esc(jourLong(jour))}</h2>
      ${listeRdv(liste)}`).join("") : `<div class="carte vide">Aucun rendez-vous à venir.</div>`}
    ${passes.length ? `<details style="margin-top:1.5rem"><summary>Rendez-vous passés (${passes.length})</summary>${listeRdv(passes)}</details>` : ""}
  `;
};

/* ---------------- Clients ---------------- */
VUES.clients = (filtre = "") => {
  const f = filtre.toLowerCase();
  const liste = db.clients
    .filter((c) => !f || [nomComplet(c), c.societe, c.tel, c.email, c.vehicule, c.immat, c.ville].join(" ").toLowerCase().includes(f))
    .sort((a, b) => (a.nom || a.prenom).localeCompare(b.nom || b.prenom, "fr"));
  const aExporter = db.clients.filter((c) => !c.exporteIndy).length;
  $("#vue").innerHTML = `
    <div class="entete">
      <h1>Clients</h1>
      <div class="actions">
        <input class="recherche" type="search" placeholder="Rechercher…" value="${esc(filtre)}" id="cherche-client">
        <button class="btn" data-action="nouveau-client">+ Nouveau client</button>
      </div>
    </div>
    ${db.clients.length ? `<div class="carte bloc-indy">
      <div><strong>Indy</strong> — ${aExporter ? `${aExporter} client(s) pas encore importé(s).` : "tous les clients sont importés."}</div>
      <div class="actions"><button class="btn secondaire petit" data-action="export-indy">Exporter pour Indy (CSV)</button>
      <a class="btn secondaire petit" href="${URL_INDY}" target="_blank" rel="noopener">Ouvrir Indy</a></div>
    </div>` : ""}
    ${liste.length ? `
    <table class="liste">
      <thead><tr><th>Nom</th><th class="cache-mobile">Contact</th><th>Véhicule</th><th class="cache-mobile">Indy</th></tr></thead>
      <tbody>${liste.map((c) => `
        <tr class="cliquable" data-client="${c.id}">
          <td><strong>${esc(nomComplet(c))}</strong>${c.ville ? `<br><span class="note">${esc(c.ville)}</span>` : ""}</td>
          <td class="cache-mobile">${esc(c.tel)}<br><span class="note">${esc(c.email)}</span></td>
          <td>${esc(c.vehicule)}${c.immat ? `<br><span class="note">${esc(c.immat)}</span>` : ""}</td>
          <td class="cache-mobile">${c.exporteIndy ? `<span class="pastille accepte">Importé</span>` : `<span class="pastille">À importer</span>`}</td>
        </tr>`).join("")}
      </tbody>
    </table>` : `<div class="carte vide">${filtre ? "Aucun client ne correspond." : "Pas encore de client. Ajoutez-en un, ou créez-le depuis une demande du site."}</div>`}
  `;
  const champ = $("#cherche-client");
  champ.addEventListener("input", () => {
    const pos = champ.selectionStart;
    VUES.clients(champ.value);
    const c2 = $("#cherche-client");
    c2.focus();
    c2.setSelectionRange(pos, pos);
  });
};

VUES["clients-fiche"] = (cid) => {
  const c = cid ? client(cid) : { ...CLIENT_VIDE };
  if (!c) return aller("clients");
  const rdv = db.rdv.filter((r) => r.clientId === cid).sort((a, b) => b.debut.localeCompare(a.debut));
  const demandes = db.demandes.filter((d) => d.clientId === cid);
  const v = (k) => esc(c[k]);
  $("#vue").innerHTML = `
    <div class="entete">
      <h1>${cid ? esc(nomComplet(c)) : "Nouveau client"}</h1>
      ${cid ? (c.exporteIndy ? `<span class="pastille accepte">Dans Indy depuis le ${dateFr(c.exporteIndy)}</span>` : `<span class="pastille">Pas encore dans Indy</span>`) : ""}
    </div>
    ${cid && (c.tel || c.email) ? `<div class="barre-actions" style="margin:0 0 1rem">
      ${c.tel ? `<a class="btn secondaire" href="tel:${esc(lienTel(c.tel))}">Appeler</a>` : ""}
      ${c.email ? `<a class="btn secondaire" href="mailto:${esc(c.email)}">E-mail</a>` : ""}
      <button class="btn" data-action="nouveau-rdv" data-pour="${cid}">Planifier un rendez-vous</button>
    </div>` : ""}
    <form id="form-client" class="carte" novalidate>
      <div class="grille">
        <label>Type<select name="type">
          <option value="particulier" ${c.type !== "pro" ? "selected" : ""}>Particulier</option>
          <option value="pro" ${c.type === "pro" ? "selected" : ""}>Professionnel</option></select></label>
        <label data-pro ${c.type === "pro" ? "" : "hidden"}>Société<input name="societe" value="${v("societe")}"></label>
        <label>Prénom<input name="prenom" value="${v("prenom")}" autocomplete="off"></label>
        <label>Nom *<input name="nom" value="${v("nom")}" autocomplete="off"></label>
        <label>Téléphone<input name="tel" type="tel" value="${v("tel")}"></label>
        <label>E-mail<input name="email" type="email" value="${v("email")}"></label>
        <label class="plein">Adresse<input name="adresse" value="${v("adresse")}" placeholder="N° et rue"></label>
        <label>Code postal<input name="cp" inputmode="numeric" value="${v("cp")}"></label>
        <label>Ville<input name="ville" value="${v("ville")}"></label>
        <label>Véhicule<input name="vehicule" value="${v("vehicule")}" placeholder="ex. Renault Trafic L2H1 2018"></label>
        <label>Immatriculation<input name="immat" value="${v("immat")}" placeholder="AA-123-BB"></label>
        <label class="plein">Notes<textarea name="notes" placeholder="Envies, contraintes, budget…">${v("notes")}</textarea></label>
      </div>
      <p class="note erreur" id="erreur-client" role="alert"></p>
      <div class="barre-actions">
        <button class="btn" type="submit">Enregistrer</button>
        <button class="btn secondaire" type="button" data-aller="clients">Retour</button>
        ${cid ? `<button class="btn secondaire" type="button" data-action="copier-indy" data-id="${cid}">Copier les infos pour Indy</button>
                 <button class="btn secondaire" type="button" data-action="marquer-indy" data-id="${cid}">${c.exporteIndy ? "Marquer « pas dans Indy »" : "Marquer « déjà dans Indy »"}</button>
                 <button class="btn danger" type="button" data-action="suppr-client" data-id="${cid}">Supprimer</button>` : ""}
      </div>
    </form>
    ${cid ? `
      <h2>Rendez-vous</h2>${listeRdv(rdv, false)}
      ${demandes.length ? `<h2>Demandes reçues du site</h2><ul class="liste-simple">${demandes.map((d) => `<li><a href="#" data-demande="${d.id}">${esc(infoDemande(d).type)} — ${dateHeure(d.date)}</a></li>`).join("")}</ul>` : ""}` : ""}
  `;
  const form = $("#form-client");
  form.type.addEventListener("change", () => (form.querySelector("[data-pro]").hidden = form.type.value !== "pro"));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    Object.keys(d).forEach((k) => (d[k] = String(d[k]).trim()));
    $("#erreur-client").textContent = "";
    if (!d.nom && !d.prenom && !d.societe) { $("#erreur-client").textContent = "Indiquez au moins un nom."; form.nom.focus(); return; }
    if (d.email && !form.email.checkValidity()) { $("#erreur-client").textContent = "L'adresse e-mail n'est pas valide."; form.email.focus(); return; }
    if (d.type !== "pro") d.societe = "";
    let cible = c;
    if (cid) Object.assign(c, d);
    else { cible = { ...CLIENT_VIDE, ...d, id: id() }; db.clients.push(cible); }
    sauver();
    aller("clients-fiche", cible.id);
  });
};

/* ---------------- Export vers Indy ---------------- */
// Indy importe les contacts depuis un fichier CSV séparé par des virgules
function csvIndy(liste) {
  const entetes = ["Type", "Société", "Prénom", "Nom", "E-mail", "Téléphone", "Adresse", "Code postal", "Ville", "Pays", "Notes"];
  const cell = (x) => {
    let s = String(x ?? "").replace(/\r?\n/g, " ").trim();
    if (/^[=+\-@]/.test(s)) s = "'" + s; // évite qu'un tableur l'exécute comme formule
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lignes = liste.map((c) => [
    c.type === "pro" ? "Professionnel" : "Particulier", c.societe, c.prenom, c.nom, c.email, c.tel,
    c.adresse, c.cp, c.ville, "France", [c.vehicule && `Véhicule : ${c.vehicule}`, c.immat && `Immat : ${c.immat}`].filter(Boolean).join(" · "),
  ]);
  return [entetes, ...lignes].map((l) => l.map(cell).join(",")).join("\r\n") + "\r\n";
}
function ouvrirExportIndy() {
  const dlg = $("#fenetre");
  const nouveaux = db.clients.filter((c) => !c.exporteIndy);
  $("#fenetre-form").innerHTML = `
    <h2 style="margin-top:0">Exporter les clients pour Indy</h2>
    <div class="grille">
      <label class="case plein"><input type="radio" name="quoi" value="nouveaux" ${nouveaux.length ? "checked" : "disabled"}> Seulement ceux pas encore dans Indy (${nouveaux.length})</label>
      <label class="case plein"><input type="radio" name="quoi" value="tous" ${nouveaux.length ? "" : "checked"}> Tous les clients (${db.clients.length})</label>
    </div>
    <ol class="etapes">
      <li>Téléchargez le fichier ci-dessous.</li>
      <li>Dans Indy, ouvrez la liste des clients (contacts) et choisissez <strong>Importer</strong>.</li>
      <li>Choisissez le fichier, vérifiez que chaque colonne correspond au bon champ, puis validez.</li>
    </ol>
    <p class="note">Les clients exportés sont marqués « dans Indy » pour ne pas les importer deux fois.</p>
    <div class="barre-actions"><button class="btn" type="submit">Télécharger le fichier</button><button class="btn secondaire" type="button" data-fermer>Fermer</button></div>`;
  const f = $("#fenetre-form");
  f.querySelector("[data-fermer]").addEventListener("click", () => dlg.close());
  f.onsubmit = (e) => {
    e.preventDefault();
    const liste = f.quoi.value === "tous" ? db.clients : nouveaux;
    if (!liste.length) return dlg.close();
    telecharger(`clients-indy-${aujourdhui()}.csv`, csvIndy(liste), "text/csv");
    liste.forEach((c) => (c.exporteIndy = c.exporteIndy || aujourdhui()));
    sauver();
    dlg.close();
    aller("clients");
  };
  dlg.showModal();
}
function texteIndy(c) {
  return [
    c.societe && `Société : ${c.societe}`, `Prénom : ${c.prenom}`, `Nom : ${c.nom}`, `E-mail : ${c.email}`, `Téléphone : ${c.tel}`,
    `Adresse : ${c.adresse}`, `Code postal : ${c.cp}`, `Ville : ${c.ville}`,
  ].filter(Boolean).join("\n");
}
function copier(texte, bouton, libelle) {
  const fini = () => { bouton.textContent = "Copié ✓"; setTimeout(() => (bouton.textContent = libelle), 2500); };
  const repli = () => {
    const t = document.createElement("textarea");
    t.value = texte; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); fini();
  };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(texte).then(fini, repli);
  else repli();
}

/* ---------------- Demandes reçues depuis le site ---------------- */
// Lecture d'une valeur de la demande (ignore les champs vides ou « — »)
function champ(dem, ...cles) {
  for (const k of cles) {
    const v = String(dem.champs?.[k] ?? "").trim();
    if (v && v !== "—" && v !== "-") return v;
  }
  return "";
}
const infoDemande = (dem) => ({
  nom: champ(dem, "Nom") || "Sans nom",
  email: champ(dem, "email", "E-mail"),
  tel: champ(dem, "Téléphone"),
  type: champ(dem, "Type de demande") || "Demande",
  vehicule: champ(dem, "Véhicule", "Gabarit", "Fourgon"),
  message: champ(dem, "Message", "Message du client"),
  ref: champ(dem, "Référence"),
  prestations: champ(dem, "Prestations"),
  budget: champ(dem, "Budget global"),
});
function clientDeDemande(dem) {
  if (dem.clientId && client(dem.clientId)) return client(dem.clientId);
  const i = infoDemande(dem);
  return db.clients.find((c) =>
    (i.email && c.email && c.email.trim().toLowerCase() === i.email.toLowerCase()) ||
    (chiffres(i.tel).length >= 9 && chiffres(c.tel).length >= 9 && chiffres(c.tel).slice(-9) === chiffres(i.tel).slice(-9))
  );
}
const nouvellesDemandes = () => db.demandes.filter((d) => d.statut === "nouvelle").length;
function majPastilleMenu() {
  const b = $('#menu button[data-vue="demandes"] .compteur');
  if (!b) return;
  const n = nouvellesDemandes();
  b.textContent = n;
  b.hidden = !n;
}

let synchroEnCours = null;
let erreurSynchro = "";
// Va chercher les nouvelles demandes sur le script Google. Renvoie le nombre de nouveautés.
function synchroDemandes() {
  const r = db.reglages;
  if (!r.urlDemandes || !r.cleDemandes) return Promise.resolve(0);
  if (synchroEnCours) return synchroEnCours;
  synchroEnCours = (async () => {
    const stop = new AbortController();
    const minuteur = setTimeout(() => stop.abort(), 20000);
    try {
      const url = `${r.urlDemandes}?cle=${encodeURIComponent(r.cleDemandes)}&depuis=${Number(r.dernierIdDemande) || 0}`;
      const rep = await fetch(url, { signal: stop.signal, cache: "no-store" });
      const json = await rep.json();
      if (!json.ok) throw new Error(json.erreur === "cle" ? "Clé refusée : le code du script Google ne correspond pas à cet appareil." : "Réponse invalide du script Google.");
      let ajout = 0;
      for (const d of json.demandes || []) {
        const idNum = Number(d.id);
        if (!idNum || db.demandes.some((x) => x.id === idNum)) continue;
        db.demandes.push({ id: idNum, date: d.date, champs: d.champs || {}, statut: "nouvelle" });
        r.dernierIdDemande = Math.max(Number(r.dernierIdDemande) || 0, idNum);
        ajout++;
      }
      r.derniereSynchro = new Date().toISOString();
      erreurSynchro = "";
      sauver();
      return ajout;
    } catch (e) {
      erreurSynchro = e.name === "AbortError" ? "Le script Google ne répond pas (réseau ?)."
        : e instanceof SyntaxError ? "L'adresse du script ne renvoie pas les demandes. Vérifiez qu'elle finit par /exec et que l'accès est « Tout le monde »."
        : navigator.onLine === false ? "Pas de connexion internet : les demandes seront récupérées au retour du réseau."
        : e instanceof TypeError ? "Impossible de joindre le script Google. Vérifiez la connexion internet et l'adresse du script."
        : e.message || "Erreur de connexion.";
      return 0;
    } finally {
      clearTimeout(minuteur);
      synchroEnCours = null;
      majPastilleMenu();
    }
  })();
  return synchroEnCours;
}

VUES.demandes = (filtre = "nouvelle") => {
  const r = db.reglages;
  const configure = r.urlDemandes && r.cleDemandes;
  const liste = db.demandes
    .filter((d) => filtre === "toutes" || d.statut === filtre)
    .sort((a, b) => b.id - a.id);
  const onglet = (k, t) => `<button class="btn ${filtre === k ? "" : "secondaire"} petit" data-filtre-demandes="${k}">${t}</button>`;
  $("#vue").innerHTML = `
    <div class="entete">
      <h1>Demandes du site</h1>
      ${configure ? `<button class="btn" data-action="actualiser-demandes">Actualiser</button>` : ""}
    </div>
    ${!configure ? `<div class="alerte">Les demandes du site n'arrivent pas encore ici. Suivez les étapes dans <a href="#" data-aller="reglages">Réglages → Recevoir les demandes du site</a> (gratuit, 5 minutes).</div>` : ""}
    ${erreurSynchro ? `<div class="alerte">${esc(erreurSynchro)}</div>` : ""}
    ${configure ? `<p class="note" id="etat-synchro">Dernière vérification : ${dateHeure(r.derniereSynchro)}</p>` : ""}
    <div class="barre-actions" style="margin:0 0 1rem">
      ${onglet("nouvelle", `Nouvelles (${nouvellesDemandes()})`)}${onglet("traitee", "Traitées")}${onglet("toutes", "Toutes")}
    </div>
    ${liste.length ? `<div class="cartes-demandes">${liste.map((d) => {
      const i = infoDemande(d);
      return `<article class="carte demande cliquable" data-demande="${d.id}">
        <div class="entete"><strong>${esc(i.nom)}</strong>${d.statut === "nouvelle" ? `<span class="pastille envoye">Nouvelle</span>` : `<span class="pastille accepte">Traitée</span>`}</div>
        <div class="note">${esc(i.type)} · ${dateHeure(d.date)}${i.ref ? ` · ${esc(i.ref)}` : ""}</div>
        ${i.vehicule ? `<div>${esc(i.vehicule)}</div>` : ""}
        ${i.message ? `<p class="extrait">${esc(i.message)}</p>` : ""}
      </article>`;
    }).join("")}</div>`
    : `<div class="carte vide">${filtre === "nouvelle" ? "Aucune nouvelle demande." : "Aucune demande."}</div>`}
  `;
};

VUES["demandes-fiche"] = (did) => {
  const dem = db.demandes.find((d) => d.id === Number(did));
  if (!dem) return aller("demandes");
  const i = infoDemande(dem);
  const cli = clientDeDemande(dem);
  const lignes = Object.entries(dem.champs || {}).filter(([k]) => !k.startsWith("_"));
  const tel = lienTel(i.tel);
  $("#vue").innerHTML = `
    <div class="entete">
      <h1>${esc(i.nom)}</h1>
      ${dem.statut === "nouvelle" ? `<span class="pastille envoye">Nouvelle</span>` : `<span class="pastille accepte">Traitée</span>`}
    </div>
    <p class="note">${esc(i.type)} · reçue le ${dateHeure(dem.date)}</p>
    <div class="barre-actions" style="margin:0 0 1rem">
      ${tel ? `<a class="btn secondaire" href="tel:${esc(tel)}">Appeler ${esc(i.tel)}</a>` : ""}
      ${i.email ? `<a class="btn secondaire" href="mailto:${esc(i.email)}?subject=${encodeURIComponent("Votre demande — Aménag'Van")}">Écrire un e-mail</a>` : ""}
    </div>
    <div class="carte">
      <dl class="details">${lignes.map(([k, v]) => `<dt>${esc(k === "email" ? "E-mail" : k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
    </div>
    <div class="barre-actions">
      ${cli ? `<button class="btn secondaire" data-client="${cli.id}">Fiche client : ${esc(nomComplet(cli))}</button>`
            : `<button class="btn secondaire" data-action="demande-client" data-id="${dem.id}">Créer le client</button>`}
      <button class="btn" data-action="demande-rdv" data-id="${dem.id}">Planifier un rendez-vous</button>
      <a class="btn secondaire" href="${URL_INDY}" target="_blank" rel="noopener">Faire le devis dans Indy</a>
      ${dem.statut === "nouvelle"
        ? `<button class="btn secondaire" data-action="demande-traitee" data-id="${dem.id}">Marquer traitée</button>`
        : `<button class="btn secondaire" data-action="demande-nouvelle" data-id="${dem.id}">Remettre en « nouvelle »</button>`}
      <button class="btn secondaire" data-aller="demandes">Retour</button>
    </div>
    ${cli && !dem.clientId ? `<p class="note">Client déjà connu (même e-mail ou même téléphone).</p>` : ""}
  `;
};

// Crée (ou retrouve) le client correspondant à une demande
function creerClientDepuisDemande(dem) {
  const existant = clientDeDemande(dem);
  if (existant) { dem.clientId = existant.id; return existant; }
  const i = infoDemande(dem);
  const mots = i.nom === "Sans nom" ? [] : i.nom.split(/\s+/);
  const notes = [i.type, i.prestations && `Prestations : ${i.prestations}`, i.budget && `Budget estimé : ${i.budget}`, i.message, i.ref && `Réf. site : ${i.ref}`].filter(Boolean).join("\n");
  const c = {
    ...CLIENT_VIDE, id: id(),
    prenom: mots.length > 1 ? mots[0] : "", nom: mots.length > 1 ? mots.slice(1).join(" ") : mots[0] || "Sans nom",
    tel: i.tel, email: i.email, vehicule: i.vehicule, notes,
  };
  db.clients.push(c);
  dem.clientId = c.id;
  return c;
}

/* ---------------- Réglages & sauvegarde ---------------- */
VUES.reglages = () => {
  const r = db.reglages;
  if (!r.cleDemandes) { r.cleDemandes = cleAleatoire(); sauver(); }
  const champR = (k, label, extra = "") => `<label>${label}<input name="${k}" value="${esc(r[k])}" ${extra}></label>`;
  $("#vue").innerHTML = `
    <h1>Réglages</h1>
    <form id="form-reglages" class="carte" novalidate>
      <h2 style="margin-top:0">Agenda</h2>
      <div class="grille">
        ${champR("compteAgenda", "Compte Google de l'agenda", "type='email' placeholder='ethan79pro@gmail.com'")}
        ${champR("lieuAtelier", "Lieu par défaut des rendez-vous")}
        <label class="plein">Lien de votre page de prise de rendez-vous Google (facultatif)<input name="urlRdv" type="url" value="${esc(r.urlRdv)}" placeholder="https://calendar.app.google/…"></label>
      </div>
      <p class="note">Les rendez-vous s'ajoutent dans le Google Agenda de ce compte (il doit être connecté dans le navigateur). La page de prise de rendez-vous se crée dans Google Agenda → Créer → Planning des rendez-vous ; Claude peut la mettre sur le site.</p>
      <p class="note erreur" id="erreur-reglages" role="alert"></p>
      <div class="barre-actions"><button class="btn" type="submit">Enregistrer</button></div>
    </form>

    <h2 id="connexion-site">Recevoir les demandes du site</h2>
    <div class="carte">
      ${r.urlDemandes
        ? `<p><strong>Connecté.</strong> Les demandes du site arrivent dans l'onglet « Demandes ». Dernière vérification : ${dateHeure(r.derniereSynchro)}.</p>`
        : `<p>Gratuit : un petit script Google range chaque demande du site dans un tableau Google Sheets, et l'appli vient les chercher. Les e-mails continuent d'arriver comme avant.</p>`}
      <details ${r.urlDemandes ? "" : "open"}>
        <summary>Mise en place (une seule fois, 5 minutes)</summary>
        <ol class="etapes">
          <li>Sur <strong>sheets.google.com</strong> (connecté au compte Google de l'atelier), créez une feuille vide nommée « Demandes Aménag'Van ».</li>
          <li>Menu <strong>Extensions → Apps Script</strong>. Effacez tout le code présent.</li>
          <li>Collez ce code, puis cliquez sur l'icône 💾 Enregistrer :
            <textarea id="code-script" readonly rows="6" spellcheck="false">${esc(window.codeScriptGoogle ? window.codeScriptGoogle(r.cleDemandes) : "")}</textarea>
            <button type="button" class="btn secondaire petit" data-action="copier-script">Copier le code</button>
          </li>
          <li><strong>Déployer → Nouveau déploiement</strong> → type « Application Web ». « Exécuter en tant que » : <em>Moi</em> ; « Qui a accès » : <em>Tout le monde</em>. Cliquez sur Déployer et autorisez l'accès (Google affiche un avertissement : « Paramètres avancés » → « Accéder au projet »).</li>
          <li>Copiez l'<strong>URL de l'application Web</strong> (elle finit par <code>/exec</code>) et collez-la ci-dessous.</li>
          <li>Envoyez aussi cette URL à Claude : il l'ajoute au site (fichier <code>site/js/config.js</code>).</li>
        </ol>
      </details>
      <form id="form-connexion" class="grille" style="margin-top:1rem" novalidate>
        <label class="plein">URL du script Google<input name="urlDemandes" type="url" inputmode="url" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(r.urlDemandes)}"></label>
        <div class="barre-actions plein" style="margin-top:0">
          <button class="btn" type="submit">Enregistrer et tester</button>
          ${r.urlDemandes ? `<button class="btn danger" type="button" data-action="deconnecter-site">Déconnecter</button>` : ""}
        </div>
        <p class="note plein" id="resultat-connexion" role="status"></p>
      </form>
      <p class="note">Sur un 2e appareil : restaurez une sauvegarde de celui-ci, l'adresse et la clé secrète sont incluses.</p>
    </div>

    <h2>Installer sur téléphone ou tablette</h2>
    <div class="carte">
      ${estInstallee() ? `<p><strong>L'appli est installée sur cet appareil.</strong> Elle marche même sans réseau.</p>` : `
      <p>Ouvrez <strong>amenagvan.github.io/gestion</strong> sur l'appareil, puis :</p>
      <ul>
        <li><strong>iPhone / iPad (Safari)</strong> : bouton Partager → « Sur l'écran d'accueil ».</li>
        <li><strong>Android (Chrome)</strong> : menu ⋮ → « Installer l'application » (ou « Ajouter à l'écran d'accueil »).</li>
        <li><strong>Ordinateur (Chrome / Edge)</strong> : icône d'installation à droite de la barre d'adresse.</li>
      </ul>
      ${invitationInstall ? `<button class="btn" data-action="installer">Installer maintenant</button>` : ""}`}
      <p class="note">Une fois installée, l'appli s'ouvre en plein écran depuis son icône et fonctionne hors ligne (dans l'atelier, au garage…).</p>
    </div>

    <h2>Sauvegarde</h2>
    <div class="carte">
      <p>Les données sont gardées <strong>sur cet appareil uniquement</strong>. Chaque appareil a donc ses propres données. Exportez une sauvegarde régulièrement (dans OneDrive ou Google Drive par exemple).</p>
      <p class="note"><strong>Passer de l'ordi à la tablette</strong> : « Exporter une sauvegarde » sur l'ancien appareil, envoyez-vous le fichier (e-mail, Drive…), puis « Restaurer une sauvegarde » sur le nouveau.</p>
      <p class="note">Dernière sauvegarde exportée : ${r.derniereSauvegarde ? dateFr(r.derniereSauvegarde) : "jamais"}.</p>
      <div class="barre-actions">
        <button class="btn" data-action="export">Exporter une sauvegarde</button>
        <label class="btn secondaire" style="flex-direction:row;color:var(--vert)">Restaurer une sauvegarde<input type="file" accept=".json,application/json" id="import" hidden></label>
        <button class="btn secondaire" data-action="demo">Charger des données d'essai</button>
        <button class="btn danger" data-action="tout-effacer">Tout effacer</button>
      </div>
    </div>`;
  $("#form-reglages").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    const d = Object.fromEntries(new FormData(f));
    Object.keys(d).forEach((k) => (d[k] = String(d[k]).trim()));
    if (d.compteAgenda && !f.compteAgenda.checkValidity()) { $("#erreur-reglages").textContent = "Le compte Google doit être une adresse e-mail."; return; }
    if (d.urlRdv && !/^https:\/\/\S+$/.test(d.urlRdv)) { $("#erreur-reglages").textContent = "Le lien de prise de rendez-vous doit commencer par https://"; return; }
    Object.assign(r, d);
    sauver();
    $("#erreur-reglages").textContent = "";
    const b = f.querySelector('button[type="submit"]');
    b.textContent = "Enregistré ✓";
    setTimeout(() => (b.textContent = "Enregistrer"), 2000);
  });
  $("#form-connexion").addEventListener("submit", async (e) => {
    e.preventDefault();
    const sortie = $("#resultat-connexion");
    const url = new FormData(e.target).get("urlDemandes").trim();
    if (url && !/^https:\/\/script\.google(usercontent)?\.com\/.+/.test(url)) {
      sortie.textContent = "Cette adresse ne ressemble pas à une URL de script Google (https://script.google.com/macros/s/…/exec).";
      return;
    }
    r.urlDemandes = url;
    sauver();
    if (!url) { sortie.textContent = "Adresse effacée."; return; }
    sortie.textContent = "Test en cours…";
    const n = await synchroDemandes();
    sortie.textContent = erreurSynchro ? `Échec : ${erreurSynchro}` : `Connexion réussie ✓ ${n ? `${n} demande(s) récupérée(s).` : "Aucune demande pour l'instant."}`;
  });
  $("#import").addEventListener("change", async (e) => {
    const fichier = e.target.files[0];
    if (!fichier) return;
    try {
      const d = JSON.parse(await fichier.text());
      if (!d.reglages || !Array.isArray(d.clients)) throw new Error("format");
      if (!confirm("Remplacer toutes les données actuelles par cette sauvegarde ?")) return;
      localStorage.setItem(CLE, JSON.stringify(d));
      db = charger();
      aller("accueil");
    } catch {
      alert("Ce fichier n'est pas une sauvegarde valide.");
    }
  });
};

async function telecharger(nom, contenu, type) {
  // Sur téléphone/tablette : menu « Partager » (Drive, OneDrive, e-mail, AirDrop…)
  const fichier = new File([contenu], nom, { type });
  if (window.matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [fichier] })) {
    try { await navigator.share({ files: [fichier], title: nom }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([contenu], { type }));
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function chargerDemo() {
  const c1 = { ...CLIENT_VIDE, id: id(), prenom: "Julie", nom: "Martin", tel: "06 11 22 33 44", email: "julie@example.com", adresse: "3 rue des Lilas", cp: "79700", ville: "Mauléon", vehicule: "Renault Trafic L2H1 2018", immat: "AB-123-CD", notes: "Veut partir en juillet." };
  const c2 = { ...CLIENT_VIDE, id: id(), type: "pro", societe: "Vans de l'Ouest", prenom: "Karim", nom: "Benali", tel: "06 55 66 77 88", email: "karim@example.com", adresse: "12 av. de Nantes", cp: "49300", ville: "Cholet", vehicule: "Fiat Ducato L3H2", immat: "EF-456-GH", exporteIndy: plusJours(aujourdhui(), -3) };
  db.clients.push(c1, c2);
  const j1 = plusJours(aujourdhui(), 2), j2 = plusJours(aujourdhui(), 9);
  db.rdv.push(
    { id: id(), clientId: c1.id, type: "diagnostic", journee: false, debut: `${j1}T10:00`, fin: `${j1}T11:00`, titre: `Diagnostic du van — Julie Martin (${c1.vehicule})`, lieu: db.reglages.lieuAtelier, notes: "" },
    { id: id(), clientId: c2.id, type: "chantier", journee: true, debut: j2, fin: plusJours(j2, 4), titre: "Chantier — Karim Benali (Fiat Ducato L3H2)", lieu: db.reglages.lieuAtelier, notes: "Chauffage gaz" },
  );
  sauver();
}

/* ---------------- Clics globaux ---------------- */
document.addEventListener("click", (e) => {
  const lien = e.target.closest("[data-aller]");
  if (lien) { e.preventDefault(); return aller(lien.dataset.aller); }
  const carte = e.target.closest("[data-demande]");
  if (carte) { e.preventDefault(); return aller("demandes-fiche", carte.dataset.demande); }
  const ligne = e.target.closest("[data-client]");
  if (ligne) { e.preventDefault(); return aller("clients-fiche", ligne.dataset.client); }
  const f = e.target.closest("[data-filtre-demandes]");
  if (f) return aller("demandes", f.dataset.filtreDemandes);
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const a = b.dataset.action;
  const cible = b.dataset.id;

  if (a === "nouveau-client") aller("clients-fiche");
  if (a === "nouveau-rdv") {
    if (!db.clients.length) { alert("Ajoutez d'abord un client."); return aller("clients-fiche"); }
    ouvrirRdv(b.dataset.pour);
  }
  if (a === "suppr-rdv" && confirm("Retirer ce rendez-vous de l'appli ? (Pensez à le supprimer aussi dans Google Agenda.)")) {
    db.rdv = db.rdv.filter((r) => r.id !== cible);
    sauver();
    rafraichir();
  }
  if (a === "suppr-client") {
    if (!confirm("Supprimer ce client et ses rendez-vous de l'appli ? (Il reste dans Indy s'il y a été importé.)")) return;
    db.clients = db.clients.filter((c) => c.id !== cible);
    db.rdv = db.rdv.filter((r) => r.clientId !== cible);
    db.demandes.forEach((d) => { if (d.clientId === cible) delete d.clientId; });
    sauver(); aller("clients");
  }
  if (a === "export-indy") ouvrirExportIndy();
  if (a === "copier-indy") { const c = client(cible); if (c) copier(texteIndy(c), b, b.textContent); }
  if (a === "marquer-indy") {
    const c = client(cible);
    if (c) { c.exporteIndy = c.exporteIndy ? "" : aujourdhui(); sauver(); aller("clients-fiche", c.id); }
  }

  // Demandes
  if (a === "actualiser-demandes") {
    b.disabled = true;
    b.textContent = "Vérification…";
    synchroDemandes().then((n) => {
      if (!$('[data-action="actualiser-demandes"]')) return; // l'utilisateur a changé d'écran
      aller("demandes");
      const etat = $("#etat-synchro");
      if (etat && !erreurSynchro) etat.textContent += n ? ` — ${n} nouvelle(s) demande(s)` : " — rien de nouveau";
    });
  }
  const dem = cible && a.startsWith("demande-") && db.demandes.find((d) => d.id === Number(cible));
  if (dem) {
    if (a === "demande-client") { const c = creerClientDepuisDemande(dem); sauver(); aller("clients-fiche", c.id); }
    if (a === "demande-rdv") {
      const c = creerClientDepuisDemande(dem);
      sauver();
      aller("demandes-fiche", dem.id);
      ouvrirRdv(c.id, () => { dem.statut = "traitee"; }); // « traitée » seulement si le rdv est planifié
    }
    if (a === "demande-traitee") { dem.statut = "traitee"; sauver(); aller("demandes"); }
    if (a === "demande-nouvelle") { dem.statut = "nouvelle"; sauver(); aller("demandes-fiche", dem.id); }
  }

  // Réglages
  if (a === "installer") installer();
  if (a === "copier-script") copier($("#code-script").value, b, "Copier le code");
  if (a === "deconnecter-site" && confirm("Ne plus recevoir les demandes du site dans cette appli ?")) {
    db.reglages.urlDemandes = "";
    sauver();
    aller("reglages");
  }
  if (a === "export") {
    db.reglages.derniereSauvegarde = aujourdhui();
    sauver();
    telecharger(`sauvegarde-gestion-${aujourdhui()}.json`, JSON.stringify(db, null, 2), "application/json");
    if ($("#form-reglages")) setTimeout(() => aller("reglages"), 300);
  }
  if (a === "demo") { chargerDemo(); aller("accueil"); }
  if (a === "tout-effacer" && confirm("Effacer TOUTES les données ? Exportez une sauvegarde avant.") && confirm("Vraiment tout effacer ?")) {
    localStorage.removeItem(CLE); db = base(); aller("accueil");
  }
});

// Clé secrète propre à l'atelier (copiée dans le script Google)
function cleAleatoire() {
  const t = new Uint8Array(18);
  crypto.getRandomValues(t);
  return Array.from(t, (x) => x.toString(16).padStart(2, "0")).join("");
}

/* ---------------- Appli installable (PWA) ---------------- */
let invitationInstall = null;
function estInstallee() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}
async function installer() {
  if (!invitationInstall) return;
  invitationInstall.prompt();
  await invitationInstall.userChoice;
  invitationInstall = null;
  $("#bandeau-installer").hidden = true;
}
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  invitationInstall = e;
  if (localStorage.getItem(CLE + "-pas-installer") !== aujourdhui()) $("#bandeau-installer").hidden = false;
});
window.addEventListener("appinstalled", () => { $("#bandeau-installer").hidden = true; invitationInstall = null; });
$("#btn-installer").addEventListener("click", installer);
$("#btn-installer-non").addEventListener("click", () => {
  $("#bandeau-installer").hidden = true;
  localStorage.setItem(CLE + "-pas-installer", aujourdhui());
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch((e) => console.warn("Mode hors ligne indisponible :", e));
}
// Demande au navigateur de ne jamais effacer les données de l'appli tout seul
navigator.storage?.persist?.();

function synchroAuto() {
  synchroDemandes().then((n) => {
    if (!n) return;
    const vue = $("#menu .actif")?.dataset.vue;
    if (vue === "accueil" || (vue === "demandes" && !$(".details"))) aller(vue);
  });
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") synchroAuto(); });
window.addEventListener("online", synchroAuto);

// Rappel de sauvegarde si la dernière date de plus de 14 jours
function rappelSauvegarde() {
  const d = db.reglages.derniereSauvegarde;
  const ancien = !d || plusJours(d, 14) < aujourdhui();
  return ancien && (db.clients.length || db.rdv.length) ? true : false;
}

aller("accueil");
synchroAuto();
