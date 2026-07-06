# Restaurant Reviews - recensionssystem via NFC

Multi-tenant recensionssystem: gasten tappar mobilen mot en NFC-ståndare på
bordet, betygsätter besöket (1-5 stjärnor) och skriver en kort kommentar.
Höga betyg uppmanas att dela recensionen vidare på Google mot en rabattkod.
Låga betyg går som intern feedback till restaurangägaren. Flera restauranger
kan använda samma installation utan att se varandras data.

## Stack

- **Backend**: Node.js + Express (`src/`), tänkt att hostas på Railway
- **Databas**: Supabase (Postgres), åtkomst enbart via service-role-nyckeln server-side
- **Frontend**: statisk HTML/CSS/vanilla JS (`public/`), ljust Google-inspirerat tema med guldaccenter (delad bas i `public/shared/theme.css`), mobiloptimerad
- **NFC**: NTAG215-taggar skrivna med en URL som pekar på `/review/index.html?r=<restaurang-slug>`

Se tekniska avvägningar och motiveringar i koden (kommentarer i `src/`) - de
viktigaste är: NFC-URL:en innehåller bara restaurangens slug (Google Place ID
slås upp server-side, så en gammal/kopierad tagg aldrig kan peka mot fel
Google-sida), och rabattkoder löses in via restaurangens admin-inloggning
istället för ett separat personalkonto-system.

## Komma igång lokalt

1. **Skapa ett Supabase-projekt** (supabase.com) och hämta `Project URL` och
   `service_role`-nyckeln under Project Settings -> API.
2. **Kör databasschemat**: öppna Supabase SQL Editor, klistra in och kör
   `db/schema.sql`, kör sedan `db/seed.sql` för testdata (två exempel-
   restauranger med recensioner och rabattkoder).
3. **Konfigurera miljövariabler**:
   ```bash
   cp .env.example .env
   # fyll i SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
   # generera egna slumpade värden för JWT_SECRET och IP_HASH_SALT, t.ex:
   openssl rand -hex 32
   ```
4. **Installera och starta**:
   ```bash
   npm install
   npm start
   # eller under utveckling, med auto-reload:
   npm run dev
   ```
5. Öppna `http://localhost:3000/review/index.html?r=pizzeria-bella` för att
   testa recensionsflödet, eller `http://localhost:3000/admin/login.html` för
   adminvyn.

### Testinloggningar (från seed-datan)

| Restaurang       | Slug              | Lösenord      |
|------------------|-------------------|---------------|
| Pizzeria Bella   | `pizzeria-bella`  | `pizzeria123` |
| Sushi Yama       | `sushi-yama`      | `sushi123`    |

Seed-datan innehåller också redan genererade rabattkoder (vissa markerade
som använda) så adminvyns statistik går att se i verkligt bruk direkt.

## Deploy till Railway

1. Skapa ett nytt Railway-projekt, koppla till detta repo.
2. Sätt miljövariablerna från `.env.example` i Railway (Settings -> Variables):
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `IP_HASH_SALT`.
   `PORT` sätts automatiskt av Railway. `SUPER_ADMIN_PASSWORD_HASH`,
   `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `APP_BASE_URL`, `ELKS_API_USERNAME`,
   `ELKS_API_PASSWORD` och `ELKS_FROM` är valfria (se respektive avsnitt
   nedan).
3. Starta-kommando: `npm start`.

### Migrering: lägga till en kolumn på en redan körd databas

`db/schema.sql` körs bara en gång manuellt - om du redan har ett Supabase-
projekt igång och en ny kolumn tillkommer (t.ex. `owner_email` eller
`last_monthly_report_sent_at`), kör bara den enskilda `alter table`-raden ur
schemat i SQL Editor, t.ex.:
```sql
alter table restaurants add column if not exists owner_email text;
alter table restaurants add column if not exists last_monthly_report_sent_at timestamptz;
alter table reviews add column if not exists contact_email text;
alter table reviews add column if not exists contact_phone text;
alter table restaurants add column if not exists logo_url text;
alter table restaurants add column if not exists accent_color text;
alter table reviews add column if not exists reminder_phone text;
alter table discount_codes add column if not exists discount_percent int;
alter table discount_codes add column if not exists bonus_applied boolean not null default false;
```

## Ultra-admin (hantera alla restaurangkunder)

Ett separat konto, bara för dig som driver plattformen, för att skapa och
hantera restaurangkunder via ett UI istället för att köra SQL manuellt.

1. **Aktivera det**: generera en lösenordshash och sätt den som
   `SUPER_ADMIN_PASSWORD_HASH` i din `.env` (lokalt) respektive Railways
   miljövariabler (produktion):
   ```bash
   npm run hash-password -- "ditt-egna-losenord"
   ```
   Om variabeln inte är satt är `/superadmin/login.html` avstängt (503).
2. Logga in på `/superadmin/login.html` (bara lösenord, inget slug-fält).
3. I dashboarden kan du:
   - **Skapa en ny restaurang** (slug, namn, Google Place ID, lösenord till
     restaurangens egen adminvy, samt rabattinställningar) - restaurangen kan
     logga in direkt efteråt.
   - **Redigera** namn, Google Place ID, rabattinställningar eller nollställa
     lösenordet för valfri restaurang.
   - **Ta bort** en restaurang (tar även bort dess recensioner/rabattkoder).
4. Efter att en restaurang skapats: skriv en NFC-tagg som pekar mot
   `https://<din-domän>/review/index.html?r=<slug>` (se nästa avsnitt), och
   ge ägaren dess slug + lösenord för `/admin/login.html`.

Restaurangägaren kan själv justera sina rabattinställningar (rabatt-%,
giltighetstid, betygströskel) under "Inställningar" i sin egen adminvy -
ultra-admin behövs bara för att skapa/ta bort restauranger eller nollställa
ett glömt lösenord.

### Alternativ: manuell SQL

Fungerar fortfarande om du hellre vill slippa sätta upp ultra-admin-kontot:

```bash
npm run hash-password -- "restaurangens-onskade-losenord"
```
```sql
insert into restaurants (slug, name, google_place_id, password_hash)
values ('ny-restaurang', 'Ny Restaurang AB', '<GOOGLE_PLACE_ID>', '<hash fran steg 1>');
```

Valfria kolumner (`discount_percent`, `discount_valid_days`,
`high_rating_threshold`) har rimliga standardvärden (10%, 30 dagar, betyg
>= 4 räknas som högt) men kan sättas per restaurang i samma INSERT.

## Skriva NFC-taggar (NTAG215)

1. Installera en NFC-skrivarapp, t.ex. **NFC Tools** (Android/iOS) eller
   **TagWriter by NXP**.
2. Välj "Write" / "Skriv" -> lägg till en post av typen **URL/URI**.
3. Klistra in: `https://<din-domän>/review/index.html?r=<restaurang-slug>`
4. Håll telefonen mot NTAG215-taggen tills appen bekräftar att skrivningen lyckades.
5. Testa genast genom att tappa en annan telefon mot taggen och verifiera att
   rätt restaurangnamn visas.

## Hämta Google Place ID

1. Gå till Google Maps Platforms verktyg för att hitta Place ID:
   https://developers.google.com/maps/documentation/places/web-service/place-id
2. Sök på restaurangens namn och adress i sökrutan på sidan.
3. Kopiera det `Place ID` som visas och använd det som `google_place_id` i
   `restaurants`-tabellen.

## Spam-/missbruksskydd

Tre lager, ingen kräver inloggning från gästen:

1. **IP-baserad rate limit** (`express-rate-limit`): max 10 recensionsförsök
   per IP var 15:e minut.
2. **Enhets-cookie** (`device_id`, httpOnly, 1 år): samma enhet kan inte
   recensera samma restaurang igen inom 24 timmar.
3. **Honeypot-fält**: ett dolt formulärfält som riktiga användare aldrig
   fyller i - fylls det i låtsas vi att det lyckades utan att spara något.

IP-adresser lagras aldrig i klartext - bara en saltad SHA-256-hash
(`IP_HASH_SALT`), tillräckligt för att upptäcka mönster utan att spara
personuppgifter i klartext.

## Lågbetygslarm (mejl vid 1-2 stjärnor)

Restaurangägaren kan få ett mejl direkt när en gäst lämnar ett lågt betyg
(under `high_rating_threshold`), så de kan agera medan gästen kanske
fortfarande är kvar.

1. **Skapa ett konto** på [resend.com](https://resend.com) och hämta en API-nyckel.
2. Sätt `RESEND_API_KEY` i `.env` (lokalt) respektive Railway (produktion).
   Utan den satt skickas inga larm - lågt betyg sparas som vanligt, bara helt tyst.
3. Valfritt: sätt `RESEND_FROM_EMAIL` till en avsändaradress på en domän du
   verifierat hos Resend (bättre leveransgrad). Standard är Resends delade
   testadress `onboarding@resend.dev`, som fungerar utan egen domän.
4. Valfritt: sätt `APP_BASE_URL` (t.ex. `https://ditt-namn.up.railway.app`)
   för att få med en länk till adminvyn i larmmejlet.
5. Restaurangen sätter sin larm-e-post själv under "Inställningar" i
   `/admin/dashboard.html`, eller ultra-admin sätter den vid
   skapande/redigering i `/superadmin/dashboard.html`. Tom = inget larm.

**Fördröjning:** eftersom gästen kan lägga till en kommentar *efter* att
betyget redan skickats in (se nästa stycke om det trimmade gästflödet),
väntar systemet 2 minuter innan mejlet skickas, så en eventuell kommentar
oftast hinner vara med. Fördröjningen ligger i minnet (en enkel `setTimeout`)
och försvinner om servern startar om/omdeployas precis då - ett känt,
accepterat undantagsfall för v1.

## Automatisk månadsrapport

Restauranger med en `owner_email` satt får också ett mejl var 30:e dag med
en sammanfattning: antal recensioner, snittbetyg, betygsfördelning,
Google-klick, samt utfärdade/inlösta rabattkoder. Bra påminnelse för kunden
om vad de får för sin avgift, och bra säljmaterial för dig.

- Ingen extern cron behövs. Servern kollar själv vid start och sedan var
  24:e timme om 30 dagar gått sedan `restaurants.last_monthly_report_sent_at`
  (eller om den aldrig skickats) - se `src/lib/monthlyReportScheduler.js`.
  Kollen är idempotent, så en omstart/redeploy varken missar eller
  dubbelskickar en rapport.
- Kräver samma `RESEND_API_KEY`-uppsättning som lågbetygslarmet ovan.
- **Manuell utlösare** (bra för test, eller för att skicka en färsk rapport
  precis inför ett säljmöte): knappen "Skicka rapport nu" i en restaurangs
  redigeringsvy i `/superadmin/dashboard.html`, eller direkt mot
  `POST /api/superadmin/restaurants/:id/send-report`. Fungerar oavsett när
  förra rapporten skickades.

## Gästflödet: stjärna submittar direkt

Ett tryck på en stjärna skickar in betyget omedelbart (ingen separat
"Skicka"-knapp). Kommentaren är ett valfritt extra steg på resultatsidan
efteråt (`PATCH /api/reviews/:id/comment`), eftersom den är mest värdefull
vid låga betyg och annars bara var friktion i vägen för nöjda gäster som
snabbt vill vidare till Google-delningen/rabatten.

## Google-bonusrabatt + SMS-påminnelse (högt betyg)

Efter ett högt betyg kan gästen valfritt lämna sitt mobilnummer för att låsa
upp en extra rabatt (`GOOGLE_BONUS_PERCENT` i `src/routes/reviews.js`,
för närvarande 10 procentenheter utöver ordinarie rabatt) genom att dela
recensionen på Google.

- **Bekräftelse-SMS = gästens kvitto**: eftersom ingen rabattkod visas på
  skärmen längre skickas ett bekräftelse-SMS så fort gästen sparar sitt
  nummer ("Du har X% rabatt, giltig till Y, visa detta SMS i kassan") -
  det är det som består efter att webbläsaren stängts. Låses bonusen upp
  senare (via Google-klicket) skickas ett uppdaterings-SMS med den nya
  procentsatsen, så gästens sparade SMS aldrig visar fel. SMS:et skickas
  på gästens valda språk (frontend skickar med `lang` i anropen).
- **Direkt bonus**: har gästen redan klickat på Google-länken innan de
  lämnar numret, läggs bonusen på omedelbart och procentsatsen på skärmen
  uppdateras direkt - bekräftelse-SMS:et skickas då med den höjda procenten
  från början.
- **SMS-påminnelse**: har de inte klickat än, väntar systemet 15 minuter
  (`GOOGLE_BONUS_REMINDER_DELAY_MS`) och skickar då ett SMS med
  Google-länken, om de fortfarande inte klickat. Samma in-memory
  `setTimeout`-avvägning som lågbetygslarmet (försvinner vid
  omstart/redeploy mitt i fönstret, accepterat för v1).
- **En kod, inte två**: eftersom varje recension bara får en rabattkod
  (`discount_codes.review_id` är unikt, för att gottgörelseflödet ska
  förbli idempotent) höjs den befintliga kodens värde istället för att
  skapa en ny. `discount_codes.bonus_applied` förhindrar att bonusen läggs
  på två gånger (t.ex. om gästen både klickar och numret redan var sparat).
- **Tekniskt sett ovillkorad av en faktisk Google-recension** - precis som
  ordinarie rabatt mäter vi bara klicket på länken, aldrig om en recension
  faktiskt postats (se avsnittet om spam-/missbruksskydd och beslut 2 i
  `CLAUDE.md`). Medvetet vald avvägning av Jonas - se `CLAUDE.md` för
  resonemanget.
- **SMS via [46elks](https://46elks.se)**: sätt `ELKS_API_USERNAME` och
  `ELKS_API_PASSWORD` (från ditt 46elks-konto) i `.env`/Railway. Utan dem
  skickas inga påminnelser - bonusen kan ändå låsas upp direkt vid klick,
  bara SMS-delen är avstängd. `ELKS_FROM` är valfri avsändare (nummer eller
  kort text); saknas den används 46elks standardavsändare.

## Mejlmallar (HTML i gästsidans stil)

Alla tre mejlutskick (lågbetygslarm, månadsrapport, gottgörelserabatt)
skickas som HTML-mejl i samma visuella stil som gästsidan - ljus bakgrund,
vitt kort med rundade hörn, guldaccent och Roboto/Arial. Byggda med
inline-CSS och table-layout i `src/lib/emailAlerts.js` (mejlklienter
stödjer inte externa stylesheets), med en delad `renderLayout`-wrapper.
- En textversion skickas alltid med som fallback för klienter utan HTML.
- Lågbetygslarmet visar betyget som stjärnor, kommentaren i en citatruta
  och gästens kontaktuppgifter i en guldton-ruta med klickbara
  mailto-/tel-länkar.
- Månadsrapporten visar statistiken som kort + stapeldiagram för
  betygsfördelningen.
- Gottgörelsemejlet använder samma belöningsruta som gästsidan (procent +
  "visa upp det här mejlet i kassan") - ingen kod visas längre, i linje
  med att den digitala inlösningen är borttagen.

## Engelska på gästsidan

Gästsidan (`public/review/`) finns på svenska och engelska, för turister som
scannar en NFC-tagg/QR-skylt.
- Ett litet SV/EN-val högst upp på sidan. Ingen extern översättningstjänst -
  bara en ordbok i `public/review/app.js` (`I18N`), tillämpad via
  `data-i18n`/`data-i18n-placeholder`-attribut i `public/review/index.html`.
- **Standardval**: `navigator.language` avgör - allt utom svenska webbläsare
  får engelska som förval, eftersom det främst är till för turister. Gästens
  val sparas i `localStorage` (`rr_lang`) så det består vid ett omladdning.
- **Felmeddelanden och tack-texter från API:t** är också översatta: guest-
  endpointerna i `src/routes/reviews.js`/`src/routes/restaurants.js`
  returnerar en `code` (fel) eller `messageCode` (lyckade tack-svar) utöver
  den svenska texten i `error`/`message` - frontend slår upp rätt språk via
  `ERROR_MESSAGES` i `app.js` och faller tillbaka på den svenska texten om
  koden saknas/är okänd, så inget går sönder om en kod glöms bort på en ny
  endpoint.
- Admin- och ultra-admin-vyerna (Jonas interna verktyg) är fortfarande bara
  på svenska - medvetet avgränsat till gästflödet.

## Kontaktuppgifter vid lågt betyg + gottgörelsekod

Efter ett lågt betyg kan gästen valfritt lämna e-post och/eller telefon om
de vill att restaurangen hör av sig personligen - följer med i
lågbetygslarmet till ägaren, precis som en eventuell kommentar.
- Inget kryssruta-baserat samtycke - fälten är tydligt frivilliga, med en
  kort text om att uppgifterna delas med restaurangen om de lämnas.
- Ägaren kan därefter, om de vill, trycka "Skicka gottgörelsekod" i sin
  adminvy (`/admin/dashboard.html`, recensionslistan) för att skicka en
  rabatt till just den gästen (mejlas automatiskt om gästen lämnat sin
  e-post - mejlet säger "visa upp det här mejlet i kassan"; annars ringer
  ägaren upp och ger rabatten muntligt).
- **Medvetet manuellt, inte automatiskt** - till skillnad från höga betyg
  genereras ingen kod automatiskt vid lågt betyg, för att undvika att någon
  avsiktligt ger lågt betyg för att utlösa en rabatt.
- **Ingen digital inlösning** (2026-07-06): restaurangen ringer eller
  mejlar gästen om rabatten direkt istället för att någon skriver in koden
  i adminvyn - `POST /api/admin/discounts/:code/redeem` och "Lös in
  rabattkod"-rutan är borttagna. `discount_codes.used`/`used_at` finns kvar
  i schemat men sätts inte längre av något i appen.

## Branding per restaurang (logga + accentfärg)

Gästsidan kan visas i restaurangens egen stil istället för standardguldet:
- **Logga**: en https-länk till en bild, visas ovanför restaurangnamnet.
  Restaurangen behöver hosta bilden själv (t.ex. sin egen hemsida eller ett
  bildhotell) - appen har ingen egen filuppladdning i v1.
- **Accentfärg**: en hex-färg (t.ex. `#c0392b`) som ersätter standardguldet
  på stjärnor, knappar och rabattboxen på just den restaurangens gästsida.
  Admin- och ultra-admin-vyerna behåller alltid standardtemat.
- Båda är helt valfria och sätts under "Inställningar" i
  `/admin/dashboard.html`, eller av ultra-admin vid skapande/redigering i
  `/superadmin/dashboard.html`. Tomt/ogiltigt värde = standardtemat används.
- Om loggans URL inte går att ladda (trasig länk) döljs bilden tyst istället
  för att visa en trasig bild-ikon.

## Gästsidans design (2026-07-06, "Google review"-känsla)

Gästsidan (`public/review/`) fick en visuell omdesign för att kännas igen
som ett Google-recensionsflöde direkt när gästen landar på länken - inte en
kopia av Googles varumärke, men samma Material-inspirerade formspråk.

- Ljust kort-UI (`#f5f6f7`-bakgrund, vita kort, Roboto via Google Fonts).
  Sedan samma dag delar admin/ultra-admin samma ljusa tema via
  `public/shared/theme.css` - recensionstabellerna visar betyg som
  stjärnor, rabattkoder som chips, och "Ta bort restaurang" är tydligt
  rödmarkerad.
- Solida guld-stjärnor, en vit Google-liknande delningsknapp (färgad "G"
  byggd med en CSS `conic-gradient`, ingen Google-logotypfil används av
  varumärkesskäl).
- Restaurangens logga visas som förut; saknas en logga visas istället en
  rund avatar med restaurangens initialer (t.ex. "TL" för Trattoria Lucia),
  precis som Googles egna kontaktavatarer.
- Efter ett högt betyg visas gästens FAKTISKA stjärnbetyg (inte alltid 5)
  ovanför tack-texten, för att förstärka känslan av en riktig recension.
- Fortfarande allt via `var(--gold)`/`var(--gold-soft)`, så per-restaurang-
  branding (se nedan) fungerar exakt som förut även med den nya designen.
- **Ingen rabattkod visas längre för gästen** vid högt betyg (medvetet
  beslut, se nästa stycke) - bara procentsats + "visa skärmen för
  personalen i kassan".

## API-översikt

| Metod | Endpoint                                   | Auth   | Beskrivning |
|-------|---------------------------------------------|--------|-------------|
| GET   | `/api/restaurants/:slug`                    | Publik | Restaurangnamn + branding (logga/accentfärg) för review-sidan |
| POST  | `/api/reviews`                              | Publik | Skapar en recension, ev. rabattkod |
| PATCH | `/api/reviews/:id/comment`                  | Publik | Lägger till/uppdaterar kommentaren i efterhand |
| PATCH | `/api/reviews/:id/contact`                  | Publik | Lämnar valfria kontaktuppgifter (lågt betyg) |
| PATCH | `/api/reviews/:id/phone`                    | Publik | Lämnar mobilnummer för Google-bonus + SMS-påminnelse (högt betyg) |
| POST  | `/api/reviews/:id/google-click`             | Publik | Registrerar klick på Google-länken, lägger på bonusen om numret redan lämnats |
| POST  | `/api/admin/login`                          | Publik | Loggar in, returnerar JWT |
| GET   | `/api/admin/settings`                       | JWT    | Restaurangens rabattinställningar |
| PATCH | `/api/admin/settings`                       | JWT    | Uppdaterar rabattinställningar |
| GET   | `/api/admin/stats`                          | JWT    | Statistik för inloggad restaurang |
| GET   | `/api/admin/reviews`                        | JWT    | Paginerad recensionslista |
| POST  | `/api/admin/reviews/:id/recovery-discount`  | JWT    | Skickar en manuell gottgörelsekod |
| POST  | `/api/superadmin/login`                     | Publik | Ultra-admin-inloggning (bara lösenord) |
| GET   | `/api/superadmin/restaurants`               | Ultra-JWT | Lista alla restauranger + statistik |
| POST  | `/api/superadmin/restaurants`               | Ultra-JWT | Skapa en ny restaurang |
| PATCH | `/api/superadmin/restaurants/:id`           | Ultra-JWT | Redigera valfri restaurang |
| DELETE| `/api/superadmin/restaurants/:id`           | Ultra-JWT | Ta bort en restaurang |
| POST  | `/api/superadmin/restaurants/:id/send-report` | Ultra-JWT | Skickar månadsrapporten direkt |

## Kända begränsningar / vidareutveckling

- Statistik i `/api/admin/stats` beräknas i Node genom att hämta alla
  recensioner för restaurangen. Fungerar bra för normal volym; om en
  restaurang får väldigt många recensioner bör detta flyttas till
  SQL-aggregering (`avg()`, `count() ... group by`).
- Adminlösenord hanteras helt av denna app (bcrypt + JWT). Det finns ingen
  "glömt lösenord"-flöde i v1 - ett nytt lösenord sätts genom att köra
  `npm run hash-password` och uppdatera `password_hash` direkt i databasen.
