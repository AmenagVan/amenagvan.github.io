/* ==========================================================
   Aménag'Van — appli de gestion (bêta)
   Tout est stocké dans le navigateur (localStorage) : rien ne
   part sur Internet. Pensez à « Exporter une sauvegarde ».
   ========================================================== */
"use strict";

const CLE = "amenagvan-gestion-v1";
const TARIFS = window.TARIFS || { taux: 40, tvaMention: "TVA non applicable, art. 293 B du CGI" };

/* ---------------- Données ---------------- */
function base() {
  return {
    reglages: {
      nom: "Aménag'Van",
      responsable: "",
      adresse: "",
      cpVille: "79700 Mauléon",
      siret: "",
      tel: "07 57 57 03 90",
      email: "ethan79pro@gmail.com",
      taux: TARIFS.taux,
      validite: 30,
      delai: 30,
      iban: "",
      prochainDevis: 1,
      prochaineFacture: 1,
    },
    clients: [],
    devis: [],
    factures: [],
  };
}

let db = charger();
function charger() {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return base();
    const d = JSON.parse(brut);
    const b = base();
    return { ...b, ...d, reglages: { ...b.reglages, ...d.reglages } };
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
const euros = (n) => (Number(n) || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const nb = (v) => { const n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : 0; };
const aujourdhui = () => new Date().toISOString().slice(0, 10);
const dateFr = (iso) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("fr-FR") : "—");
function plusJours(iso, j) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + Number(j || 0));
  return d.toISOString().slice(0, 10);
}
const client = (cid) => db.clients.find((c) => c.id === cid);
const nomClient = (cid) => client(cid)?.nom || "Client supprimé";
function numero(prefixe, n, date) {
  return `${prefixe}-${(date || aujourdhui()).slice(0, 4)}-${String(n).padStart(3, "0")}`;
}

const TYPES = {
  mo: "Main d'œuvre (h)",
  forfait: "Prestation forfait",
  info: "Matériel client (info)",
};
function totalLigne(l) {
  return l.type === "info" ? 0 : Math.round(nb(l.qte) * nb(l.pu) * 100) / 100;
}
function total(doc) {
  return doc.lignes.reduce((s, l) => s + totalLigne(l), 0);
}
function heures(doc) {
  return doc.lignes.filter((l) => l.type === "mo").reduce((s, l) => s + nb(l.qte), 0);
}
function enRetard(f) {
  return !f.payee && f.echeance && f.echeance < aujourdhui();
}

const STATUTS_DEVIS = { brouillon: "Brouillon", envoye: "Envoyé", accepte: "Accepté", refuse: "Refusé" };
const pastilleDevis = (d) => `<span class="pastille ${d.statut}">${STATUTS_DEVIS[d.statut]}</span>`;
const pastilleFacture = (f) =>
  f.payee
    ? `<span class="pastille payee">Payée le ${dateFr(f.datePaiement)}</span>`
    : enRetard(f)
    ? `<span class="pastille retard">En retard</span>`
    : `<span class="pastille impayee">À encaisser</span>`;

/* ---------------- Navigation ---------------- */
const VUES = {};
function aller(nom, ...args) {
  document.querySelectorAll("#menu button").forEach((b) =>
    b.classList.toggle("actif", b.dataset.vue === nom.split("-")[0])
  );
  $("#vue").innerHTML = "";
  VUES[nom](...args);
  window.scrollTo(0, 0);
}
$("#menu").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-vue]");
  if (b) aller(b.dataset.vue);
});

/* ---------------- Tableau de bord ---------------- */
VUES.accueil = () => {
  const an = aujourdhui().slice(0, 4);
  const facturesAn = db.factures.filter((f) => f.date.startsWith(an));
  const encaisse = facturesAn.filter((f) => f.payee).reduce((s, f) => s + total(f), 0);
  const aEncaisser = db.factures.filter((f) => !f.payee).reduce((s, f) => s + total(f), 0);
  const retards = db.factures.filter(enRetard);
  const devisOuverts = db.devis.filter((d) => d.statut === "envoye");
  const hAn = facturesAn.reduce((s, f) => s + heures(f), 0);
  const r = db.reglages;
  const incomplet = !r.siret || !r.responsable || !r.adresse;

  $("#vue").innerHTML = `
    <h1>Tableau de bord</h1>
    ${rappelSauvegarde() ? `<div class="alerte">Pensez à <a href="#" data-aller="reglages">exporter une sauvegarde</a> : les données ne sont que sur cet appareil.</div>` : ""}
    ${incomplet ? `<div class="alerte">Pour des devis et factures valables, complétez <a href="#" data-aller="reglages">vos réglages</a> (nom du responsable, adresse, SIRET).</div>` : ""}
    <div class="tuiles">
      <div class="carte tuile"><div class="libelle">Encaissé en ${an}</div><div class="valeur">${euros(encaisse)}</div></div>
      <div class="carte tuile"><div class="libelle">Reste à encaisser</div><div class="valeur">${euros(aEncaisser)}</div></div>
      <div class="carte tuile"><div class="libelle">Devis en attente de réponse</div><div class="valeur">${devisOuverts.length}</div></div>
      <div class="carte tuile"><div class="libelle">Heures facturées en ${an}</div><div class="valeur">${hAn.toLocaleString("fr-FR")} h</div></div>
    </div>
    <p class="note">Micro-entreprise : le chiffre d'affaires à déclarer à l'Urssaf, c'est ce qui est <strong>encaissé</strong>, pas ce qui est facturé.</p>

    <div class="barre-actions">
      <button class="btn" data-action="nouveau-devis">+ Nouveau devis</button>
      <button class="btn secondaire" data-action="nouveau-client">+ Nouveau client</button>
    </div>

    <h2>Factures en retard</h2>
    ${retards.length ? tableFactures(retards) : `<p class="note">Aucune, tout va bien.</p>`}

    <h2>Devis envoyés, sans réponse</h2>
    ${devisOuverts.length ? tableDevis(devisOuverts) : `<p class="note">Aucun.</p>`}
  `;
};

/* ---------------- Clients ---------------- */
VUES.clients = (filtre = "") => {
  const f = filtre.toLowerCase();
  const liste = db.clients
    .filter((c) => !f || [c.nom, c.tel, c.email, c.vehicule, c.immat].join(" ").toLowerCase().includes(f))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  $("#vue").innerHTML = `
    <div class="entete">
      <h1>Clients</h1>
      <div class="actions">
        <input class="recherche" type="search" placeholder="Rechercher…" value="${esc(filtre)}" id="cherche-client">
        <button class="btn" data-action="nouveau-client">+ Nouveau client</button>
      </div>
    </div>
    ${liste.length ? `
    <table class="liste">
      <thead><tr><th>Nom</th><th class="cache-mobile">Contact</th><th>Véhicule</th><th class="num cache-mobile">Facturé</th></tr></thead>
      <tbody>${liste.map((c) => `
        <tr class="cliquable" data-client="${c.id}">
          <td><strong>${esc(c.nom)}</strong></td>
          <td class="cache-mobile">${esc(c.tel)}<br><span class="note">${esc(c.email)}</span></td>
          <td>${esc(c.vehicule)}${c.immat ? `<br><span class="note">${esc(c.immat)}</span>` : ""}</td>
          <td class="num cache-mobile">${euros(db.factures.filter((x) => x.clientId === c.id).reduce((s, x) => s + total(x), 0))}</td>
        </tr>`).join("")}
      </tbody>
    </table>` : `<div class="carte vide">${filtre ? "Aucun client ne correspond." : "Pas encore de client. Commencez par en ajouter un."}</div>`}
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
  const c = cid ? client(cid) : { id: "", nom: "", tel: "", email: "", adresse: "", vehicule: "", immat: "", notes: "" };
  if (!c) return aller("clients");
  const devis = db.devis.filter((d) => d.clientId === cid);
  const factures = db.factures.filter((f) => f.clientId === cid);
  $("#vue").innerHTML = `
    <h1>${cid ? esc(c.nom) : "Nouveau client"}</h1>
    <form id="form-client" class="carte">
      <div class="grille">
        <label>Nom et prénom *<input name="nom" required value="${esc(c.nom)}"></label>
        <label>Téléphone<input name="tel" type="tel" value="${esc(c.tel)}"></label>
        <label>E-mail<input name="email" type="email" value="${esc(c.email)}"></label>
        <label class="plein">Adresse<input name="adresse" value="${esc(c.adresse)}" placeholder="N°, rue, code postal, ville"></label>
        <label>Véhicule<input name="vehicule" value="${esc(c.vehicule)}" placeholder="ex. Renault Trafic L2H1 2018"></label>
        <label>Immatriculation<input name="immat" value="${esc(c.immat)}" placeholder="AA-123-BB"></label>
        <label class="plein">Notes<textarea name="notes" placeholder="Envies, contraintes, budget…">${esc(c.notes)}</textarea></label>
      </div>
      <div class="barre-actions">
        <button class="btn" type="submit">Enregistrer</button>
        <button class="btn secondaire" type="button" data-aller="clients">Retour</button>
        ${cid ? `<button class="btn secondaire" type="button" data-action="nouveau-devis" data-pour="${cid}">+ Devis pour ce client</button>
                 <button class="btn danger" type="button" data-action="suppr-client" data-id="${cid}">Supprimer</button>` : ""}
      </div>
    </form>
    ${cid ? `
      <h2>Devis</h2>${devis.length ? tableDevis(devis) : `<p class="note">Aucun devis.</p>`}
      <h2>Factures</h2>${factures.length ? tableFactures(factures) : `<p class="note">Aucune facture.</p>`}` : ""}
  `;
  $("#form-client").addEventListener("submit", (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    d.nom = d.nom.trim();
    if (!d.nom) return;
    if (cid) Object.assign(c, d);
    else db.clients.push({ id: id(), ...d });
    sauver();
    aller("clients");
  });
};

/* ---------------- Listes devis / factures ---------------- */
function tableDevis(liste) {
  return `<table class="liste">
    <thead><tr><th>N°</th><th>Client</th><th class="cache-mobile">Objet</th><th class="cache-mobile">Date</th><th class="num">Montant</th><th>Statut</th></tr></thead>
    <tbody>${[...liste].sort((a, b) => b.date.localeCompare(a.date) || b.numero.localeCompare(a.numero)).map((d) => `
      <tr class="cliquable" data-devis="${d.id}">
        <td><strong>${esc(d.numero)}</strong></td><td>${esc(nomClient(d.clientId))}</td>
        <td class="cache-mobile">${esc(d.objet)}</td><td class="cache-mobile">${dateFr(d.date)}</td>
        <td class="num">${euros(total(d))}</td><td>${pastilleDevis(d)}${d.factureId ? ` <span class="pastille">Facturé</span>` : ""}</td>
      </tr>`).join("")}</tbody></table>`;
}
function tableFactures(liste) {
  return `<table class="liste">
    <thead><tr><th>N°</th><th>Client</th><th class="cache-mobile">Date</th><th class="cache-mobile">Échéance</th><th class="num">Montant</th><th>Paiement</th></tr></thead>
    <tbody>${[...liste].sort((a, b) => b.numero.localeCompare(a.numero)).map((f) => `
      <tr class="cliquable" data-facture="${f.id}">
        <td><strong>${esc(f.numero)}</strong></td><td>${esc(nomClient(f.clientId))}</td>
        <td class="cache-mobile">${dateFr(f.date)}</td><td class="cache-mobile">${dateFr(f.echeance)}</td>
        <td class="num">${euros(total(f))}</td><td>${pastilleFacture(f)}</td>
      </tr>`).join("")}</tbody></table>`;
}

VUES.devis = () => {
  $("#vue").innerHTML = `
    <div class="entete"><h1>Devis</h1><button class="btn" data-action="nouveau-devis">+ Nouveau devis</button></div>
    ${db.devis.length ? tableDevis(db.devis) : `<div class="carte vide">Aucun devis pour l'instant.</div>`}`;
};
VUES.factures = () => {
  $("#vue").innerHTML = `
    <div class="entete"><h1>Factures</h1>
      <div class="actions"><button class="btn secondaire" data-action="export-csv">Exporter (tableur)</button></div></div>
    <p class="note">Une facture se crée depuis un devis accepté (bouton « Transformer en facture »).</p>
    ${db.factures.length ? tableFactures(db.factures) : `<div class="carte vide">Aucune facture pour l'instant.</div>`}`;
};

/* ---------------- Éditeur commun devis / facture ---------------- */
function editeur(genre, original) {
  // On travaille sur une copie : rien n'est modifié tant qu'on n'a pas enregistré.
  const doc = JSON.parse(JSON.stringify(original));
  const estFacture = genre === "facture";
  const r = db.reglages;
  const verrou = estFacture && doc.payee;
  const options = db.clients
    .slice().sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
    .map((c) => `<option value="${c.id}" ${c.id === doc.clientId ? "selected" : ""}>${esc(c.nom)}</option>`).join("");

  $("#vue").innerHTML = `
    <div class="entete">
      <h1>${estFacture ? "Facture" : "Devis"} ${esc(doc.numero)}</h1>
      <div>${estFacture ? pastilleFacture(doc) : pastilleDevis(doc)}</div>
    </div>
    ${verrou ? `<div class="alerte">Facture payée : elle n'est plus modifiable. En cas d'erreur, il faut faire un avoir (pas encore dans la bêta).</div>` : ""}
    ${!db.clients.length ? `<div class="alerte">Ajoutez d'abord un client.</div>` : ""}
    <form id="form-doc" class="carte">
      <fieldset ${verrou ? "disabled" : ""} style="border:0;padding:0;margin:0">
      <div class="grille">
        <label>Client *<select name="clientId" required><option value="">— Choisir —</option>${options}</select></label>
        <label>Date<input type="date" name="date" value="${doc.date}" required></label>
        ${estFacture
          ? `<label>Échéance<input type="date" name="echeance" value="${doc.echeance}"></label>`
          : `<label>Statut<select name="statut">${Object.entries(STATUTS_DEVIS).map(([k, v]) => `<option value="${k}" ${k === doc.statut ? "selected" : ""}>${v}</option>`).join("")}</select></label>`}
        <label class="plein">Objet<input name="objet" value="${esc(doc.objet)}" placeholder="ex. Aménagement partiel : isolation + électricité"></label>
      </div>

      <h2>Lignes</h2>
      <table class="lignes">
        <thead><tr><th class="c-type">Type</th><th>Désignation</th><th class="c-qte">Qté / h</th><th class="c-pu">Prix unit.</th><th class="c-total">Total</th><th class="c-sup"></th></tr></thead>
        <tbody id="lignes"></tbody>
      </table>
      <div class="barre-actions" style="margin-top:.5rem">
        <button type="button" class="btn secondaire petit" data-ajout="mo">+ Main d'œuvre</button>
        <button type="button" class="btn secondaire petit" data-ajout="forfait">+ Forfait</button>
        <button type="button" class="btn secondaire petit" data-ajout="info">+ Matériel fourni par le client</button>
      </div>
      <p class="note">« Matériel client » = pour information, non facturé (le client achète son matériel). Taux horaire actuel : ${euros(r.taux)} / h.</p>
      <div class="totaux" id="totaux"></div>
      <label class="plein" style="margin-top:1rem">Remarques (imprimées sur le document)<textarea name="remarques">${esc(doc.remarques)}</textarea></label>
      </fieldset>

      <div class="barre-actions">
        ${verrou ? "" : `<button class="btn" type="submit">Enregistrer</button>`}
        <button class="btn secondaire" type="button" data-action="imprimer">Imprimer / PDF</button>
        ${!estFacture && !doc.factureId && doc.id ? `<button class="btn secondaire" type="button" data-action="vers-facture">Transformer en facture</button>` : ""}
        ${!estFacture && doc.factureId ? `<button class="btn secondaire" type="button" data-ouvrir-facture="${doc.factureId}">Voir la facture</button>` : ""}
        ${estFacture && !doc.payee && doc.id ? `<button class="btn secondaire" type="button" data-action="payer">Marquer comme payée</button>` : ""}
        ${estFacture && doc.payee ? `<button class="btn secondaire" type="button" data-action="impayer">Annuler le paiement</button>` : ""}
        <button class="btn secondaire" type="button" data-aller="${estFacture ? "factures" : "devis"}">Retour</button>
        ${!estFacture && doc.id && !doc.factureId ? `<button class="btn danger" type="button" data-action="suppr-devis">Supprimer</button>` : ""}
      </div>
    </form>`;

  const corps = $("#lignes");
  const dessinerLignes = () => {
    corps.innerHTML = doc.lignes.map((l, i) => `
      <tr data-i="${i}">
        <td class="c-type"><select data-champ="type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${k === l.type ? "selected" : ""}>${v}</option>`).join("")}</select></td>
        <td class="c-desc"><input data-champ="desc" value="${esc(l.desc)}" placeholder="Désignation"></td>
        <td class="c-qte" data-l="${l.type === 'mo' ? 'Heures' : 'Quantité'}"><input data-champ="qte" inputmode="decimal" value="${esc(l.qte)}" ${l.type === "info" ? "placeholder='—'" : ""}></td>
        <td class="c-pu" data-l="Prix unitaire (€)"><input data-champ="pu" inputmode="decimal" value="${l.type === "info" ? "" : esc(l.pu)}" ${l.type === "info" ? "disabled placeholder='—'" : ""}></td>
        <td class="c-total">${l.type === "info" ? "<span class='note'>info</span>" : euros(totalLigne(l))}</td>
        <td class="c-sup"><button type="button" class="btn danger petit" data-suppr="${i}" title="Supprimer la ligne">✕</button></td>
      </tr>`).join("") || `<tr><td colspan="6" class="note">Aucune ligne. Ajoutez-en avec les boutons ci-dessous.</td></tr>`;
    majTotaux();
  };
  const majTotaux = () => {
    $("#totaux").innerHTML = `
      <div>Main d'œuvre : ${heures(doc).toLocaleString("fr-FR")} h</div>
      <div class="grand">Total à payer : ${euros(total(doc))}</div>
      <div class="note">${esc(TARIFS.tvaMention)}</div>`;
    corps.querySelectorAll("tr[data-i]").forEach((tr) => {
      const l = doc.lignes[tr.dataset.i];
      tr.querySelector(".c-total").innerHTML = l.type === "info" ? "<span class='note'>info</span>" : euros(totalLigne(l));
    });
  };
  dessinerLignes();

  corps.addEventListener("input", (e) => {
    const tr = e.target.closest("tr[data-i]");
    if (!tr || !e.target.dataset.champ) return;
    const l = doc.lignes[tr.dataset.i];
    l[e.target.dataset.champ] = e.target.value;
    if (e.target.dataset.champ === "type") {
      if (l.type === "mo") { l.pu = r.taux; if (!l.desc) l.desc = "Main d'œuvre"; }
      if (l.type === "info") l.pu = 0;
      dessinerLignes();
    } else majTotaux();
  });
  corps.addEventListener("click", (e) => {
    const b = e.target.closest("[data-suppr]");
    if (!b) return;
    doc.lignes.splice(Number(b.dataset.suppr), 1);
    dessinerLignes();
  });
  $("#form-doc").addEventListener("click", (e) => {
    const b = e.target.closest("[data-ajout]");
    if (!b) return;
    const t = b.dataset.ajout;
    doc.lignes.push({
      type: t,
      desc: t === "mo" ? "Main d'œuvre" : "",
      qte: t === "info" ? "" : 1,
      pu: t === "mo" ? r.taux : t === "info" ? 0 : "",
    });
    dessinerLignes();
    corps.querySelector(`tr[data-i="${doc.lignes.length - 1}"] [data-champ="desc"]`)?.focus();
  });

  const lireFormulaire = () => {
    const d = Object.fromEntries(new FormData($("#form-doc")));
    doc.clientId = d.clientId;
    doc.date = d.date;
    doc.objet = d.objet;
    doc.remarques = d.remarques;
    if (estFacture) doc.echeance = d.echeance;
    else doc.statut = d.statut;
  };
  const enregistrer = () => {
    lireFormulaire();
    if (!doc.clientId) { alert("Choisissez un client."); return false; }
    doc.lignes = doc.lignes.filter((l) => String(l.desc).trim() || nb(l.qte) || nb(l.pu));
    if (!doc.id) {
      doc.id = id();
      if (estFacture) { doc.numero = numero("F", r.prochaineFacture, doc.date); r.prochaineFacture++; }
      else { doc.numero = numero("D", r.prochainDevis, doc.date); r.prochainDevis++; }
    }
    valider();
    return true;
  };
  const valider = () => {
    const liste = estFacture ? db.factures : db.devis;
    const i = liste.findIndex((x) => x.id === doc.id);
    if (i >= 0) liste[i] = doc; else liste.push(doc);
    sauver();
  };

  $("#form-doc").addEventListener("submit", (e) => {
    e.preventDefault();
    if (enregistrer()) aller(estFacture ? "factures-fiche" : "devis-fiche", doc.id);
  });
  $("#form-doc").addEventListener("click", (e) => {
    const a = e.target.closest("[data-action]")?.dataset.action;
    if (!a) return;
    if (a === "imprimer") {
      if (!verrou && !enregistrer()) return;
      imprimer(genre, doc);
      aller(estFacture ? "factures-fiche" : "devis-fiche", doc.id);
    }
    if (a === "vers-facture") {
      if (!enregistrer()) return;
      if (doc.statut !== "accepte" && !confirm("Ce devis n'est pas marqué « Accepté ». Créer la facture quand même ?")) return;
      const f = {
        id: id(),
        numero: numero("F", r.prochaineFacture, aujourdhui()),
        devisId: doc.id,
        clientId: doc.clientId,
        date: aujourdhui(),
        echeance: plusJours(aujourdhui(), r.delai),
        objet: doc.objet,
        lignes: JSON.parse(JSON.stringify(doc.lignes)),
        remarques: `Suite au devis ${doc.numero} du ${dateFr(doc.date)}.`,
        payee: false,
      };
      r.prochaineFacture++;
      doc.statut = "accepte";
      doc.factureId = f.id;
      db.factures.push(f);
      valider();
      aller("factures-fiche", f.id);
    }
    if (a === "payer") { if (enregistrer()) ouvrirPaiement(doc.id); }
    if (a === "impayer" && confirm("Annuler l'enregistrement du paiement ?")) {
      doc.payee = false; delete doc.datePaiement; delete doc.mode;
      valider(); aller("factures-fiche", doc.id);
    }
    if (a === "suppr-devis" && confirm(`Supprimer le devis ${doc.numero} ?`)) {
      db.devis = db.devis.filter((x) => x.id !== doc.id);
      sauver(); aller("devis");
    }
  });
}

VUES["devis-fiche"] = (did, pourClient) => {
  let d = did && db.devis.find((x) => x.id === did);
  if (did && !d) return aller("devis");
  if (!d) {
    d = {
      id: "", numero: "(nouveau)", clientId: pourClient || "", date: aujourdhui(), objet: "",
      statut: "brouillon", remarques: "",
      lignes: [{ type: "mo", desc: "Main d'œuvre", qte: 1, pu: db.reglages.taux }],
    };
  }
  editeur("devis", d);
};
VUES["factures-fiche"] = (fid) => {
  const f = db.factures.find((x) => x.id === fid);
  if (!f) return aller("factures");
  editeur("facture", f);
};

function ouvrirPaiement(fid) {
  const f = db.factures.find((x) => x.id === fid);
  const dlg = $("#fenetre");
  $("#fenetre-form").innerHTML = `
    <h2 style="margin-top:0">Paiement de ${esc(f.numero)} — ${euros(total(f))}</h2>
    <div class="grille">
      <label>Date du paiement<input type="date" name="date" value="${aujourdhui()}" required></label>
      <label>Mode<select name="mode"><option>Virement</option><option>Espèces</option><option>Chèque</option><option>Carte</option><option>Autre</option></select></label>
    </div>
    <div class="barre-actions"><button class="btn" value="ok">Valider</button><button class="btn secondaire" value="annuler" formnovalidate>Annuler</button></div>`;
  dlg.onclose = () => {
    if (dlg.returnValue !== "ok") return;
    const d = Object.fromEntries(new FormData($("#fenetre-form")));
    f.payee = true; f.datePaiement = d.date; f.mode = d.mode;
    sauver(); aller("factures-fiche", f.id);
  };
  dlg.returnValue = "";
  dlg.showModal();
}

/* ---------------- Impression / PDF ---------------- */
function imprimer(genre, doc) {
  const r = db.reglages;
  const c = client(doc.clientId) || {};
  const estFacture = genre === "facture";
  const lignes = doc.lignes.map((l) => l.type === "info"
    ? `<tr class="info"><td>${esc(l.desc)}${l.qte ? ` (× ${esc(l.qte)})` : ""}</td><td colspan="3">Fourni par le client</td></tr>`
    : `<tr><td>${esc(l.desc)}</td><td class="num">${nb(l.qte).toLocaleString("fr-FR")}${l.type === "mo" ? " h" : ""}</td><td class="num">${euros(l.pu)}</td><td class="num">${euros(totalLigne(l))}</td></tr>`
  ).join("");

  $("#impression").innerHTML = `
  <div class="doc">
    <div class="haut">
      <div class="emetteur">
        <strong>${esc(r.nom)}</strong><br>
        ${r.responsable ? esc(r.responsable) + " — Entrepreneur individuel (EI)<br>" : ""}
        ${r.adresse ? esc(r.adresse) + "<br>" : ""}${esc(r.cpVille)}<br>
        ${esc(r.tel)} · ${esc(r.email)}<br>
        ${r.siret ? "SIRET : " + esc(r.siret) : "<em>SIRET : à compléter</em>"}
      </div>
      <div class="titre-doc">
        <h1>${estFacture ? "FACTURE" : "DEVIS"}</h1>
        N° <strong>${esc(doc.numero)}</strong><br>
        Date : ${dateFr(doc.date)}<br>
        ${estFacture ? `Échéance : ${dateFr(doc.echeance)}` : `Valable jusqu'au ${dateFr(plusJours(doc.date, r.validite))}`}
      </div>
    </div>
    <div class="destinataire">
      <strong>${esc(c.nom || "")}</strong><br>
      ${esc(c.adresse || "")}<br>
      ${c.vehicule ? "Véhicule : " + esc(c.vehicule) : ""}${c.immat ? " — " + esc(c.immat) : ""}
    </div>
    ${doc.objet ? `<p><strong>Objet :</strong> ${esc(doc.objet)}</p>` : ""}
    <table>
      <thead><tr><th>Désignation</th><th class="num">Qté</th><th class="num">Prix unit.</th><th class="num">Total</th></tr></thead>
      <tbody>${lignes}</tbody>
    </table>
    <table class="totaux-doc">
      <tr><td>Main d'œuvre</td><td class="num">${heures(doc).toLocaleString("fr-FR")} h × ${euros(r.taux)}</td></tr>
      <tr class="grand"><td>${estFacture ? "Net à payer" : "Total"}</td><td class="num">${euros(total(doc))}</td></tr>
      <tr><td colspan="2" class="note">${esc(TARIFS.tvaMention)}</td></tr>
    </table>
    ${doc.remarques ? `<p>${esc(doc.remarques).replace(/\n/g, "<br>")}</p>` : ""}
    ${estFacture && doc.payee ? `<p><strong>Acquittée le ${dateFr(doc.datePaiement)} (${esc(doc.mode)}).</strong></p>` : ""}
    <div class="mentions">
      ${estFacture
        ? `Paiement à réception, au plus tard le ${dateFr(doc.echeance)}${r.iban ? ` — par virement sur l'IBAN ${esc(r.iban)}` : ""}.
           Pas d'escompte pour paiement anticipé. En cas de retard, pénalités au taux de 3 fois le taux d'intérêt légal.
           Pour les clients professionnels : indemnité forfaitaire pour frais de recouvrement de 40 €.`
        : `Devis gratuit, valable ${esc(r.validite)} jours. Le matériel est acheté directement par le client ; seule la main d'œuvre est facturée par l'atelier.
           Les frais d'organismes éventuels (contrôle VASP, DREAL, pesée, certificat gaz) sont payés directement par le client.`}
    </div>
    ${estFacture ? "" : `
    <div class="signature">
      <div>Date et signature de l'atelier</div>
      <div>Bon pour accord — date, signature et mention « Devis reçu avant l'exécution des travaux »</div>
    </div>`}
  </div>`;
  const ancienTitre = document.title;
  document.title = `${doc.numero} ${c.nom || ""}`.trim(); // nom de fichier proposé pour le PDF
  window.print();
  document.title = ancienTitre;
}

/* ---------------- Réglages & sauvegarde ---------------- */
VUES.reglages = () => {
  const r = db.reglages;
  const champ = (k, label, extra = "") => `<label>${label}<input name="${k}" value="${esc(r[k])}" ${extra}></label>`;
  $("#vue").innerHTML = `
    <h1>Réglages</h1>
    <form id="form-reglages" class="carte">
      <h2 style="margin-top:0">Votre entreprise (apparaît sur les devis et factures)</h2>
      <div class="grille">
        ${champ("nom", "Nom commercial")}
        ${champ("responsable", "Prénom et nom du responsable", "placeholder='obligatoire sur les factures'")}
        ${champ("siret", "SIRET", "placeholder='14 chiffres'")}
        ${champ("adresse", "Adresse")}
        ${champ("cpVille", "Code postal et ville")}
        ${champ("tel", "Téléphone")}
        ${champ("email", "E-mail")}
        ${champ("iban", "IBAN (pour les virements)")}
      </div>
      <h2>Règles</h2>
      <div class="grille">
        ${champ("taux", "Taux horaire (€)", "type='number' min='0' step='1'")}
        ${champ("validite", "Validité des devis (jours)", "type='number' min='1'")}
        ${champ("delai", "Délai de paiement (jours)", "type='number' min='0'")}
      </div>
      <p class="note">Le taux horaire du site public est réglé dans <code>site/js/tarifs.js</code> (${euros(TARIFS.taux)} / h). Changer ce taux-ci ne modifie que les nouveaux devis.</p>
      <div class="barre-actions"><button class="btn" type="submit">Enregistrer</button></div>
    </form>

    <h2>Installer sur téléphone ou tablette</h2>
    <div class="carte">
      ${estInstallee() ? `<p><strong>L'appli est installée sur cet appareil.</strong> Elle marche même sans réseau.</p>` : `
      <p>Ouvrez <strong>amenagvan.github.io/gestion</strong> sur l'appareil, puis :</p>
      <ul>
        <li><strong>iPhone / iPad (Safari)</strong> : bouton Partager <span aria-hidden="true">⎋</span> → « Sur l'écran d'accueil ».</li>
        <li><strong>Android (Chrome)</strong> : menu ⋮ → « Installer l'application » (ou « Ajouter à l'écran d'accueil »).</li>
        <li><strong>Ordinateur (Chrome / Edge)</strong> : icône d'installation à droite de la barre d'adresse.</li>
      </ul>
      ${invitationInstall ? `<button class="btn" data-action="installer">Installer maintenant</button>` : ""}`}
      <p class="note">Une fois installée, l'appli s'ouvre en plein écran depuis son icône et fonctionne hors ligne (dans l'atelier, au garage…).</p>
    </div>

    <h2>Sauvegarde</h2>
    <div class="carte">
      <p>Les données sont gardées <strong>sur cet appareil uniquement</strong> (rien n'est envoyé sur Internet). Chaque appareil a donc ses propres données. Exportez une sauvegarde régulièrement (dans OneDrive ou Google Drive par exemple).</p>
      <p class="note"><strong>Passer de l'ordi à la tablette</strong> : « Exporter une sauvegarde » sur l'ancien appareil, envoyez-vous le fichier (e-mail, Drive…), puis « Restaurer une sauvegarde » sur le nouveau.</p>
      <p class="note">Dernière sauvegarde exportée : ${db.reglages.derniereSauvegarde ? dateFr(db.reglages.derniereSauvegarde) : "jamais"}.</p>
      <div class="barre-actions">
        <button class="btn" data-action="export">Exporter une sauvegarde</button>
        <label class="btn secondaire" style="flex-direction:row;color:var(--vert)">Restaurer une sauvegarde<input type="file" accept=".json,application/json" id="import" hidden></label>
        <button class="btn secondaire" data-action="demo">Charger des données d'essai</button>
        <button class="btn danger" data-action="tout-effacer">Tout effacer</button>
      </div>
    </div>`;
  $("#form-reglages").addEventListener("submit", (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    ["taux", "validite", "delai"].forEach((k) => (d[k] = nb(d[k])));
    Object.assign(r, d);
    sauver();
    alert("Réglages enregistrés.");
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

// Rappel de sauvegarde si la dernière date de plus de 14 jours
function rappelSauvegarde() {
  const d = db.reglages.derniereSauvegarde;
  const ancien = !d || plusJours(d, 14) < aujourdhui();
  return ancien && (db.clients.length || db.devis.length) ? true : false;
}

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
  const t = db.reglages.taux;
  const c1 = { id: id(), nom: "Julie Martin", tel: "06 11 22 33 44", email: "julie@example.com", adresse: "3 rue des Lilas, 79700 Mauléon", vehicule: "Renault Trafic L2H1 2018", immat: "AB-123-CD", notes: "Veut partir en juillet." };
  const c2 = { id: id(), nom: "Karim Benali", tel: "06 55 66 77 88", email: "karim@example.com", adresse: "12 av. de Nantes, 49300 Cholet", vehicule: "Fiat Ducato L3H2", immat: "EF-456-GH", notes: "" };
  db.clients.push(c1, c2);
  const r = db.reglages;
  const mk = (cl, objet, statut, lignes, date) => {
    const d = { id: id(), numero: numero("D", r.prochainDevis++, date), clientId: cl.id, date, objet, statut, remarques: "", lignes };
    db.devis.push(d); return d;
  };
  const d1 = mk(c1, "Isolation + électricité 12 V", "accepte", [
    { type: "mo", desc: "Isolation, plancher, habillage", qte: 40, pu: t },
    { type: "mo", desc: "Installation électrique 12 V", qte: 24, pu: t },
    { type: "info", desc: "Laine de mouton + contreplaqué peuplier", qte: "", pu: 0 },
  ], plusJours(aujourdhui(), -40));
  mk(c2, "Chauffage gaz", "envoye", [
    { type: "mo", desc: "Pose chauffage gaz + ligne gaz", qte: 22, pu: t },
    { type: "forfait", desc: "Déplacement", qte: 1, pu: 30 },
  ], plusJours(aujourdhui(), -5));
  const f = {
    id: id(), numero: numero("F", r.prochaineFacture++, plusJours(aujourdhui(), -35)), devisId: d1.id, clientId: c1.id,
    date: plusJours(aujourdhui(), -35), echeance: plusJours(aujourdhui(), -5), objet: d1.objet,
    lignes: JSON.parse(JSON.stringify(d1.lignes)), remarques: `Suite au devis ${d1.numero}.`, payee: false,
  };
  d1.factureId = f.id;
  db.factures.push(f);
  sauver();
}

/* ---------------- Clics globaux ---------------- */
document.addEventListener("click", (e) => {
  const lien = e.target.closest("[data-aller]");
  if (lien) { e.preventDefault(); return aller(lien.dataset.aller); }
  const ligne = e.target.closest("[data-client],[data-devis],[data-facture],[data-ouvrir-facture]");
  if (ligne) {
    if (ligne.dataset.client) return aller("clients-fiche", ligne.dataset.client);
    if (ligne.dataset.devis) return aller("devis-fiche", ligne.dataset.devis);
    return aller("factures-fiche", ligne.dataset.facture || ligne.dataset.ouvrirFacture);
  }
  const b = e.target.closest("[data-action]");
  if (!b || b.closest("#form-doc")) return;
  const a = b.dataset.action;
  if (a === "nouveau-client") aller("clients-fiche");
  if (a === "nouveau-devis") aller("devis-fiche", null, b.dataset.pour);
  if (a === "suppr-client") {
    const cid = b.dataset.id;
    if (db.factures.some((f) => f.clientId === cid)) return alert("Ce client a des factures : on doit les garder 10 ans, il ne peut pas être supprimé.");
    if (!confirm("Supprimer ce client et ses devis ?")) return;
    db.clients = db.clients.filter((c) => c.id !== cid);
    db.devis = db.devis.filter((d) => d.clientId !== cid);
    sauver(); aller("clients");
  }
  if (a === "installer") installer();
  if (a === "export") {
    db.reglages.derniereSauvegarde = aujourdhui();
    sauver();
    if (document.querySelector("#form-reglages")) setTimeout(() => aller("reglages"), 300);
  }
  if (a === "export") telecharger(`sauvegarde-gestion-${aujourdhui()}.json`, JSON.stringify(db, null, 2), "application/json");
  if (a === "export-csv") {
    const lignes = [["Numéro", "Date", "Client", "Objet", "Montant", "Payée", "Date paiement", "Mode"]].concat(
      db.factures.map((f) => [f.numero, f.date, nomClient(f.clientId), f.objet, total(f).toFixed(2).replace(".", ","), f.payee ? "oui" : "non", f.datePaiement || "", f.mode || ""])
    );
    const csv = "﻿" + lignes.map((l) => l.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    telecharger(`factures-${aujourdhui()}.csv`, csv, "text/csv");
  }
  if (a === "demo") { chargerDemo(); aller("accueil"); }
  if (a === "tout-effacer" && confirm("Effacer TOUTES les données ? Exportez une sauvegarde avant.") && confirm("Vraiment tout effacer ?")) {
    localStorage.removeItem(CLE); db = base(); /* ---------------- Appli installable (PWA) ---------------- */
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

// Rappel de sauvegarde si la dernière date de plus de 14 jours
function rappelSauvegarde() {
  const d = db.reglages.derniereSauvegarde;
  const ancien = !d || plusJours(d, 14) < aujourdhui();
  return ancien && (db.clients.length || db.devis.length) ? true : false;
}

aller("accueil");
  }
});

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

// Rappel de sauvegarde si la dernière date de plus de 14 jours
function rappelSauvegarde() {
  const d = db.reglages.derniereSauvegarde;
  const ancien = !d || plusJours(d, 14) < aujourdhui();
  return ancien && (db.clients.length || db.devis.length) ? true : false;
}

aller("accueil");
