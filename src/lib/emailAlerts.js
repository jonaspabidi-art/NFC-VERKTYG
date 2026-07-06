const config = require("../config");

// Skickar ett larmmejl till restaurangagaren via Resends REST-API. No-op om
// RESEND_API_KEY inte ar satt eller restaurangen inte har en owner_email -
// far ALDRIG kasta ett fel som stoppar gastens recensionsflode.
async function sendLowRatingAlert(restaurant, review) {
  if (!config.resendApiKey || !restaurant.owner_email) {
    return;
  }

  const commentLine = review.comment ? `"${review.comment}"` : "Ingen kommentar lämnad.";
  const createdAt = new Date(review.created_at).toLocaleString("sv-SE");

  const lines = [
    `Ett lågt betyg lämnades hos ${restaurant.name}.`,
    ``,
    `Betyg: ${review.rating}/5`,
    `Kommentar: ${commentLine}`,
    `Tidpunkt: ${createdAt}`,
  ];
  if (config.appBaseUrl) {
    lines.push(``, `Logga in för fler detaljer: ${config.appBaseUrl}/admin/dashboard.html`);
  }
  const text = lines.join("\n");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.resendFromEmail,
        to: restaurant.owner_email,
        subject: `Lågt betyg hos ${restaurant.name} (${review.rating}/5)`,
        text,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Kunde inte skicka lågbetygslarm för ${restaurant.slug}: ${res.status} ${body}`);
    }
  } catch (err) {
    console.error(`Kunde inte skicka lågbetygslarm för ${restaurant.slug}:`, err.message);
  }
}

module.exports = { sendLowRatingAlert };
