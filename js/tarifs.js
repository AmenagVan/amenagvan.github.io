/* ==========================================================
   GRILLE TARIFAIRE — source unique pour tout le site
   (page d'accueil + configurateur + PDF)

   Principe : le client achète le MATÉRIEL (on lui conseille les
   références), l'atelier facture la MAIN D'ŒUVRE à l'heure.

   - h   : heures de pose estimées
   - mat : [min, max] coût du matériel en € TTC, du premier prix
           correct au haut de gamme (prix publics 2025-2026)
   Les variantes par taille de fourgon sont des objets
   { compact, moyen, grand, xl }.
   ========================================================== */
window.TARIFS = {
  taux: 40,                 // € / heure de main d'œuvre
  tvaMention: "TVA non applicable, art. 293 B du CGI",

  etude:        { complet: 8, partiel: 3 },            // heures : plan, conseils matériel, suivi
  mobilier: {               // aménagement complet : lit, cuisine, rangements, table, placards
    h:   { compact: 90, moyen: 110, grand: 130, xl: 150 },
    mat: { compact: [1200, 2200], moyen: [1600, 2800], grand: [2000, 3400], xl: [2400, 4000] },
  },
  modules: {                // aménagement partiel
    lit:        { h: 20, mat: [300, 600] },
    cuisine:    { h: 35, mat: [500, 1000] },
    rangements: { h: 20, mat: [300, 600] },
    table:      { h: 5,  mat: [100, 250] },
  },
  lit: {                    // supplément selon le type de couchage
    fixe:        { h: 0,  mat: [0, 0] },
    convertible: { h: 8,  mat: [200, 500] },
    pavillon:    { h: 16, mat: [600, 1500] },
    superposes:  { h: 10, mat: [200, 400] },
  },
  isolation: {              // isolation + plancher + habillage murs et plafond
    h:   { compact: 30, moyen: 40, grand: 48, xl: 56 },
    mat: { compact: [600, 1000], moyen: [800, 1400], grand: [1000, 1700], xl: [1200, 2000] },
  },

  elecBase:      { h: 24, mat: [400, 700] },   // tableau, fusibles, coupe-batterie, câbles, LED, USB
  batterie100:   { h: 0,  mat: [350, 900] },   // par 100 Ah lithium LiFePO4
  solaire:       { hFixe: 6, hPar100W: 1, matFixe: [140, 400], matPar100W: [90, 200] }, // + régulateur MPPT, supports
  dcdc:          { h: 3,  mat: [150, 350] },
  prise230:      { h: 5,  mat: [250, 500] },   // prise ext., chargeur de quai, différentiel 30 mA
  convertisseur: {
    petit: { h: 2, mat: [150, 450] },          // 1 000 W pur sinus
    gros:  { h: 4, mat: [500, 1300] },         // 2 000 W+ convertisseur-chargeur
  },

  plomberie:     { h: 16, mat: [300, 650] },   // pompe, évier, robinet, réservoirs 40 L, tuyaux
  litreSupp:     [1.5, 3],                     // € par litre de réservoir au-delà de 40 L
  douche: {
    exterieure: { h: 3,  mat: [60, 200] },
    interieure: { h: 30, mat: [500, 1200] },
  },
  wc: {
    sec:      { h: 4,  mat: [150, 600] },
    cassette: { h: 12, mat: [800, 1300] },
  },
  frigo:         { h: 4,  mat: [450, 1000] },  // frigo encastré, découpe, ventilation
  glaciere:      { h: 1,  mat: [250, 800] },   // glacière à compression : fixation, prise 12 V
  cuisson: {
    gaz:       { h: 3, mat: [100, 300] },
    induction: { h: 2, mat: [100, 300] },
  },
  gaz:           { h: 10, mat: [200, 450] },   // coffre ventilé, détendeur, cuivre, robinets, détecteur
  chauffage: {
    gaz:    { h: 12, mat: [1100, 1600] },
    combi:  { h: 18, mat: [2000, 3000] },  // type Truma Combi 4 / 6 (gaz)
  },
  eauChaude: {
    boiler: { h: 6, mat: [300, 600] },
    gaz:    { h: 8, mat: [700, 1100] },
  },

  lanterneau:    { h: 5,  mat: [160, 350] },   // par lanterneau 40×40
  ventilateur:   { h: 1,  mat: [200, 350] },   // supplément extracteur
  fenetre:       { h: 6,  mat: [250, 550] },   // par fenêtre
  occultants: {
    h: 4,
    mat: { compact: [150, 350], moyen: [200, 450], grand: [250, 500], xl: [300, 600] },
  },
  store:         { h: 6,  mat: [700, 1200] },
  clim:          { h: 14, mat: [1600, 2800] },
  pivotant:      { h: 2,  mat: [150, 300] },   // par siège
  banquette: {
    2: { h: 10, mat: [900, 1600] },            // banquette homologuée avec ceintures
    3: { h: 12, mat: [1200, 2200] },
  },
  teletravail:   { h: 6,  mat: [80, 200] },
  securite:      { h: 1,  mat: [60, 120] },    // extincteur, détecteurs CO et gaz

  vasp:          { h: 8 },                     // dossier, photos, plans, accompagnement pesée
  externes: {                                  // payés directement par le client à des tiers
    vasp:        [350, 550],                   // contrôle de conformité + DREAL (86,90 €) + pesée
    certifGaz:   [100, 200],                   // certificat gaz par un professionnel qualifié
  },
  diagnostic:    { h: 1 },

  // Ordre de grandeur affiché sur la page d'accueil pour un aménagement
  // complet L2H2 (vérifié avec le configurateur, configurations courantes)
  exempleComplet: { h: [250, 300], mat: [6500, 15000] },
};
