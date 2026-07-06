const express = require("express");
const supabase = require("../lib/supabaseClient");
const { hashIp } = require("../lib/hash");
const { generateDiscountCode } = require("../lib/discountCode");
const deviceId = require("../middleware/deviceId");
const { reviewLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

const DEVICE_COOLDOWN_HOURS = 24;

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
    .select("id, slug, google_place_id, discount_percent, discount_valid_days, high_rating_threshold")
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
    return res.json({
      status: "thanks",
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
