const config = require("../config");

// Delad hjälpfunktion mot Resends REST-API. No-op om RESEND_API_KEY eller
// mottagaradressen saknas. Får ALDRIG kasta ett fel som stoppar anroparens
// flöde - fångar och loggar internt istället.
async function sendEmail({ to, subject, text, html }, logLabel) {
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
      body: JSON.stringify({ from: config.resendFromEmail, to, subject, text, ...(html && { html }) }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Kunde inte skicka ${logLabel}: ${res.status} ${body}`);
    }
  } catch (err) {
    console.error(`Kunde inte skicka ${logLabel}:`, err.message);
  }
}

// --- HTML-mallar i samma stil som gästsidan (ljust, vita kort, guldaccent) ---
// Allt inline-CSS (mejlklienter stödjer inte externa stylesheets), Roboto med
// Arial-fallback, färgerna speglar public/review/style.css.

const COLOR = {
  bg: "#f5f6f7",
  card: "#ffffff",
  border: "#e8eaed",
  text: "#202124",
  muted: "#5f6368",
  faint: "#80868b",
  gold: "#d4af37",
  goldDark: "#8a6d0f",
  goldSoft: "#f9f3e1", // rgba(212,175,55,.15) mot vitt, som hex för mejlklienter
  starEmpty: "#dadce0",
  track: "#f1f3f4",
};

function renderLayout(contentHtml) {
  return `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0; padding:0; background:${COLOR.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.bg};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <tr><td style="background:${COLOR.card}; border:1px solid ${COLOR.border}; border-radius:16px; padding:32px 28px; font-family:'Roboto',Arial,sans-serif; color:${COLOR.text};">
${contentHtml}
        </td></tr>
        <tr><td align="center" style="padding-top:16px; font-family:'Roboto',Arial,sans-serif; font-size:12px; color:${COLOR.faint};">Skickat via Restaurant Reviews</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function renderStars(rating) {
  let stars = "";
  for (let i = 1; i <= 5; i++) {
    const color = i <= rating ? COLOR.gold : COLOR.starEmpty;
    stars += `<span style="color:${color}; font-size:26px;">&#9733;</span>`;
  }
  return `<div style="text-align:center; letter-spacing:4px; margin-bottom:14px;">${stars}</div>`;
}

function renderCta(href, label) {
  return `<div style="text-align:center; margin-top:24px;">
    <a href="${href}" style="display:inline-block; background:${COLOR.gold}; color:#ffffff; text-decoration:none; font-weight:500; font-size:15px; padding:13px 28px; border-radius:999px;">${label}</a>
  </div>`;
}

function dashboardCta(label) {
  if (!config.appBaseUrl) return "";
  return renderCta(`${config.appBaseUrl}/admin/dashboard.html`, label);
}

async function sendLowRatingAlert(restaurant, review) {
  const createdAt = new Date(review.created_at).toLocaleString("sv-SE");

  // Textversion (fallback för klienter utan HTML)
  const lines = [
    `Ett lågt betyg lämnades hos ${restaurant.name}.`,
    ``,
    `Betyg: ${review.rating}/5`,
    `Kommentar: ${review.comment ? `"${review.comment}"` : "Ingen kommentar lämnad."}`,
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

  const commentHtml = review.comment
    ? `<div style="background:${COLOR.track}; border-radius:12px; padding:14px 16px; margin-top:18px; font-size:14px; color:${COLOR.text}; line-height:1.5;">&#8220;${escapeHtml(review.comment)}&#8221;</div>`
    : `<p style="text-align:center; margin:18px 0 0; font-size:14px; color:${COLOR.muted};">Ingen kommentar lämnad.</p>`;

  let contactHtml = "";
  if (review.contact_email || review.contact_phone) {
    const rows = [];
    if (review.contact_email) {
      rows.push(`<div style="font-size:14px; color:${COLOR.text}; margin-top:4px;">E-post: <a href="mailto:${review.contact_email}" style="color:${COLOR.goldDark};">${escapeHtml(review.contact_email)}</a></div>`);
    }
    if (review.contact_phone) {
      rows.push(`<div style="font-size:14px; color:${COLOR.text}; margin-top:4px;">Telefon: <a href="tel:${review.contact_phone}" style="color:${COLOR.goldDark};">${escapeHtml(review.contact_phone)}</a></div>`);
    }
    contactHtml = `<div style="background:${COLOR.goldSoft}; border-radius:12px; padding:16px; margin-top:18px;">
      <div style="font-size:12px; letter-spacing:.5px; text-transform:uppercase; color:${COLOR.goldDark}; margin-bottom:4px;">Gästen vill bli kontaktad</div>
      ${rows.join("")}
    </div>`;
  }

  const html = renderLayout(`
    <h2 style="margin:0 0 4px; font-size:22px; font-weight:400; text-align:center;">Nytt lågt betyg</h2>
    <p style="margin:0 0 18px; text-align:center; font-size:15px; color:${COLOR.muted};">${escapeHtml(restaurant.name)}</p>
    ${renderStars(review.rating)}
    <p style="margin:0; text-align:center; font-size:13px; color:${COLOR.faint};">${createdAt}</p>
    ${commentHtml}
    ${contactHtml}
    ${dashboardCta("Öppna adminvyn")}
  `);

  await sendEmail(
    {
      to: restaurant.owner_email,
      subject: `Lågt betyg hos ${restaurant.name} (${review.rating}/5)`,
      text: lines.join("\n"),
      html,
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
  ];
  if (config.appBaseUrl) {
    lines.push(``, `Se alla recensioner: ${config.appBaseUrl}/admin/dashboard.html`);
  }

  const statBox = (value, label) =>
    `<td width="50%" style="padding:6px;">
      <div style="background:${COLOR.track}; border-radius:12px; padding:16px 8px; text-align:center;">
        <div style="font-size:26px; font-weight:500; color:${COLOR.gold};">${value}</div>
        <div style="font-size:12px; color:${COLOR.muted}; margin-top:2px;">${label}</div>
      </div>
    </td>`;

  const maxCount = Math.max(1, ...[5, 4, 3, 2, 1].map((r) => stats.distribution[r] || 0));
  const distributionHtml = [5, 4, 3, 2, 1]
    .map((rating) => {
      const count = stats.distribution[rating] || 0;
      const width = Math.round((count / maxCount) * 100);
      return `<tr>
        <td style="font-size:13px; color:${COLOR.muted}; padding:3px 8px 3px 0; white-space:nowrap;">${rating} <span style="color:${COLOR.gold};">&#9733;</span></td>
        <td width="100%" style="padding:3px 0;">
          <div style="background:${COLOR.track}; border-radius:6px; height:12px;">
            <div style="background:${COLOR.gold}; border-radius:6px; height:12px; width:${width}%;"></div>
          </div>
        </td>
        <td style="font-size:13px; color:${COLOR.muted}; padding:3px 0 3px 8px;">${count}</td>
      </tr>`;
    })
    .join("");

  const html = renderLayout(`
    <h2 style="margin:0 0 4px; font-size:22px; font-weight:400; text-align:center;">Månadsrapport</h2>
    <p style="margin:0 0 18px; text-align:center; font-size:15px; color:${COLOR.muted};">${escapeHtml(restaurant.name)} - senaste 30 dagarna</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>${statBox(stats.totalReviews, "Recensioner")}${statBox(stats.averageRating, "Snittbetyg")}</tr>
      <tr>${statBox(stats.googleClicks, "Google-klick")}${statBox(stats.discountsIssued, "Rabatter utfärdade")}</tr>
    </table>
    <div style="height:1px; background:${COLOR.track}; margin:22px 0;"></div>
    <div style="font-size:12px; letter-spacing:.5px; text-transform:uppercase; color:${COLOR.goldDark}; margin-bottom:10px;">Betygsfördelning</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${distributionHtml}</table>
    ${dashboardCta("Se alla recensioner")}
  `);

  await sendEmail(
    {
      to: restaurant.owner_email,
      subject: `Månadsrapport för ${restaurant.name}`,
      text: lines.join("\n"),
      html,
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
    `Giltig till: ${validUntilText}`,
    ``,
    `Visa upp det här mejlet i kassan vid ditt nästa besök.`,
  ].join("\n");

  const html = renderLayout(`
    <h2 style="margin:0 0 8px; font-size:22px; font-weight:400; text-align:center;">Tack för din feedback!</h2>
    <p style="margin:0 0 22px; text-align:center; font-size:15px; color:${COLOR.muted}; line-height:1.5;">${escapeHtml(restaurant.name)} vill gärna bjuda på en rabatt som tack för att du hjälper oss bli bättre.</p>
    <div style="background:${COLOR.goldSoft}; border-radius:16px; padding:24px; text-align:center;">
      <div style="font-size:12px; letter-spacing:.5px; text-transform:uppercase; color:${COLOR.goldDark};">Din belöning</div>
      <div style="margin:8px 0 2px; font-size:44px; font-weight:500; color:${COLOR.gold};">${discountPercent}%</div>
      <div style="font-size:14px; color:${COLOR.muted}; margin-bottom:18px;">rabatt vid ditt nästa besök</div>
      <div style="background:${COLOR.card}; border-radius:12px; padding:14px 16px; text-align:left; font-size:13px; color:${COLOR.text}; line-height:1.4;">
        <span style="color:${COLOR.gold}; font-weight:700;">&#10003;</span>&nbsp; Visa upp det här mejlet i kassan vid ditt nästa besök.
      </div>
    </div>
    <p style="margin:18px 0 0; text-align:center; font-size:13px; color:${COLOR.faint};">Giltig till ${validUntilText}</p>
  `);

  await sendEmail(
    {
      to: review.contact_email,
      subject: `En rabatt från ${restaurant.name}`,
      text,
      html,
    },
    `gottgörelsekod för ${restaurant.slug}`
  );
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = { sendLowRatingAlert, sendMonthlyReport, sendRecoveryDiscountEmail };
