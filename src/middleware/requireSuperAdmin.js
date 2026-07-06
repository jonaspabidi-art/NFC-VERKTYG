const jwt = require("jsonwebtoken");
const config = require("../config");

// Verifierar ultra-admin-JWT:n. Skiljs strikt från restaurang-JWT:n via
// role-fältet, så ett restaurang-JWT aldrig kan användas här och tvärtom.
function requireSuperAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Inte inloggad." });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.role !== "super_admin") {
      return res.status(401).json({ error: "Inte inloggad som ultra-admin." });
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Ogiltig eller utgången session." });
  }
}

module.exports = requireSuperAdmin;
