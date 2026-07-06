const config = require("../config");

// Delad hjälpfunktion mot 46elks REST-API. No-op om ELKS_API_USERNAME/
// ELKS_API_PASSWORD eller mottagarnumret saknas. Får ALDRIG kasta ett fel
// som stoppar anroparens flöde - fångar och loggar internt istället.
async function sendSms({ to, message }, logLabel) {
  if (!config.elksApiUsername || !config.elksApiPassword || !to) {
    return;
  }

  try {
    const auth = Buffer.from(`${config.elksApiUsername}:${config.elksApiPassword}`).toString("base64");
    const body = new URLSearchParams({ to, message });
    if (config.elksFrom) {
      body.set("from", config.elksFrom);
    }

    const res = await fetch("https://api.46elks.com/a1/sms", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const responseBody = await res.text();
      console.error(`Kunde inte skicka ${logLabel}: ${res.status} ${responseBody}`);
    }
  } catch (err) {
    console.error(`Kunde inte skicka ${logLabel}:`, err.message);
  }
}

function formatDate(validUntil, lang) {
  return new Date(validUntil).toLocaleDateString(lang === "en" ? "en-GB" : "sv-SE");
}

// Gästens kvitto på rabatten - eftersom ingen kod visas på skärmen längre är
// detta SMS det som består efter att gästen stängt webbläsaren.
async function sendDiscountConfirmationSms(restaurant, percent, validUntil, phone, lang) {
  const date = formatDate(validUntil, lang);
  const message =
    lang === "en"
      ? `Thanks for rating ${restaurant.name}! You have ${percent}% off your next visit, valid until ${date}. Show this SMS at checkout.`
      : `Tack för ditt betyg hos ${restaurant.name}! Du har ${percent}% rabatt på ditt nästa besök, giltig till ${date}. Visa detta SMS i kassan.`;

  await sendSms({ to: phone, message }, `rabattbekräftelse för ${restaurant.slug}`);
}

// Skickas när Google-bonusen låses upp EFTER att bekräftelsen redan gått ut,
// så gästens sparade SMS inte visar fel procentsats.
async function sendBonusUpdateSms(restaurant, percent, validUntil, phone, lang) {
  const date = formatDate(validUntil, lang);
  const message =
    lang === "en"
      ? `Your discount at ${restaurant.name} is now ${percent}%! Valid until ${date}. Show this SMS at checkout.`
      : `Din rabatt hos ${restaurant.name} är nu höjd till ${percent}%! Giltig till ${date}. Visa detta SMS i kassan.`;

  await sendSms({ to: phone, message }, `bonusuppdatering för ${restaurant.slug}`);
}

async function sendGoogleBonusReminderSms(restaurant, bonusPercent, googleReviewUrl, phone, lang) {
  const message =
    lang === "en"
      ? `You can still unlock ${bonusPercent}% extra off at ${restaurant.name} by sharing your review on Google: ${googleReviewUrl}`
      : `Hej! Du har fortfarande chansen att låsa upp ${bonusPercent}% extra rabatt hos ${restaurant.name} genom att dela din recension på Google: ${googleReviewUrl}`;

  await sendSms({ to: phone, message }, `Google-bonuspåminnelse för ${restaurant.slug}`);
}

function smsConfigured() {
  return Boolean(config.elksApiUsername && config.elksApiPassword);
}

module.exports = {
  sendDiscountConfirmationSms,
  sendBonusUpdateSms,
  sendGoogleBonusReminderSms,
  smsConfigured,
};
