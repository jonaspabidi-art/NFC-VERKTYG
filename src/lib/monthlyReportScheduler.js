const supabase = require("./supabaseClient");
const { getRestaurantStats } = require("./restaurantStats");
const { sendMonthlyReport } = require("./emailAlerts");

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const REPORT_INTERVAL_DAYS = 30;

function isDue(restaurant) {
  if (!restaurant.last_monthly_report_sent_at) return true;
  const daysSinceLastReport =
    (Date.now() - new Date(restaurant.last_monthly_report_sent_at).getTime()) / (24 * 60 * 60 * 1000);
  return daysSinceLastReport >= REPORT_INTERVAL_DAYS;
}

// Kör en gång vid serverstart och sedan var 24:e timme (se
// startMonthlyReportScheduler). Ingen extern cron behövs - varje körning är
// idempotent tack vare last_monthly_report_sent_at, så omstarter/redeploys
// varken missar eller dubbelskickar rapporter.
async function runMonthlyReportCheck() {
  const { data: restaurants, error } = await supabase
    .from("restaurants")
    .select("id, slug, name, owner_email, last_monthly_report_sent_at")
    .not("owner_email", "is", null);

  if (error) {
    console.error("Kunde inte hämta restauranger för månadsrapport:", error.message);
    return;
  }

  for (const restaurant of restaurants) {
    if (!isDue(restaurant)) continue;

    try {
      const stats = await getRestaurantStats(restaurant.id);
      await sendMonthlyReport(restaurant, stats);

      await supabase
        .from("restaurants")
        .update({ last_monthly_report_sent_at: new Date().toISOString() })
        .eq("id", restaurant.id);
    } catch (err) {
      console.error(`Kunde inte skicka månadsrapport för ${restaurant.slug}:`, err.message);
    }
  }
}

function startMonthlyReportScheduler() {
  const runSafely = () => runMonthlyReportCheck().catch((err) => console.error("Månadsrapport-koll misslyckades:", err.message));
  runSafely();
  setInterval(runSafely, CHECK_INTERVAL_MS);
}

module.exports = { startMonthlyReportScheduler, runMonthlyReportCheck };
