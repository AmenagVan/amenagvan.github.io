/* ==========================================================
   Aménag'Van — configurateur de projet
   Les prix viennent de js/tarifs.js (window.TARIFS).
   ========================================================== */

const T = window.TARIFS;

/* ----------------------------------------------------------
   DONNÉES TECHNIQUES
   ---------------------------------------------------------- */
const SOLEIL_H = { ete: 5, mi: 3, annee: 2, hiver: 1.2 };      // heures équivalent plein soleil / jour
const TOIT_MAX_W = { compact: 300, moyen: 400, grand: 500, xl: 600 };
const EAU_MAX_L = { compact: 60, moyen: 100, grand: 120, xl: 150 };
const RESERVOIRS = [40, 60, 80, 100, 120, 150];

const LIBELLE = {
  gabarit: { compact: "Compact", moyen: "Moyen (L2H2)", grand: "Grand (L3H2)", xl: "Très grand (L4H3)" },
  projet: { complet: "Aménagement complet", partiel: "Aménagement partiel", reparation: "Réparation" },
  saison: { ete: "Beaux jours", mi: "Mi-saison", annee: "Toute l'année", hiver: "Hiver et montagne" },
  lit: { fixe: "Lit fixe arrière", convertible: "Banquette convertible", pavillon: "Lit de pavillon", superposes: "Lits superposés" },
  cuisson: { aucune: "aucune", gaz: "gaz", induction: "induction" },
  wc: { aucun: "aucun", sec: "toilettes sèches", cassette: "WC cassette" },
  douche: { exterieure: "douchette extérieure", interieure: "douche intérieure" },
  froid: { aucun: "pas de frigo", frigo: "frigo à compression", glaciere: "glacière à compression" },
  chauffage: { aucun: "Aucun", gaz: "Gaz", combi: "Combiné gaz (chauffage + eau chaude)" },
  eauChaude: { aucune: "aucune", boiler: "ballon 12 V / 230 V", gaz: "chauffe-eau gaz", combi: "par le combiné" },
  convertisseur: { aucun: "aucun", petit: "1 000 W", gros: "2 000 W et plus" },
  modules: { lit: "Lit", cuisine: "Meuble cuisine", rangements: "Rangements", table: "Table", electricite: "Électricité", plomberie: "Plomberie" },
  vasp: { oui: "Accompagnement complet", normes: "Construit aux normes, démarches par le client", nsp: "À discuter" },
};

const euros = (n) => Math.round(n).toLocaleString("fr-FR") + " €";
const fourchette = ([a, b]) => (a === b ? euros(a) : `${euros(a)} – ${euros(b)}`);
const arrondi = (n, pas = 10) => Math.round(n / pas) * pas;
const pluriel = (n, mot, motPl = mot + "s") => `${n} ${n > 1 ? motPl : mot}`;

/* ----------------------------------------------------------
   LECTURE DU FORMULAIRE
   ---------------------------------------------------------- */
const form = document.getElementById("config");
const el = form.elements;

function lire() {
  const coches = (nom) => [...form.querySelectorAll(`input[name="${nom}"]:checked`)];
  const s = {
    gabarit: el.gabarit.value,
    projet: el.projet.value,
    modele: el.modele.value.trim(),
    possede: el.possede.value,
    adultes: +el.adultes.value,
    enfants: +el.enfants.value,
    saison: el.saison.value,
    joursElec: +el.joursElec.value,
    joursEau: +el.joursEau.value,
    modules: coches("modules").map((c) => c.value),
    lit: el.lit.value,
    cabine3: el.cabine3.checked,
    pivotants: el.pivotants.checked,
    banquette: +el.banquette.value,
    cuisson: el.cuisson.value,
    froid: el.froid.value,
    teletravail: el.teletravail.checked,
    wc: el.wc.value,
    douches: coches("douches").map((c) => c.value),
    extras: coches("conso").map((c) => ({ nom: c.dataset.nom, wh: +c.value })),
    dcdc: el.dcdc.checked,
    prise230: el.prise230.checked,
    convertisseur: el.convertisseur.value,
    chauffage: el.chauffage.value,
    eauChaude: el.eauChaude.value,
    isolation: el.isolation.checked,
    lanterneaux: +el.lanterneaux.value,
    fenetres: +el.fenetres.value,
    lanterneauVentile: el.lanterneauVentile.checked,
    occultants: el.occultants.checked,
    store: el.store.checked,
    clim: el.clim.checked,
    vasp: el.vasp.value,
  };
  s.pers = s.adultes + s.enfants;
  s.complet = s.projet === "complet";
  s.a = (m) => s.complet || s.modules.includes(m);   // ce module est-il prévu ?
  if (s.chauffage === "combi") s.eauChaude = "combi";
  s.avecElec = s.a("electricite");
  s.avecEau = s.a("plomberie") || s.a("cuisine") || s.douches.length > 0;
  s.texteDouches = s.douches.length ? s.douches.map((d) => LIBELLE.douche[d]).join(" et ") : "aucune";
  s.avecGaz = s.cuisson === "gaz" || s.chauffage !== "aucun" || s.eauChaude === "gaz";   // chauffages tous au gaz
  s.placesRoute = (s.cabine3 ? 3 : 2) + s.banquette;
  return s;
}

/* ----------------------------------------------------------
   CALCUL ÉLECTRIQUE
   ---------------------------------------------------------- */
function calculElec(s) {
  const conso = [["Éclairage LED", 60]];
  if (s.froid === "frigo") conso.push(["Frigo", 400]);
  if (s.froid === "glaciere") conso.push(["Glacière", 300]);
  if (s.avecEau) conso.push(["Pompe à eau", 15]);
  conso.push([`Téléphones (${s.pers})`, 20 * s.pers]);
  if (s.teletravail) conso.push(["Ordinateur (télétravail)", 300]);
  if (s.chauffage !== "aucun") conso.push(["Ventilation du chauffage", ["annee", "hiver"].includes(s.saison) ? 150 : 60]);
  if (s.lanterneauVentile && s.lanterneaux > 0) conso.push(["Extracteur de lanterneau", 100]);
  if (s.cuisson === "induction") conso.push(["Plaque induction", 1000]);
  if (s.clim) conso.push(["Climatisation", 2500]);
  s.extras.forEach((x) => conso.push([x.nom, x.wh]));

  // Gros appareils 230 V : il faut un convertisseur adapté
  let convertisseur = s.convertisseur;
  const alertes = [];
  if ((s.cuisson === "induction" || s.clim) && convertisseur !== "gros") {
    convertisseur = "gros";
    alertes.push("L'induction et la climatisation demandent un convertisseur de 2 000 W ou plus : il est ajouté au chiffrage.");
  }
  if (convertisseur !== "aucun") conso.push(["Convertisseur (consommation à vide)", 50]);

  const wh = conso.reduce((t, c) => t + c[1], 0);
  const h = SOLEIL_H[s.saison];
  const solaire = Math.min(Math.ceil(wh / (h * 0.75) / 100) * 100, TOIT_MAX_W[s.gabarit]);
  const apportSolaire = solaire * h * 0.75;                         // Wh produits par jour
  const deficit = Math.max(0, wh - apportSolaire);                  // Wh à puiser chaque jour
  // Réserve : jusqu'à 2 jours sans soleil, puis le déficit solaire des jours suivants
  const J = s.joursElec;
  const besoinWh = wh * Math.min(J, 2) + deficit * Math.max(0, J - 2);
  const ahBrut = besoinWh / (12.8 * 0.9);                           // lithium 12,8 V, 90 % utilisable
  const ah = Math.max(s.cuisson === "induction" ? 200 : 100, Math.min(Math.ceil(ahBrut / 50) * 50, 600));
  const autonomie = (ah * 12.8 * 0.9) / wh;
  const couverture = Math.min(100, Math.round((apportSolaire / wh) * 100));

  if (ahBrut > 600) alertes.push(`Pour tenir ${pluriel(J, "jour")} sans vous brancher, il faudrait environ ${Math.round(ahBrut / 50) * 50} Ah : on s'arrête à 600 Ah, il faudra rouler ou vous brancher en cours de route.`);
  if (s.clim) alertes.push("La climatisation consomme énormément : elle fonctionnera surtout branchée au camping ou moteur allumé.");
  if (couverture < 60) alertes.push(`En saison « ${LIBELLE.saison[s.saison].toLowerCase()} », le solaire couvre environ ${couverture} % des besoins : la recharge en roulant ou au camping prend le relais.`);
  return { conso, wh, solaire, ah, autonomie, couverture, convertisseur, alertes };
}

/* ----------------------------------------------------------
   CALCUL EAU
   ---------------------------------------------------------- */
function calculEau(s) {
  // 7 L/jour/pers. (boire, cuisiner, vaisselle, toilette) + douches
  const parJour = 7 + (s.douches.includes("interieure") ? 8 : 0) + (s.douches.includes("exterieure") ? 3 : 0);
  const besoin = s.pers * s.joursEau * parJour;
  const max = EAU_MAX_L[s.gabarit];
  const reservoir = Math.min(RESERVOIRS.find((r) => r >= besoin) || 150, max);
  const grises = Math.round((reservoir * 0.8) / 10) * 10;
  const alertes = [];
  if (besoin > max) {
    const j = Math.max(1, Math.floor(max / (s.pers * parJour)));
    alertes.push(`Il faudrait ${besoin} L, mais ce fourgon accepte environ ${max} L : comptez un plein d'eau ${j > 1 ? `tous les ${j} jours` : "chaque jour"}.`);
  }
  return { parJour, besoin, reservoir, grises, alertes };
}

/* ----------------------------------------------------------
   CHECKLIST VASP
   ---------------------------------------------------------- */
function checklistVasp(s) {
  const L = [];
  const add = (ok, txt, detail) => L.push({ ok, txt, detail });
  add(s.a("lit"), "Couchage d'au moins 1,80 × 0,60 m", s.a("lit") ? LIBELLE.lit[s.lit] : "Ajoutez un lit (module « Lit »)");
  add(s.a("table"), "Table (fixe ou amovible)", s.a("table") ? "Prévue" : "Ajoutez le module « Table »");
  add(s.cuisson !== "aucune" && s.avecEau, "Cuisine : cuisson et point d'eau",
    s.cuisson === "aucune" ? "Ajoutez un moyen de cuisson" : !s.avecEau ? "Ajoutez la plomberie (évier)" : `Cuisson ${LIBELLE.cuisson[s.cuisson]} et évier`);
  add(s.a("rangements"), "Rangements fixés à la structure", s.a("rangements") ? "Prévus" : "Ajoutez le module « Rangements »");
  add(s.placesRoute >= s.pers, "Une place avec ceinture par voyageur",
    s.placesRoute >= s.pers ? `${s.placesRoute} places pour ${pluriel(s.pers, "voyageur")}` : `${s.placesRoute} places pour ${s.pers} voyageurs : ajoutez une banquette homologuée`);
  add(s.lanterneaux > 0, "Aération haute et basse permanentes (NF EN 721)", s.lanterneaux > 0 ? "Lanterneau et grille basse" : "Ajoutez au moins un lanterneau");
  add(true, s.avecGaz ? "Installation gaz certifiée (NF EN 1949)" : "Pas de gaz à bord",
    s.avecGaz ? "Coffre ventilé, détendeur, détecteur, certificat de conformité" : "Aucun certificat gaz nécessaire");
  add(true, "Électricité protégée", "Fusibles par circuit, batterie fixée et ventilée, différentiel 30 mA");
  add(true, "Mobilier fixé, portes verrouillables, extincteur", "Inclus dans nos aménagements");
  add(s.vasp === "oui", "Pesée officielle et dossier DREAL", s.vasp === "oui" ? "Dossier préparé avec vous" : "À votre charge (ou choisissez l'accompagnement)");
  return L;
}

/* ----------------------------------------------------------
   CHIFFRAGE : heures de pose + matériel estimé
   ---------------------------------------------------------- */
function calculPrix(s, elec, eau) {
  const L = [];   // { poste, h, mat: [min, max] }
  const add = (poste, h, mat = [0, 0]) => (h > 0 || mat[1] > 0) && L.push({ poste, h, mat });
  const fois = (n, [a, b]) => [n * a, n * b];
  const g = s.gabarit;

  add(s.complet ? "Étude, plan et conseil matériel" : "Étude et conseil matériel", T.etude[s.complet ? "complet" : "partiel"]);
  if (s.complet) add(`Mobilier complet (${LIBELLE.gabarit[g]})`, T.mobilier.h[g], T.mobilier.mat[g]);
  else ["lit", "cuisine", "rangements", "table"].forEach((m) => s.modules.includes(m) && add(LIBELLE.modules[m], T.modules[m].h, T.modules[m].mat));
  if (s.a("lit") && s.lit !== "fixe") add(`Supplément ${LIBELLE.lit[s.lit].toLowerCase()}`, T.lit[s.lit].h, T.lit[s.lit].mat);
  if (s.isolation) add("Isolation, plancher et habillage", T.isolation.h[g], T.isolation.mat[g]);

  if (s.avecElec) {
    add("Installation électrique (tableau, câblage, éclairage, USB)", T.elecBase.h, T.elecBase.mat);
    add(`Batterie lithium ${elec.ah} Ah`, T.batterie100.h, fois(elec.ah / 100, T.batterie100.mat));
    if (elec.solaire) {
      const n = elec.solaire / 100;
      add(`Panneaux solaires ${elec.solaire} W et régulateur MPPT`, T.solaire.hFixe + n * T.solaire.hPar100W,
        [T.solaire.matFixe[0] + n * T.solaire.matPar100W[0], T.solaire.matFixe[1] + n * T.solaire.matPar100W[1]]);
    }
    if (s.dcdc) add("Chargeur DC-DC (recharge en roulant)", T.dcdc.h, T.dcdc.mat);
    if (s.prise230) add("Prise extérieure 230 V et chargeur", T.prise230.h, T.prise230.mat);
    if (elec.convertisseur !== "aucun") add(`Convertisseur 230 V ${LIBELLE.convertisseur[elec.convertisseur]}`, T.convertisseur[elec.convertisseur].h, T.convertisseur[elec.convertisseur].mat);
  }
  if (s.avecEau) {
    const supp = Math.max(0, eau.reservoir - 40);
    add(`Plomberie, réservoir ${eau.reservoir} L`, T.plomberie.h, [T.plomberie.mat[0] + supp * T.litreSupp[0], T.plomberie.mat[1] + supp * T.litreSupp[1]]);
  }
  s.douches.forEach((d) => add(LIBELLE.douche[d].replace(/^./, (c) => c.toUpperCase()), T.douche[d].h, T.douche[d].mat));
  if (s.wc !== "aucun") add(LIBELLE.wc[s.wc].replace(/^./, (c) => c.toUpperCase()), T.wc[s.wc].h, T.wc[s.wc].mat);
  if (s.froid === "frigo") add("Frigo à compression", T.frigo.h, T.frigo.mat);
  if (s.froid === "glaciere") add("Glacière à compression (fixation, prise 12 V)", T.glaciere.h, T.glaciere.mat);
  if (s.cuisson !== "aucune") add(`Cuisson ${LIBELLE.cuisson[s.cuisson]}`, T.cuisson[s.cuisson].h, T.cuisson[s.cuisson].mat);
  if (s.avecGaz) add("Installation gaz", T.gaz.h, T.gaz.mat);
  if (s.chauffage !== "aucun") add(`Chauffage ${LIBELLE.chauffage[s.chauffage].toLowerCase()}`, T.chauffage[s.chauffage].h, T.chauffage[s.chauffage].mat);
  if (T.eauChaude[s.eauChaude]) add(`Eau chaude : ${LIBELLE.eauChaude[s.eauChaude]}`, T.eauChaude[s.eauChaude].h, T.eauChaude[s.eauChaude].mat);

  if (s.lanterneaux) add(pluriel(s.lanterneaux, "lanterneau", "lanterneaux") + " 40 × 40", s.lanterneaux * T.lanterneau.h, fois(s.lanterneaux, T.lanterneau.mat));
  if (s.lanterneauVentile && s.lanterneaux) add("Extracteur sur lanterneau", T.ventilateur.h, T.ventilateur.mat);
  if (s.fenetres) add(pluriel(s.fenetres, "fenêtre"), s.fenetres * T.fenetre.h, fois(s.fenetres, T.fenetre.mat));
  if (s.occultants) add("Rideaux occultants isolants", T.occultants.h, T.occultants.mat[g]);
  if (s.store) add("Store extérieur", T.store.h, T.store.mat);
  if (s.clim) add("Climatisation de toit", T.clim.h, T.clim.mat);
  if (s.pivotants) add("2 embases pivotantes", 2 * T.pivotant.h, fois(2, T.pivotant.mat));
  if (s.banquette) add(`Banquette ${s.banquette} places homologuée`, T.banquette[s.banquette].h, T.banquette[s.banquette].mat);
  if (s.teletravail) add("Coin télétravail", T.teletravail.h, T.teletravail.mat);
  if (s.complet) add("Sécurité (extincteur, détecteurs)", T.securite.h, T.securite.mat);
  if (s.vasp === "oui") add("Accompagnement homologation VASP", T.vasp.h);

  L.forEach((l) => (l.mo = l.h * T.taux));
  const heures = L.reduce((t, l) => t + l.h, 0);
  const mo = heures * T.taux;
  const mat = [arrondi(L.reduce((t, l) => t + l.mat[0], 0), 50), arrondi(L.reduce((t, l) => t + l.mat[1], 0), 50)];

  // Frais payés à des tiers
  const externes = [];
  if (s.vasp !== "nsp") externes.push({ poste: "Contrôle de conformité, DREAL et pesée VASP", mat: T.externes.vasp });
  if (s.avecGaz) externes.push({ poste: "Certificat de conformité gaz", mat: T.externes.certifGaz });
  const ext = [externes.reduce((t, e) => t + e.mat[0], 0), externes.reduce((t, e) => t + e.mat[1], 0)];

  const total = [arrondi(mo + mat[0] + ext[0], 100), arrondi(mo + mat[1] + ext[1], 100)];
  return { lignes: L, heures, mo, mat, externes, ext, total };
}

/* ----------------------------------------------------------
   AFFICHAGE
   ---------------------------------------------------------- */
const $ = (id) => document.getElementById(id);
let dernier = null;

function majAffichage() {
  const s = lire();
  $("bloc-modules").hidden = s.projet !== "partiel";
  $("note-combi").hidden = s.chauffage !== "combi";
  $("choix-eau-chaude").hidden = s.chauffage === "combi";
  $("alerte-pivotants").hidden = !(s.cabine3 && s.pivotants);

  if (s.projet === "reparation") {
    $("est-mo").textContent = "Sur devis";
    $("est-mo-detail").textContent = `Diagnostic : ${euros(T.diagnostic.h * T.taux)} la première heure`;
    $("est-mat").textContent = "Selon la pièce";
    $("est-total").textContent = "—";
    $("resume-tech").innerHTML = "<li>🔧 Décrivez la panne à l'étape suivante, on vous rappelle.</li>";
    $("lignes-prix").innerHTML = "";
    $("barre-prix-valeur").textContent = "Réparation sur devis";
    $("recap-detail").innerHTML = `<div class="recap-prix"><span>Réparation</span><strong>Sur devis</strong><p>Diagnostic ${euros(T.diagnostic.h * T.taux)} la première heure, puis ${euros(T.taux)}/h. Décrivez la panne ci-dessous.</p></div>`;
    dernier = { s, reparation: true };
    return;
  }

  const elec = calculElec(s);
  const eau = calculEau(s);
  const vasp = checklistVasp(s);
  const prix = calculPrix(s, elec, eau);
  const okVasp = vasp.filter((v) => v.ok).length;
  dernier = { s, elec, eau, vasp, prix, okVasp };

  // Colonne estimation
  $("est-mo").textContent = euros(prix.mo);
  $("est-mo-detail").textContent = `${prix.heures} h × ${euros(T.taux)}`;
  $("est-mat").textContent = fourchette(prix.mat);
  $("est-total").textContent = fourchette(prix.total);
  $("barre-prix-valeur").textContent = `${fourchette(prix.total)}`;
  $("resume-tech").innerHTML = [
    `🚐 ${LIBELLE.gabarit[s.gabarit]} · ${LIBELLE.projet[s.projet].toLowerCase()}`,
    `👥 ${pluriel(s.pers, "voyageur")}`,
    s.avecElec ? `🔋 ${elec.ah} Ah lithium · ☀️ ${elec.solaire} W · ${pluriel(s.joursElec, "jour")}` : null,
    s.avecEau ? `💧 ${eau.reservoir} L d'eau propre · ${pluriel(s.joursEau, "jour")}` : null,
    s.chauffage !== "aucun" ? `🔥 Chauffage ${LIBELLE.chauffage[s.chauffage].toLowerCase()}` : null,
    `📋 VASP : ${okVasp}/${vasp.length} points OK`,
  ].filter(Boolean).map((t) => `<li>${t}</li>`).join("");
  $("lignes-prix").innerHTML =
    `<li class="entete-lignes"><span>Poste</span><span></span><span>Main d'œuvre</span></li>` +
    prix.lignes.map((l) => `<li><span>${l.poste}</span><span>${l.h ? `${l.h} h` : "Pose incluse"}${l.mat[1] ? ` · matériel ${fourchette(l.mat)}` : ""}</span><span>${l.h ? euros(l.mo) : "—"}</span></li>`).join("") +
    prix.externes.map((e) => `<li class="externe"><span>${e.poste}</span><span>Payé à un organisme : ${fourchette(e.mat)}</span><span>—</span></li>`).join("");

  // Bilan électricité
  $("bilan-elec").innerHTML = s.avecElec ? `
    <h4>Votre besoin électrique</h4>
    <div class="chiffres">
      <div><b>${elec.wh} Wh</b><span>consommés par jour</span></div>
      <div><b>${elec.ah} Ah</b><span>batterie lithium conseillée</span></div>
      <div><b>${elec.solaire} W</b><span>de panneaux solaires</span></div>
      <div><b>${elec.autonomie.toFixed(1).replace(".", ",")} j</b><span>sans soleil ni recharge</span></div>
    </div>
    <p class="detail">Dimensionné pour tenir ${pluriel(s.joursElec, "jour")} sans vous brancher : le solaire produit environ ${Math.round(elec.couverture)} % de votre consommation en saison « ${LIBELLE.saison[s.saison].toLowerCase()} ».</p>
    <p class="detail">Calculé avec : ${elec.conso.map((c) => `${c[0]} ${c[1]} Wh`).join(" · ")}</p>
    ${elec.alertes.map((a) => `<p class="alerte">${a}</p>`).join("")}`
    : `<h4>Électricité</h4><p class="detail">Pas d'installation électrique prévue. Ajoutez le module « Installation électrique » à l'étape 3 si besoin.</p>`;

  // Bilan eau
  $("bilan-eau").innerHTML = s.avecEau ? `
    <h4>Votre besoin en eau</h4>
    <div class="chiffres">
      <div><b>${eau.besoin} L</b><span>${s.pers} pers. × ${s.joursEau} j × ${eau.parJour} L</span></div>
      <div><b>${eau.reservoir} L</b><span>réservoir d'eau propre</span></div>
      <div><b>${eau.grises} L</b><span>réservoir d'eaux grises</span></div>
    </div>
    ${eau.alertes.map((a) => `<p class="alerte">${a}</p>`).join("")}`
    : `<h4>Eau</h4><p class="detail">Pas de plomberie prévue.</p>`;

  // Checklist VASP
  $("checklist-vasp").innerHTML = vasp.map((v) =>
    `<li class="${v.ok ? "" : "manque"}"><div>${v.txt}<small>${v.detail}</small></div></li>`).join("");

  // Récapitulatif
  const ligne = (k, val) => (val ? `<tr><th>${k}</th><td>${val}</td></tr>` : "");
  $("recap-detail").innerHTML = `
    <div class="recap-prix">
      <div><span>Main d'œuvre</span><strong>${euros(prix.mo)}</strong><small>${prix.heures} h × ${euros(T.taux)}</small></div>
      <div><span>Matériel estimé</span><strong>${fourchette(prix.mat)}</strong><small>acheté par vous</small></div>
      <div><span>Budget global</span><strong>${fourchette(prix.total)}</strong><small>frais externes compris</small></div>
    </div>
    <table class="recap-table">${recapLignes(s, elec, eau, okVasp, vasp.length).map(([k, v]) => ligne(k, v)).join("")}</table>`;
}

function recapLignes(s, elec, eau, okVasp, nbVasp) {
  return [
    ["Véhicule", `${LIBELLE.gabarit[s.gabarit]}${s.modele ? " · " + s.modele : ""} (${s.possede.toLowerCase()})`],
    ["Projet", LIBELLE.projet[s.projet] + (s.projet === "partiel" ? " : " + (s.modules.map((m) => LIBELLE.modules[m].toLowerCase()).join(", ") || "aucun module choisi") : "")],
    ["Voyageurs", `${pluriel(s.adultes, "adulte")}, ${pluriel(s.enfants, "enfant")} · ${LIBELLE.saison[s.saison].toLowerCase()}`],
    ["Couchage", s.a("lit") ? LIBELLE.lit[s.lit] : ""],
    ["Places pour rouler", `${s.placesRoute} avec ceinture${s.pivotants ? " · sièges pivotants" : ""}`],
    ["Cuisine", `Cuisson ${LIBELLE.cuisson[s.cuisson]} · ${LIBELLE.froid[s.froid]}`],
    ["Sanitaires", `WC : ${LIBELLE.wc[s.wc]} · douche : ${s.texteDouches}`],
    ["Électricité", s.avecElec ? `Autonomie ${pluriel(s.joursElec, "jour")} · ${elec.wh} Wh/jour · batterie ${elec.ah} Ah · solaire ${elec.solaire} W${s.dcdc ? " · recharge en roulant" : ""}${s.prise230 ? " · prise 230 V" : ""}` : ""],
    ["Eau", s.avecEau ? `Autonomie ${pluriel(s.joursEau, "jour")} · ${eau.reservoir} L propre · ${eau.grises} L eaux grises` : ""],
    ["Chauffage", `${LIBELLE.chauffage[s.chauffage]} · eau chaude : ${LIBELLE.eauChaude[s.eauChaude]}`],
    ["Isolation", s.isolation ? "Complète (parois, toit, plancher)" : "Non incluse"],
    ["Ouvertures", `${pluriel(s.lanterneaux, "lanterneau", "lanterneaux")}${s.lanterneauVentile && s.lanterneaux ? " (dont 1 ventilé)" : ""}, ${pluriel(s.fenetres, "fenêtre")}`],
    ["Confort", ([s.occultants && "rideaux occultants", s.store && "store", s.clim && "climatisation", s.teletravail && "coin télétravail"].filter(Boolean).join(", ") || "—").replace(/^./, (c) => c.toUpperCase())],
    ["Homologation VASP", `${LIBELLE.vasp[s.vasp]} · ${okVasp}/${nbVasp} points OK`],
  ];
}

/* ----------------------------------------------------------
   NAVIGATION ENTRE ÉTAPES
   ---------------------------------------------------------- */
const sections = [...document.querySelectorAll(".etape-config")];
const puces = [...document.querySelectorAll("#liste-etapes li")];
let etape = 1;

const etapesActives = () => (el.projet.value === "reparation" ? [1, 8] : [1, 2, 3, 4, 5, 6, 7, 8]);

function aller(n, defiler = true) {
  etape = n;
  const actives = etapesActives();
  sections.forEach((sec) => (sec.hidden = +sec.dataset.etape !== n));
  puces.forEach((li, i) => {
    const num = i + 1;
    li.classList.toggle("actif", num === n);
    li.classList.toggle("fait", num < n && actives.includes(num));
    li.querySelector("button").disabled = !actives.includes(num);
  });
  $("precedent").disabled = !actives.some((x) => x < n);
  $("suivant").hidden = !actives.some((x) => x > n);
  // Garde l'étape active visible dans la barre (mobile)
  const ol = $("liste-etapes"), li = puces[n - 1];
  ol.scrollLeft = li.offsetLeft - (ol.clientWidth - li.clientWidth) / 2;
  // Remonte en haut du formulaire, sous l'en-tête et la barre d'étapes (qui sont collés en haut)
  if (defiler) {
    const decalage = document.querySelector(".entete").offsetHeight + document.querySelector(".progression").offsetHeight + 12;
    window.scrollTo({ top: form.getBoundingClientRect().top + window.scrollY - decalage, behavior: "smooth" });
  }
}

$("suivant").addEventListener("click", () => {
  const suiv = etapesActives().find((x) => x > etape);
  if (suiv) aller(suiv);
});
$("precedent").addEventListener("click", () => {
  const prec = etapesActives().reverse().find((x) => x < etape);
  if (prec) aller(prec);
});
puces.forEach((li, i) => li.querySelector("button").addEventListener("click", () => aller(i + 1)));

// Compteurs +/-
form.querySelectorAll(".stepper").forEach((st) => {
  const input = st.querySelector("input");
  st.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      input.value = Math.min(+input.max, Math.max(+input.min, +input.value + +b.dataset.delta));
      majAffichage();
    })
  );
});

form.addEventListener("input", majAffichage);
form.addEventListener("change", () => { majAffichage(); aller(etape, false); });

/* ----------------------------------------------------------
   PDF DE CONFIRMATION
   ---------------------------------------------------------- */
// jsPDF utilise l'encodage Latin-1 : on retire espaces fines, emojis, etc.
const pdfTxt = (t) => String(t ?? "")
  .replace(/[  ]/g, " ")
  .replace(/[‘’]/g, "'")
  .replace(/[^\x20-\x7E -ÿ€–—“”…œŒ•\n]/g, "")
  .replace(/\s{2,}/g, " ")
  .trim();

function logoPng() {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => {
      // Fond vert de l'en-tête + JPEG : fichier PDF léger
      const c = document.createElement("canvas");
      c.width = c.height = 160;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#24382c";
      ctx.fillRect(0, 0, 160, 160);
      ctx.drawImage(img, 0, 0, 160, 160);
      try { ok(c.toDataURL("image/jpeg", 0.9)); } catch { ok(null); }
    };
    img.onerror = () => ok(null);
    img.src = "assets/logo.svg";
  });
}

function nouvelleReference() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `EN-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${Math.floor(1000 + Math.random() * 9000)}`;
}

async function genererPdf(client, telecharger = true) {
  if (!window.jspdf) throw new Error("jsPDF indisponible");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const d = dernier;
  const ref = nouvelleReference();
  const date = new Date().toLocaleDateString("fr-FR");
  const W = 210, M = 15;
  const VERT = [36, 56, 44], ORANGE = [200, 97, 42], SABLE = [242, 232, 213], GRIS = [93, 107, 98], TEXTE = [35, 48, 42];
  let y;

  // --- En-tête
  doc.setFillColor(...VERT);
  doc.rect(0, 0, W, 34, "F");
  const logo = await logoPng();
  if (logo) doc.addImage(logo, "JPEG", M, 7, 20, 20);
  doc.setTextColor(255, 255, 255).setFont("helvetica", "bold").setFontSize(18);
  doc.text("AMÉNAG'VAN", M + 25, 16);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...SABLE);
  doc.text(pdfTxt("Aménagement & réparation de vans · Mauléon (79)"), M + 25, 22);
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(240, 160, 110);
  doc.text(d.reparation ? "DEMANDE DE RÉPARATION" : "RÉCAPITULATIF DE PROJET", W - M, 14, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...SABLE);
  doc.text(`Réf. ${ref}`, W - M, 20, { align: "right" });
  doc.text(`Date : ${date}`, W - M, 25, { align: "right" });
  y = 44;

  const titre = (t) => {
    if (y > 255) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...ORANGE);
    doc.text(pdfTxt(t).toUpperCase(), M, y);
    doc.setDrawColor(...ORANGE).setLineWidth(0.4).line(M, y + 1.8, W - M, y + 1.8);
    y += 6;
  };
  const tableau = (opts) => {
    doc.autoTable({
      startY: y, margin: { left: M, right: M, bottom: 20 },
      styles: { font: "helvetica", fontSize: 9, textColor: TEXTE, cellPadding: 2, lineColor: [230, 216, 189], lineWidth: 0.1 },
      headStyles: { fillColor: VERT, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [251, 246, 236] },
      ...opts,
    });
    y = doc.lastAutoTable.finalY + 8;
  };

  // --- Client
  titre("Client");
  tableau({
    theme: "plain",
    body: [
      ["Nom", pdfTxt(client.nom)],
      ["E-mail", pdfTxt(client.email)],
      ["Téléphone", pdfTxt(client.tel || "—")],
    ],
    columnStyles: { 0: { cellWidth: 45, textColor: GRIS, fontStyle: "bold" } },
  });

  if (d.reparation) {
    titre("Demande");
    tableau({ theme: "plain", body: [["Véhicule", pdfTxt(`${LIBELLE.gabarit[d.s.gabarit]}${d.s.modele ? " · " + d.s.modele : ""}`)], ["Description", pdfTxt(client.idees || "—")]],
      columnStyles: { 0: { cellWidth: 45, textColor: GRIS, fontStyle: "bold" } } });
    titre("Tarif");
    doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...TEXTE);
    doc.text(pdfTxt(`Diagnostic : ${euros(T.diagnostic.h * T.taux)} la première heure, puis ${euros(T.taux)} par heure. Les pièces sont à la charge du client. Un devis vous est envoyé après diagnostic.`), M, y, { maxWidth: W - 2 * M });
    y += 14;
  } else {
    const { s, elec, eau, vasp, prix, okVasp } = d;

    // --- Synthèse chiffrée (3 encadrés)
    titre("Estimation");
    const bw = (W - 2 * M - 8) / 3;
    [
      ["MAIN D'ŒUVRE", euros(prix.mo), `${prix.heures} h × ${euros(T.taux)}`],
      ["MATÉRIEL ESTIMÉ", fourchette(prix.mat), "acheté par le client"],
      ["BUDGET GLOBAL", fourchette(prix.total), "frais externes compris"],
    ].forEach(([lib, val, sous], i) => {
      const x = M + i * (bw + 4);
      const fort = i === 2;
      doc.setFillColor(...(fort ? [255, 244, 236] : [251, 246, 236]));
      doc.setDrawColor(...(fort ? ORANGE : [230, 216, 189])).setLineWidth(fort ? 0.6 : 0.2);
      doc.roundedRect(x, y, bw, 22, 2, 2, "FD");
      doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...GRIS).text(pdfTxt(lib), x + 4, y + 6);
      doc.setFontSize(val.length > 16 ? 10.5 : 13).setTextColor(...(fort ? ORANGE : VERT)).text(pdfTxt(val), x + 4, y + 13.5);
      doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...GRIS).text(pdfTxt(sous), x + 4, y + 19);
    });
    y += 30;

    // --- Configuration
    titre("Votre configuration");
    tableau({
      theme: "plain",
      body: recapLignes(s, elec, eau, okVasp, vasp.length).filter(([, v]) => v).map(([k, v]) => [pdfTxt(k), pdfTxt(v)]),
      columnStyles: { 0: { cellWidth: 45, textColor: GRIS, fontStyle: "bold" } },
    });

    // --- Bilan technique
    const tech = [];
    if (s.avecElec) {
      tech.push(["Consommation électrique", `${elec.wh} Wh par jour`]);
      tech.push(["Batterie conseillée", `${elec.ah} Ah lithium (LiFePO4)`]);
      tech.push(["Panneaux solaires", `${elec.solaire} W (couvrent environ ${elec.couverture} % des besoins)`]);
      tech.push(["Autonomie sans recharge", `${elec.autonomie.toFixed(1).replace(".", ",")} jours`]);
    }
    if (s.avecEau) {
      tech.push(["Besoin en eau", `${eau.besoin} L (${s.pers} pers. × ${s.joursEau} j × ${eau.parJour} L)`]);
      tech.push(["Réservoirs", `${eau.reservoir} L eau propre · ${eau.grises} L eaux grises`]);
    }
    [...(s.avecElec ? elec.alertes : []), ...(s.avecEau ? eau.alertes : [])].forEach((a) => tech.push(["À noter", a]));
    if (tech.length) {
      titre("Dimensionnement");
      tableau({ theme: "plain", body: tech.map(([k, v]) => [pdfTxt(k), pdfTxt(v)]), columnStyles: { 0: { cellWidth: 45, textColor: GRIS, fontStyle: "bold" } } });
    }

    // --- Chiffrage détaillé
    titre("Chiffrage détaillé");
    const corps = prix.lignes.map((l) => [pdfTxt(l.poste), l.h ? `${l.h} h` : "incluse", l.h ? pdfTxt(euros(l.mo)) : "—", l.mat[1] ? pdfTxt(fourchette(l.mat)) : "—"]);
    prix.externes.forEach((e) => corps.push([pdfTxt(e.poste + " · payé à un tiers"), "—", "—", pdfTxt(fourchette(e.mat))]));
    tableau({
      head: [["Poste", "Heures", "Main d'œuvre", "Matériel estimé *"].map(pdfTxt)],
      body: corps,
      foot: [
        [pdfTxt("Total main d'œuvre"), `${prix.heures} h`, pdfTxt(euros(prix.mo)), ""],
        [pdfTxt("Total matériel estimé"), "", "", pdfTxt(fourchette(prix.mat))],
        ...(prix.externes.length ? [[pdfTxt("Frais externes"), "", "", pdfTxt(fourchette(prix.ext))]] : []),
        [pdfTxt("BUDGET GLOBAL ESTIMÉ"), "", "", pdfTxt(fourchette(prix.total))],
      ],
      footStyles: { fillColor: SABLE, textColor: VERT, fontStyle: "bold" },
      showFoot: "lastPage",
      columnStyles: { 1: { halign: "right", cellWidth: 18 }, 2: { halign: "right", cellWidth: 28 }, 3: { halign: "right", cellWidth: 40 } },
      didParseCell: (c) => { if (c.section === "foot" && c.row.index === c.table.foot.length - 1) { c.cell.styles.fillColor = VERT; c.cell.styles.textColor = 255; } },
    });
    doc.setFont("helvetica", "italic").setFontSize(7.5).setTextColor(...GRIS);
    doc.text(pdfTxt("* Fourchette du premier prix de qualité au haut de gamme. Nous vous conseillons les références exactes avant l'achat."), M, y - 4);
    y += 2;

    // --- VASP
    titre(`Conformité VASP (${okVasp}/${vasp.length} points)`);
    tableau({
      head: [["Exigence", "Statut", "Détail"]],
      body: vasp.map((v) => [pdfTxt(v.txt), v.ok ? "OK" : "À revoir", pdfTxt(v.detail)]),
      columnStyles: { 1: { cellWidth: 20, fontStyle: "bold" } },
      didParseCell: (c) => { if (c.section === "body" && c.column.index === 1) c.cell.styles.textColor = c.cell.raw === "OK" ? [63, 95, 72] : ORANGE; },
    });

    if (client.idees) {
      titre("Vos idées");
      tableau({ theme: "plain", body: [[pdfTxt(client.idees)]] });
    }
  }

  // --- Conditions
  titre("Conditions");
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GRIS);
  const conditions = [
    "Estimation indicative et non contractuelle, établie à partir de vos réponses. Le devis définitif est établi après visite du véhicule.",
    `Le matériel est acheté par le client ; nous vous conseillons les références adaptées. La main d'œuvre est facturée ${euros(T.taux)} de l'heure.`,
    "Les frais externes (contrôle de conformité, dossier DREAL, pesée, certificat gaz) sont réglés directement aux organismes concernés.",
    T.tvaMention + ".",
  ];
  conditions.forEach((c) => {
    const lignes = doc.splitTextToSize(pdfTxt("• " + c), W - 2 * M);
    if (y + lignes.length * 4 > 280) { doc.addPage(); y = 20; }
    doc.text(lignes, M, y);
    y += lignes.length * 3.8 + 1;
  });

  // --- Pied de page sur chaque page
  const nb = doc.internal.getNumberOfPages();
  for (let i = 1; i <= nb; i++) {
    doc.setPage(i);
    doc.setDrawColor(230, 216, 189).setLineWidth(0.3).line(M, 286, W - M, 286);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...GRIS);
    doc.text(pdfTxt(`Aménag'Van · Mauléon (79700) · ${window.SITE.tel} · ${window.SITE.email}`), M, 291);
    doc.text(`Réf. ${ref} · page ${i}/${nb}`, W - M, 291, { align: "right" });
  }

  const nom = `Projet-van-${ref}.pdf`;
  if (telecharger) doc.save(nom);
  return { ref, nom, blob: doc.output("blob") };
}

/* ----------------------------------------------------------
   ENVOI
   ---------------------------------------------------------- */
const msg = form.querySelector(".message-form");

function lireClient() {
  msg.className = "message-form";
  const nom = el.nom.value.trim();
  if (!nom || !el.email.value || !el.email.checkValidity()) {
    msg.textContent = "Merci d'indiquer votre nom et une adresse e-mail valide.";
    msg.classList.add("erreur");
    (nom ? el.email : el.nom).focus();
    return null;
  }
  return { nom, email: el.email.value.trim(), tel: el.tel.value.trim(), idees: el.idees.value.trim() };
}

// Crée le PDF ; renvoie null (et l'indique) s'il ne peut pas être créé
async function pdfAvecMessage(client, telecharger) {
  majAffichage();
  try {
    return await genererPdf(client, telecharger);
  } catch (err) {
    console.error(err);
    return null;
  }
}

$("btn-pdf").addEventListener("click", async () => {
  const client = lireClient();
  if (!client) return;
  const pdf = await pdfAvecMessage(client, true);
  msg.className = "message-form " + (pdf ? "ok" : "erreur");
  msg.textContent = pdf
    ? `Votre récapitulatif ${pdf.ref} a été téléchargé.`
    : "Le PDF n'a pas pu être créé (connexion internet nécessaire).";
});

// Tout le contenu de la demande, champ par champ, pour l'e-mail reçu par l'atelier
function champsDemande(client, ref) {
  const d = dernier;
  const c = {
    _subject: `Nouvelle demande ${d.reparation ? "de réparation" : "de devis"} — ${client.nom} — ${ref}`,
    "Référence": ref,
    "Nom": client.nom,
    email: client.email,
    "Téléphone": client.tel || "—",
    "Type de demande": d.reparation ? "Réparation" : LIBELLE.projet[d.s.projet],
  };
  if (d.reparation) {
    c["Véhicule"] = `${LIBELLE.gabarit[d.s.gabarit]}${d.s.modele ? " · " + d.s.modele : ""}`;
  } else {
    c["Main d'œuvre estimée"] = `${euros(d.prix.mo)} (${d.prix.heures} h × ${euros(T.taux)})`;
    c["Matériel estimé"] = fourchette(d.prix.mat);
    c["Budget global"] = fourchette(d.prix.total);
    recapLignes(d.s, d.elec, d.eau, d.okVasp, d.vasp.length).filter(([, v]) => v).forEach(([k, v]) => (c[k] = v));
    c["Détail du chiffrage"] = d.prix.lignes
      .map((l) => `${l.poste} : ${l.h ? `${l.h} h = ${euros(l.mo)}` : "pose incluse"}${l.mat[1] ? ` · matériel ${fourchette(l.mat)}` : ""}`)
      .concat(d.prix.externes.map((e) => `${e.poste} (organisme) : ${fourchette(e.mat)}`))
      .join("\n");
    const manques = d.vasp.filter((v) => !v.ok);
    if (manques.length) c["Points VASP à revoir"] = manques.map((v) => `${v.txt} : ${v.detail}`).join("\n");
  }
  c["Message du client"] = client.idees || "—";
  return c;
}

// Solution de secours si l'envoi automatique échoue : messagerie du visiteur
function envoiParMessagerie(champs) {
  const corps = Object.entries(champs).filter(([k]) => !k.startsWith("_")).map(([k, v]) => `${k} : ${v}`).join("\n");
  window.location.href = `mailto:${window.SITE.email}?subject=${encodeURIComponent(champs._subject)}&body=${encodeURIComponent(corps)}`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const client = lireClient();
  if (!client) return;
  const bouton = form.querySelector('button[type="submit"]');
  bouton.disabled = true;
  bouton.textContent = "Envoi en cours…";
  msg.className = "message-form";
  msg.textContent = "";

  const pdf = await pdfAvecMessage(client, false);
  const ref = pdf ? pdf.ref : nouvelleReference();
  const champs = champsDemande(client, ref);

  try {
    await window.SITE.envoyer(champs);
    msg.className = "message-form ok";
    msg.innerHTML = `✅ <b>Votre demande a bien été envoyée</b> (réf. ${ref}).<br>Nous vous recontactons très vite, par téléphone ou par e-mail.` +
      (pdf ? `<br>Vous pouvez garder une copie de votre projet avec le bouton « Télécharger le PDF ».` : "");
    bouton.textContent = "Demande envoyée ✓";
  } catch (err) {
    console.error(err);
    envoiParMessagerie(champs);
    msg.className = "message-form erreur";
    msg.innerHTML = `L'envoi automatique n'a pas fonctionné. Votre messagerie s'ouvre avec la demande déjà remplie : il suffit d'appuyer sur Envoyer.<br>Vous pouvez aussi nous appeler au ${window.SITE.tel}.`;
    bouton.disabled = false;
    bouton.textContent = "Envoyer ma demande";
  }
});

document.getElementById("annee").textContent = new Date().getFullYear();
majAffichage();
aller(1, false);
