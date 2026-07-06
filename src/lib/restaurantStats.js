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
    .select(
      "id, rating, comment, clicked_google, contact_email, contact_phone, reminder_phone, created_at",
      { count: "exact" }
    )
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }

  const reviewIds = data.map((review) => review.id);
  const { data: discountCodes, error: discountError } =
    reviewIds.length > 0
      ? await supabase
          .from("discount_codes")
          .select("review_id, code, discount_percent, bonus_applied, valid_until")
          .in("review_id", reviewIds)
      : { data: [], error: null };

  if (discountError) {
    throw discountError;
  }

  const discountByReviewId = {};
  for (const discount of discountCodes) {
    discountByReviewId[discount.review_id] = discount;
  }

  const reviews = data.map((review) => ({
    ...review,
    discount_code: discountByReviewId[review.id]?.code || null,
    discount_percent: discountByReviewId[review.id]?.discount_percent || null,
    discount_bonus_applied: discountByReviewId[review.id]?.bonus_applied || false,
    discount_valid_until: discountByReviewId[review.id]?.valid_until || null,
  }));

  return { reviews, total: count, page, pageSize };
}

module.exports = { getRestaurantStats, getRestaurantReviews };
