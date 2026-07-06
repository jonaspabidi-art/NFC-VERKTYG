const jwt = require("jsonwebtoken");
const config = require("../config");

// Verifierar admin-JWT:n och satter req.restaurantId sa varje route bara
// nagonsin kan lasa/skriva den inloggade restaurangens egen data.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Inte inloggad." });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.restaurantId = payload.restaurantId;
    req.restaurantSlug = payload.slug;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Ogiltig eller utgangen session." });
  }
}

module.exports = requireAuth;
