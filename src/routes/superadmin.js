const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const supabase = require("../lib/supabaseClient");
const config = require("../config");
const requireSuperAdmin = require("../middleware/requireSuperAdmin");
const { superAdminLoginLimiter } = require("../middleware/rateLimiters");
const { getRestaurantStats, getRestaurantReviews } = require("../lib/restaurantStats");

const router = express.Router();

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSettings({ discountPercent, discountValidDays, highRatingThreshold }) {
  if (discountPercent !== undefined) {
    const value = Number(discountPercent);
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      return "Rabattprocent måste vara ett heltal mellan 0 och 100.";
    }
  }
  if (discountValidDays !== undefined) {
    const value = Number(discountValidDays);
    if (!Number.isInteger(value) || value < 1 || value > 365) {
      return "Giltighetstid måste vara mellan 1 och 365 dagar.";
    }
  }
  if (highRatingThreshold !== undefined) {
    const value = Number(highRatingThreshold);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      return "Betygströskel måste vara mellan 1 och 5.";
    }
  }
  return null;
}

router.post("/login", superAdminLoginLimiter, async (req, res) => {
  if (!config.superAdminPasswordHash) {
    return res.status(503).json({ error: "Ultra-admin är inte konfigurerad på denna server." });
  }

  const { password } = req.body || {};
  if (!password) {
    return res.status(400).json({ error: "Ange lösenord." });
  }

  const passwordMatches = await bcrypt.compare(password, config.superAdminPasswordHash);
  if (!passwordMatches) {
    return res.status(401).json({ error: "Fel lösenord." });
  }

  const token = jwt.sign({ role: "super_admin" }, config.jwtSecret, { expiresIn: "12h" });
  res.json({ token });
});

router.get("/restaurants", requireSuperAdmin, async (req, res) => {
  const { data: restaurants, error: restaurantsError } = await supabase
    .from("restaurants")
    .select(
      "id, slug, name, google_place_id, discount_percent, discount_valid_days, high_rating_threshold, owner_email, created_at"
    )
    .order("created_at", { ascending: false });

  if (restaurantsError) {
    return res.status(500).json({ error: "Kunde inte hämta restauranger." });
  }

  const { data: reviews, error: reviewsError } = await supabase.from("reviews").select("restaurant_id, rating");

  if (reviewsError) {
    return res.status(500).json({ error: "Kunde inte hämta recensionsstatistik." });
  }

  const statsByRestaurant = {};
  for (const review of reviews) {
    const stats = statsByRestaurant[review.restaurant_id] || { count: 0, sum: 0 };
    stats.count += 1;
    stats.sum += review.rating;
    statsByRestaurant[review.restaurant_id] = stats;
  }

  const result = restaurants.map((restaurant) => {
    const stats = statsByRestaurant[restaurant.id] || { count: 0, sum: 0 };
    return {
      id: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.name,
      googlePlaceId: restaurant.google_place_id,
      discountPercent: restaurant.discount_percent,
      discountValidDays: restaurant.discount_valid_days,
      highRatingThreshold: restaurant.high_rating_threshold,
      ownerEmail: restaurant.owner_email,
      createdAt: restaurant.created_at,
      totalReviews: stats.count,
      averageRating: stats.count > 0 ? Math.round((stats.sum / stats.count) * 100) / 100 : 0,
    };
  });

  res.json({ restaurants: result });
});

router.get("/restaurants/:id/stats", requireSuperAdmin, async (req, res) => {
  try {
    res.json(await getRestaurantStats(req.params.id));
  } catch (err) {
    res.status(500).json({ error: "Kunde inte hämta statistik." });
  }
});

router.get("/restaurants/:id/reviews", requireSuperAdmin, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Number(req.query.pageSize) || 20);

  try {
    res.json(await getRestaurantReviews(req.params.id, page, pageSize));
  } catch (err) {
    res.status(500).json({ error: "Kunde inte hämta recensioner." });
  }
});

router.post("/restaurants", requireSuperAdmin, async (req, res) => {
  const {
    slug,
    name,
    googlePlaceId,
    password,
    discountPercent,
    discountValidDays,
    highRatingThreshold,
    ownerEmail,
  } = req.body || {};

  if (!slug || !SLUG_PATTERN.test(slug)) {
    return res.status(400).json({ error: "Slug måste bestå av gemener, siffror och bindestreck." });
  }
  if (!name || !googlePlaceId || !password) {
    return res.status(400).json({ error: "Namn, Google Place ID och lösenord krävs." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Lösenordet måste vara minst 6 tecken." });
  }
  if (ownerEmail && !EMAIL_PATTERN.test(ownerEmail)) {
    return res.status(400).json({ error: "Ogiltig e-postadress." });
  }

  const settingsError = validateSettings({ discountPercent, discountValidDays, highRatingThreshold });
  if (settingsError) {
    return res.status(400).json({ error: settingsError });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from("restaurants")
    .insert({
      slug,
      name,
      google_place_id: googlePlaceId,
      password_hash: passwordHash,
      ...(discountPercent !== undefined && { discount_percent: Number(discountPercent) }),
      ...(discountValidDays !== undefined && { discount_valid_days: Number(discountValidDays) }),
      ...(highRatingThreshold !== undefined && { high_rating_threshold: Number(highRatingThreshold) }),
      ...(ownerEmail !== undefined && { owner_email: ownerEmail || null }),
    })
    .select("id, slug, name")
    .single();

  if (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "En restaurang med den sluggen finns redan." });
    }
    return res.status(500).json({ error: "Kunde inte skapa restaurangen." });
  }

  res.status(201).json(data);
});

router.patch("/restaurants/:id", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, googlePlaceId, password, discountPercent, discountValidDays, highRatingThreshold, ownerEmail } =
    req.body || {};

  const settingsError = validateSettings({ discountPercent, discountValidDays, highRatingThreshold });
  if (settingsError) {
    return res.status(400).json({ error: settingsError });
  }
  if (password !== undefined && password.length < 6) {
    return res.status(400).json({ error: "Lösenordet måste vara minst 6 tecken." });
  }
  if (ownerEmail && !EMAIL_PATTERN.test(ownerEmail)) {
    return res.status(400).json({ error: "Ogiltig e-postadress." });
  }

  const updates = {
    ...(name !== undefined && { name }),
    ...(googlePlaceId !== undefined && { google_place_id: googlePlaceId }),
    ...(discountPercent !== undefined && { discount_percent: Number(discountPercent) }),
    ...(discountValidDays !== undefined && { discount_valid_days: Number(discountValidDays) }),
    ...(highRatingThreshold !== undefined && { high_rating_threshold: Number(highRatingThreshold) }),
    ...(ownerEmail !== undefined && { owner_email: ownerEmail || null }),
  };
  if (password) {
    updates.password_hash = await bcrypt.hash(password, 10);
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "Inget att uppdatera." });
  }

  const { data, error } = await supabase
    .from("restaurants")
    .update(updates)
    .eq("id", id)
    .select(
      "id, slug, name, google_place_id, discount_percent, discount_valid_days, high_rating_threshold, owner_email"
    )
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: "Kunde inte uppdatera restaurangen." });
  }
  if (!data) {
    return res.status(404).json({ error: "Restaurangen hittades inte." });
  }

  res.json(data);
});

router.delete("/restaurants/:id", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase.from("restaurants").delete().eq("id", id);

  if (error) {
    return res.status(500).json({ error: "Kunde inte ta bort restaurangen." });
  }

  res.json({ status: "deleted" });
});

module.exports = router;
