import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  ChevronRight,
  Clock3,
  Inbox,
  Mail,
  Plus,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { DashboardTodoList } from "@/components/dashboard/dashboard-todo-list";
import { FocusCard } from "@/components/dashboard/focus-card";
import { JobStatusIndicator } from "@/components/jobs/job-status-indicator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateBadge } from "@/components/ui/date-badge";
import {
  Page,
  PageHeader,
  Panel,
  PanelEmpty,
  PanelHeader,
  PanelList,
} from "@/components/ui/page";
import { StatTile } from "@/components/ui/stat-tile";
import { getSessionProfile } from "@/lib/auth/session";
import { subscriptionGrantsAccess } from "@/lib/billing/access";
import { getOrgContext } from "@/lib/org/context";
import { resolveLocationFilter } from "@/lib/org/location-filter";
import { formatDate, formatTime } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Subscription } from "@/types/database";

export const metadata: Metadata = {
  title: "Dashboard",
};

async function getUrgencyDateRange() {
  await connection();
  const now = Date.now();
  const amsterdamDate = (offsetDays: number) => {
    const date = new Date(now + offsetDays * 24 * 60 * 60 * 1000);
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Amsterdam",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    return `${values.year}-${values.month}-${values.day}`;
  };

  return { urgencyStart: amsterdamDate(0), urgencyEnd: amsterdamDate(7) };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    redirect("/login");
  }

  if (!profile.onboarding_completed && profile.role !== "admin") {
    redirect("/onboarding");
  }

  if (profile.role === "admin") {
    redirect("/admin");
  }

  if (profile.role === "organization") {
    const orgContext = await getOrgContext();

    if (!orgContext) {
      redirect("/onboarding");
    }

    const params = await searchParams;
    const selectedLocationId = await resolveLocationFilter(
      orgContext.locations,
      params.location,
    );
    const locationIds = selectedLocationId
      ? [selectedLocationId]
      : orgContext.locations.map((location) => location.id);

    let jobsQuery = supabase
      .from("jobs")
      .select("id, status, title, starts_on, start_time")
      .eq("organization_id", orgContext.organization.id)
      .eq("status", "open");
    let applicationsQuery = supabase
      .from("job_applications")
      .select("id, job_id, job:jobs!inner(organization_id, location_id)")
      .eq("job.organization_id", orgContext.organization.id)
      .eq("status", "pending");

    if (selectedLocationId) {
      jobsQuery = jobsQuery.eq("location_id", selectedLocationId);
      applicationsQuery = applicationsQuery.eq(
        "job.location_id",
        selectedLocationId,
      );
    }

    const [jobsResult, subsResult, applicationsResult, pendingReviewResult] =
      await Promise.all([
        jobsQuery,
        locationIds.length > 0
          ? supabase.from("subscriptions").select("*").in("location_id", locationIds)
          : Promise.resolve({ data: [] as Subscription[] }),
        applicationsQuery,
        supabase.rpc("has_pending_review", { target_user: profile.id }),
      ]);

    const subscriptions = (subsResult.data as Subscription[] | null) ?? [];
    const hasInactiveLocation = subscriptions.some(
      (subscription) => !subscriptionGrantsAccess(subscription),
    );
    const openJobs =
      (jobsResult.data as { id: string; status: string }[] | null) ?? [];
    const openJobIds = openJobs.map((job) => job.id);
    const pendingApplications =
      (applicationsResult.data as { id: string; job_id: string }[] | null) ?? [];
    const pendingApplicationJobIds = new Set(
      pendingApplications.map((application) => application.job_id),
    );

    const pendingConfirmationJobIds = new Set<string>();

    if (openJobIds.length > 0) {
      const [wholeConfirmationsResult, segmentConfirmationsResult] =
        await Promise.all([
          supabase
            .from("job_confirmations")
            .select("job_id")
            .in("job_id", openJobIds)
            .is("confirmed_at", null),
          supabase
            .from("job_segment_confirmations")
            .select("job_id")
            .in("job_id", openJobIds)
            .is("confirmed_at", null)
            .is("cancelled_at", null),
        ]);

      for (const confirmation of wholeConfirmationsResult.data ?? []) {
        pendingConfirmationJobIds.add(confirmation.job_id as string);
      }
      for (const confirmation of segmentConfirmationsResult.data ?? []) {
        pendingConfirmationJobIds.add(confirmation.job_id as string);
      }
    }

    const openJobCount = openJobs.length;
    const pendingApplicationCount = pendingApplications.length;
    const pendingConfirmationCount = pendingConfirmationJobIds.size;
    const hasPendingReview = pendingReviewResult.data === true;
    const searchingJobCount = openJobIds.filter(
      (jobId) =>
        !pendingApplicationJobIds.has(jobId) &&
        !pendingConfirmationJobIds.has(jobId),
    ).length;

    const { urgencyStart, urgencyEnd } = await getUrgencyDateRange();

    type OrganizationDashboardJob = {
      id: string;
      status: string;
      title: string;
      starts_on: string;
      start_time: string;
    };

    const urgentJobs = (openJobs as OrganizationDashboardJob[])
      .filter(
        (job) =>
          job.starts_on >= urgencyStart &&
          job.starts_on <= urgencyEnd,
      )
      .sort((left, right) =>
        `${left.starts_on}T${left.start_time}`.localeCompare(
          `${right.starts_on}T${right.start_time}`,
        ),
      );

    const todoItems = [
      ...(hasPendingReview
        ? [
            {
              title: "Beoordeling afronden",
              description: "Er staat nog een verplichte review open.",
              href: "/organisatie/reviews?view=given",
            },
          ]
        : []),
      ...(pendingApplicationCount > 0
        ? [
            {
              title: "Reacties beoordelen",
              description: `${pendingApplicationCount} ${pendingApplicationCount === 1 ? "reactie wacht" : "reacties wachten"} op beoordeling.`,
              href: "/organisatie/kandidaten",
            },
          ]
        : []),
      ...(searchingJobCount > 0
        ? [
            {
              title: "Open opdrachten opvolgen",
              description: `${searchingJobCount} ${searchingJobCount === 1 ? "opdracht heeft" : "opdrachten hebben"} nog geen reactie of gekozen instructeur.`,
              href: "/organisatie/opdrachten",
            },
          ]
        : []),
      ...(hasInactiveLocation
        ? [
            {
              title: "Abonnement vestiging controleren",
              description: "Minimaal één vestiging heeft geen actieve toegang.",
              href: "/abonnement",
            },
          ]
        : []),
    ];

    const primaryAction =
      pendingConfirmationCount > 0
        ? {
            title: "Bevestigingen opvolgen",
            text: `${pendingConfirmationCount} ${
              pendingConfirmationCount === 1 ? "opdracht wacht" : "opdrachten wachten"
            } nog op definitieve bevestiging van de instructeur.`,
            href: "/organisatie/opdrachten",
            cta: "Bekijk bevestigingen",
          }
        : pendingApplicationCount > 0
          ? {
              title: "Nieuwe reacties beoordelen",
              text: `${pendingApplicationCount} ${
                pendingApplicationCount === 1 ? "reactie staat" : "reacties staan"
              } klaar om te vergelijken en op te volgen.`,
              href: "/organisatie/kandidaten",
              cta: "Bekijk kandidaten",
            }
          : searchingJobCount > 0
            ? {
                title: "Nog iemand vinden",
                text: `${searchingJobCount} ${
                  searchingJobCount === 1 ? "open opdracht heeft" : "open opdrachten hebben"
                } nog geen reactie of gekozen instructeur.`,
                href: "/organisatie/opdrachten",
                cta: "Bekijk open opdrachten",
              }
            : {
                title: openJobCount > 0 ? "Alles is opgevolgd" : "Klaar voor een nieuwe opdracht",
                text:
                  openJobCount > 0
                    ? "Je open opdrachten hebben allemaal opvolging. Houd de agenda in de gaten voor de volgende stap."
                    : "Er staat nu niets open. Plaats een nieuwe opdracht zodra je weer iemand nodig hebt.",
                href: openJobCount > 0 ? "/agenda" : "/organisatie/opdrachten/nieuw",
                cta: openJobCount > 0 ? "Bekijk agenda" : "Nieuwe opdracht",
              };

    return (
      <Page>
        <PageHeader
          actions={
            <Link href="/organisatie/opdrachten/nieuw">
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                Nieuwe opdracht
              </Button>
            </Link>
          }
          title={orgContext.organization.name}
        />

        {hasInactiveLocation ? (
          <Alert variant="warning">
            <AlertTitle>Niet alle vestigingen hebben actieve toegang</AlertTitle>
            <AlertDescription>
              Voor vestigingen zonder actief abonnement kun je geen nieuwe
              opdrachten plaatsen of bevestigen.{" "}
              <Link className="font-medium underline" href="/abonnement">
                Bekijk je abonnementen
              </Link>
              .
            </AlertDescription>
          </Alert>
        ) : null}

        <FocusCard
          cta={primaryAction.cta}
          href={primaryAction.href}
          text={primaryAction.text}
          title={primaryAction.title}
        />

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <StatTile
            href="/organisatie/opdrachten"
            icon={X}
            label="Nog iemand zoeken"
            tone={searchingJobCount > 0 ? "danger" : "default"}
            value={searchingJobCount}
          />
          <StatTile
            href="/organisatie/kandidaten"
            icon={Inbox}
            label="Reacties te beoordelen"
            tone={pendingApplicationCount > 0 ? "warning" : "default"}
            value={pendingApplicationCount}
          />
          <StatTile
            href="/organisatie/opdrachten"
            icon={Clock3}
            label="Wacht op bevestiging"
            tone={pendingConfirmationCount > 0 ? "warning" : "default"}
            value={pendingConfirmationCount}
          />
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Panel>
            <PanelHeader
              count={urgentJobs.length}
              description="Binnen 7 dagen"
              icon={AlertTriangle}
              iconClassName="bg-destructive-soft text-destructive"
              title="Urgentie"
            />

            {urgentJobs.length > 0 ? (
              <PanelList>
                {urgentJobs.slice(0, 5).map((job) => {
                  const workflowState = pendingConfirmationJobIds.has(job.id)
                    ? ("planned" as const)
                    : pendingApplicationJobIds.has(job.id)
                      ? ("action_required" as const)
                      : ("searching" as const);
                  const workflowLabel = pendingConfirmationJobIds.has(job.id)
                    ? "Wacht op bevestiging"
                    : pendingApplicationJobIds.has(job.id)
                      ? "Reacties binnen"
                      : "Nog zoeken";

                  return (
                    <Link
                      className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-subtle sm:px-5"
                      href={`/organisatie/opdrachten/${job.id}`}
                      key={job.id}
                    >
                      <DateBadge date={job.starts_on} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium group-hover:text-primary">
                          {job.title}
                        </p>
                        <p className="text-[13px] tabular-nums text-muted-foreground">
                          {formatTime(job.start_time)}
                        </p>
                      </div>
                      <span className="flex shrink-0 items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="hidden text-[13px] font-medium text-muted-foreground sm:inline"
                        >
                          {workflowLabel}
                        </span>
                        <JobStatusIndicator
                          showLabel={false}
                          size="sm"
                          state={workflowState}
                        />
                      </span>
                    </Link>
                  );
                })}
                {urgentJobs.length > 5 ? (
                  <Link
                    className="flex items-center gap-1 px-4 py-3 text-sm font-medium text-primary hover:bg-subtle sm:px-5"
                    href="/organisatie/opdrachten"
                  >
                    Bekijk alle urgente opdrachten
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                ) : null}
              </PanelList>
            ) : (
              <PanelEmpty>Geen open opdrachten binnen 7 dagen.</PanelEmpty>
            )}
          </Panel>

          <DashboardTodoList items={todoItems} />
        </div>
      </Page>
    );
  }

  // Instructeur
  const today = new Date().toISOString().slice(0, 10);
  const [
    subscriptionResult,
    applicationsResult,
    invitationsResult,
    pendingConfirmationsResult,
    pendingSegmentConfirmationsResult,
    confirmedJobsResult,
    vogResult,
    instructorProfileResult,
    pendingReviewResult,
  ] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("*")
      .eq("instructor_id", profile.id)
      .maybeSingle(),
    supabase
      .from("job_applications")
      .select("id", { count: "exact", head: true })
      .eq("instructor_id", profile.id)
      .eq("status", "pending"),
    supabase
      .from("job_invitations")
      .select("id", { count: "exact", head: true })
      .eq("instructor_id", profile.id)
      .eq("status", "pending"),
    supabase
      .from("job_confirmations")
      .select("job_id")
      .eq("instructor_id", profile.id)
      .not("organization_agreed_at", "is", null)
      .is("instructor_agreed_at", null)
      .is("confirmed_at", null),
    supabase
      .from("job_segment_confirmations")
      .select("job_id")
      .eq("instructor_id", profile.id)
      .not("organization_agreed_at", "is", null)
      .is("instructor_agreed_at", null)
      .is("confirmed_at", null)
      .is("cancelled_at", null),
    supabase
      .from("job_confirmations")
      .select(
        "job_id, job:jobs!inner(id, title, starts_on, start_time, status)",
      )
      .eq("instructor_id", profile.id)
      .not("confirmed_at", "is", null)
      .eq("job.status", "confirmed")
      .gte("job.starts_on", today),
    supabase
      .from("document_uploads")
      .select("status, expires_at, created_at")
      .eq("user_id", profile.id)
      .eq("doc_type", "vog")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("instructor_profiles")
      .select(
        "hourly_rate_cents, travel_distance_km, work_experience, years_experience",
      )
      .eq("user_id", profile.id)
      .maybeSingle(),
    supabase.rpc("has_pending_review", { target_user: profile.id }),
  ]);

  const subscription = subscriptionResult.data as Subscription | null;
  const hasAccess = subscriptionGrantsAccess(subscription);
  const pendingApplicationCount = applicationsResult.count ?? 0;
  const pendingInvitationCount = invitationsResult.count ?? 0;

  const pendingConfirmationJobIds = new Set<string>();
  for (const row of pendingConfirmationsResult.data ?? []) {
    pendingConfirmationJobIds.add(row.job_id as string);
  }
  for (const row of pendingSegmentConfirmationsResult.data ?? []) {
    pendingConfirmationJobIds.add(row.job_id as string);
  }
  const pendingConfirmationCount = pendingConfirmationJobIds.size;
  const firstPendingConfirmationJobId =
    Array.from(pendingConfirmationJobIds)[0] ?? null;

  type ConfirmedDashboardJob = {
    job_id: string;
    job: {
      id: string;
      title: string;
      starts_on: string;
      start_time: string;
      status: string;
    } | null;
  };

  const upcomingConfirmedJobs =
    (confirmedJobsResult.data as unknown as ConfirmedDashboardJob[] | null) ?? [];
  const nextConfirmedJob = upcomingConfirmedJobs
    .filter((row) => row.job)
    .sort((left, right) =>
      `${left.job!.starts_on}T${left.job!.start_time}`.localeCompare(
        `${right.job!.starts_on}T${right.job!.start_time}`,
      ),
    )[0]?.job ?? null;

  const latestVog = vogResult.data as
    | { status: string; expires_at: string | null; created_at: string }
    | null;
  const vogValid =
    latestVog?.status === "approved" &&
    (!latestVog.expires_at || latestVog.expires_at >= today);

  const instructorDetails = instructorProfileResult.data as
    | {
        hourly_rate_cents: number | null;
        travel_distance_km: number | null;
        work_experience: string | null;
        years_experience: number | null;
      }
    | null;

  const profileNeedsAttention =
    !profile.phone ||
    (!profile.city_id && !profile.custom_city) ||
    !instructorDetails?.hourly_rate_cents ||
    !instructorDetails?.travel_distance_km ||
    !instructorDetails?.work_experience;
  const hasPendingReview = pendingReviewResult.data === true;

  const todoItems = [
    ...(hasPendingReview
      ? [
          {
            title: "Beoordeling afronden",
            description: "Er staat nog een verplichte review open.",
            href: "/reviews?view=given",
          },
        ]
      : []),
    ...(pendingInvitationCount > 0
      ? [
          {
            title: "Uitnodiging beantwoorden",
            description: `${pendingInvitationCount} ${pendingInvitationCount === 1 ? "uitnodiging wacht" : "uitnodigingen wachten"} op jouw reactie.`,
            href: "/mijn-reacties",
          },
        ]
      : []),
    ...(pendingConfirmationCount > 0
      ? [
          {
            title: "Opdracht bevestigen",
            description: `${pendingConfirmationCount} ${pendingConfirmationCount === 1 ? "opdracht wacht" : "opdrachten wachten"} op jouw definitieve bevestiging.`,
            href: firstPendingConfirmationJobId
              ? `/opdrachten/${firstPendingConfirmationJobId}`
              : "/mijn-reacties",
          },
        ]
      : []),
    ...(!vogValid
      ? [
          {
            title: "VOG regelen",
            description:
              latestVog?.status === "pending"
                ? "Je VOG wacht nog op controle."
                : "Er is nog geen geldige, goedgekeurde VOG.",
            href: "/documenten",
          },
        ]
      : []),
    ...(profileNeedsAttention
      ? [
          {
            title: "Profiel aanvullen",
            description: "Je basisprofiel mist nog informatie voor betere matching.",
            href: "/profiel",
          },
        ]
      : []),
  ];

  const primaryAction =
    pendingInvitationCount > 0
      ? {
          title: "Je hebt een nieuwe uitnodiging",
          text: `${pendingInvitationCount} ${
            pendingInvitationCount === 1 ? "sportschool wil" : "sportscholen willen"
          } je rechtstreeks boeken. Bekijk datum, locatie en vergoeding en reageer.`,
          href: "/mijn-reacties",
          cta: "Bekijk uitnodigingen",
        }
      : pendingConfirmationCount > 0
        ? {
            title: "Een sportschool heeft jou gekozen",
            text: `${pendingConfirmationCount} ${
              pendingConfirmationCount === 1 ? "opdracht wacht" : "opdrachten wachten"
            } nog op jouw definitieve bevestiging.`,
            href: firstPendingConfirmationJobId
              ? `/opdrachten/${firstPendingConfirmationJobId}`
              : "/mijn-reacties",
            cta: "Bevestiging bekijken",
          }
        : !vogValid
          ? {
              title: "Je VOG vraagt aandacht",
              text:
                latestVog?.status === "pending"
                  ? "Je VOG wacht nog op controle. Je kunt opdrachten bekijken, maar commerciële acties blijven beperkt totdat deze is goedgekeurd."
                  : "Zorg voor een geldige, goedgekeurde VOG zodat je kunt reageren, uitnodigingen accepteren en bevestigd kunt worden.",
              href: "/documenten",
              cta: "Bekijk documenten",
            }
          : profileNeedsAttention
            ? {
                title: "Maak je profiel completer",
                text:
                  "Vul je woonplaats, reisafstand, tarief en werkervaring zo volledig mogelijk in. Dat verbetert je matching en geeft sportscholen meer context.",
                href: "/profiel",
                cta: "Profiel aanvullen",
              }
            : pendingApplicationCount > 0
              ? {
                  title: "Je reacties lopen",
                  text: `${pendingApplicationCount} ${
                    pendingApplicationCount === 1 ? "reactie staat" : "reacties staan"
                  } nog open. Je hoeft niets opnieuw te versturen; houd opvolging en berichten in de gaten.`,
                  href: "/mijn-reacties",
                  cta: "Mijn reacties",
                }
              : nextConfirmedJob
                ? {
                    title: "Je volgende klus staat gepland",
                    text: `${nextConfirmedJob.title} · ${formatDate(
                      nextConfirmedJob.starts_on,
                    )} om ${formatTime(nextConfirmedJob.start_time)}.`,
                    href: `/opdrachten/${nextConfirmedJob.id}`,
                    cta: "Bekijk opdracht",
                  }
                : {
                    title: "Bekijk passende opdrachten",
                    text:
                      "Er staat nu geen actie voor je open. Bekijk opdrachten die passen bij je sport, reisafstand en voorkeuren.",
                    href: "/opdrachten",
                    cta: "Opdrachten bekijken",
                  };

  const vogStatus = vogValid
    ? { label: "Goedgekeurd", variant: "success" as const }
    : latestVog?.status === "pending"
      ? { label: "Wacht op controle", variant: "warning" as const }
      : { label: "Geen geldige VOG", variant: "destructive" as const };

  return (
    <Page>
      <PageHeader title={`Hoi ${profile.full_name.split(" ")[0]}!`} />

      {!hasAccess ? (
        <Alert variant="warning">
          <AlertTitle>Je abonnement is niet actief</AlertTitle>
          <AlertDescription>
            Je kunt opdrachten bekijken, maar niet reageren of chatten.{" "}
            <Link className="font-medium underline" href="/abonnement">
              Bekijk je abonnement
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : null}

      <FocusCard
        cta={primaryAction.cta}
        href={primaryAction.href}
        text={primaryAction.text}
        title={primaryAction.title}
      />

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatTile
          href="/mijn-reacties"
          icon={Mail}
          label="Uitnodigingen"
          tone={pendingInvitationCount > 0 ? "primary" : "default"}
          value={pendingInvitationCount}
        />
        <StatTile
          href="/mijn-reacties"
          icon={Send}
          label="Open reacties"
          value={pendingApplicationCount}
        />
        <StatTile
          href={
            firstPendingConfirmationJobId
              ? `/opdrachten/${firstPendingConfirmationJobId}`
              : "/mijn-reacties"
          }
          icon={Clock3}
          label="Wacht op jouw bevestiging"
          tone={pendingConfirmationCount > 0 ? "warning" : "default"}
          value={pendingConfirmationCount}
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <DashboardTodoList items={todoItems} />

        <div className="space-y-6">
          <Panel>
            <PanelHeader
              icon={CalendarCheck}
              iconClassName="bg-primary-soft text-primary"
              title="Eerstvolgende bevestigde klus"
            />
            {nextConfirmedJob ? (
              <Link
                className="group flex items-center gap-3 px-4 py-4 transition-colors hover:bg-subtle sm:px-5"
                href={`/opdrachten/${nextConfirmedJob.id}`}
              >
                <DateBadge date={nextConfirmedJob.starts_on} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium group-hover:text-primary">
                    {nextConfirmedJob.title}
                  </p>
                  <p className="text-[13px] tabular-nums text-muted-foreground">
                    {formatTime(nextConfirmedJob.start_time)}
                  </p>
                </div>
                <JobStatusIndicator showLabel={false} size="sm" state="confirmed" />
              </Link>
            ) : (
              <div className="space-y-3 px-4 py-4 sm:px-5">
                <p className="text-sm text-muted-foreground">
                  Er staat nu geen bevestigde toekomstige klus in je planning.
                </p>
                <Link
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  href="/opdrachten"
                >
                  Bekijk opdrachten
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader
              icon={ShieldCheck}
              iconClassName={
                vogValid
                  ? "bg-primary-soft text-primary"
                  : "bg-warning-soft text-warning"
              }
              title="Profiel & VOG"
            />
            <PanelList>
              <Link
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-subtle sm:px-5"
                href="/documenten"
              >
                <span className="text-sm font-medium">VOG</span>
                <span className="flex items-center gap-2">
                  <Badge variant={vogStatus.variant}>{vogStatus.label}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </span>
              </Link>
              <Link
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-subtle sm:px-5"
                href="/profiel"
              >
                <span className="text-sm font-medium">Profiel</span>
                <span className="flex items-center gap-2">
                  <Badge variant={profileNeedsAttention ? "warning" : "success"}>
                    {profileNeedsAttention ? "Aanvullen" : "Compleet"}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </span>
              </Link>
            </PanelList>
          </Panel>
        </div>
      </div>
    </Page>
  );
}
