/* ==========================================================
   Aménag'Van — scripts du site
   ========================================================== */

// Coordonnées : voir js/config.js
const CONFIG = window.SITE;

// Applique la config aux liens de contact
document.querySelectorAll('[data-config="email"]').forEach((a) => {
  a.textContent = CONFIG.email;
  a.href = "mailto:" + CONFIG.email;
});
// Bouton « Prendre rendez-vous » : visible seulement si la page Google existe
if (CONFIG.urlRendezVous) {
  document.querySelectorAll('[data-config="rdv"]').forEach((a) => (a.href = CONFIG.urlRendezVous));
  document.querySelectorAll("[data-rdv]").forEach((el) => (el.hidden = false));
}
document.querySelectorAll('[data-config="tel"]').forEach((a) => {
  a.textContent = CONFIG.tel;
  a.href = "tel:+33" + CONFIG.tel.replace(/\s/g, "").replace(/^0/, "");
});

document.getElementById("annee").textContent = new Date().getFullYear();

// ---- Grille de tarifs (générée depuis js/tarifs.js) ----
(function grilleTarifs() {
  const T = window.TARIFS;
  const corps = document.getElementById("grille-tarifs");
  if (!T || !corps) return;
  const eur = (n) => Math.round(n).toLocaleString("fr-FR") + " €";
  const fourch = ([a, b]) => (a === b ? eur(a) : `${eur(a)} – ${eur(b)}`);
  const sol = (w) => [T.solaire.matFixe[0] + (w / 100) * T.solaire.matPar100W[0], T.solaire.matFixe[1] + (w / 100) * T.solaire.matPar100W[1]];

  // [prestation, détail, heures (nombre ou [min,max]), matériel (texte ou [min,max])]
  const lignes = [
    ["Diagnostic, dépannage", "Recherche de panne, petite réparation", T.diagnostic.h, "Selon la pièce"],
    ["Isolation, plancher et habillage", "Parois, toit, plancher, lambris ou contreplaqué", T.isolation.h.moyen, T.isolation.mat.moyen],
    ["Installation électrique", "Tableau, fusibles, coupe-batterie, câblage, éclairage LED, USB", T.elecBase.h, T.elecBase.mat],
    ["Batterie lithium 200 Ah", "Pose comprise dans l'installation électrique", 0, [2 * T.batterie100.mat[0], 2 * T.batterie100.mat[1]]],
    ["Panneaux solaires 300 W", "Fixation, passe-toit, régulateur MPPT", T.solaire.hFixe + 3 * T.solaire.hPar100W, sol(300)],
    ["Recharge en roulant", "Chargeur DC-DC", T.dcdc.h, T.dcdc.mat],
    ["Plomberie", "Pompe, évier, robinet, réservoirs eau propre et eaux grises", T.plomberie.h, T.plomberie.mat],
    ["Douche intérieure", "Receveur, étanchéité, mitigeur, évacuation", T.douche.interieure.h, T.douche.interieure.mat],
    ["Installation gaz", "Coffre ventilé, détendeur, cuivre, détecteur", T.gaz.h, T.gaz.mat],
    ["Chauffage gaz", "Pose, conduit, raccordement gaz, mise en service", T.chauffage.gaz.h, T.chauffage.gaz.mat],
    ["Chauffe-eau (ballon)", "Pose et raccordement", T.eauChaude.boiler.h, T.eauChaude.boiler.mat],
    ["Lanterneau 40 × 40", "Découpe, cadre, étanchéité", T.lanterneau.h, T.lanterneau.mat],
    ["Fenêtre", "Découpe, cadre, étanchéité", T.fenetre.h, T.fenetre.mat],
    ["Banquette 2 places homologuée", "Avec ceintures, fixée sur la structure", T.banquette[2].h, T.banquette[2].mat],
    ["Mobilier complet", "Lit, cuisine, rangements, table, placards", T.mobilier.h.moyen, T.mobilier.mat.moyen],
    ["Accompagnement VASP", "Dossier, photos, pesée. Frais d'organismes en plus.", T.vasp.h, T.externes.vasp],
    ["Aménagement complet clé en main", "Isolation, mobilier, électricité, eau, chauffage, VASP", T.exempleComplet.h, T.exempleComplet.mat],
  ];

  corps.innerHTML = lignes.map(([nom, detail, h, mat]) => {
    const temps = Array.isArray(h) ? `${h[0]} à ${h[1]} h` : h ? `${h} h` : "Incluse";
    const mo = Array.isArray(h) ? fourch([h[0] * T.taux, h[1] * T.taux]) : h ? eur(h * T.taux) : "—";
    const m = Array.isArray(mat) ? fourch(mat) : mat;
    return `<tr><td>${nom}<small>${detail}</small></td><td data-label="Temps">${temps}</td><td data-label="Main d'œuvre">${mo}</td><td data-label="Matériel">${m}</td></tr>`;
  }).join("");
  document.querySelectorAll('[data-tarif="taux"]').forEach((b) => (b.textContent = eur(T.taux)));
})();

// ---- Menu mobile ----
const burger = document.querySelector(".burger");
const nav = document.querySelector(".nav");
burger.addEventListener("click", () => {
  const ouvert = nav.classList.toggle("ouvert");
  burger.setAttribute("aria-expanded", ouvert);
});
nav.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    nav.classList.remove("ouvert");
    burger.setAttribute("aria-expanded", "false");
  })
);

// ---- Formulaire : adapte les champs selon le type de demande ----
const form = document.getElementById("form-devis");
const sujet = document.getElementById("sujet");
const labelMessage = document.getElementById("label-message");
const zoneMessage = form.querySelector(".message-form");

const LIBELLES = {
  devis: "Votre projet *",
  question: "Votre question *",
  depannage: "Décrivez la panne *",
  avis: "Votre avis *",
};

function majFormulaire() {
  const estDevis = sujet.value === "devis" || sujet.value === "depannage";
  form.querySelectorAll(".bloc-devis").forEach((el) => (el.hidden = !estDevis));
  labelMessage.textContent = LIBELLES[sujet.value];
}
sujet.addEventListener("change", majFormulaire);
majFormulaire();

// Bouton « Laisser un avis » : pré-sélectionne le bon sujet
document.querySelectorAll('[data-sujet]').forEach((lien) =>
  lien.addEventListener("click", () => {
    sujet.value = lien.dataset.sujet;
    majFormulaire();
  })
);

// ---- Envoi automatique par e-mail (voir SITE.envoyer dans js/config.js) ----
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  zoneMessage.className = "message-form";

  if (!form.checkValidity()) {
    const invalide = form.querySelector(":invalid");
    zoneMessage.textContent = "Merci de remplir les champs obligatoires (*) avec une adresse e-mail valide.";
    zoneMessage.classList.add("erreur");
    invalide.focus();
    return;
  }

  const d = new FormData(form);
  const titreSujet = sujet.options[sujet.selectedIndex].text;
  const champs = {
    _subject: `${titreSujet} — ${d.get("nom")} (site Aménag'Van)`,
    "Type de demande": titreSujet,
    "Nom": d.get("nom"),
    email: d.get("email"),
    "Téléphone": d.get("tel") || "—",
  };
  if (!form.querySelector(".bloc-devis").hidden) {
    const presta = d.getAll("prestations");
    champs["Véhicule"] = d.get("vehicule") || "—";
    champs["État actuel"] = d.get("etat");
    champs["Prestations"] = presta.length ? presta.join(", ") : "—";
  }
  champs["Message"] = d.get("message");

  const bouton = form.querySelector('button[type="submit"]');
  bouton.disabled = true;
  bouton.textContent = "Envoi en cours…";
  try {
    await CONFIG.envoyer(champs);
    zoneMessage.innerHTML = "✅ <b>Votre message a bien été envoyé.</b> Nous vous répondons très vite.";
    zoneMessage.classList.add("ok");
    bouton.textContent = "Message envoyé ✓";
    form.reset();
    majFormulaire();
  } catch (err) {
    console.error(err);
    // Secours : ouvre la messagerie du visiteur avec le message pré-rempli
    const corps = Object.entries(champs).filter(([k]) => !k.startsWith("_")).map(([k, v]) => `${k} : ${v}`).join("\n");
    window.location.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent(champs._subject)}&body=${encodeURIComponent(corps)}`;
    zoneMessage.textContent = `L'envoi automatique n'a pas fonctionné : votre messagerie s'ouvre avec le message déjà rempli. Vous pouvez aussi appeler le ${CONFIG.tel}.`;
    zoneMessage.classList.add("erreur");
    bouton.disabled = false;
    bouton.textContent = "Envoyer ma demande";
  }
});
