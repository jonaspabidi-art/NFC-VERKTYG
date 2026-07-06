require("dotenv").config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Saknar obligatorisk miljövariabel: ${name}`);
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
  // Valfri: om den inte är satt är ultra-admin-inloggning helt avstängd.
  superAdminPasswordHash: process.env.SUPER_ADMIN_PASSWORD_HASH || null,
  // Valfri: om den inte är satt skickas inga lågbetygslarm (bara loggas).
  resendApiKey: process.env.RESEND_API_KEY || null,
  resendFromEmail: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
  // Valfri: din publika URL (utan avslutande /), t.ex. https://mitt-namn.up.railway.app.
  // Används bara för att lägga en länk till adminvyn i larmmejlet.
  appBaseUrl: process.env.APP_BASE_URL || null,
  // Valfri: om användarnamn/lösenord saknas skickas inga SMS-påminnelser (bara loggas).
  elksApiUsername: process.env.ELKS_API_USERNAME || null,
  elksApiPassword: process.env.ELKS_API_PASSWORD || null,
  // Valfri avsändare (nummer eller kort text) - utan den använder 46elks sin standardavsändare.
  elksFrom: process.env.ELKS_FROM || null,
};
