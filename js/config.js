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
   - champs : { nom du champ: valeur } (les champs "_xxx" sont des options)
   Pas de pièce jointe : l'envoi direct ne les accepte pas, tout le
   contenu est donc écrit dans l'e-mail.
   Au-delà de 20 s sans réponse, on abandonne (le site passe alors
   par la messagerie du visiteur).
   ---------------------------------------------------------- */
window.SITE.envoyer = async function (champs) {
  const fd = new FormData();
  Object.entries(champs).forEach(([k, v]) => fd.append(k, v ?? ""));
  fd.append("_captcha", "false");
  fd.append("_template", "table");
  fd.append("_honey", "");   // piège anti-robots, doit rester vide
  const stop = new AbortController();
  const minuteur = setTimeout(() => stop.abort(), 20000);
  try {
    const rep = await fetch(`https://formsubmit.co/ajax/${window.SITE.email}`, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: fd,
      signal: stop.signal,
    });
    const json = await rep.json().catch(() => ({}));
    if (!rep.ok || String(json.success) !== "true") throw new Error(json.message || `Erreur ${rep.status}`);
    return json;
  } finally {
    clearTimeout(minuteur);
  }
};
