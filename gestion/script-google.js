/* ==========================================================
   Code du script Google (Apps Script) qui reçoit les demandes du site.
   L'appli l'affiche dans Réglages, avec la clé secrète déjà insérée :
   il suffit de le copier-coller dans Google. La clé n'est jamais
   écrite dans ce fichier (elle est créée sur l'appareil).
   Service gratuit : Google Apps Script + Google Sheets.
   ========================================================== */
window.codeScriptGoogle = (cle) => String.raw`/* Aménag'Van — réception des demandes du site (gratuit).
   Ne modifiez pas la ligne CLE : c'est le mot de passe de l'appli. */
var CLE = "${cle}";
var MAX_PAR_HEURE = 40;   // anti-abus : au-delà, les envois sont ignorés

function feuille_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var f = ss.getSheetByName("Demandes");
  if (!f) {
    f = ss.insertSheet("Demandes");
    f.appendRow(["N°", "Reçue le", "Sujet", "Nom", "E-mail", "Téléphone", "Contenu complet"]);
    f.setFrozenRows(1);
  }
  return f;
}

// Empêche une valeur d'être lue comme une formule par Google Sheets
function texte_(v) {
  v = String(v == null ? "" : v).slice(0, 2000);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Le site envoie ici chaque demande
function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    if (d.botcheck) return json_({ ok: true });
    var champs = d.champs;
    if (!champs || typeof champs !== "object") return json_({ ok: false });

    var cache = CacheService.getScriptCache();
    var n = Number(cache.get("compteur") || 0);
    if (n >= MAX_PAR_HEURE) return json_({ ok: false, erreur: "trop" });
    cache.put("compteur", String(n + 1), 3600);

    var propre = {};
    Object.keys(champs).slice(0, 60).forEach(function (k) {
      propre[String(k).slice(0, 100)] = String(champs[k] == null ? "" : champs[k]).slice(0, 5000);
    });

    var verrou = LockService.getScriptLock();
    verrou.waitLock(10000);
    try {
      var props = PropertiesService.getScriptProperties();
      var id = Number(props.getProperty("dernierId") || 0) + 1;
      props.setProperty("dernierId", String(id));
      feuille_().appendRow([
        id, new Date(), texte_(propre._subject || "Demande"), texte_(propre["Nom"]),
        texte_(propre.email), texte_(propre["Téléphone"]), JSON.stringify(propre)
      ]);
    } finally {
      verrou.releaseLock();
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false });
  }
}

// L'appli de gestion vient lire les demandes ici (clé obligatoire)
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.cle !== CLE) return json_({ ok: false, erreur: "cle" });
  var depuis = Number(p.depuis || 0);
  var f = feuille_();
  var lignes = f.getLastRow() > 1 ? f.getRange(2, 1, f.getLastRow() - 1, 7).getValues() : [];
  var demandes = [];
  lignes.forEach(function (l) {
    if (Number(l[0]) > depuis) {
      var champs = {};
      try { champs = JSON.parse(l[6]); } catch (x) {}
      demandes.push({ id: Number(l[0]), date: new Date(l[1]).toISOString(), champs: champs });
    }
  });
  return json_({ ok: true, demandes: demandes });
}
`;
