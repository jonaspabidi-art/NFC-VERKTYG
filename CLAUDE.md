# Restaurant Reviews (NFC-VERKTYG) - projektinstruktioner

Läs detta först. Dokumentet är en överlämning från en tidigare session och
innehåller allt du behöver för att fortsätta utveckla systemet.

## Vad systemet är

Multi-tenant recensionssystem för restauranger/butiker med NFC-ståndare eller
QR-skylt på bordet/disken. Gästen scannar → landar på `/review/index.html?r=<slug>`
→ lämnar 1-5 stjärnor + valfri kommentar. Högt betyg (>= restaurangens tröskel,
default 4) → uppmanas dela på Google + får rabatt att visa upp i kassan.
Lågt betyg → tackas, feedbacken går bara internt till restaurangägaren.

Affärsidén: ägaren (Jonas) säljer detta till restauranger/bolag som månadsprodukt.
Systemet ska konvertera nöjda gäster till Google-recensioner och fånga missnöjda
innan de skriver publikt.

## Drift och miljöer

- **Produktion**: https://nfc-verktyg-production.up.railway.app (Railway,
  auto-deploy vid push till `main`)
- **GitHub**: https://github.com/jonaspabidi-art/NFC-VERKTYG (privat)
- **Databas**: Supabase-projekt `xcuqmzzrdrjbqjayvnst` (Postgres)
- **Lokalt**: `npm start` (port från `.env`, senast 3100). `.env` finns lokalt
  (gitignored) med riktiga Supabase-uppgifter och är verifierad fungerande.
- Railway-miljövariabler: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `JWT_SECRET`, `IP_HASH_SALT`, `SUPER_ADMIN_PASSWORD_HASH`,
  `DEVICE_ID_COOKIE_NAME`, `NODE_ENV=production`. `PORT` sätts av Railway.

## Inloggningar

- **Ultra-admin** (`/superadmin/login.html`): bara lösenord, Jonas har det.
  Hashen ligger i `SUPER_ADMIN_PASSWORD_HASH` (Railway + lokal `.env`).
  Ej satt variabel = inloggning avstängd (503).
- **Testrestauranger** (`/admin/login.html`): `pizzeria-bella`/`pizzeria123`
  och `sushi-yama`/`sushi123` (seed-data, dokumenterat i README).
  OBS: deras `google_place_id` är PLACEHOLDER-värden - riktiga Place ID
  måste in innan skarp drift.

## Arkitektur (kortversion)

- `src/index.js` - Express, serverar API + statiska filer från `public/`
- `src/routes/reviews.js` - gästflödet: spamskydd, spara review, rabattkod.
  Stjärntryck submittar direkt (ingen kommentar krävs vid inskick); kommentar
  läggs till efteråt via `PATCH /:id/comment` (samma "svårgissat UUID är
  auktorisering nog"-mönster som `/google-click`).
- `src/routes/admin.js` - restaurangens login/stats/reviews/inställningar/redeem
- `src/routes/superadmin.js` - ultra-admin: CRUD på restauranger + drill-down-statistik
- `src/lib/restaurantStats.js` - delad statistik/paginering (används av båda admin-rollerna)
- `src/middleware/` - `requireAuth` (restaurang-JWT, kräver `restaurantId` i payload),
  `requireSuperAdmin` (kräver `role: "super_admin"`), `deviceId` (cookie),
  `rateLimiters`
- `public/review/`, `public/admin/`, `public/superadmin/` - vanilla JS-frontend,
  delat tema i `public/shared/theme.css` (mörkt + guld, CSS-variabler)
- `db/schema.sql` + `db/seed.sql` - körs manuellt i Supabase SQL Editor

## Viktiga beslut och varför (ändra inte utan skäl)

1. **NFC/QR-URL innehåller bara slug, inte Place ID** - Place ID slås upp
   server-side så taggar aldrig kan peka fel om ID byts.
2. **Rabatten är tekniskt INTE villkorad av Google-recensionen** - koden ges
   för betyget i vårt system. Detta är medvetet: Googles policy förbjuder
   incitament kopplade till recensioner. Jonas vill ändå att UI-texten säljer
   in Google-delningen hårt ("dela → visa i kassan → rabatt") - bygg ALDRIG
   verifiering av att en Google-recension faktiskt postats.
3. **Spamskydd i tre lager** (IP-rate-limit, 24h device-cookie per restaurang,
   honeypot) - medvetet "bra nog", inte vattentätt. Jonas har bekräftat att
   det ska vara kvar. Honeypot-träff returnerar fejkad success.
4. **Rabattkoder löses in via restaurangens admin-login** (personalen delar
   ägarens inlogg) - inget separat personalkontosystem i v1.
5. **Statistik beräknas i Node, inte SQL-aggregat** - OK för nuvarande volym,
   flytta till SQL vid stora volymer (flaggat i README).
6. **JWT-roller är strikt separerade**: restaurang-token utan `restaurantId`
   avvisas, superadmin kräver `role === "super_admin"`. Testa alltid
   isoleringen i BÅDA riktningarna om auth ändras.
7. **IP:n lagras aldrig i klartext** - bara saltad SHA-256 (`IP_HASH_SALT`).

## Hårda krav från Jonas

- **ÅÄÖ måste vara korrekt i ALL svensk text** (UI, felmeddelanden,
  kommentarer). Detta har gått fel förut och fick åtgärdas i efterhand.
- **Inga emojis i UI-kod** - använd vanliga Unicode-symboler (t.ex. &#9733;
  för stjärnor).
- Verifiera alltid mot produktion efter push (Railway auto-deployar från main,
  ta höjd för ~30-60s byggtid; polla tills ändringen svarar).

## Prioriterad roadmap (diskuterad med Jonas, inget påbörjat)

1. ~~**Trimma gästflödet**~~ - KLART (2026-07-06): stjärntryck submittar
   direkt (inget separat "Skicka"-klick), kommentaren är nu ett valfritt
   efterföljande steg på resultatsidan via `PATCH /api/reviews/:id/comment`.
   Verifierat i produktion.
2. **Lågbetygs-larm** (rekommenderad nästa feature): mejl/notis till ägaren
   direkt vid 1-2-stjärnig recension. Säljargument: "fånga missnöjda gäster
   innan de skriver på Google". Kräver e-posttjänst (t.ex. Resend) +
   e-postkolumn på restaurants-tabellen.
3. **Automatisk månadsrapport** till ägaren (antal recensioner, snitt,
   inlösta koder) - minskar churn, blir säljmaterial.
4. **Engelska** som andraspråk på gästsidan (turister).
5. **Branding per restaurang** (logga + accentfärg på gästsidan).
6. **SMS-påminnelse** några timmar efter högt betyg för att slutföra
   Google-recensionen - diskuterad och medvetet parkerad (PII/GDPR + kostnad,
   opt-in-fält efter inskickat betyg). Jonas tror på den för konvertering.
7. **Demo-restaurang** med snygg data för säljmöten.

## Övrigt läge just nu

- Skyltarna Jonas beställt har egna QR-koder, troligen dynamiska - han
  konfigurerar själv mål-URL hos leverantören till
  `https://nfc-verktyg-production.up.railway.app/review/index.html?r=<slug>`.
  Om de visar sig vara statiska: bygg en redirect-route på den URL QR-koden
  redan pekar mot.
- Ingen egen domän ännu - `.up.railway.app`-adressen används överallt
  (även i NFC-taggar; egen domän bör fixas INNAN många taggar skrivs).
- Inga automatiska tester finns - verifiering sker via curl-flöden lokalt
  (se README) och mot produktion.
- `npm run hash-password -- "lösenord"` genererar bcrypt-hashar (används för
  nya restauranger via SQL-vägen och för superadmin-lösenordet).
