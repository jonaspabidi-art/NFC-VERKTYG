const express = require("express");
const supabase = require("../lib/supabaseClient");

const router = express.Router();

// Publik endpoint: review-sidan anvander denna for att veta vilken
// restaurang NFC-taggen pekar mot. Returnerar bara det klienten behover -
// aldrig password_hash eller google_place_id.
router.get("/:slug", async (req, res) => {
  const { slug } = req.params;

  const { data, error } = await supabase
    .from("restaurants")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: "Kunde inte hamta restaurang." });
  }
  if (!data) {
    return res.status(404).json({ error: "Restaurangen hittades inte." });
  }

  res.json(data);
});

module.exports = router;
