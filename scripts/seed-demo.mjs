// Demo-seed voor SportMatch ZZP.
// Gebruik: npm run seed:demo
// Vereist NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY in .env.local.
// Draai eerst de migrations en supabase/seed.sql (lookups).

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

// .env.local inladen zonder extra dependency
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim();
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Zet NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_PASSWORD = "SportMatch2026!";

const log = (message) => console.log(`✓ ${message}`);

async function createUser(email, fullName, role) {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });

  if (error) {
    throw new Error(`Gebruiker ${email} aanmaken mislukt: ${error.message}`);
  }

  return data.user.id;
}

async function main() {
  // Guard: niet dubbel seeden
  const { data: existing } = await db
    .from("profiles")
    .select("id")
    .eq("email", "admin@sportmatch.test")
    .maybeSingle();

  if (existing) {
    console.error("Demo-data lijkt al aanwezig (admin@sportmatch.test bestaat).");
    process.exit(1);
  }

  const { data: cities } = await db.from("cities").select("id, name");
  const { data: sports } = await db.from("sports").select("id, slug");
  const { data: qualifications } = await db
    .from("qualifications")
    .select("id, name");

  if (!cities?.length || !sports?.length) {
    console.error("Lookups ontbreken. Draai eerst supabase/seed.sql.");
    process.exit(1);
  }

  const cityId = (name) => cities.find((city) => city.name === name)?.id;
  const sportId = (slug) => sports.find((sport) => sport.slug === slug)?.id;
  const qualId = (name) =>
    qualifications.find((qualification) => qualification.name === name)?.id;

  // ---------------------------------------------------------------- accounts
  const adminId = await createUser("admin@sportmatch.test", "Ada Admin", "instructor");
  await db.from("profiles").update({ role: "admin", onboarding_completed: true }).eq("id", adminId);
  log("admin@sportmatch.test (admin)");

  const instructor1 = await createUser(
    "instructeur@sportmatch.test",
    "Iris van Dam",
    "instructor",
  );
  const instructor2 = await createUser(
    "instructeur2@sportmatch.test",
    "Joost Bakker",
    "instructor",
  );

  const orgOwner = await createUser(
    "sportschool@sportmatch.test",
    "Olivia Sportschool",
    "organization",
  );
  const planner = await createUser(
    "planner@sportmatch.test",
    "Pieter Planner",
    "organization",
  );
  log("demo-accounts aangemaakt (wachtwoord: " + DEMO_PASSWORD + ")");

  // ------------------------------------------------------------ instructeurs
  const firstNames = [
    "Sanne", "Tim", "Lisa", "Daan", "Emma", "Bram", "Fleur", "Ruben",
    "Nina", "Max", "Sofie", "Lars", "Julia", "Tom", "Anouk", "Kevin",
    "Maud", "Rick",
  ];
  const lastNames = [
    "Jansen", "de Vries", "Visser", "Smit", "Meijer", "Mulder", "Bos",
    "Peters", "Hendriks", "Dekker", "Vermeulen", "van Leeuwen", "Brouwer",
    "de Groot", "Kuipers", "Post", "Willems", "Smits",
  ];
  const instructorCities = [
    "Amsterdam", "Rotterdam", "Den Haag", "Utrecht", "Haarlem", "Leiden",
    "Delft", "Amstelveen", "Zoetermeer", "Gouda", "Hilversum", "Almere",
    "Zaandam", "Hoofddorp", "Nieuwegein", "Rijswijk", "Schiedam", "Katwijk",
  ];
  const sportSlugs = sports.map((sport) => sport.slug);

  const extraInstructorIds = [];
  for (let index = 0; index < 18; index += 1) {
    const name = `${firstNames[index]} ${lastNames[index]}`;
    const email = `instructeur${index + 3}@sportmatch.test`;
    const userId = await createUser(email, name, "instructor");
    extraInstructorIds.push(userId);
  }

  const allInstructorIds = [instructor1, instructor2, ...extraInstructorIds];
  const allInstructorCities = ["Utrecht", "Amsterdam", ...instructorCities];

  for (let index = 0; index < allInstructorIds.length; index += 1) {
    const userId = allInstructorIds[index];
    await db
      .from("profiles")
      .update({
        phone: `06${String(10000000 + index * 111111).slice(0, 8)}`,
        city_id: cityId(allInstructorCities[index]) ?? cityId("Utrecht"),
        onboarding_completed: true,
      })
      .eq("id", userId);

    await db.from("instructor_profiles").insert({
      user_id: userId,
      birth_date: `199${index % 10}-0${(index % 9) + 1}-15`,
      years_experience: (index % 12) + 1,
      hourly_rate_cents: 3500 + (index % 8) * 500,
      travel_distance_km: 15 + (index % 5) * 10,
      work_experience: "Ervaren sportinstructeur met passie voor groepslessen.",
      kvk_number: index % 2 === 0 ? String(60000000 + index) : "",
      btw_number: "",
    });

    const statuses = index % 2 === 0 ? ["zzp"] : ["employee", "other"];
    if (index % 3 === 0) statuses.push("student");
    await db.from("instructor_statuses").insert(
      [...new Set(statuses)].map((status) => ({ user_id: userId, status })),
    );

    const mySports = [
      sportSlugs[index % sportSlugs.length],
      sportSlugs[(index + 3) % sportSlugs.length],
      sportSlugs[(index + 7) % sportSlugs.length],
    ];
    await db.from("instructor_sports").insert(
      [...new Set(mySports)].map((slug) => ({
        user_id: userId,
        sport_id: sportId(slug),
      })),
    );

    const myQuals = [
      qualifications[index % qualifications.length],
      qualifications[(index + 4) % qualifications.length],
    ];
    await db.from("instructor_qualifications").insert(
      [...new Set(myQuals.map((qualification) => qualification.id))].map(
        (qualificationId) => ({
          user_id: userId,
          qualification_id: qualificationId,
        }),
      ),
    );

    // beschikbaarheid: doordeweekse avonden + zaterdagochtend
    await db.from("availability_rules").insert([
      { user_id: userId, weekday: 2, start_time: "18:00", end_time: "22:00" },
      { user_id: userId, weekday: 4, start_time: "18:00", end_time: "22:00" },
      { user_id: userId, weekday: 6, start_time: "08:00", end_time: "13:00" },
    ]);
  }
  log(`${allInstructorIds.length} instructeurs met profielen`);

  // Goedgekeurde documenten voor de eerste twee demo-instructeurs
  const inOneYear = new Date(Date.now() + 365 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);
  await db.from("document_uploads").insert([
    {
      user_id: instructor1,
      doc_type: "sport_diploma",
      storage_path: `${instructor1}/sport_diploma/demo.pdf`,
      original_filename: "fitness-trainer-b.pdf",
      status: "approved",
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    },
    {
      user_id: instructor1,
      doc_type: "first_aid",
      storage_path: `${instructor1}/first_aid/demo.pdf`,
      original_filename: "ehbo.pdf",
      status: "approved",
      expires_at: inOneYear,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    },
    {
      user_id: instructor1,
      doc_type: "vog",
      storage_path: `${instructor1}/vog/demo.pdf`,
      original_filename: "vog.pdf",
      status: "pending",
    },
    {
      user_id: instructor2,
      doc_type: "sport_diploma",
      storage_path: `${instructor2}/sport_diploma/demo.pdf`,
      original_filename: "yoga-200ryt.pdf",
      status: "pending",
    },
  ]);
  log("demo-documenten (2 goedgekeurd, 2 te beoordelen)");

  // ------------------------------------------------------------- organisaties
  const orgOwners = [orgOwner];
  for (let index = 0; index < 4; index += 1) {
    const userId = await createUser(
      `organisatie${index + 2}@sportmatch.test`,
      `Beheerder Organisatie ${index + 2}`,
      "organization",
    );
    orgOwners.push(userId);
  }

  const orgSpecs = [
    {
      name: "FitZone Utrecht",
      type: "gym",
      locations: [
        { name: "FitZone Centrum", city: "Utrecht" },
        { name: "FitZone Leidsche Rijn", city: "Utrecht" },
      ],
    },
    {
      name: "YogaHuis Amsterdam",
      type: "yoga_studio",
      locations: [
        { name: "YogaHuis De Pijp", city: "Amsterdam" },
        { name: "YogaHuis West", city: "Amsterdam" },
      ],
    },
    {
      name: "Zwembad De Golf",
      type: "swimming_pool",
      locations: [{ name: "De Golf Rotterdam", city: "Rotterdam" }],
    },
    {
      name: "Padelclub Den Haag",
      type: "sports_club",
      locations: [
        { name: "Padelclub Centrum", city: "Den Haag" },
        { name: "Padelclub Scheveningen", city: "Den Haag" },
      ],
    },
    {
      name: "Hotel Actief Haarlem",
      type: "hotel",
      locations: [{ name: "Hotel Actief Fitness", city: "Haarlem" }],
    },
  ];

  const orgIds = [];
  const locationIds = [];

  for (let index = 0; index < orgSpecs.length; index += 1) {
    const spec = orgSpecs[index];
    const ownerId = orgOwners[index];

    await db
      .from("profiles")
      .update({ onboarding_completed: true, phone: `030123456${index}` })
      .eq("id", ownerId);

    const { data: organization, error } = await db
      .from("organizations")
      .insert({
        name: spec.name,
        org_type: spec.type,
        kvk_number: String(70000000 + index),
        contact_name: `Contact ${spec.name}`,
        contact_email: `contact@${spec.name.toLowerCase().replace(/[^a-z]+/g, "")}.nl`,
        contact_phone: `010123456${index}`,
        created_by: ownerId,
      })
      .select("id")
      .single();

    if (error) throw new Error(`Organisatie: ${error.message}`);
    orgIds.push(organization.id);

    await db.from("organization_members").insert({
      organization_id: organization.id,
      user_id: ownerId,
      member_role: "owner",
    });

    for (const location of spec.locations) {
      const { data: locationRow, error: locationError } = await db
        .from("organization_locations")
        .insert({
          organization_id: organization.id,
          name: location.name,
          street: "Sportlaan",
          house_number: String(1 + locationIds.length),
          postal_code: `${1000 + locationIds.length * 111} AB`,
          city_id: cityId(location.city),
        })
        .select("id")
        .single();
      if (locationError) throw new Error(`Vestiging: ${locationError.message}`);
      locationIds.push(locationRow.id);
    }
  }

  // planner@ wordt planner bij FitZone Utrecht
  await db.from("profiles").update({ onboarding_completed: true }).eq("id", planner);
  await db.from("organization_members").insert({
    organization_id: orgIds[0],
    user_id: planner,
    member_role: "planner",
  });
  log(`${orgIds.length} organisaties met ${locationIds.length} vestigingen`);

  // ---------------------------------------------------------------- opdrachten
  const future = (days) =>
    new Date(Date.now() + days * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const jobSpecs = [
    // 3 spoedopdrachten
    { type: "urgent_substitute", sport: "spinning", title: "SPOED: spinning vanavond", days: 1, start: "19:00", end: "20:00", pay: "hourly", hourly: 5500, org: 0, loc: 0 },
    { type: "urgent_substitute", sport: "groepsles", title: "SPOED: bodypump morgenochtend", days: 1, start: "09:00", end: "10:00", pay: "hourly", hourly: 5000, org: 0, loc: 1 },
    { type: "urgent_substitute", sport: "zwemmen", title: "SPOED: badmeester zaterdag", days: 2, start: "08:00", end: "12:00", pay: "fixed", fixed: 18000, org: 2, loc: 4 },
    // 7 eenmalige opdrachten (samen met spoed = 10 open)
    { type: "one_time", sport: "yoga", title: "Vinyasa yoga zondagochtend", days: 5, start: "09:30", end: "10:45", pay: "fixed", fixed: 7500, org: 1, loc: 2 },
    { type: "one_time", sport: "pilates", title: "Pilates workshop", days: 8, start: "19:00", end: "20:30", pay: "both", fixed: 9000, hourly: 5500, org: 1, loc: 3 },
    { type: "one_time", sport: "padel", title: "Padelclinic voor beginners", days: 10, start: "14:00", end: "16:00", pay: "fixed", fixed: 12000, org: 3, loc: 5 },
    { type: "one_time", sport: "bootcamp", title: "Bootcamp bedrijfsuitje", days: 12, start: "10:00", end: "11:30", pay: "fixed", fixed: 11000, org: 4, loc: 7 },
    { type: "one_time", sport: "fitness", title: "Fitness introles hotelgasten", days: 6, start: "17:00", end: "18:00", pay: "hourly", hourly: 4500, org: 4, loc: 7 },
    { type: "one_time", sport: "personal-training", title: "PT-sessies zaterdag", days: 9, start: "10:00", end: "14:00", pay: "hourly", hourly: 6000, org: 0, loc: 0 },
    { type: "one_time", sport: "tennis", title: "Tennisles jeugd", days: 15, start: "16:00", end: "18:00", pay: "hourly", hourly: 4000, org: 3, loc: 6 },
    // 3 terugkerende opdrachten
    { type: "recurring", sport: "spinning", title: "Vaste spinninginstructeur dinsdagavond", days: 7, start: "19:00", end: "20:00", pay: "hourly", hourly: 5000, recurrence: "Elke dinsdag, minimaal 12 weken", org: 0, loc: 0 },
    { type: "recurring", sport: "yoga", title: "Wekelijkse yin yoga donderdag", days: 9, start: "20:00", end: "21:15", pay: "fixed", fixed: 8000, recurrence: "Elke donderdagavond", org: 1, loc: 2 },
    { type: "recurring", sport: "zwemmen", title: "Zwemles ABC zaterdagochtend", days: 11, start: "09:00", end: "12:00", pay: "hourly", hourly: 4500, recurrence: "Elke zaterdag tijdens het schooljaar", org: 2, loc: 4 },
    // 3 vaste vacatures
    { type: "permanent", sport: "fitness", title: "Fitnessinstructeur (24-32 uur)", days: 20, start: "09:00", end: "17:00", pay: "both", fixed: 280000, hourly: 1800, org: 0, loc: 1 },
    { type: "permanent", sport: "groepsles", title: "Allround groepslesinstructeur (vast)", days: 25, start: "08:00", end: "16:00", pay: "hourly", hourly: 1900, org: 1, loc: 3 },
    { type: "permanent", sport: "padel", title: "Hoofdtrainer padel (fulltime)", days: 30, start: "12:00", end: "20:00", pay: "fixed", fixed: 320000, org: 3, loc: 5 },
  ];

  const jobIds = [];
  for (const spec of jobSpecs) {
    const { data: job, error } = await db
      .from("jobs")
      .insert({
        organization_id: orgIds[spec.org],
        location_id: locationIds[spec.loc],
        created_by: orgOwners[spec.org],
        job_type: spec.type,
        sport_id: sportId(spec.sport),
        title: spec.title,
        description:
          "Wij zoeken een enthousiaste instructeur. Ervaring met de doelgroep is een pre. Materiaal en muziekinstallatie aanwezig.",
        starts_on: future(spec.days),
        start_time: spec.start,
        end_time: spec.end,
        recurrence_note: spec.recurrence ?? "",
        pay_type: spec.pay,
        pay_amount_cents: spec.fixed ?? null,
        pay_hourly_rate_cents: spec.hourly ?? null,
        pay_is_negotiable: spec.type === "urgent_substitute",
        required_level: "Alle niveaus",
        expected_participants: 15,
        contact_name: `Contact ${orgSpecs[spec.org].name}`,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Opdracht: ${error.message}`);
    jobIds.push(job.id);

    if (spec.sport === "zwemmen") {
      await db.from("job_requirements").insert([
        { job_id: job.id, qualification_id: qualId("Zwemonderwijzer ABC") },
        { job_id: job.id, qualification_id: qualId("Lifeguard") },
      ]);
    }
    if (spec.sport === "fitness") {
      await db.from("job_requirements").insert([
        { job_id: job.id, qualification_id: qualId("Fitness Trainer A") },
      ]);
    }
  }
  log(`${jobIds.length} open opdrachten en vacatures`);

  // ------------------------------------------- afgeronde opdracht met reviews
  const { data: doneJob } = await db
    .from("jobs")
    .insert({
      organization_id: orgIds[0],
      location_id: locationIds[0],
      created_by: orgOwner,
      job_type: "one_time",
      sport_id: sportId("spinning"),
      title: "Spinning inval (afgerond)",
      description: "Afgeronde demo-opdracht.",
      starts_on: new Date(Date.now() - 7 * 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10),
      start_time: "19:00",
      end_time: "20:00",
      pay_type: "hourly",
      pay_hourly_rate_cents: 5000,
      contact_name: "Olivia Sportschool",
      status: "completed",
    })
    .select("id")
    .single();

  const { data: doneApplication } = await db
    .from("job_applications")
    .insert({
      job_id: doneJob.id,
      instructor_id: instructor1,
      message: "Ik neem de les graag over!",
      status: "accepted",
    })
    .select("id")
    .single();

  await db.from("job_confirmations").insert({
    job_id: doneJob.id,
    application_id: doneApplication.id,
    instructor_id: instructor1,
    terms: { note: "€ 50 per uur, 15 minuten vooraf aanwezig" },
    organization_agreed_at: new Date(Date.now() - 9 * 24 * 3600 * 1000).toISOString(),
    organization_agreed_by: orgOwner,
    instructor_agreed_at: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
    confirmed_at: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
  });

  await db.from("reviews").insert([
    {
      job_id: doneJob.id,
      reviewer_id: orgOwner,
      reviewee_id: instructor1,
      side: "organization",
      rating: 5,
      released_at: new Date().toISOString(),
    },
    {
      job_id: doneJob.id,
      reviewer_id: instructor1,
      reviewee_id: orgOwner,
      side: "instructor",
      rating: 4,
      released_at: new Date().toISOString(),
    },
  ]);

  // Demo-chat bij de afgeronde opdracht
  const { data: chat } = await db
    .from("chats")
    .insert({
      job_id: doneJob.id,
      organization_id: orgIds[0],
      instructor_id: instructor1,
    })
    .select("id")
    .single();

  await db.from("chat_messages").insert([
    {
      chat_id: chat.id,
      sender_id: null,
      body: "Iris van Dam heeft gereageerd op \"Spinning inval (afgerond)\".",
      system_event: "application_created",
    },
    {
      chat_id: chat.id,
      sender_id: instructor1,
      body: "Ik neem de les graag over! Hoe groot is de groep?",
    },
    {
      chat_id: chat.id,
      sender_id: orgOwner,
      body: "Top! Meestal zo'n 18 deelnemers. Muziek staat klaar.",
    },
    {
      chat_id: chat.id,
      sender_id: null,
      body: "De opdracht is definitief bevestigd. Contactgegevens zijn nu zichtbaar voor beide partijen.",
      system_event: "job_confirmed",
    },
  ]);

  // Eén openstaande reactie + tegenvoorstel op de eerste spoedopdracht
  const { data: openApplication } = await db
    .from("job_applications")
    .insert({
      job_id: jobIds[0],
      instructor_id: instructor2,
      message: "Ik kan vanavond invallen.",
      status: "pending",
    })
    .select("id")
    .single();

  await db.from("job_counteroffers").insert({
    application_id: openApplication.id,
    created_by: instructor2,
    side: "instructor",
    pay_type: "hourly",
    amount_cents: 6000,
    message: "Spoedtarief i.v.m. korte termijn",
    status: "pending",
  });

  log("afgeronde opdracht, reviews, chat en openstaande reactie");

  console.log("\nDemo-accounts (wachtwoord voor allemaal: " + DEMO_PASSWORD + ")");
  console.log("  admin@sportmatch.test        — beheerder");
  console.log("  instructeur@sportmatch.test  — instructeur met historie");
  console.log("  instructeur2@sportmatch.test — instructeur met open reactie");
  console.log("  sportschool@sportmatch.test  — eigenaar FitZone Utrecht");
  console.log("  planner@sportmatch.test      — planner FitZone Utrecht");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
