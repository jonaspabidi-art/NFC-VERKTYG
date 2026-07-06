const crypto = require("crypto");
const config = require("../config");

// Sätter en långlivad, slumpmässig cookie första gången en gäst öppnar
// review-sidan. Används för att spara "samma enhet recenserade nyligen"
// utan att kräva inloggning från gästen.
function deviceId(req, res, next) {
  let id = req.cookies[config.deviceIdCookieName];
  if (!id) {
    id = crypto.randomUUID();
    res.cookie(config.deviceIdCookieName, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.nodeEnv === "production",
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });
  }
  req.deviceId = id;
  next();
}

module.exports = deviceId;
