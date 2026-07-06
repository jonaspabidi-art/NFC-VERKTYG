const config = require("../config");

// Delad hjälpfunktion mot Resends REST-API. No-op om RESEND_API_KEY eller
// mottagaradressen saknas. Får ALDRIG kasta ett fel som stoppar anroparens
// flöde - fångar och loggar internt istället.
async function sendEmail({ to, subject, text }, logLabel) {
  if (!config.resendApiKey || !to) {
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: config.resendFromEmail, to, subject, text }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Kunde inte skicka ${logLabel}: ${res.status} ${body}`);
    }
  } catch (err) {
    console.error(`Kunde inte skicka ${logLabel}:`, err.message);
  }
}

async function sendLowRatingAlert(restaurant, review) {
  const commentLine = review.comment ? `"${review.comment}"` : "Ingen kommentar lämnad.";
  const createdAt = new Date(review.created_at).toLocaleString("sv-SE");

  const lines = [
    `Ett lågt betyg lämnades hos ${restaurant.name}.`,
    ``,
    `Betyg: ${review.rating}/5`,
    `Kommentar: ${commentLine}`,
    `Tidpunkt: ${createdAt}`,
  ];
  if (review.contact_email || review.contact_phone) {
    lines.push(``, `Gästen vill bli kontaktad:`);
    if (review.contact_email) lines.push(`  E-post: ${review.contact_email}`);
    if (review.contact_phone) lines.push(`  Telefon: ${review.contact_phone}`);
  }
  if (config.appBaseUrl) {
    lines.push(``, `Logga in för fler detaljer: ${config.appBaseUrl}/admin/dashboard.html`);
  }

  await sendEmail(
    {
      to: restaurant.owner_email,
      subject: `Lågt betyg hos ${restaurant.name} (${review.rating}/5)`,
      text: lines.join("\n"),
    },
    `lågbetygslarm för ${restaurant.slug}`
  );
}

async function sendMonthlyReport(restaurant, stats) {
  const distributionLines = [5, 4, 3, 2, 1].map(
    (rating) => `  ${rating} stjärnor: ${stats.distribution[rating] || 0}`
  );

  const lines = [
    `Månadsrapport för ${restaurant.name} (senaste 30 dagarna).`,
    ``,
    `Antal recensioner: ${stats.totalReviews}`,
    `Snittbetyg: ${stats.averageRating}`,
    `Betygsfördelning:`,
    ...distributionLines,
    ``,
    `Klick på Google-länken: ${stats.googleClicks}`,
    `Rabattkoder utfärdade: ${stats.discountsIssued}`,
    `Rabattkoder inlösta: ${stats.discountsUsed}`,
  ];
  if (config.appBaseUrl) {
    lines.push(``, `Se alla recensioner: ${config.appBaseUrl}/admin/dashboard.html`);
  }

  await sendEmail(
    {
      to: restaurant.owner_email,
      subject: `Månadsrapport för ${restaurant.name}`,
      text: lines.join("\n"),
    },
    `månadsrapport för ${restaurant.slug}`
  );
}

async function sendRecoveryDiscountEmail(restaurant, review, code, discountPercent, validUntil) {
  const validUntilText = new Date(validUntil).toLocaleDateString("sv-SE");

  const text = [
    `Hej!`,
    ``,
    `Tack för din feedback till ${restaurant.name}. Vi vill gärna bjuda på`,
    `${discountPercent}% rabatt vid ditt nästa besök.`,
    ``,
    `Kod: ${code}`,
    `Giltig till: ${validUntilText}`,
    ``,
    `Visa upp koden i kassan vid ditt nästa besök.`,
  ].join("\n");

  await sendEmail(
    {
      to: review.contact_email,
      subject: `En rabattkod från ${restaurant.name}`,
      text,
    },
    `gottgörelsekod för ${restaurant.slug}`
  );
}

module.exports = { sendLowRatingAlert, sendMonthlyReport, sendRecoveryDiscountEmail };
