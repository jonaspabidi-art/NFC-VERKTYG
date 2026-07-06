const rateLimit = require("express-rate-limit");

// Blunt forsta forsvarslinje mot spam/skript: max 10 recensionsforsok per
// IP var 15:e minut. Det finare skyddet (samma enhet/restaurang) sker i
// reviews-routen via device_id.
const reviewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "For manga forsok, forsok igen senare." },
});

// Strangare grans mot brute-force pa adminlosenord.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "For manga inloggningsforsok, forsok igen senare." },
});

module.exports = { reviewLimiter, loginLimiter };
