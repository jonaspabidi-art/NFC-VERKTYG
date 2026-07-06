const express = require("express");
const supabase = require("../lib/supabaseClient");
const { hashIp } = require("../lib/hash");
const { generateDiscountCode } = require("../lib/discountCode");
const { sendLowRatingAlert } = require("../lib/emailAlerts");
const deviceId = require("../middleware/deviceId");
const { reviewLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

const DEVICE_COOLDOWN_HOURS = 24;
// Ger gästen tid att lägga till en kommentar (PATCH /:id/comment) på
// resultatsidan innan larmet går iväg, så ägaren oftast får texten också.
const LOW_RATING_ALERT_DELAY_MS = 2 * 60 * 1000;

// In-memory fördröjning - ett schemalagt larm förloras vid omstart/redeploy.
// Accepterad avvägning för v1 (samma nivå som övriga enkla lösningar här).
function scheduleLowRatingAlert(restaurant, reviewId) {
  if (!restaurant.owner_email) return;

  setTimeout(async () => {
    try {
      const { data: freshReview } = await supabase
        .from("reviews")
        .select("rating, comment, created_at")
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

router.post("/", deviceId, reviewLimiter, async (req, res) => {
  const { restaurantSlug, rating, comment, website } = req.body || {};

  // Honeypot: dolt fält i formuläret som riktiga användare aldrig fyller i.
  // Låtsas lyckas så botar inte lär sig att de blev stoppade.
  if (website) {
    return res.json({ status: "thanks" });
  }

  const ratingNum = Number(rating);
  if (!restaurantSlug || !Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ error: "Ogiltigt betyg eller restaurang." });
  }

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("id, slug, name, google_place_id, discount_percent, discount_valid_days, high_rating_threshold, owner_email")
    .eq("slug", restaurantSlug)
    .maybeSingle();

  if (restaurantError) {
    return res.status(500).json({ error: "Kunde inte hämta restaurang." });
  }
  if (!restaurant) {
    return res.status(404).json({ error: "Restaurangen hittades inte." });
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
    return res.status(500).json({ error: "Kunde inte kontrollera tidigare recensioner." });
  }
  if (recentReview) {
    return res.status(429).json({ error: "Du har redan lämnat en recension nyligen. Tack!" });
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
    return res.status(500).json({ error: "Kunde inte spara recensionen." });
  }

  const isHighRating = ratingNum >= restaurant.high_rating_threshold;
  if (!isHighRating) {
    scheduleLowRatingAlert(restaurant, review.id);

    return res.json({
      status: "thanks",
      reviewId: review.id,
      message: "Tack för din feedback! Den går direkt till restaurangen.",
    });
  }

  const validUntil = new Date(Date.now() + restaurant.discount_valid_days * 24 * 60 * 60 * 1000);
  const code = generateDiscountCode(restaurant.slug);

  const { error: discountError } = await supabase.from("discount_codes").insert({
    restaurant_id: restaurant.id,
    review_id: review.id,
    code,
    valid_until: validUntil.toISOString(),
  });

  if (discountError) {
    // Recensionen är sparad, men vi kunde inte generera en rabattkod - gästen
    // ska ändå få ett svar istället för ett hårt fel.
    return res.json({
      status: "thanks",
      reviewId: review.id,
      message: "Tack för din recension!",
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
    return res.status(400).json({ error: "Kommentaren kan inte vara tom." });
  }

  const { data, error } = await supabase
    .from("reviews")
    .update({ comment: comment.slice(0, 2000) })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: "Kunde inte spara kommentaren." });
  }
  if (!data) {
    return res.status(404).json({ error: "Recensionen hittades inte." });
  }

  res.json({ status: "ok" });
});

// Publik: review-id är ett svårgissat UUID, så detta läcker ingen känslig data.
// Används enbart för att räkna hur många som faktiskt klickar sig vidare.
router.post("/:id/google-click", async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase.from("reviews").update({ clicked_google: true }).eq("id", id);

  if (error) {
    return res.status(500).json({ error: "Kunde inte registrera klicket." });
  }

  res.json({ status: "ok" });
});

module.exports = router;
