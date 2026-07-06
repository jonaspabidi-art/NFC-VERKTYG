const crypto = require("crypto");
const config = require("../config");

// Hashar en IP-adress med en serverhemlighet sa att raa IP-adresser aldrig
// lagras i databasen, men vi kan fortfarande jamfora "samma IP" over tid.
function hashIp(ip) {
  return crypto.createHash("sha256").update(`${config.ipHashSalt}:${ip}`).digest("hex");
}

module.exports = { hashIp };
