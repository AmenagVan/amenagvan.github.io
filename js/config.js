/* ==========================================================
   À MODIFIER : coordonnées de l'atelier (utilisées partout)
   ========================================================== */
window.SITE = {
  email: "ethan79pro@gmail.com",   // l'adresse qui recevra les demandes
  tel: "07 57 57 03 90",
};

/* ----------------------------------------------------------
   Envoi automatique des formulaires par e-mail via FormSubmit
   (service gratuit, sans compte : https://formsubmit.co).
   Le premier envoi déclenche un e-mail d'activation à confirmer
   une seule fois dans la boîte de réception.
   - champs  : { nom du champ: valeur } (les champs "_xxx" sont des options)
   - fichier : { blob, nom } facultatif, joint à l'e-mail
   ---------------------------------------------------------- */
window.SITE.envoyer = async function (champs, fichier) {
  const fd = new FormData();
  Object.entries(champs).forEach(([k, v]) => fd.append(k, v ?? ""));
  fd.append("_captcha", "false");
  fd.append("_template", "table");
  fd.append("_honey", "");   // piège anti-robots, doit rester vide
  if (fichier) fd.append("attachment", fichier.blob, fichier.nom);
  const rep = await fetch(`https://formsubmit.co/ajax/${window.SITE.email}`, {
    method: "POST",
    headers: { Accept: "application/json" },
    body: fd,
  });
  const json = await rep.json().catch(() => ({}));
  if (!rep.ok || String(json.success) !== "true") throw new Error(json.message || `Erreur ${rep.status}`);
  return json;
};
