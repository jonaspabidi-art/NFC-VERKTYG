const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const supabase = require("../lib/supabaseClient");
const config = require("../config");
const requireAuth = require("../middleware/requireAuth");
const { loginLimiter } = require("../middleware/rateLimiters");
const { getRestaurantStats, getRestaurantReviews } = require("../lib/restaurantStats");
const { generateDiscountCode } = require("../lib/discountCode");
const { sendRecoveryDiscountEmail } = require("../lib/emailAlerts");

const router = express.Router();

router.post("/login", loginLimiter, async (req, res) => {
  const { slug, password } = req.body || {};
  if (!slug || !password) {
    return res.status(400).json({ error: "Ange restaurang och lösenord." });
  }

  const { data: restaurant, error } = await supabase
    .from("restaurants")
    .select("id, slug, name, password_hash")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: "Något gick fel, försök igen." });
  }
  if (!restaurant) {
    return res.status(401).json({ error: "Fel restaurang eller lösenord." });
  }

  const passwordMatches = await bcrypt.compare(password, restaurant.password_hash);
  if (!passwordMatches) {
    return res.status(401).json({ error: "Fel restaurang eller lösenord." });
  }

  const token = jwt.sign({ restaurantId: restaurant.id, slug: restaurant.slug }, config.jwtSecret, {
    expiresIn: "12h",
  });

  res.json({ token, restaurantName: restaurant.name });
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get("/settings", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("restaurants")
    .select("discount_percent, discount_valid_days, high_rating_threshold, owner_email")
    .eq("id", req.restaurantId)
    .single();

  if (error) {
    return res.status(500).json({ error: "Kunde inte hämta inställningar." });
  }

  res.json({
    discountPercent: data.discount_percent,
    discountValidDays: data.discount_valid_days,
    highRatingThreshold: data.high_rating_threshold,
    ownerEmail: data.owner_email,
  });
});

router.patch("/settings", requireAuth, async (req, res) => {
  const { discountPercent, discountValidDays, highRatingThreshold, ownerEmail } = req.body || {};

  const percent = Number(discountPercent);
  const validDays = Number(discountValidDays);
  const threshold = Number(highRatingThreshold);

  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    return res.status(400).json({ error: "Rabattprocent måste vara ett heltal mellan 0 och 100." });
  }
  if (!Number.isInteger(validDays) || validDays < 1 || validDays > 365) {
    return res.status(400).json({ error: "Giltighetstid måste vara mellan 1 och 365 dagar." });
  }
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 5) {
    return res.status(400).json({ error: "Betygströskel måste vara mellan 1 och 5." });
  }
  if (ownerEmail && !EMAIL_PATTERN.test(ownerEmail)) {
    return res.status(400).json({ error: "Ogiltig e-postadress." });
  }

  const { data, error } = await supabase
    .from("restaurants")
    .update({
      discount_percent: percent,
      discount_valid_days: validDays,
      high_rating_threshold: threshold,
      owner_email: ownerEmail || null,
    })
    .eq("id", req.restaurantId)
    .select("discount_percent, discount_valid_days, high_rating_threshold, owner_email")
    .single();

  if (error) {
    return res.status(500).json({ error: "Kunde inte spara inställningar." });
  }

  res.json({
    discountPercent: data.discount_percent,
    discountValidDays: data.discount_valid_days,
    highRatingThreshold: data.high_rating_threshold,
    ownerEmail: data.owner_email,
  });
});

router.get("/stats", requireAuth, async (req, res) => {
  try {
    res.json(await getRestaurantStats(req.restaurantId));
  } catch (err) {
    res.status(500).json({ error: "Kunde inte hämta statistik." });
  }
});

router.get("/reviews", requireAuth, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Number(req.query.pageSize) || 20);

  try {
    res.json(await getRestaurantReviews(req.restaurantId, page, pageSize));
  } catch (err) {
    res.status(500).json({ error: "Kunde inte hämta recensioner." });
  }
});

router.post("/reviews/:id/recovery-discount", requireAuth, async (req, res) => {
  const { id } = req.params;

  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .select("id, restaurant_id, contact_email")
    .eq("id", id)
    .eq("restaurant_id", req.restaurantId)
    .maybeSingle();

  if (reviewError) {
    return res.status(500).json({ error: "Kunde inte hämta recensionen." });
  }
  if (!review) {
    return res.status(404).json({ error: "Recensionen hittades inte." });
  }

  const { data: existing, error: existingError } = await supabase
    .from("discount_codes")
    .select("code, valid_until")
    .eq("review_id", review.id)
    .maybeSingle();

  if (existingError) {
    return res.status(500).json({ error: "Något gick fel, försök igen." });
  }
  if (existing) {
    return res.json({ isNew: false, discountCode: existing.code, discountValidUntil: existing.valid_until });
  }

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("slug, name, discount_percent, discount_valid_days")
    .eq("id", req.restaurantId)
    .single();

  if (restaurantError) {
    return res.status(500).json({ error: "Kunde inte hämta restaurangen." });
  }

  const validUntil = new Date(Date.now() + restaurant.discount_valid_days * 24 * 60 * 60 * 1000);
  const code = generateDiscountCode(restaurant.slug);

  const { error: insertError } = await supabase.from("discount_codes").insert({
    restaurant_id: req.restaurantId,
    review_id: review.id,
    code,
    valid_until: validUntil.toISOString(),
  });

  if (insertError) {
    return res.status(500).json({ error: "Kunde inte skapa rabattkoden." });
  }

  if (review.contact_email) {
    await sendRecoveryDiscountEmail(restaurant, review, code, restaurant.discount_percent, validUntil);
  }

  res.json({ isNew: true, discountCode: code, discountValidUntil: validUntil.toISOString() });
});

router.post("/discounts/:code/redeem", requireAuth, async (req, res) => {
  const { code } = req.params;

  const { data: discount, error } = await supabase
    .from("discount_codes")
    .select("id, used, valid_until, restaurant_id")
    .eq("code", code.toUpperCase())
    .eq("restaurant_id", req.restaurantId)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: "Något gick fel, försök igen." });
  }
  if (!discount) {
    return res.status(404).json({ error: "Rabattkoden hittades inte." });
  }
  if (discount.used) {
    return res.status(409).json({ error: "Rabattkoden är redan använd." });
  }
  if (new Date(discount.valid_until) < new Date()) {
    return res.status(409).json({ error: "Rabattkoden har gått ut." });
  }

  const { error: updateError } = await supabase
    .from("discount_codes")
    .update({ used: true, used_at: new Date().toISOString() })
    .eq("id", discount.id);

  if (updateError) {
    return res.status(500).json({ error: "Kunde inte lösa in koden." });
  }

  res.json({ status: "redeemed" });
});

module.exports = router;
