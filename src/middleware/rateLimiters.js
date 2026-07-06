const rateLimit = require("express-rate-limit");

// Blunt första försvarslinje mot spam/skript: max 10 recensionsförsök per
// IP var 15:e minut. Det finare skyddet (samma enhet/restaurang) sker i
// reviews-routen via device_id.
const reviewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "För många försök, försök igen senare." },
});

// Strängare gräns mot brute-force på adminlösenord.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "För många inloggningsförsök, försök igen senare." },
});

module.exports = { reviewLimiter, loginLimiter };
