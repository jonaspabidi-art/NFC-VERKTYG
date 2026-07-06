// Genererar en bcrypt-hash for ett lösenord, till exempel för en ny
// restaurangkund. Anvandning:
//   npm run hash-password -- "mitt-losenord"
const bcrypt = require("bcryptjs");

const password = process.argv[2];
if (!password) {
  console.error('Anvandning: npm run hash-password -- "ditt-losenord"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log(hash);
