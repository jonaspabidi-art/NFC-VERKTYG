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
  Valfria: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `APP_BASE_URL` (styr
  lågbetygslarmet, se nedan - saknas de skickas bara inga larm, inget fel).

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
- `src/lib/emailAlerts.js` - `sendLowRatingAlert` + `sendMonthlyReport` via
  Resends REST-API (fetch, ingen npm-dependency), delad `sendEmail`-helper,
  no-op om `RESEND_API_KEY`/`owner_email` saknas
- `src/lib/monthlyReportScheduler.js` - periodisk koll (se beslut 9 nedan),
  startas från `src/index.js` vid serverstart
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
8. **Lågbetygslarmet fördröjs 2 minuter** (`LOW_RATING_ALERT_DELAY_MS` i
   `src/routes/reviews.js`) via in-memory `setTimeout`, INTE en riktig kö -
   fångar upp en kommentar tillagd efteråt (`PATCH /:id/comment`) innan
   mejlet skickas, men förloras om servern startar om/omdeployas under
   fördröjningen. Medvetet accepterad begränsning för v1 - flytta till en
   riktig kö (t.ex. en `scheduled_at`-kolumn + cron) om det blir ett problem.
9. **Periodiska utskick = 24h-`setInterval` + DB-tidsstämpel, inte cron.**
   Etablerat i `src/lib/monthlyReportScheduler.js`: kör direkt vid start,
   sedan var 24:e timme, jämför mot en `last_*_sent_at`-kolumn för att avgöra
   om det är dags. Idempotent kring omstarter/redeploys. Återanvänd samma
   mönster om fler periodiska utskick tillkommer (t.ex. veckorapport) -
   ingen anledning att införa en extern cron-tjänst för det här.

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
2. ~~**Lågbetygs-larm**~~ - KLART (2026-07-06): mejl via Resend till
   `restaurants.owner_email` vid betyg under tröskeln, 2 min fördröjning för
   att hinna fånga en efterhandskommentar (se beslut 8 ovan). Restaurangen
   sätter sin egen larm-e-post i Inställningar, ultra-admin kan sätta den vid
   skapande/redigering. `owner_email`-kolumnen kördes som separat migrering
   (låg utanför den ursprungliga schema.sql-körningen).
   - Verifierat LOKALT med riktig Resend-nyckel: mejl levererat till Jonas
     egen adress (`onboarding@resend.dev`-avsändare, `last_event: delivered`
     bekräftat via Resends API).
   - `RESEND_API_KEY` är ÄNNU INTE satt i Railway - Jonas har nyckeln
     (`re_jHqhowQg_...`, given i chatten, redan i lokal `.env`) men har inte
     lagt in den i Railway Variables än. Fråga om det är gjort innan du
     antar att larmet funkar i produktion.
   - Viktigt Resend-beslut: Jonas Resend-konto delas med ett annat projekt
     ("BK Däck", bildäcksbokningar, domän `bkdack.se`/`xn--bkdck-ira.se`
     redan verifierad där). `onboarding@resend.dev` kan bara leverera till
     kontots EGEN e-post (Jonas), inte till en godtycklig restaurangägare -
     Jonas valde MEDVETET att vänta med att verifiera en egen domän för det
     här projektet (avstod från att återanvända bkdäck-domänen, ville inte
     köpa en ny domän direkt heller) - så riktiga tredjeparts-restaurangmejl
     fungerar INTE förrän en domän skaffas/verifieras. Fråga inte om att
     återanvända bkdäck-domänen igen, redan diskuterat och avböjt.
3. ~~**Automatisk månadsrapport**~~ - KLART (2026-07-06): mejl var 30:e dag
   via `src/lib/monthlyReportScheduler.js` (idempotent daglig koll mot
   `restaurants.last_monthly_report_sent_at`, ingen extern cron). Manuell
   utlösare `POST /api/superadmin/restaurants/:id/send-report` + knapp
   "Skicka rapport nu" i `/superadmin/dashboard.html`. Samma
   Resend-integration som lågbetygslarmet, samma no-op-utan-config-princip.
   `last_monthly_report_sent_at`-kolumnen kräver samma typ av separat
   migrering som `owner_email` gjorde (fråga om Jonas kört den innan du
   antar att schemaläggningen fungerar mot en riktig databas).
4. **Engelska** som andraspråk på gästsidan (turister).
5. **Branding per restaurang** (logga + accentfärg på gästsidan).
6. **SMS-påminnelse** några timmar efter högt betyg för att slutföra
   Google-recensionen - diskuterad och medvetet parkerad (PII/GDPR + kostnad,
   opt-in-fält efter inskickat betyg). Jonas tror på den för konvertering.
7. **Demo-restaurang** med snygg data för säljmöten.
8. ~~**Kontaktuppgifter + gottgörelsekod vid lågt betyg**~~ - KLART
   (2026-07-06, Jonas egen idé): gästen kan valfritt lämna e-post/telefon
   efter lågt betyg (`PATCH /api/reviews/:id/contact`), följer med i
   lågbetygslarmet. Ägaren kan MANUELLT trycka "Skicka gottgörelsekod" i
   `/admin/dashboard.html` (`POST /api/admin/reviews/:id/recovery-discount`)
   - **bygg ALDRIG om detta till automatisk generering vid lågt betyg**,
     Jonas avvisade det uttryckligen (risk att folk medvetet ger lågt betyg
     för att få rabatt). `reviews.contact_email`/`contact_phone` kräver
     samma typ av separat migrering som tidigare kolumner.

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
