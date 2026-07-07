-- SportMatch ZZP — lookup-seed
-- Draai dit na de migrations. Demo-accounts en demo-content worden aangemaakt
-- met `npm run seed:demo` (heeft de service-role key nodig).

-- Steden in en rond de Randstad (globale coördinaten voor afstandsberekening)
insert into public.cities (name, province, lat, lng) values
  ('Amsterdam', 'Noord-Holland', 52.3676, 4.9041),
  ('Rotterdam', 'Zuid-Holland', 51.9244, 4.4777),
  ('Den Haag', 'Zuid-Holland', 52.0705, 4.3007),
  ('Utrecht', 'Utrecht', 52.0907, 5.1214),
  ('Haarlem', 'Noord-Holland', 52.3874, 4.6462),
  ('Leiden', 'Zuid-Holland', 52.1601, 4.4970),
  ('Delft', 'Zuid-Holland', 52.0116, 4.3571),
  ('Dordrecht', 'Zuid-Holland', 51.8133, 4.6901),
  ('Zoetermeer', 'Zuid-Holland', 52.0575, 4.4931),
  ('Gouda', 'Zuid-Holland', 52.0115, 4.7104),
  ('Amstelveen', 'Noord-Holland', 52.3114, 4.8701),
  ('Hilversum', 'Noord-Holland', 52.2292, 5.1669),
  ('Amersfoort', 'Utrecht', 52.1561, 5.3878),
  ('Almere', 'Flevoland', 52.3508, 5.2647),
  ('Zaandam', 'Noord-Holland', 52.4420, 4.8292),
  ('Purmerend', 'Noord-Holland', 52.5053, 4.9592),
  ('Schiedam', 'Zuid-Holland', 51.9198, 4.3987),
  ('Vlaardingen', 'Zuid-Holland', 51.9121, 4.3419),
  ('Rijswijk', 'Zuid-Holland', 52.0367, 4.3253),
  ('Alphen aan den Rijn', 'Zuid-Holland', 52.1290, 4.6557),
  ('Nieuwegein', 'Utrecht', 52.0296, 5.0803),
  ('Zeist', 'Utrecht', 52.0906, 5.2332),
  ('Hoofddorp', 'Noord-Holland', 52.3061, 4.6907),
  ('Katwijk', 'Zuid-Holland', 52.2032, 4.3990),
  ('Capelle aan den IJssel', 'Zuid-Holland', 51.9298, 4.5777)
on conflict (name) do nothing;

-- Sporten en lestypen
insert into public.sports (name, slug) values
  ('Fitness', 'fitness'),
  ('Groepsles', 'groepsles'),
  ('Yoga', 'yoga'),
  ('Pilates', 'pilates'),
  ('Tennis', 'tennis'),
  ('Padel', 'padel'),
  ('Zwemmen', 'zwemmen'),
  ('Personal training', 'personal-training'),
  ('Spinning', 'spinning'),
  ('Bootcamp', 'bootcamp'),
  ('Kickboksen', 'kickboksen'),
  ('CrossFit', 'crossfit'),
  ('Dans', 'dans'),
  ('Voetbal', 'voetbal'),
  ('Hockey', 'hockey')
on conflict (slug) do nothing;

-- Diploma's en certificaten
insert into public.qualifications (name, description) values
  ('Fitness Trainer A', 'Basisdiploma fitnesstrainer'),
  ('Fitness Trainer B', 'Gevorderd diploma fitnesstrainer'),
  ('Groepslesinstructeur', 'Diploma voor het geven van groepslessen'),
  ('Yoga docent 200RYT', 'Yoga Alliance 200 uur docentenopleiding'),
  ('Zwemonderwijzer ABC', 'Bevoegdheid zwem-ABC lesgeven'),
  ('Lifeguard', 'Reddend zwemmen / toezichthouder'),
  ('Tennisleraar KNLTB', 'KNLTB-erkende tennisleraar'),
  ('Padeltrainer', 'Erkende padeltrainer'),
  ('Personal Trainer NASM', 'NASM-gecertificeerd personal trainer'),
  ('Spinning instructeur', 'Gecertificeerd indoor cycling instructeur'),
  ('EHBO', 'Geldig EHBO-diploma'),
  ('BHV', 'Bedrijfshulpverlening'),
  ('AED-bediener', 'AED-certificaat')
on conflict (name) do nothing;

-- Instellingen
insert into public.settings (key, value) values
  ('billing', jsonb_build_object(
    'monthly_price_cents', 500,
    'trial_days', 30,
    'grace_days', 14,
    'currency', 'EUR'
  )),
  ('cancellation_policy', jsonb_build_object(
    'tiers', jsonb_build_array(
      jsonb_build_object('max_hours_before', 2, 'pct', 100),
      jsonb_build_object('max_hours_before', 6, 'pct', 50),
      jsonb_build_object('max_hours_before', 12, 'pct', 25)
    ),
    'note', 'Registratie van de annuleringsregeling; inning verloopt buiten het platform.'
  )),
  ('conversion_fee', jsonb_build_object(
    'amount_cents', 5000,
    'window_months', 6,
    'note', 'Eenmalige conversievergoeding bij vaste aanname binnen 6 maanden. Juridisch te toetsen vóór lancering.'
  ))
on conflict (key) do nothing;
