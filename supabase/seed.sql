-- SportMatch — lookup-seed
-- Draai dit na de migrations. Demo-accounts en demo-content worden aangemaakt
-- met `npm run seed:demo` (heeft de service-role key nodig).

-- Startset van plaatsen met globale coördinaten voor afstandsberekening.
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

insert into public.lesson_types (sport_id, name, sort_order)
select s.id, preset.name, preset.sort_order
from public.sports s
cross join lateral (
  select * from (values
    ('fitness', 'Fitnessbegeleiding', 10), ('fitness', 'Circuittraining', 20),
    ('fitness', 'Krachttraining', 30), ('groepsles', 'Bodypump', 10),
    ('groepsles', 'HIIT', 20), ('groepsles', 'Core training', 30),
    ('yoga', 'Vinyasa yoga', 10), ('yoga', 'Yin yoga', 20),
    ('yoga', 'Hatha yoga', 30), ('pilates', 'Mat pilates', 10),
    ('pilates', 'Reformer pilates', 20), ('tennis', 'Tennisles jeugd', 10),
    ('tennis', 'Tennisles volwassenen', 20), ('tennis', 'Tennisclinic', 30),
    ('padel', 'Padelles beginners', 10), ('padel', 'Padelles gevorderden', 20),
    ('padel', 'Padelclinic', 30), ('zwemmen', 'Zwem-ABC', 10),
    ('zwemmen', 'Aquafitness', 20), ('zwemmen', 'Toezicht', 30),
    ('personal-training', 'Personal training', 10),
    ('personal-training', 'Duo training', 20), ('spinning', 'Spinning', 10),
    ('spinning', 'Indoor cycling beginners', 20), ('bootcamp', 'Bootcamp', 10),
    ('bootcamp', 'Bedrijfsbootcamp', 20),
    ('kickboksen', 'Kickboksen beginners', 10),
    ('kickboksen', 'Kickboksen gevorderden', 20),
    ('kickboksen', 'Techniektraining', 30), ('crossfit', 'CrossFit WOD', 10),
    ('crossfit', 'CrossFit fundamentals', 20), ('dans', 'Streetdance', 10),
    ('dans', 'Ballet', 20), ('dans', 'Hip-hop', 30), ('dans', 'Zumba', 40),
    ('dans', 'Modern', 50), ('voetbal', 'Voetbaltraining jeugd', 10),
    ('voetbal', 'Voetbaltraining senioren', 20), ('voetbal', 'Clinic', 30),
    ('hockey', 'Hockeytraining jeugd', 10),
    ('hockey', 'Hockeytraining senioren', 20), ('hockey', 'Clinic', 30)
  ) as values_for_sport(sport_slug, name, sort_order)
  where values_for_sport.sport_slug = s.slug
) preset
on conflict (sport_id, name) do nothing;

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
    'percentage', 150,
    'force_majeure_review', true,
    'note', '150% van de totale afgesproken vergoeding; registratie zonder automatische betaling.'
  )),
  ('conversion_fee', jsonb_build_object(
    'amount_cents', 5000,
    'window_months', 6,
    'note', 'Eenmalige conversievergoeding bij vaste aanname binnen 6 maanden. Juridisch te toetsen vóór lancering.'
  ))
on conflict (key) do nothing;
