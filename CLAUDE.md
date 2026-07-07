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
- `src/routes/admin.js` - restaurangens login/stats/reviews/inställningar/gottgörelse
- `src/routes/superadmin.js` - ultra-admin: CRUD på restauranger + drill-down-statistik
- `src/lib/restaurantStats.js` - delad statistik/paginering (används av båda admin-rollerna)
- `src/lib/emailAlerts.js` - `sendLowRatingAlert` + `sendMonthlyReport` +
  `sendRecoveryDiscountEmail` via Resends REST-API (fetch, ingen
  npm-dependency), delad `sendEmail`-helper, no-op om
  `RESEND_API_KEY`/`owner_email` saknas. Alla mejl skickas som HTML i
  gästsidans ljusa stil (inline-CSS + table-layout, `renderLayout`-wrapper,
  textversion som fallback) - håll nya mejl i samma mall.
- `src/lib/smsAlerts.js` - 46elks-integration: `sendDiscountConfirmationSms`
  (gästens bestående kvitto på rabatten, skickas när numret sparas),
  `sendBonusUpdateSms` (när bonusen låses upp efteråt),
  `sendGoogleBonusReminderSms` (15-min-påminnelsen). Alla sv/en via
  `lang`-parameter som frontend skickar med. No-op om `ELKS_*` saknas.
- `src/lib/monthlyReportScheduler.js` - periodisk koll (se beslut 9 nedan),
  startas från `src/index.js` vid serverstart
- `src/lib/logoStorage.js` - uppladdning/borttagning av restauranglogga mot
  Supabase Storage-bucketen `logos` (skapas automatiskt om den saknas), se
  roadmap-punkt 5
- `src/middleware/` - `requireAuth` (restaurang-JWT, kräver `restaurantId` i payload),
  `requireSuperAdmin` (kräver `role: "super_admin"`), `deviceId` (cookie),
  `rateLimiters`
- `public/shared/theme.css` - LJUST Google-inspirerat bastema (sedan
  2026-07-06, samma dag som gästsidans redesign): vita kort, Roboto,
  guldaccent via `--gold`/`--gold-soft` (som per-restaurang-branding
  skriver över på gästsidan). Delas av ALLA ytor - gäst, admin och
  ultra-admin. Tänk på att en ändring här slår igenom överallt.
- `public/admin/`, `public/superadmin/` - vanilla JS-frontend på bastemat,
  plus `public/admin/admin.css` (topbar, tabellstjärnor `.table-stars`,
  rabattchip `.chip`, paginering - delas av båda adminvyerna)
- `public/review/` - gästsidan, bastemat + egna komponenter i
  `public/review/style.css` (stjärnor, Google-knapp, belöningsruta,
  avatar). Designen kommer från Jonas Claude Design-fil (roadmap-punkt 9) -
  behåll det formspråket vid ändringar.
- `db/schema.sql` + `db/seed.sql` - körs manuellt i Supabase SQL Editor

## Viktiga beslut och varför (ändra inte utan skäl)

1. **NFC/QR-URL innehåller bara slug, inte Place ID** - Place ID slås upp
   server-side så taggar aldrig kan peka fel om ID byts.
2. **Rabatten är tekniskt INTE villkorad av Google-recensionen** - koden ges
   för betyget i vårt system. Detta är medvetet: Googles policy förbjuder
   incitament kopplade till recensioner. Jonas vill ändå att UI-texten säljer
   in Google-delningen hårt ("dela → visa i kassan → rabatt") - bygg ALDRIG
   verifiering av att en Google-recension faktiskt postats.
   - **Undantag, medvetet beslutat av Jonas (2026-07-06)**: Google-bonusen
     (se roadmap-punkt 6) HÖJER en befintlig kod baserat på om gästen
     klickat på Google-länken (`reviews.clicked_google`), inte på en
     bekräftad recension - fortfarande bara ett klick, aldrig en verifierad
     post. Jonas resonemang: "rabatten är en gåva, inte en muta" - han är
     medveten om och accepterar risken att Google ändå kan se mönstret som
     incitamentsstyrt. Fråga inte om detta igen, redan avvägt och beslutat.
3. **Spamskydd i tre lager** (IP-rate-limit, 24h device-cookie per restaurang,
   honeypot) - medvetet "bra nog", inte vattentätt. Jonas har bekräftat att
   det ska vara kvar. Honeypot-träff returnerar fejkad success.
4. **Ingen digital inlösning av rabattkoder** (ändrat 2026-07-06, se
   roadmap-punkt 9) - personalen ger rabatten direkt i kassan (högt betyg)
   eller ringer/mejlar gästen (gottgörelse) utan att skriva in någon kod
   någonstans. `POST /api/admin/discounts/:code/redeem` och adminvyns
   "Lös in rabattkod"-ruta är BORTTAGNA, bygg inte tillbaka dem utan att
   fråga - `discount_codes.used`/`used_at` finns kvar i schemat men sätts
   aldrig av något i appen längre.
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
4. ~~**Engelska**~~ - KLART (2026-07-06): SV/EN-toggle på gästsidan
   (`public/review/`), inget externt översättningsbibliotek. Ordbok `I18N`
   i `public/review/app.js`, tillämpad via `data-i18n`/
   `data-i18n-placeholder`-attribut i `index.html`. Standardval styrs av
   `navigator.language` (icke-svensk webbläsare = engelska, tänkt för
   turister), gästens val sparas i `localStorage` (`rr_lang`).
   Guest-endpointerna i `src/routes/reviews.js`/`restaurants.js` returnerar
   nu ÄVEN en `code` (fel) eller `messageCode` (lyckade tack-svar) utöver
   den svenska `error`/`message`-texten - lägg ALLTID till en `code` på nya
   fel-svar på dessa två filer, annars visas bara den svenska texten som
   fallback för engelska gäster. Admin-/ultra-admin-vyerna är fortfarande
   enbart svenska, medvetet avgränsat.
5. ~~**Branding per restaurang**~~ - KLART (2026-07-06): valfri `logo_url`
   (https-länk) och `accent_color` (hex) på `restaurants`, satta av
   restaurangen själv i `/admin/dashboard.html` eller av ultra-admin i
   `/superadmin/dashboard.html`. Gästsidan (`public/review/app.js`,
   `applyBranding()`) visar loggan och sätter `--gold`/`--gold-soft` via
   inline CSS-variabler - påverkar bara den enskilda restaurangens gästsida,
   ALDRIG admin-/ultra-admin-temat. Trasig loggo-URL döljs tyst (ingen
   trasig bild-ikon). `logo_url`/`accent_color`-kolumnerna kräver samma typ
   av separat migrering som tidigare kolumner.
   - **Uppdaterad 2026-07-07**: logga sätts inte längre genom att klistra in
     en URL - både restaurangens egen inställningsvy och ultra-admins
     redigeringsvy har nu en "Ladda upp logga"-knapp (filuppladdning,
     PNG/JPEG/WebP, max 3 MB) istället för textfältet. Filen laddas upp till
     en Supabase Storage-bucket (`logos`, publik, skapas automatiskt av
     `src/lib/logoStorage.js` vid första uppladdningen - ingen manuell
     bucket-skapelse behövs), sökväg `<restaurantId>/logo.<ext>` med
     `upsert: true` (skriver alltid över, ingen historik). Resultat-URL:en
     (med `?v=`-cache-bust) skrivs till samma `logo_url`-kolumn som förut,
     så gästsidans `applyBranding()` är helt opåverkad. Nya endpoints
     `POST`/`DELETE /api/admin/logo` (restaurang) och
     `POST`/`DELETE /api/superadmin/restaurants/:id/logo` (ultra-admin,
     bara i redigeringsvyn - "Skapa ny restaurang" saknar loggafält eftersom
     ett restaurant-ID krävs innan en fil kan laddas upp). Ingen ny
     databas-migrering - samma `logo_url`-kolumn, bara en ny källa för den.
6. ~~**Google-bonusrabatt + SMS-påminnelse**~~ - KLART (2026-07-06): efter
   högt betyg kan gästen lämna mobilnummer för att låsa upp
   `GOOGLE_BONUS_PERCENT` (10 procentenheter, konstant i
   `src/routes/reviews.js`) extra rabatt genom att klicka på Google-länken.
   Klickat redan? Bonusen läggs på direkt (`applyGoogleBonus()`). Annars
   schemaläggs en påminnelse-SMS via 46elks efter
   `GOOGLE_BONUS_REMINDER_DELAY_MS` (15 min, samma in-memory-`setTimeout`-
   avvägning som lågbetygslarmet - se beslut 8). Eftersom
   `discount_codes.review_id` är unikt höjs SAMMA kods `discount_percent`
   istället för att skapa en andra kod; `bonus_applied` förhindrar
   dubbel-bonus. Se beslut 2 ovan för det medvetna undantaget från
   Google-ToS-försiktigheten. `reviews.reminder_phone`,
   `discount_codes.discount_percent`/`bonus_applied` kräver samma typ av
   separat migrering som tidigare kolumner. `ELKS_API_USERNAME`/
   `ELKS_API_PASSWORD` (46elks) är ÄNNU INTE satta i Railway - utan dem
   fungerar bonusen (klick-flödet) men inga påminnelse-SMS skickas, bara
   loggas tyst. Fråga om Jonas skaffat 46elks-konto innan du antar att
   SMS:en går ut i produktion.
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
9. ~~**Gästsidans UI-redesign ("Google review"-känsla)**~~ - KLART
   (2026-07-06): Jonas designade om gästflödet i Claude Design (extern
   design-verktyg) och lämnade över en `.dc.html`-canvas + skärmdumpar
   (zip-fil) som facit. Implementerat rakt av i `public/review/index.html`,
   `style.css`, `app.js`. Senare samma dag fick admin/ultra-admin samma
   ljusa tema (`shared/theme.css` skrevs om till ljus bas, se
   arkitekturavsnittet) - stjärnor istället för sifferbetyg i
   recensionstabellerna, rabattkoder som chips, Roboto överallt.
   - **Rabattkoden visas INTE längre för gästen** vid högt betyg - bara
     procentsats + "visa skärmen i kassan". Detta var en medveten ändring
     Jonas gjorde (bekräftat två gånger: "personal kmr inte använda en
     kod" och senare bekräftat att gottgörelsekoder också sköts via
     telefon/mejl istället för adminvyns kodruta) - se beslut 4 ovan.
     Fråga inte om att lägga tillbaka en synlig kod utan att Jonas tar
     upp det själv.
   - **Persistensproblemet ("rabatten försvinner med skärmen") löstes
     2026-07-06 med bekräftelse-SMS**: när gästen sparar sitt nummer
     skickas ett SMS med procent + giltighetsdatum ("visa detta SMS i
     kassan"), och ett uppdaterings-SMS om bonusen låses upp senare -
     se `src/lib/smsAlerts.js`. Gäster som INTE lämnar nummer har
     fortfarande inget bestående kvitto - känd kvarvarande lucka,
     accepterad av Jonas tills vidare.
   - Ny avatar-fallback: saknas `logo_url` visas restaurangens initialer i
     en rund cirkel (`getInitials()` i `app.js`).
   - Gästens faktiska stjärnbetyg (inte alltid 5) renderas ovanför
     tacktexten vid högt betyg (`renderResultStars()`), för äkthetskänsla.
   - i18n-nycklarna i `I18N`-ordboken byttes namn för att matcha
     designfilens `data-i18n`-attribut (t.ex. `form_title` istället för
     `reviewInstruction`) - `ERROR_MESSAGES`-ordboken (kopplad till
     backendens `code`/`messageCode`) är opåverkad och oförändrad.

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
