const { createClient } = require("@supabase/supabase-js");
const config = require("../config");

// Service-role-klient: anvands ENDAST server-side. Nyckeln exponeras aldrig
// till frontend. All atkomst till databasen gar via detta API.
const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

module.exports = supabase;
