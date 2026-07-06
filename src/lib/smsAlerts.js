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

async function sendGoogleBonusReminderSms(restaurant, bonusPercent, googleReviewUrl, phone) {
  const message =
    `Hej! Du har fortfarande chansen att låsa upp ${bonusPercent}% extra rabatt hos ` +
    `${restaurant.name} genom att dela din recension på Google: ${googleReviewUrl}`;

  await sendSms({ to: phone, message }, `Google-bonuspåminnelse för ${restaurant.slug}`);
}

module.exports = { sendGoogleBonusReminderSms };
