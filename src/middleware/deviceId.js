const crypto = require("crypto");
const config = require("../config");

// Satter en langlivad, slumpmassig cookie forsta gangen en gast oppnar
// review-sidan. Anvands for att spara "samma enhet recenserade nyligen"
// utan att kra inloggning fran gasten.
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
