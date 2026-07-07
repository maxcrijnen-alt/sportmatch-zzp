import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CalendarDays,
  Clock,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Star,
} from "lucide-react";
import { CancelForm } from "@/components/jobs/cancel-form";
import { CounterofferForm } from "@/components/jobs/counteroffer-form";
import { InviteForm } from "@/components/jobs/invite-form";
import { NoShowForm } from "@/components/jobs/no-show-form";
import { ReviewForm } from "@/components/jobs/review-form";
import { SelectCandidateForm } from "@/components/jobs/select-candidate-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth/session";
import {
  applicationStatusLabels,
  formatDate,
  formatEuro,
  formatTime,
  jobStatusLabels,
  jobTypeLabels,
} from "@/lib/labels";
import {
  closeJobAction,
  completeJobAction,
  decideReplacementAction,
  respondCounterofferAction,
} from "@/lib/jobs/actions";
import { describePay, fetchJobWithRelations } from "@/lib/jobs/queries";
import { getOrgContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import type {
  InstructorPublicStats,
  JobApplication,
  JobConfirmation,
  JobCounteroffer,
  JobInvitation,
  Replacement,
  Review,
} from "@/types/database";

export const metadata: Metadata = {
  title: "Opdracht beheren",
};

interface CandidateProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  city: { name: string } | null;
}

interface ApplicationWithProfile extends JobApplication {
  instructor: CandidateProfile | null;
}

interface ContactDetails {
  full_name: string;
  email: string;
  phone: string;
}

export default async function OrganisatieOpdrachtDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getSessionProfile();
  const orgContext = await getOrgContext();
  const supabase = await createClient();

  if (!profile || !supabase) {
    redirect("/login");
  }

  if (!orgContext) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const job = await fetchJobWithRelations(id);

  if (!job || job.organization_id !== orgContext.organization.id) {
    notFound();
  }

  const [
    applicationsResult,
    invitationsResult,
    confirmationResult,
    replacementsResult,
    reviewsResult,
    myReviewResult,
    contactResult,
    suggestionsResult,
  ] = await Promise.all([
    supabase
      .from("job_applications")
      .select("*")
      .eq("job_id", job.id)
      .order("created_at"),
    supabase.from("job_invitations").select("*").eq("job_id", job.id),
    supabase.from("job_confirmations").select("*").eq("job_id", job.id).maybeSingle(),
    supabase
      .from("replacements")
      .select("*")
      .eq("job_id", job.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("reviews")
      .select("*")
      .eq("job_id", job.id)
      .not("released_at", "is", null),
    supabase
      .from("reviews")
      .select("id")
      .eq("job_id", job.id)
      .eq("reviewer_id", profile.id)
      .maybeSingle(),
    supabase.rpc("get_job_contact_details", { p_job: job.id }),
    // suggesties om uit te nodigen: instructeurs met deze sport als specialisatie
    supabase
      .from("instructor_sports")
      .select("user_id")
      .eq("sport_id", job.sport_id)
      .limit(12),
  ]);

  const rawApplications =
    (applicationsResult.data as JobApplication[] | null) ?? [];
  const suggestionUserIds = (
    (suggestionsResult.data as { user_id: string }[] | null) ?? []
  ).map((row) => row.user_id);

  // Profielen van kandidaten en suggesties in één query ophalen
  const profileIds = Array.from(
    new Set([
      ...rawApplications.map((application) => application.instructor_id),
      ...suggestionUserIds,
    ]),
  );

  const profilesById = new Map<string, CandidateProfile>();
  if (profileIds.length > 0) {
    const { data: candidateProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, city:cities (name)")
      .in("id", profileIds);
    for (const candidate of (candidateProfiles as unknown as CandidateProfile[]) ??
      []) {
      profilesById.set(candidate.id, candidate);
    }
  }

  const applications: ApplicationWithProfile[] = rawApplications.map(
    (application) => ({
      ...application,
      instructor: profilesById.get(application.instructor_id) ?? null,
    }),
  );
  const invitations =
    (invitationsResult.data as JobInvitation[] | null) ?? [];
  const confirmation = confirmationResult.data as JobConfirmation | null;
  const replacements = (replacementsResult.data as Replacement[] | null) ?? [];
  const releasedReviews = (reviewsResult.data as Review[] | null) ?? [];
  const hasReviewed = Boolean(myReviewResult.data);
  const contact =
    ((contactResult.data as ContactDetails[] | null) ?? [])[0] ?? null;

  // Statistieken per kandidaat ophalen (kleine aantallen in de MVP)
  const statsEntries = await Promise.all(
    applications.map(async (application) => {
      const { data } = await supabase.rpc("instructor_public_stats", {
        target: application.instructor_id,
      });
      return [
        application.instructor_id,
        ((data as InstructorPublicStats[] | null) ?? [])[0] ?? null,
      ] as const;
    }),
  );
  const statsByInstructor = new Map(statsEntries);

  // Tegenvoorstellen per reactie
  const applicationIds = applications.map((application) => application.id);
  let counteroffers: JobCounteroffer[] = [];
  if (applicationIds.length > 0) {
    const { data } = await supabase
      .from("job_counteroffers")
      .select("*")
      .in("application_id", applicationIds)
      .order("created_at", { ascending: false });
    counteroffers = (data as JobCounteroffer[] | null) ?? [];
  }

  const invitedIds = new Set(invitations.map((invitation) => invitation.instructor_id));
  const appliedIds = new Set(applications.map((application) => application.instructor_id));
  const suggestions = suggestionUserIds
    .filter(
      (userId) =>
        profilesById.has(userId) &&
        !invitedIds.has(userId) &&
        !appliedIds.has(userId),
    )
    .slice(0, 6)
    .map((userId) => ({
      user_id: userId,
      profile: profilesById.get(userId) ?? null,
    }));

  const confirmedApplication = applications.find(
    (application) => application.id === confirmation?.application_id,
  );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              job.job_type === "urgent_substitute" ? "destructive" : "secondary"
            }
          >
            {jobTypeLabels[job.job_type]}
          </Badge>
          {job.sport ? <Badge variant="muted">{job.sport.name}</Badge> : null}
          <Badge variant="outline">{jobStatusLabels[job.status]}</Badge>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{job.title}</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            {job.location?.name}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" />
            {formatDate(job.starts_on)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {formatTime(job.start_time)}–{formatTime(job.end_time)}
          </span>
          <span className="font-medium text-foreground">{describePay(job)}</span>
        </div>
      </div>

      {/* Statusacties */}
      {job.status === "open" ? (
        <div className="flex flex-wrap gap-2">
          <form action={closeJobAction.bind(null, job.id)}>
            <Button size="sm" type="submit" variant="outline">
              Opdracht sluiten
            </Button>
          </form>
        </div>
      ) : null}

      {/* Bevestigde instructeur */}
      {confirmation?.confirmed_at ? (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Bevestigde instructeur</CardTitle>
            <CardDescription>
              {confirmedApplication?.instructor?.full_name ??
                "De opdracht is bevestigd."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {contact ? (
              <div className="space-y-1 text-sm">
                <p className="font-medium">{contact.full_name}</p>
                <p className="inline-flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" /> {contact.email}
                </p>
                <br />
                <p className="inline-flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" /> {contact.phone}
                </p>
              </div>
            ) : null}

            {job.status === "confirmed" ? (
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <form action={completeJobAction.bind(null, job.id)}>
                  <Button size="sm" type="submit">
                    Opdracht afronden
                  </Button>
                </form>
                <NoShowForm jobId={job.id} />
                <CancelForm jobId={job.id} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* Vervangingsvoorstellen */}
      {replacements.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Vervangingsvoorstellen</CardTitle>
            <CardDescription>
              Jij bepaalt of een vervanger geschikt is.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {replacements.map((replacement) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"
                key={replacement.id}
              >
                <div>
                  <p className="font-medium">
                    Vervanger voorgesteld
                    <Badge className="ml-2" variant={
                      replacement.status === "approved"
                        ? "success"
                        : replacement.status === "rejected"
                          ? "destructive"
                          : "secondary"
                    }>
                      {replacement.status === "proposed"
                        ? "Te beoordelen"
                        : replacement.status === "approved"
                          ? "Goedgekeurd"
                          : "Afgewezen"}
                    </Badge>
                  </p>
                  {replacement.reason ? (
                    <p className="text-muted-foreground">
                      Reden: {replacement.reason}
                    </p>
                  ) : null}
                </div>
                {replacement.status === "proposed" ? (
                  <div className="flex gap-2">
                    <form
                      action={decideReplacementAction.bind(
                        null,
                        replacement.id,
                        true,
                        job.id,
                      )}
                    >
                      <Button size="sm" type="submit">
                        Goedkeuren
                      </Button>
                    </form>
                    <form
                      action={decideReplacementAction.bind(
                        null,
                        replacement.id,
                        false,
                        job.id,
                      )}
                    >
                      <Button size="sm" type="submit" variant="outline">
                        Afwijzen
                      </Button>
                    </form>
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Review */}
      {job.status === "completed" && !hasReviewed ? (
        <Card>
          <CardHeader>
            <CardTitle>Beoordeel de instructeur</CardTitle>
          </CardHeader>
          <CardContent>
            <ReviewForm jobId={job.id} />
          </CardContent>
        </Card>
      ) : null}

      {releasedReviews.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Beoordelingen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {releasedReviews.map((review) => (
              <p key={review.id}>
                {"★".repeat(review.rating)}
                {"☆".repeat(5 - review.rating)}{" "}
                <span className="text-muted-foreground">
                  door {review.side === "instructor" ? "instructeur" : "organisatie"}
                </span>
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Kandidaten */}
      <Card>
        <CardHeader>
          <CardTitle>Kandidaten ({applications.length})</CardTitle>
          <CardDescription>
            Vergelijk kandidaten op beoordeling, ervaring en betrouwbaarheid.
            Jij kiest wie het beste past.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {applications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nog geen reacties. Nodig hieronder zelf instructeurs uit.
            </p>
          ) : (
            applications.map((application) => {
              const stats = statsByInstructor.get(application.instructor_id);
              const offers = counteroffers.filter(
                (offer) => offer.application_id === application.id,
              );

              return (
                <div
                  className="space-y-3 rounded-lg border border-border p-4"
                  key={application.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={application.instructor?.full_name ?? "?"}
                        src={application.instructor?.avatar_url}
                      />
                      <div>
                        <p className="font-medium">
                          {application.instructor?.full_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {application.instructor?.city?.name ?? "Onbekende plaats"}
                          {" · "}
                          {applicationStatusLabels[application.status]}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {stats?.avg_rating != null ? (
                        <Badge variant="accent">
                          <Star className="h-3 w-3" /> {stats.avg_rating}
                        </Badge>
                      ) : (
                        <Badge variant="muted">Nieuw</Badge>
                      )}
                      {stats ? (
                        <>
                          <Badge variant="muted">
                            {stats.completed_count} afgerond
                          </Badge>
                          {stats.no_show_count > 0 ? (
                            <Badge variant="warning">
                              {stats.no_show_count} no-show
                            </Badge>
                          ) : null}
                          {stats.reliability_score != null ? (
                            <Badge variant="outline">
                              Betrouwbaarheid {stats.reliability_score}%
                            </Badge>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>

                  {application.message ? (
                    <p className="text-sm text-muted-foreground">
                      “{application.message}”
                    </p>
                  ) : null}
                  {application.availability_note ? (
                    <p className="text-xs text-muted-foreground">
                      Beschikbaarheid: {application.availability_note}
                    </p>
                  ) : null}

                  {offers.length > 0 ? (
                    <div className="space-y-2">
                      {offers.map((offer) => (
                        <div
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted p-2.5 text-sm"
                          key={offer.id}
                        >
                          <span>
                            Tegenvoorstel: {formatEuro(offer.amount_cents)}{" "}
                            {offer.pay_type === "hourly" ? "per uur" : "vast"} (
                            {offer.status === "pending"
                              ? "in afwachting"
                              : offer.status === "accepted"
                                ? "geaccepteerd"
                                : "afgewezen"}
                            )
                          </span>
                          {offer.status === "pending" &&
                          offer.side === "instructor" ? (
                            <span className="flex gap-2">
                              <form
                                action={respondCounterofferAction.bind(
                                  null,
                                  offer.id,
                                  true,
                                  `/organisatie/opdrachten/${job.id}`,
                                )}
                              >
                                <Button size="sm" type="submit">
                                  Accepteren
                                </Button>
                              </form>
                              <form
                                action={respondCounterofferAction.bind(
                                  null,
                                  offer.id,
                                  false,
                                  `/organisatie/opdrachten/${job.id}`,
                                )}
                              >
                                <Button size="sm" type="submit" variant="outline">
                                  Afwijzen
                                </Button>
                              </form>
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {job.status === "open" && application.status === "pending" ? (
                    <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                      <SelectCandidateForm
                        applicationId={application.id}
                        candidateName={
                          application.instructor?.full_name ?? "deze kandidaat"
                        }
                        jobId={job.id}
                      />
                      <details>
                        <summary className="cursor-pointer text-sm text-primary">
                          Tegenvoorstel doen
                        </summary>
                        <div className="mt-2">
                          <CounterofferForm applicationId={application.id} />
                        </div>
                      </details>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Uitnodigen */}
      {job.status === "open" ? (
        <Card>
          <CardHeader>
            <CardTitle>Instructeurs uitnodigen</CardTitle>
            <CardDescription>
              Instructeurs met {job.sport?.name ?? "deze sport"} als
              specialisatie.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Geen extra suggesties gevonden.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {suggestions.map((suggestion) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                    key={suggestion.user_id}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={suggestion.profile?.full_name ?? "?"}
                        size="sm"
                        src={suggestion.profile?.avatar_url}
                      />
                      <div>
                        <p className="text-sm font-medium">
                          {suggestion.profile?.full_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {suggestion.profile?.city?.name ?? ""}
                        </p>
                      </div>
                    </div>
                    <InviteForm instructorId={suggestion.user_id} jobId={job.id} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Chats voor deze opdracht */}
      <Alert>
        <AlertDescription className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Alle gesprekken met kandidaten vind je onder{" "}
          <Link className="font-medium text-primary hover:underline" href="/berichten">
            Berichten
          </Link>
          .
        </AlertDescription>
      </Alert>
    </div>
  );
}
