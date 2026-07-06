# Restaurant Reviews - recensionssystem via NFC

Multi-tenant recensionssystem: gasten tappar mobilen mot en NFC-ståndare på
bordet, betygsätter besöket (1-5 stjärnor) och skriver en kort kommentar.
Höga betyg uppmanas att dela recensionen vidare på Google mot en rabattkod.
Låga betyg går som intern feedback till restaurangägaren. Flera restauranger
kan använda samma installation utan att se varandras data.

## Stack

- **Backend**: Node.js + Express (`src/`), tänkt att hostas på Railway
- **Databas**: Supabase (Postgres), åtkomst enbart via service-role-nyckeln server-side
- **Frontend**: statisk HTML/CSS/vanilla JS (`public/`), mörkt tema med guldaccenter, mobiloptimerad
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
   `RESEND_API_KEY`, `RESEND_FROM_EMAIL` och `APP_BASE_URL` är valfria
   (se respektive avsnitt nedan).
3. Starta-kommando: `npm start`.

### Migrering: lägga till en kolumn på en redan körd databas

`db/schema.sql` körs bara en gång manuellt - om du redan har ett Supabase-
projekt igång och en ny kolumn tillkommer (t.ex. `owner_email`), kör bara den
enskilda `alter table`-raden ur schemat i SQL Editor, t.ex.:
```sql
alter table restaurants add column if not exists owner_email text;
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

## Gästflödet: stjärna submittar direkt

Ett tryck på en stjärna skickar in betyget omedelbart (ingen separat
"Skicka"-knapp). Kommentaren är ett valfritt extra steg på resultatsidan
efteråt (`PATCH /api/reviews/:id/comment`), eftersom den är mest värdefull
vid låga betyg och annars bara var friktion i vägen för nöjda gäster som
snabbt vill vidare till Google-delningen/rabatten.

## API-översikt

| Metod | Endpoint                                   | Auth   | Beskrivning |
|-------|---------------------------------------------|--------|-------------|
| GET   | `/api/restaurants/:slug`                    | Publik | Restaurangnamn för review-sidan |
| POST  | `/api/reviews`                              | Publik | Skapar en recension, ev. rabattkod |
| PATCH | `/api/reviews/:id/comment`                  | Publik | Lägger till/uppdaterar kommentaren i efterhand |
| POST  | `/api/reviews/:id/google-click`             | Publik | Registrerar klick på Google-länken |
| POST  | `/api/admin/login`                          | Publik | Loggar in, returnerar JWT |
| GET   | `/api/admin/settings`                       | JWT    | Restaurangens rabattinställningar |
| PATCH | `/api/admin/settings`                       | JWT    | Uppdaterar rabattinställningar |
| GET   | `/api/admin/stats`                          | JWT    | Statistik för inloggad restaurang |
| GET   | `/api/admin/reviews`                        | JWT    | Paginerad recensionslista |
| POST  | `/api/admin/discounts/:code/redeem`         | JWT    | Markerar en rabattkod som använd |
| POST  | `/api/superadmin/login`                     | Publik | Ultra-admin-inloggning (bara lösenord) |
| GET   | `/api/superadmin/restaurants`               | Ultra-JWT | Lista alla restauranger + statistik |
| POST  | `/api/superadmin/restaurants`               | Ultra-JWT | Skapa en ny restaurang |
| PATCH | `/api/superadmin/restaurants/:id`           | Ultra-JWT | Redigera valfri restaurang |
| DELETE| `/api/superadmin/restaurants/:id`           | Ultra-JWT | Ta bort en restaurang |

## Kända begränsningar / vidareutveckling

- Statistik i `/api/admin/stats` beräknas i Node genom att hämta alla
  recensioner för restaurangen. Fungerar bra för normal volym; om en
  restaurang får väldigt många recensioner bör detta flyttas till
  SQL-aggregering (`avg()`, `count() ... group by`).
- Adminlösenord hanteras helt av denna app (bcrypt + JWT). Det finns ingen
  "glömt lösenord"-flöde i v1 - ett nytt lösenord sätts genom att köra
  `npm run hash-password` och uppdatera `password_hash` direkt i databasen.
