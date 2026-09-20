import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type DemoRole = "organization" | "instructor";

interface DemoCredentials {
  sessionId: string;
  email: string;
  password: string;
}

interface DemoUserSpec {
  key: "owner" | "instructor" | "strong" | "average" | "starter";
  name: string;
  role: DemoRole;
}

const DEMO_DURATION_HOURS = 8;

function assertDatabaseResult(
  error: { message: string } | null,
  context: string,
): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

const userSpecs: DemoUserSpec[] = [
  { key: "owner", name: "Olivia de Vries", role: "organization" },
  { key: "instructor", name: "Iris van Dam", role: "instructor" },
  { key: "strong", name: "Sanne Jansen", role: "instructor" },
  { key: "average", name: "Joost Bakker", role: "instructor" },
  { key: "starter", name: "Noa Smit", role: "instructor" },
];

function futureDate(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function pastDate(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function demoEmail(sessionId: string, key: DemoUserSpec["key"]): string {
  return `demo-${sessionId}-${key}@demo.sportmatch.invalid`;
}

export async function cleanupDemoSession(sessionId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) {
    return;
  }

  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id")
    .eq("demo_session_id", sessionId);

  // Organization deletion cascades through locations, jobs and all job data.
  await admin.from("organizations").delete().eq("demo_session_id", sessionId);

  for (const profile of profiles ?? []) {
    await admin.auth.admin.deleteUser(profile.id as string);
  }

  await admin.from("demo_sessions").delete().eq("id", sessionId);
}

export async function cleanupExpiredDemoSessions(): Promise<number> {
  const admin = createAdminClient();
  const { data: sessions } = await admin
    .from("demo_sessions")
    .select("id")
    .lt("expires_at", new Date().toISOString())
    .limit(50);

  for (const session of sessions ?? []) {
    await cleanupDemoSession(session.id as string);
  }

  return sessions?.length ?? 0;
}

export async function createDemoSession(role: DemoRole): Promise<DemoCredentials> {
  const admin = createAdminClient();
  const sessionId = randomUUID();
  const password = `${randomBytes(24).toString("base64url")}!A7`;
  const expiresAt = new Date(
    Date.now() + DEMO_DURATION_HOURS * 3_600_000,
  ).toISOString();
  const createdUserIds: string[] = [];

  const { error: sessionError } = await admin.from("demo_sessions").insert({
    id: sessionId,
    expires_at: expiresAt,
  });
  if (sessionError) {
    throw new Error(`Demosessie kon niet worden gestart: ${sessionError.message}`);
  }

  try {
    const users = new Map<DemoUserSpec["key"], string>();

    for (const spec of userSpecs) {
      const email = demoEmail(sessionId, spec.key);
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: spec.name, role: spec.role },
      });
      if (error || !data.user) {
        throw new Error(error?.message ?? "Demo-account kon niet worden gemaakt.");
      }
      createdUserIds.push(data.user.id);
      users.set(spec.key, data.user.id);
    }

    const ownerId = users.get("owner")!;
    const instructorId = users.get("instructor")!;
    const instructorIds = [
      instructorId,
      users.get("strong")!,
      users.get("average")!,
      users.get("starter")!,
    ];

    const { data: city, error: cityError } = await admin
      .from("cities")
      .select("id")
      .eq("name", "Utrecht")
      .single();
    if (cityError || !city) {
      throw new Error("De demo-baseline mist de plaats Utrecht.");
    }

    const { error: instructorProfilesScopeError } = await admin
      .from("profiles")
      .update({
        demo_session_id: sessionId,
        onboarding_completed: true,
        city_id: city.id,
      })
      .in("id", instructorIds);
    assertDatabaseResult(
      instructorProfilesScopeError,
      "Demo-instructeurs konden niet worden geïsoleerd",
    );
    const { error: ownerProfileScopeError } = await admin
      .from("profiles")
      .update({
        demo_session_id: sessionId,
        onboarding_completed: true,
        city_id: city.id,
      })
      .eq("id", ownerId);
    assertDatabaseResult(
      ownerProfileScopeError,
      "Demo-organisatieprofiel kon niet worden geïsoleerd",
    );

    const { error: instructorProfileError } = await admin
      .from("instructor_profiles")
      .insert(
        instructorIds.map((userId, index) => ({
          user_id: userId,
          years_experience: [6, 11, 4, 0][index],
          hourly_rate_cents: [5000, 6000, 4500, 4000][index],
          travel_distance_km: 50,
          work_experience:
            index === 3
              ? "Nieuw op SportMatch, met relevante diploma's en een compleet profiel."
              : "Ervaren sportinstructeur voor groepslessen en invalopdrachten.",
        })),
      );
    if (instructorProfileError) {
      throw new Error(instructorProfileError.message);
    }

    const [{ data: sports }, { data: qualifications }, { data: lessonTypes }] =
      await Promise.all([
        admin.from("sports").select("id, name, slug").eq("is_active", true).order("name"),
        admin.from("qualifications").select("id").eq("is_active", true).limit(4),
        admin
          .from("lesson_types")
          .select("id, sport_id, name, sort_order")
          .eq("is_active", true)
          .order("sort_order"),
      ]);

    if (!sports?.length || !lessonTypes?.length) {
      throw new Error("Sport- of lesvormconfiguratie ontbreekt voor de demo.");
    }

    const { error: statusesError } = await admin.from("instructor_statuses").insert(
      instructorIds.map((userId) => ({ user_id: userId, status: "zzp" })),
    );
    assertDatabaseResult(statusesError, "Demo-statussen ontbreken");
    const { error: sportsError } = await admin.from("instructor_sports").insert(
      instructorIds.flatMap((userId) =>
        sports.map((sport) => ({ user_id: userId, sport_id: sport.id })),
      ),
    );
    assertDatabaseResult(sportsError, "Demo-specialisaties ontbreken");
    if (qualifications?.length) {
      const { error: qualificationsError } = await admin.from("instructor_qualifications").insert(
        instructorIds.flatMap((userId) =>
          qualifications.map((qualification) => ({
            user_id: userId,
            qualification_id: qualification.id,
          })),
        ),
      );
      assertDatabaseResult(qualificationsError, "Demo-diploma's ontbreken");
    }
    const { error: vogError } = await admin.from("document_uploads").insert(
      instructorIds.map((userId) => ({
        user_id: userId,
        doc_type: "vog",
        storage_path: `${userId}/vog/demo-vog.pdf`,
        original_filename: "vog-demo.pdf",
        status: "approved",
        expires_at: futureDate(365),
        reviewed_at: new Date().toISOString(),
      })),
    );
    assertDatabaseResult(vogError, "Demo-VOG's ontbreken");

    const { data: organization, error: organizationError } = await admin
      .from("organizations")
      .insert({
        name: "SportMatch Demo Sportschool",
        org_type: "gym",
        contact_name: "Olivia de Vries",
        contact_email: demoEmail(sessionId, "owner"),
        contact_phone: "030 000 00 00",
        created_by: ownerId,
        demo_session_id: sessionId,
      })
      .select("id")
      .single();
    if (organizationError || !organization) {
      throw new Error(organizationError?.message ?? "Demo-sportschool ontbreekt.");
    }

    const { error: memberError } = await admin.from("organization_members").insert({
      organization_id: organization.id,
      user_id: ownerId,
      member_role: "owner",
      state: "active",
    });
    assertDatabaseResult(memberError, "Demo-lidmaatschap ontbreekt");
    const { data: location, error: locationError } = await admin
      .from("organization_locations")
      .insert({
        organization_id: organization.id,
        name: "Centrum",
        street: "Sportlaan",
        house_number: "10",
        postal_code: "3511 AA",
        city_id: city.id,
      })
      .select("id")
      .single();
    if (locationError || !location) {
      throw new Error(locationError?.message ?? "Demo-vestiging ontbreekt.");
    }

    const lessonTypeBySport = new Map<string, { id: string; name: string }>();
    for (const lessonType of lessonTypes) {
      if (!lessonTypeBySport.has(lessonType.sport_id as string)) {
        lessonTypeBySport.set(lessonType.sport_id as string, {
          id: lessonType.id as string,
          name: lessonType.name as string,
        });
      }
    }

    const jobTypes = [
      "urgent_substitute",
      "one_time",
      "recurring",
      "temporary",
      "permanent",
    ] as const;
    const openJobs = sports.map((sport, index) => {
      const lessonType = lessonTypeBySport.get(sport.id as string);
      return {
        organization_id: organization.id,
        location_id: location.id,
        created_by: ownerId,
        demo_session_id: sessionId,
        job_type: jobTypes[index % jobTypes.length],
        sport_id: sport.id,
        lesson_type_id: lessonType?.id ?? null,
        title: `${lessonType?.name ?? sport.name} gezocht`,
        description:
          "Een duidelijke demo-opdracht met materiaal op locatie en een vast aanspreekpunt.",
        starts_on: futureDate(2 + index),
        start_time: index % 2 === 0 ? "18:00" : "19:00",
        end_time: index % 2 === 0 ? "19:00" : "20:30",
        recurrence_note:
          jobTypes[index % jobTypes.length] === "recurring"
            ? "Iedere week op hetzelfde tijdstip, 8 weken"
            : "",
        pay_type: index % 3 === 0 ? "fixed" : "hourly",
        pay_amount_cents: index % 3 === 0 ? 7500 : null,
        pay_hourly_rate_cents: index % 3 === 0 ? null : 5000 + index * 100,
        required_level: "Alle niveaus",
        expected_participants: 16,
        contact_name: "Olivia de Vries",
      };
    });
    const { data: insertedJobs, error: jobsError } = await admin
      .from("jobs")
      .insert(openJobs)
      .select("id, sport_id, title, starts_on");
    if (jobsError || !insertedJobs?.length) {
      throw new Error(jobsError?.message ?? "Demo-opdrachten ontbreken.");
    }

    const firstJob = insertedJobs[0];
    const secondJob = insertedJobs[1] ?? firstJob;
    const thirdJob = insertedJobs[2] ?? firstJob;
    const { data: applications, error: applicationsError } = await admin
      .from("job_applications")
      .insert([
        {
          job_id: firstJob.id,
          instructor_id: users.get("strong"),
          message: "Ik ken deze lesvorm goed en ben ruim op tijd beschikbaar.",
        },
        {
          job_id: firstJob.id,
          instructor_id: users.get("starter"),
          message: "Dit wordt mijn eerste klus via SportMatch; mijn VOG en diploma's zijn goedgekeurd.",
        },
        {
          job_id: secondJob.id,
          instructor_id: users.get("average"),
          message: "Ik kan deze training overnemen.",
        },
      ])
      .select("id, job_id, instructor_id");
    assertDatabaseResult(applicationsError, "Demo-reacties ontbreken");
    if (!applications?.length) throw new Error("Demo-reacties ontbreken.");

    const { error: invitationError } = await admin.from("job_invitations").insert({
      job_id: thirdJob.id,
      instructor_id: instructorId,
      invited_by: ownerId,
      message: "Kun jij deze training verzorgen?",
    });
    assertDatabaseResult(invitationError, "Demo-uitnodiging ontbreekt");

    const { data: plannedJob, error: plannedJobError } = await admin
      .from("jobs")
      .insert({
        ...openJobs[0],
        title: "Bevestigde training in je agenda",
        starts_on: futureDate(1),
        status: "confirmed",
      })
      .select("id, title")
      .single();
    assertDatabaseResult(plannedJobError, "Demo-agendaopdracht ontbreekt");
    if (!plannedJob) throw new Error("Demo-agendaopdracht ontbreekt.");
    const { data: plannedApplication, error: plannedApplicationError } = await admin
      .from("job_applications")
      .insert({
        job_id: plannedJob!.id,
        instructor_id: instructorId,
        message: "Bevestigd voor de demo-agenda.",
        status: "accepted",
      })
      .select("id")
      .single();
    assertDatabaseResult(
      plannedApplicationError,
      "Demo-agendareactie ontbreekt",
    );
    if (!plannedApplication) throw new Error("Demo-agendareactie ontbreekt.");
    const { error: plannedConfirmationError } = await admin.from("job_confirmations").insert({
      job_id: plannedJob.id,
      application_id: plannedApplication.id,
      instructor_id: instructorId,
      terms: { note: "€ 50 per uur, 15 minuten vooraf aanwezig" },
      organization_agreed_at: new Date().toISOString(),
      organization_agreed_by: ownerId,
      instructor_agreed_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
    });
    assertDatabaseResult(
      plannedConfirmationError,
      "Demo-agendabevestiging ontbreekt",
    );

    const historyInstructors = [
      users.get("strong")!,
      users.get("average")!,
      instructorId,
    ];
    const historyJobs: { id: string; instructorId: string; title: string }[] = [];
    for (let index = 0; index < historyInstructors.length; index += 1) {
      const historyInstructor = historyInstructors[index];
      const historyTitle = [
        "Eerder succesvol samengewerkt",
        "Afgeronde invaltraining",
        "Afgeronde yogales",
      ][index] ?? "Afgeronde training";
      const { data: historyJob, error: historyJobError } = await admin
        .from("jobs")
        .insert({
          ...openJobs[index],
          title: historyTitle,
          starts_on: pastDate(7 + index),
          status: "completed",
        })
        .select("id")
        .single();
      assertDatabaseResult(historyJobError, "Demo-historieopdracht ontbreekt");
      if (!historyJob) throw new Error("Demo-historieopdracht ontbreekt.");
      const { data: historyApplication, error: historyApplicationError } = await admin
        .from("job_applications")
        .insert({
          job_id: historyJob.id,
          instructor_id: historyInstructor,
          status: "accepted",
        })
        .select("id")
        .single();
      assertDatabaseResult(
        historyApplicationError,
        "Demo-historiereactie ontbreekt",
      );
      if (!historyApplication) throw new Error("Demo-historiereactie ontbreekt.");
      const { error: historyConfirmationError } = await admin.from("job_confirmations").insert({
        job_id: historyJob.id,
        application_id: historyApplication.id,
        instructor_id: historyInstructor,
        terms: {},
        organization_agreed_at: new Date().toISOString(),
        organization_agreed_by: ownerId,
        instructor_agreed_at: new Date().toISOString(),
        confirmed_at: new Date().toISOString(),
      });
      assertDatabaseResult(
        historyConfirmationError,
        "Demo-historiebevestiging ontbreekt",
      );
      const { error: historyReviewError } = await admin.from("reviews").insert([
        {
          job_id: historyJob.id,
          reviewer_id: ownerId,
          reviewee_id: historyInstructor,
          side: "organization",
          rating: [5, 3, 4][index],
          comment:
            index === 0
              ? "Professioneel, duidelijk en goed voorbereid."
              : "De les was in orde en de afspraken zijn nagekomen.",
          released_at: new Date().toISOString(),
        },
        {
          job_id: historyJob.id,
          reviewer_id: historyInstructor,
          reviewee_id: ownerId,
          side: "instructor",
          rating: 4,
          comment: "Prettige samenwerking en heldere briefing.",
          released_at: new Date().toISOString(),
        },
      ]);
      assertDatabaseResult(historyReviewError, "Demo-reviews ontbreken");
      historyJobs.push({
        id: historyJob.id,
        instructorId: historyInstructor,
        title: historyTitle,
      });
    }

    const addChat = async (
      jobId: string,
      chatInstructorId: string,
      messages: Array<{
        senderId: string | null;
        body: string;
        systemEvent?: string;
      }>,
    ) => {
      const { data: chat, error: chatError } = await admin
        .from("chats")
        .insert({
          job_id: jobId,
          organization_id: organization.id,
          instructor_id: chatInstructorId,
        })
        .select("id")
        .single();
      assertDatabaseResult(chatError, "Demo-gesprek ontbreekt");
      if (!chat) throw new Error("Demo-gesprek ontbreekt.");

      const start = Date.now() - messages.length * 60_000;
      const rows = messages.map((message, index) => ({
        chat_id: chat.id,
        sender_id: message.senderId,
        body: message.body,
        system_event: message.systemEvent ?? null,
        created_at: new Date(start + index * 60_000).toISOString(),
      }));
      const { error: messagesError } = await admin
        .from("chat_messages")
        .insert(rows);
      assertDatabaseResult(messagesError, "Demo-chatberichten ontbreken");
      const { error: activityError } = await admin
        .from("chats")
        .update({ last_message_at: rows[rows.length - 1].created_at })
        .eq("id", chat.id);
      assertDatabaseResult(activityError, "Demo-chatdatum ontbreekt");
      return chat.id as string;
    };

    await addChat(firstJob.id, users.get("strong")!, [
      {
        senderId: users.get("strong")!,
        body: "Is de muziekinstallatie op locatie beschikbaar?",
      },
      {
        senderId: ownerId,
        body: "Ja, alles staat klaar. Fijn dat je reageert!",
      },
    ]);
    await addChat(firstJob.id, users.get("starter")!, [
      {
        senderId: null,
        body: "Noa heeft gereageerd op deze opdracht.",
        systemEvent: "application_created",
      },
      {
        senderId: users.get("starter")!,
        body: "Dit wordt mijn eerste klus via SportMatch. Kan ik vooraf de zaal bekijken?",
      },
    ]);
    const invitationChatId = await addChat(thirdJob.id, instructorId, [
      {
        senderId: null,
        body: "De sportschool heeft een uitnodiging gestuurd.",
        systemEvent: "invitation_sent",
      },
      {
        senderId: ownerId,
        body: "Kun jij deze training verzorgen? Alle materialen zijn aanwezig.",
      },
    ]);
    const plannedChatId = await addChat(plannedJob.id, instructorId, [
      {
        senderId: null,
        body: "De training is definitief bevestigd en staat in beide agenda's.",
        systemEvent: "job_confirmed",
      },
      {
        senderId: instructorId,
        body: "Bevestigd, ik ben vijftien minuten van tevoren aanwezig.",
      },
    ]);
    const historyChatIds = new Map<string, string>();
    for (const historyJob of historyJobs) {
      const historyChatId = await addChat(historyJob.id, historyJob.instructorId, [
        {
          senderId: null,
          body: "De opdracht is afgerond. Jullie kunnen elkaar beoordelen.",
          systemEvent: "review_available",
        },
        {
          senderId: historyJob.instructorId,
          body: "Bedankt voor de fijne samenwerking!",
        },
      ]);
      historyChatIds.set(historyJob.id, historyChatId);
    }

    const primaryHistory = historyJobs.find(
      (historyJob) => historyJob.instructorId === instructorId,
    );
    const { error: notificationsError } = await admin.from("notifications").insert([
      {
        user_id: ownerId,
        notification_type: "application_received",
        title: "Nieuwe reactie",
        body: "Sanne reageerde op een open opdracht.",
        href: `/organisatie/opdrachten/${firstJob.id}`,
      },
      {
        user_id: instructorId,
        notification_type: "invitation_received",
        title: "Nieuwe uitnodiging",
        body: "Je bent uitgenodigd voor een training.",
        href: `/opdrachten/${thirdJob.id}`,
      },
      {
        user_id: instructorId,
        notification_type: "job_confirmed",
        title: "Training bevestigd",
        body: "De training staat nu in je agenda.",
        href: `/agenda?job=${plannedJob.id}`,
      },
      {
        user_id: instructorId,
        notification_type: "chat_message",
        title: "Nieuw chatbericht",
        body: "De sportschool heeft aanvullende informatie gestuurd.",
        href: `/berichten/${invitationChatId}`,
      },
      {
        user_id: ownerId,
        notification_type: "chat_message",
        title: "Nieuw chatbericht",
        body: "Iris bevestigde dat ze eerder aanwezig is.",
        href: `/berichten/${plannedChatId}`,
      },
      ...(primaryHistory
        ? [
            {
              user_id: instructorId,
              notification_type: "job_completed",
              title: "Klus afgerond",
              body: `${primaryHistory.title} is afgerond.`,
              href: `/opdrachten/${primaryHistory.id}`,
            },
            {
              user_id: instructorId,
              notification_type: "review_available",
              title: "Beoordeling gevraagd",
              body: "Bekijk de afgeronde klus en je reviewhistorie.",
              href: `/opdrachten/${primaryHistory.id}`,
            },
            {
              user_id: ownerId,
              notification_type: "review_available",
              title: "Beoordeling gevraagd",
              body: "Een afgeronde klus staat klaar in het reviewoverzicht.",
              href: `/organisatie/opdrachten/${primaryHistory.id}`,
            },
          ]
        : []),
      ...(primaryHistory && historyChatIds.has(primaryHistory.id)
        ? [
            {
              user_id: instructorId,
              notification_type: "chat_message",
              title: "Gesprek bij afgeronde klus",
              body: "Bekijk het gesprek bij je afgeronde klus.",
              href: `/berichten/${historyChatIds.get(primaryHistory.id)}`,
            },
          ]
        : []),
    ]);
    assertDatabaseResult(notificationsError, "Demo-meldingen ontbreken");

    const selectedKey = role === "organization" ? "owner" : "instructor";
    return {
      sessionId,
      email: demoEmail(sessionId, selectedKey),
      password,
    };
  } catch (error) {
    await admin.from("organizations").delete().eq("demo_session_id", sessionId);
    for (const userId of createdUserIds) {
      await admin.auth.admin.deleteUser(userId);
    }
    await admin.from("demo_sessions").delete().eq("id", sessionId);
    throw error;
  }
}
