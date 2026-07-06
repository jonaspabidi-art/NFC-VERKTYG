const supabase = require("./supabaseClient");

async function getRestaurantStats(restaurantId) {
  const { data: reviews, error: reviewsError } = await supabase
    .from("reviews")
    .select("rating, clicked_google")
    .eq("restaurant_id", restaurantId);

  if (reviewsError) {
    throw reviewsError;
  }

  const { data: discountCodes, error: discountError } = await supabase
    .from("discount_codes")
    .select("used")
    .eq("restaurant_id", restaurantId);

  if (discountError) {
    throw discountError;
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

  return {
    totalReviews,
    averageRating: Math.round(averageRating * 100) / 100,
    distribution,
    googleClicks,
    discountsIssued,
    discountsUsed,
  };
}

async function getRestaurantReviews(restaurantId, page, pageSize) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("reviews")
    .select("id, rating, comment, clicked_google, created_at", { count: "exact" })
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }

  return { reviews: data, total: count, page, pageSize };
}

module.exports = { getRestaurantStats, getRestaurantReviews };
