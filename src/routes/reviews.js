const express = require("express");
const supabase = require("../lib/supabaseClient");
const { hashIp } = require("../lib/hash");
const { generateDiscountCode } = require("../lib/discountCode");
const { sendLowRatingAlert } = require("../lib/emailAlerts");
const { sendGoogleBonusReminderSms } = require("../lib/smsAlerts");
const deviceId = require("../middleware/deviceId");
const { reviewLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEVICE_COOLDOWN_HOURS = 24;
// Ger gästen tid att lägga till en kommentar (PATCH /:id/comment) på
// resultatsidan innan larmet går iväg, så ägaren oftast får texten också.
const LOW_RATING_ALERT_DELAY_MS = 2 * 60 * 1000;
// Extra procentenheter utöver ordinarie rabatt, upplåst genom att lämna
// telefonnummer OCH klicka på Google-länken. Medvetet ovillkorad av att en
// recension faktiskt postas (kan bara mäta klicket) - se CLAUDE.md.
const GOOGLE_BONUS_PERCENT = 10;
// Hur länge vi väntar innan påminnelse-SMS:et skickas om gästen ännu inte
// klickat på Google-länken.
const GOOGLE_BONUS_REMINDER_DELAY_MS = 15 * 60 * 1000;

// In-memory fördröjning - ett schemalagt larm förloras vid omstart/redeploy.
// Accepterad avvägning för v1 (samma nivå som övriga enkla lösningar här).
function scheduleLowRatingAlert(restaurant, reviewId) {
  if (!restaurant.owner_email) return;

  setTimeout(async () => {
    try {
      const { data: freshReview } = await supabase
        .from("reviews")
        .select("rating, comment, contact_email, contact_phone, created_at")
        .eq("id", reviewId)
        .maybeSingle();

      if (freshReview) {
        await sendLowRatingAlert(restaurant, freshReview);
      }
    } catch (err) {
      console.error(`Kunde inte skicka lågbetygslarm för ${restaurant.slug}:`, err.message);
    }
  }, LOW_RATING_ALERT_DELAY_MS);
}

// Höjer den befintliga koden med GOOGLE_BONUS_PERCENT om den inte redan har
// fått bonusen. En kod per recension (unik `review_id`), så bonusen läggs
// alltid på samma kod istället för att skapa en andra.
async function applyGoogleBonus(reviewId) {
  const { data: discount, error } = await supabase
    .from("discount_codes")
    .select("id, discount_percent, bonus_applied")
    .eq("review_id", reviewId)
    .maybeSingle();

  if (error || !discount || discount.bonus_applied) {
    return null;
  }

  const newPercent = (discount.discount_percent || 0) + GOOGLE_BONUS_PERCENT;

  const { data: updated, error: updateError } = await supabase
    .from("discount_codes")
    .update({ discount_percent: newPercent, bonus_applied: true })
    .eq("id", discount.id)
    .select("discount_percent")
    .single();

  if (updateError) {
    return null;
  }

  return updated.discount_percent;
}

// In-memory fördröjning, samma accepterade avvägning som lågbetygslarmet.
function scheduleGoogleBonusReminder(restaurant, reviewId, phone) {
  setTimeout(async () => {
    try {
      const { data: freshReview } = await supabase
        .from("reviews")
        .select("clicked_google")
        .eq("id", reviewId)
        .maybeSingle();

      if (!freshReview || freshReview.clicked_google) return;

      const { data: discount } = await supabase
        .from("discount_codes")
        .select("bonus_applied")
        .eq("review_id", reviewId)
        .maybeSingle();

      if (!discount || discount.bonus_applied) return;

      const googleReviewUrl = `https://search.google.com/local/writereview?placeid=${encodeURIComponent(
        restaurant.google_place_id
      )}`;
      await sendGoogleBonusReminderSms(restaurant, GOOGLE_BONUS_PERCENT, googleReviewUrl, phone);
    } catch (err) {
      console.error(`Kunde inte skicka Google-bonuspåminnelse för ${restaurant.slug}:`, err.message);
    }
  }, GOOGLE_BONUS_REMINDER_DELAY_MS);
}

router.post("/", deviceId, reviewLimiter, async (req, res) => {
  const { restaurantSlug, rating, comment, website } = req.body || {};

  // Honeypot: dolt fält i formuläret som riktiga användare aldrig fyller i.
  // Låtsas lyckas så botar inte lär sig att de blev stoppade.
  if (website) {
    return res.json({ status: "thanks" });
  }

  const ratingNum = Number(rating);
  if (!restaurantSlug || !Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ error: "Ogiltigt betyg eller restaurang.", code: "invalid_rating" });
  }

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("id, slug, name, google_place_id, discount_percent, discount_valid_days, high_rating_threshold, owner_email")
    .eq("slug", restaurantSlug)
    .maybeSingle();

  if (restaurantError) {
    return res.status(500).json({ error: "Kunde inte hämta restaurang.", code: "server_error" });
  }
  if (!restaurant) {
    return res.status(404).json({ error: "Restaurangen hittades inte.", code: "restaurant_not_found" });
  }

  const cooldownSince = new Date(Date.now() - DEVICE_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
  const { data: recentReview, error: recentError } = await supabase
    .from("reviews")
    .select("id")
    .eq("restaurant_id", restaurant.id)
    .eq("device_id", req.deviceId)
    .gte("created_at", cooldownSince)
    .maybeSingle();

  if (recentError) {
    return res.status(500).json({ error: "Kunde inte kontrollera tidigare recensioner.", code: "server_error" });
  }
  if (recentReview) {
    return res
      .status(429)
      .json({ error: "Du har redan lämnat en recension nyligen. Tack!", code: "already_reviewed" });
  }

  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  const ipHash = hashIp(ip);

  const { data: review, error: insertError } = await supabase
    .from("reviews")
    .insert({
      restaurant_id: restaurant.id,
      rating: ratingNum,
      comment: typeof comment === "string" ? comment.slice(0, 2000) : null,
      device_id: req.deviceId,
      ip_hash: ipHash,
    })
    .select("id")
    .single();

  if (insertError) {
    return res.status(500).json({ error: "Kunde inte spara recensionen.", code: "server_error" });
  }

  const isHighRating = ratingNum >= restaurant.high_rating_threshold;
  if (!isHighRating) {
    scheduleLowRatingAlert(restaurant, review.id);

    return res.json({
      status: "thanks",
      reviewId: review.id,
      message: "Tack för din feedback! Den går direkt till restaurangen.",
      messageCode: "thanks_low",
    });
  }

  const validUntil = new Date(Date.now() + restaurant.discount_valid_days * 24 * 60 * 60 * 1000);
  const code = generateDiscountCode(restaurant.slug);

  const { error: discountError } = await supabase.from("discount_codes").insert({
    restaurant_id: restaurant.id,
    review_id: review.id,
    code,
    discount_percent: restaurant.discount_percent,
    valid_until: validUntil.toISOString(),
  });

  if (discountError) {
    // Recensionen är sparad, men vi kunde inte generera en rabattkod - gästen
    // ska ändå få ett svar istället för ett hårt fel.
    return res.json({
      status: "thanks",
      reviewId: review.id,
      message: "Tack för din recension!",
      messageCode: "thanks_no_discount",
    });
  }

  res.json({
    status: "high_rating",
    reviewId: review.id,
    discountCode: code,
    discountPercent: restaurant.discount_percent,
    discountValidUntil: validUntil.toISOString(),
    googleReviewUrl: `https://search.google.com/local/writereview?placeid=${encodeURIComponent(restaurant.google_place_id)}`,
  });
});

// Publik: review-id är ett svårgissat UUID. Gästen kan lägga till/uppdatera
// sin kommentar i efterhand, sedan betyget redan skickats in - detta gör att
// stjärnorna kan submittas direkt utan att gästen först måste ta ställning
// till om de vill skriva något.
router.patch("/:id/comment", reviewLimiter, async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body || {};

  if (typeof comment !== "string" || comment.trim().length === 0) {
    return res.status(400).json({ error: "Kommentaren kan inte vara tom.", code: "comment_empty" });
  }

  const { data, error } = await supabase
    .from("reviews")
    .update({ comment: comment.slice(0, 2000) })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: "Kunde inte spara kommentaren.", code: "server_error" });
  }
  if (!data) {
    return res.status(404).json({ error: "Recensionen hittades inte.", code: "review_not_found" });
  }

  res.json({ status: "ok" });
});

// Publik: review-id är ett svårgissat UUID. Gästen kan valfritt lämna
// kontaktuppgifter (efter ett lågt betyg) om de vill att restaurangen hör
// av sig - följer med i lågbetygslarmet till ägaren.
router.patch("/:id/contact", reviewLimiter, async (req, res) => {
  const { id } = req.params;
  const { email, phone } = req.body || {};

  const trimmedEmail = typeof email === "string" ? email.trim() : "";
  const trimmedPhone = typeof phone === "string" ? phone.trim() : "";

  if (!trimmedEmail && !trimmedPhone) {
    return res.status(400).json({ error: "Ange e-post eller telefonnummer.", code: "contact_required" });
  }
  if (trimmedEmail && !EMAIL_PATTERN.test(trimmedEmail)) {
    return res.status(400).json({ error: "Ogiltig e-postadress.", code: "invalid_email" });
  }
  if (trimmedPhone && (trimmedPhone.length < 6 || trimmedPhone.length > 30)) {
    return res.status(400).json({ error: "Ogiltigt telefonnummer.", code: "invalid_phone" });
  }

  const { data, error } = await supabase
    .from("reviews")
    .update({
      contact_email: trimmedEmail || null,
      contact_phone: trimmedPhone || null,
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: "Kunde inte spara kontaktuppgifterna.", code: "server_error" });
  }
  if (!data) {
    return res.status(404).json({ error: "Recensionen hittades inte.", code: "review_not_found" });
  }

  res.json({ status: "ok" });
});

// Publik: review-id är ett svårgissat UUID. Gästen kan valfritt lämna sitt
// telefonnummer efter ett högt betyg för att låsa upp en bonusrabatt genom
// att dela på Google - antingen direkt (om de redan klickat) eller via en
// påminnelse om 15 minuter om de inte hunnit än.
router.patch("/:id/phone", reviewLimiter, async (req, res) => {
  const { id } = req.params;
  const { phone } = req.body || {};

  const trimmedPhone = typeof phone === "string" ? phone.trim() : "";
  if (!trimmedPhone || trimmedPhone.length < 6 || trimmedPhone.length > 30) {
    return res.status(400).json({ error: "Ange ett giltigt telefonnummer.", code: "invalid_phone" });
  }

  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .update({ reminder_phone: trimmedPhone })
    .eq("id", id)
    .select("id, restaurant_id, clicked_google")
    .maybeSingle();

  if (reviewError) {
    return res.status(500).json({ error: "Kunde inte spara telefonnumret.", code: "server_error" });
  }
  if (!review) {
    return res.status(404).json({ error: "Recensionen hittades inte.", code: "review_not_found" });
  }

  if (review.clicked_google) {
    const newPercent = await applyGoogleBonus(review.id);
    if (newPercent) {
      return res.json({ status: "ok", bonusApplied: true, discountPercent: newPercent });
    }
  } else {
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("slug, name, google_place_id")
      .eq("id", review.restaurant_id)
      .maybeSingle();

    if (restaurant) {
      scheduleGoogleBonusReminder(restaurant, review.id, trimmedPhone);
    }
  }

  res.json({ status: "ok", bonusApplied: false });
});

// Publik: review-id är ett svårgissat UUID, så detta läcker ingen känslig data.
// Används dels för att räkna klick, dels för att lägga på Google-bonusen
// direkt om gästen redan lämnat sitt telefonnummer.
router.post("/:id/google-click", async (req, res) => {
  const { id } = req.params;

  const { data: review, error } = await supabase
    .from("reviews")
    .update({ clicked_google: true })
    .eq("id", id)
    .select("id, reminder_phone")
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: "Kunde inte registrera klicket.", code: "server_error" });
  }
  if (!review) {
    return res.status(404).json({ error: "Recensionen hittades inte.", code: "review_not_found" });
  }

  if (review.reminder_phone) {
    const newPercent = await applyGoogleBonus(review.id);
    if (newPercent) {
      return res.json({ status: "ok", bonusApplied: true, discountPercent: newPercent });
    }
  }

  res.json({ status: "ok", bonusApplied: false });
});

module.exports = router;
