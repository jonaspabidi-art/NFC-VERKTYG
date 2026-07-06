const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const config = require("./config");

const restaurantsRouter = require("./routes/restaurants");
const reviewsRouter = require("./routes/reviews");
const adminRouter = require("./routes/admin");
const superadminRouter = require("./routes/superadmin");

const app = express();

app.set("trust proxy", 1); // Railway/liknande proxyar - behövs för korrekt req.ip

app.use(
  helmet({
    // Tillåt inline <script>/<style> i våra egna statiska sidor utan att
    // dra in en extern CSP-konfiguration för ett litet vanilla-JS-projekt.
    contentSecurityPolicy: false,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use("/api/restaurants", restaurantsRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/superadmin", superadminRouter);

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", (req, res) => {
  res.redirect("/admin/login.html");
});

app.use((req, res) => {
  res.status(404).json({ error: "Hittades inte." });
});

app.listen(config.port, () => {
  console.log(`Servern kör på http://localhost:${config.port}`);
});
