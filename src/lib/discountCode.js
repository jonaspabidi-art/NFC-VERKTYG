const { customAlphabet } = require("nanoid");

// Uteslutna tecken: 0/O, 1/I/L - undviker forvaxlingar nar personal skriver
// av en kod fran en gasts mobil.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const generateSuffix = customAlphabet(ALPHABET, 6);

function generateDiscountCode(restaurantSlug) {
  const prefix = restaurantSlug.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `${prefix}-${generateSuffix()}`;
}

module.exports = { generateDiscountCode };
