const express = require("express");
const supabase = require("../lib/supabaseClient");

const router = express.Router();

// Publik endpoint: review-sidan använder denna för att veta vilken
// restaurang NFC-taggen pekar mot. Returnerar bara det klienten behöver -
// aldrig password_hash eller google_place_id.
router.get("/:slug", async (req, res) => {
  const { slug } = req.params;

  const { data, error } = await supabase
    .from("restaurants")
    .select("id, name, logo_url, accent_color")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: "Kunde inte hämta restaurang.", code: "server_error" });
  }
  if (!data) {
    return res.status(404).json({ error: "Restaurangen hittades inte.", code: "restaurant_not_found" });
  }

  res.json({ id: data.id, name: data.name, logoUrl: data.logo_url, accentColor: data.accent_color });
});

module.exports = router;
