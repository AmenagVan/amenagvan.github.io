/* ==========================================================
   À MODIFIER : coordonnées de l'atelier (utilisées partout)
   ========================================================== */
window.SITE = {
  email: "ethan79pro@gmail.com",   // l'adresse qui reçoit les demandes
  tel: "07 57 57 03 90",
  // Clé d'accès Web3Forms (reçue par e-mail sur web3forms.com).
  // Ce n'est pas un mot de passe : elle peut être visible dans le code.
  web3formsKey: "bb2bcd9a-a4c6-4c42-aebf-2e8eb74dbe2b",
};

/* ----------------------------------------------------------
   Envoi automatique des formulaires par e-mail via Web3Forms
   (plan gratuit à vie : 250 demandes / mois, https://web3forms.com).
   - champs : { nom du champ: valeur } ; "_subject" = objet de l'e-mail,
     les autres champs commençant par "_" sont ignorés.
   Le champ "email" sert d'adresse de réponse : il suffit de cliquer
   sur « Répondre » dans Gmail pour écrire au client.
   Pas de pièce jointe ni de confirmation automatique au client
   (options payantes) : tout le contenu est écrit dans l'e-mail.
   Si la clé manque, si le service refuse ou s'il ne répond pas en
   20 s, une erreur est levée et le site passe par la messagerie
   du visiteur.
   ---------------------------------------------------------- */
window.SITE.envoyer = async function (champs) {
  if (!window.SITE.web3formsKey) throw new Error("Clé Web3Forms manquante");
  const donnees = {
    access_key: window.SITE.web3formsKey,
    subject: champs._subject || "Nouvelle demande depuis le site Aménag'Van",
    from_name: "Site Aménag'Van",
    botcheck: "",   // piège anti-robots, doit rester vide
  };
  Object.entries(champs).forEach(([k, v]) => {
    if (!k.startsWith("_")) donnees[k] = v ?? "";
  });

  const stop = new AbortController();
  const minuteur = setTimeout(() => stop.abort(), 20000);
  try {
    const rep = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(donnees),
      signal: stop.signal,
    });
    const json = await rep.json().catch(() => ({}));
    if (!rep.ok || json.success !== true) throw new Error(json.message || `Erreur ${rep.status}`);
    return json;
  } finally {
    clearTimeout(minuteur);
  }
};
