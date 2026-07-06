require("dotenv").config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Saknar obligatorisk miljovariabel: ${name}`);
  }
  return value;
}

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  jwtSecret: required("JWT_SECRET"),
  ipHashSalt: required("IP_HASH_SALT"),
  deviceIdCookieName: process.env.DEVICE_ID_COOKIE_NAME || "rr_device_id",
};
