const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const supabase = require("../lib/supabaseClient");
const config = require("../config");
const requireAuth = require("../middleware/requireAuth");
const { loginLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

router.post("/login", loginLimiter, async (req, res) => {
  const { slug, password } = req.body || {};
  if (!slug || !password) {
    return res.status(400).json({ error: "Ange restaurang och losenord." });
  }

  const { data: restaurant, error } = await supabase
    .from("restaurants")
    .select("id, slug, name, password_hash")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: "Nagot gick fel, forsok igen." });
  }
  if (!restaurant) {
    return res.status(401).json({ error: "Fel restaurang eller losenord." });
  }

  const passwordMatches = await bcrypt.compare(password, restaurant.password_hash);
  if (!passwordMatches) {
    return res.status(401).json({ error: "Fel restaurang eller losenord." });
  }

  const token = jwt.sign({ restaurantId: restaurant.id, slug: restaurant.slug }, config.jwtSecret, {
    expiresIn: "12h",
  });

  res.json({ token, restaurantName: restaurant.name });
});

router.get("/stats", requireAuth, async (req, res) => {
  const { data: reviews, error: reviewsError } = await supabase
    .from("reviews")
    .select("rating, clicked_google")
    .eq("restaurant_id", req.restaurantId);

  if (reviewsError) {
    return res.status(500).json({ error: "Kunde inte hamta statistik." });
  }

  const { data: discountCodes, error: discountError } = await supabase
    .from("discount_codes")
    .select("used")
    .eq("restaurant_id", req.restaurantId);

  if (discountError) {
    return res.status(500).json({ error: "Kunde inte hamta rabattstatistik." });
  }

  const totalReviews = reviews.length;
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let ratingSum = 0;
  let googleClicks = 0;

  for (const review of reviews) {
    distribution[review.rating] = (distribution[review.rating] || 0) + 1;
    ratingSum += review.rating;
    if (review.clicked_google) googleClicks += 1;
  }

  const averageRating = totalReviews > 0 ? ratingSum / totalReviews : 0;
  const discountsIssued = discountCodes.length;
  const discountsUsed = discountCodes.filter((code) => code.used).length;

  res.json({
    totalReviews,
    averageRating: Math.round(averageRating * 100) / 100,
    distribution,
    googleClicks,
    discountsIssued,
    discountsUsed,
  });
});

router.get("/reviews", requireAuth, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Number(req.query.pageSize) || 20);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("reviews")
    .select("id, rating, comment, clicked_google, created_at", { count: "exact" })
    .eq("restaurant_id", req.restaurantId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    return res.status(500).json({ error: "Kunde inte hamta recensioner." });
  }

  res.json({ reviews: data, total: count, page, pageSize });
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
    return res.status(500).json({ error: "Nagot gick fel, forsok igen." });
  }
  if (!discount) {
    return res.status(404).json({ error: "Rabattkoden hittades inte." });
  }
  if (discount.used) {
    return res.status(409).json({ error: "Rabattkoden ar redan anvand." });
  }
  if (new Date(discount.valid_until) < new Date()) {
    return res.status(409).json({ error: "Rabattkoden har gatt ut." });
  }

  const { error: updateError } = await supabase
    .from("discount_codes")
    .update({ used: true, used_at: new Date().toISOString() })
    .eq("id", discount.id);

  if (updateError) {
    return res.status(500).json({ error: "Kunde inte losa in koden." });
  }

  res.json({ status: "redeemed" });
});

module.exports = router;
