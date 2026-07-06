-- Testdata. Kor detta EFTER schema.sql i Supabase SQL Editor for att fa
-- tva exempelrestauranger med recensioner och rabattkoder att prova systemet med.
--
-- Inloggningsuppgifter (adminvy):
--   Pizzeria Bella  -> slug: pizzeria-bella   losenord: pizzeria123
--   Sushi Yama      -> slug: sushi-yama       losenord: sushi123
-- (password_hash nedan ar bcrypt-hashar av dessa losenord, genererade med
--  `npm run hash-password -- "losenord"`)
--
-- OBS: google_place_id nedan ar PLATSHALLARE, inte riktiga Place ID. Byt ut
-- mot verkliga ID:n (se README, avsnittet "Hamta Google Place ID") innan
-- "Dela pa Google"-lanken ska fungera pa riktigt.

insert into restaurants (slug, name, google_place_id, password_hash, discount_percent, discount_valid_days, high_rating_threshold)
values
  ('pizzeria-bella', 'Pizzeria Bella', 'ChIJPLACEHOLDER_BELLA_000', '$2a$10$34v.34lfA8A8PTAXjNy75.veRUNs5PWREmCVVPioNNfnCTTlhCwEa', 10, 30, 4),
  ('sushi-yama', 'Sushi Yama', 'ChIJPLACEHOLDER_YAMA_000', '$2a$10$EVyVhCLpZ5jfh3E8V4M5ruTrO1ImNMePZ3EcJYbPY0BE.wyrMtQNq', 15, 14, 4)
on conflict (slug) do nothing;

-- Pizzeria Bella: 8 recensioner, blandade betyg

with r as (
  insert into reviews (restaurant_id, rating, comment, device_id, ip_hash, clicked_google, created_at)
  values ((select id from restaurants where slug = 'pizzeria-bella'), 5, 'Fantastisk pizza och trevlig personal!', 'seed-device-b1', 'seed-iphash-b1', true, now() - interval '9 days')
  returning id, restaurant_id
)
insert into discount_codes (restaurant_id, review_id, code, valid_until, used, used_at)
select restaurant_id, id, 'BELLA-7K2P9', now() - interval '9 days' + interval '30 days', true, now() - interval '5 days' from r;

with r as (
  insert into reviews (restaurant_id, rating, comment, device_id, ip_hash, clicked_google, created_at)
  values ((select id from restaurants where slug = 'pizzeria-bella'), 5, 'Basta pizzan i stan, kommer definitivt tillbaka.', 'seed-device-b2', 'seed-iphash-b2', false, now() - interval '7 days')
  returning id, restaurant_id
)
insert into discount_codes (restaurant_id, review_id, code, valid_until, used, used_at)
select restaurant_id, id, 'BELLA-4M8X2', now() - interval '7 days' + interval '30 days', false, null from r;

with r as (
  insert into reviews (restaurant_id, rating, comment, device_id, ip_hash, clicked_google, created_at)
  values ((select id from restaurants where slug = 'pizzeria-bella'), 4, 'Bra mat, lite lang vantetid.', 'seed-device-b3', 'seed-iphash-b3', false, now() - interval '6 days')
  returning id, restaurant_id
)
insert into discount_codes (restaurant_id, review_id, code, valid_until, used, used_at)
select restaurant_id, id, 'BELLA-9T3H7', now() - interval '6 days' + interval '30 days', false, null from r;

insert into reviews (restaurant_id, rating, comment, device_id, ip_hash, clicked_google, created_at) values
  ((select id from restaurants where slug = 'pizzeria-bella'), 3, 'Okej, inget speciellt.', 'seed-device-b4', 'seed-iphash-b4', false, now() - interval '5 days'),
  ((select id from restaurants where slug = 'pizzeria-bella'), 2, 'Maten var kall nar den kom fram.', 'seed-device-b5', 'seed-iphash-b5', false, now() - interval '4 days'),
  ((select id from restaurants where slug = 'pizzeria-bella'), 1, 'Fel bestallning och lang vantetid, valdigt missnojd.', 'seed-device-b6', 'seed-iphash-b6', false, now() - interval '3 days');

with r as (
  insert into reviews (restaurant_id, rating, comment, device_id, ip_hash, clicked_google, created_at)
  values ((select id from restaurants where slug = 'pizzeria-bella'), 5, 'Alskar deras vitloksbrod!', 'seed-device-b7', 'seed-iphash-b7', true, now() - interval '2 days')
  returning id, restaurant_id
)
insert into discount_codes (restaurant_id, review_id, code, valid_until, used, used_at)
select restaurant_id, id, 'BELLA-2R5Q4', now() - interval '2 days' + interval '30 days', false, null from r;

insert into reviews (restaurant_id, rating, comment, device_id, ip_hash, clicked_google, created_at) values
  ((select id from restaurants where slug = 'pizzeria-bella'), 3, 'Trevlig atmosfar men prisvard mat kunde varit battre.', 'seed-device-b8', 'seed-iphash-b8', false, now() - interval '1 days');

-- Sushi Yama: 8 recensioner, blandade betyg

with r as (
  insert into reviews (restaurant_id, rating, comment, device_id, ip_hash, clicked_google, created_at)
  values ((select id from restaurants where slug = 'sushi-yama'), 5, 'Fraschaste sushin jag atit, superbra service.', 'seed-device-y1', 'seed-iphash-y1', true, now() - interval '10 days')
  returning id, restaurant_id
)
insert into discount_codes (restaurant_id, review_id, code, valid_until, used, used_at)
select restaurant_id, id, 'YAMA-3F9K1', now() - interval '10 days' + interval '14 days', true, now() - interval '8 days' from r;

with r as (
  insert into reviews (restaurant_id, rating, comment, device_id, ip_hash, clicked_google, created_at)
  values ((select id from restaurants where slug = 'sushi-yama'), 4, 'Riktigt god omakase-meny.', 'seed-device-y2', 'seed-iphash-y2', false, now() - interval '8 days')
  returning id, restaurant_id
)
insert into discount_codes (restaurant_id, review_id, code, valid_until, used, used_at)
select restaurant_id, id, 'YAMA-6D2M8', now() - interval '8 days' + interval '14 days', false, null from r;

insert into reviews (restaurant_id, rating, comment, device_id, ip_hash, clicked_google, created_at) values
  ((select id from restaurants where slug = 'sushi-yama'), 2, 'Riset var kallt, forvantade mig mer.', 'seed-device-y3', 'seed-iphash-y3', false, now() - interval '7 days'),
  ((select id from restaurants where slug = 'sushi-yama'), 3, 'Bra men dyrt for portionsstorleken.', 'seed-device-y4', 'seed-iphash-y4', false, now() - interval '6 days');

with r as (
  insert into reviews (restaurant_id, rating, comment, device_id, ip_hash, clicked_google, created_at)
  values ((select id from restaurants where slug = 'sushi-yama'), 5, 'Perfekt datekvall, kommer boka bord igen.', 'seed-device-y5', 'seed-iphash-y5', true, now() - interval '4 days')
  returning id, restaurant_id
)
insert into discount_codes (restaurant_id, review_id, code, valid_until, used, used_at)
select restaurant_id, id, 'YAMA-8P4N6', now() - interval '4 days' + interval '14 days', false, null from r;

insert into reviews (restaurant_id, rating, comment, device_id, ip_hash, clicked_google, created_at) values
  ((select id from restaurants where slug = 'sushi-yama'), 1, 'Vantade en timme utan att bli serverad.', 'seed-device-y6', 'seed-iphash-y6', false, now() - interval '3 days'),
  ((select id from restaurants where slug = 'sushi-yama'), 4, 'Fin inredning och trevlig personal.', 'seed-device-y7', 'seed-iphash-y7', false, now() - interval '2 days'),
  ((select id from restaurants where slug = 'sushi-yama'), 3, 'Helt okej, inget som stack ut.', 'seed-device-y8', 'seed-iphash-y8', false, now() - interval '1 days');
