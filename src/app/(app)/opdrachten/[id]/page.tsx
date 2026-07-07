import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Building2,
  CalendarDays,
  Clock,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Users,
} from "lucide-react";
import { ApplyForm } from "@/components/jobs/apply-form";
import { CancelForm } from "@/components/jobs/cancel-form";
import { ConfirmJobForm } from "@/components/jobs/confirm-job-form";
import { CounterofferForm } from "@/components/jobs/counteroffer-form";
import { ReplacementForm } from "@/components/jobs/replacement-form";
import { ReviewForm } from "@/components/jobs/review-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  respondCounterofferAction,
  respondInvitationAction,
} from "@/lib/jobs/actions";
import { describePay, fetchJobWithRelations } from "@/lib/jobs/queries";
import { createClient } from "@/lib/supabase/server";
import type {
  JobApplication,
  JobConfirmation,
  JobCounteroffer,
  JobInvitation,
  Review,
} from "@/types/database";

export const metadata: Metadata = {
  title: "Opdracht",
};

interface ContactDetails {
  full_name: string;
  email: string;
  phone: string;
}

export default async function OpdrachtDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    redirect("/login");
  }

  if (profile.role === "organization") {
    const { id } = await params;
    redirect(`/organisatie/opdrachten/${id}`);
  }

  const { id } = await params;
  const job = await fetchJobWithRelations(id);

  if (!job) {
    notFound();
  }

  const [
    applicationResult,
    invitationResult,
    confirmationResult,
    requirementsResult,
    myQualificationsResult,
    contactResult,
    reviewsResult,
    myReviewResult,
  ] = await Promise.all([
    supabase
      .from("job_applications")
      .select("*")
      .eq("job_id", job.id)
      .eq("instructor_id", profile.id)
      .maybeSingle(),
    supabase
      .from("job_invitations")
      .select("*")
      .eq("job_id", job.id)
      .eq("instructor_id", profile.id)
      .maybeSingle(),
    supabase.from("job_confirmations").select("*").eq("job_id", job.id).maybeSingle(),
    supabase
      .from("job_requirements")
      .select("qualification_id, qualification:qualifications(name)")
      .eq("job_id", job.id),
    supabase
      .from("instructor_qualifications")
      .select("qualification_id")
      .eq("user_id", profile.id),
    supabase.rpc("get_job_contact_details", { p_job: job.id }),
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
  ]);

  const application = applicationResult.data as JobApplication | null;
  const invitation = invitationResult.data as JobInvitation | null;
  const confirmation = confirmationResult.data as JobConfirmation | null;
  const releasedReviews = (reviewsResult.data as Review[] | null) ?? [];
  const hasReviewed = Boolean(myReviewResult.data);
  const contact =
    ((contactResult.data as ContactDetails[] | null) ?? [])[0] ?? null;

  const myQualificationIds = new Set(
    (myQualificationsResult.data ?? []).map((row) => row.qualification_id as string),
  );
  const requirements =
    (requirementsResult.data as
      | { qualification_id: string; qualification: { name: string } | null }[]
      | null) ?? [];

  const isSelected =
    confirmation?.instructor_id === profile.id &&
    confirmation.organization_agreed_at &&
    !confirmation.confirmed_at;
  const isConfirmedForMe =
    confirmation?.instructor_id === profile.id && confirmation.confirmed_at;

  let counteroffers: JobCounteroffer[] = [];
  if (application) {
    const { data } = await supabase
      .from("job_counteroffers")
      .select("*")
      .eq("application_id", application.id)
      .order("created_at", { ascending: false });
    counteroffers = (data as JobCounteroffer[] | null) ?? [];
  }

  // Kandidaten voor vervanging (eenvoudige lijst voor de MVP)
  let replacementCandidates: { id: string; name: string }[] = [];
  if (isConfirmedForMe && job.status === "confirmed") {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, instructor_profiles!inner(user_id)")
      .neq("id", profile.id)
      .limit(50);
    replacementCandidates =
      (data ?? []).map((row) => ({
        id: row.id as string,
        name: (row.full_name as string) || "Onbekend",
      })) ?? [];
  }

  const { data: chat } = await supabase
    .from("chats")
    .select("id")
    .eq("job_id", job.id)
    .eq("instructor_id", profile.id)
    .maybeSingle();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
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
            <Building2 className="h-4 w-4" />
            {job.organization?.name}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            {job.location?.name} · {job.location?.city?.name}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" />
            {formatDate(job.starts_on)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {formatTime(job.start_time)}–{formatTime(job.end_time)}
          </span>
          {job.expected_participants ? (
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" />~{job.expected_participants} deelnemers
            </span>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vergoeding</CardTitle>
          <CardDescription className="text-base font-medium text-foreground">
            {describePay(job)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="whitespace-pre-line text-muted-foreground">
            {job.description}
          </p>
          {job.recurrence_note ? (
            <p>
              <span className="font-medium">Terugkerend:</span>{" "}
              {job.recurrence_note}
            </p>
          ) : null}
          {job.required_level ? (
            <p>
              <span className="font-medium">Niveau:</span> {job.required_level}
            </p>
          ) : null}
          {requirements.length > 0 ? (
            <div>
              <p className="mb-2 font-medium">Gevraagde diploma&apos;s</p>
              <div className="flex flex-wrap gap-2">
                {requirements.map((requirement) => (
                  <Badge
                    key={requirement.qualification_id}
                    variant={
                      myQualificationIds.has(requirement.qualification_id)
                        ? "success"
                        : "warning"
                    }
                  >
                    {requirement.qualification?.name}
                    {myQualificationIds.has(requirement.qualification_id)
                      ? " ✓"
                      : " — ontbreekt bij jou"}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {job.job_type === "permanent" ? (
        <Alert>
          <AlertTitle>Vaste vacature</AlertTitle>
          <AlertDescription>
            Het platform faciliteert de sollicitatie en het contact. De formele
            arbeidsovereenkomst sluit je rechtstreeks met de werkgever.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Uitnodiging */}
      {invitation?.status === "pending" ? (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Je bent uitgenodigd!</CardTitle>
            <CardDescription>
              {invitation.message || "De organisatie nodigt je uit voor deze opdracht."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <form action={respondInvitationAction.bind(null, invitation.id, true)}>
              <Button type="submit">Accepteren</Button>
            </form>
            <form action={respondInvitationAction.bind(null, invitation.id, false)}>
              <Button type="submit" variant="outline">
                Afslaan
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {/* Bevestiging gevraagd */}
      {isSelected ? (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>De organisatie heeft jou gekozen 🎉</CardTitle>
            <CardDescription>
              Controleer de samenvatting en bevestig om de opdracht definitief te
              maken.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4 text-sm">
              <p className="font-medium">Samenvatting van de afspraak</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>Opdracht: {job.title}</li>
                <li>
                  Datum: {formatDate(job.starts_on)}, {formatTime(job.start_time)}–
                  {formatTime(job.end_time)}
                </li>
                <li>
                  Locatie: {job.location?.name}, {job.location?.city?.name}
                </li>
                <li>Vergoeding: {describePay(job)}</li>
                {typeof confirmation?.terms === "object" &&
                confirmation?.terms !== null &&
                "note" in confirmation.terms &&
                confirmation.terms.note ? (
                  <li>Afspraken: {String(confirmation.terms.note)}</li>
                ) : null}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Na bevestiging geldt de annuleringsregeling en worden
                contactgegevens zichtbaar voor beide partijen.
              </p>
            </div>
            <ConfirmJobForm jobId={job.id} />
          </CardContent>
        </Card>
      ) : null}

      {/* Bevestigd: contact + acties */}
      {isConfirmedForMe ? (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Opdracht bevestigd</CardTitle>
            <CardDescription>
              Contactgegevens van de organisatie zijn nu zichtbaar.
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
            {chat ? (
              <Link href={`/berichten/${chat.id}`}>
                <Button variant="outline">
                  <MessageSquare className="h-4 w-4" /> Naar de chat
                </Button>
              </Link>
            ) : null}
            {job.status === "confirmed" ? (
              <div className="space-y-4 border-t border-border pt-4">
                <div>
                  <p className="mb-2 text-sm font-medium">
                    Kun je onverwacht niet? Stel een vervanger voor
                  </p>
                  <ReplacementForm
                    candidates={replacementCandidates}
                    jobId={job.id}
                  />
                </div>
                <CancelForm jobId={job.id} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* Review na afronding */}
      {job.status === "completed" && isConfirmedForMe && !hasReviewed ? (
        <Card>
          <CardHeader>
            <CardTitle>Beoordeel de organisatie</CardTitle>
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

      {/* Reageren */}
      {job.status === "open" && !application && !isSelected ? (
        <Card>
          <CardHeader>
            <CardTitle>Reageren op deze opdracht</CardTitle>
          </CardHeader>
          <CardContent>
            <ApplyForm jobId={job.id} />
          </CardContent>
        </Card>
      ) : null}

      {/* Mijn reactie + tegenvoorstellen */}
      {application ? (
        <Card>
          <CardHeader>
            <CardTitle>Jouw reactie</CardTitle>
            <CardDescription>
              Status: {applicationStatusLabels[application.status]}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {application.message ? (
              <p className="text-sm text-muted-foreground">
                “{application.message}”
              </p>
            ) : null}

            {counteroffers.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Tegenvoorstellen</p>
                {counteroffers.map((offer) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
                    key={offer.id}
                  >
                    <div>
                      <p className="font-medium">
                        {formatEuro(offer.amount_cents)}{" "}
                        {offer.pay_type === "hourly" ? "per uur" : "vast"}
                        <span className="ml-2 text-xs text-muted-foreground">
                          door{" "}
                          {offer.side === "instructor" ? "jou" : "de organisatie"} ·{" "}
                          {offer.status === "pending"
                            ? "in afwachting"
                            : offer.status === "accepted"
                              ? "geaccepteerd"
                              : "afgewezen"}
                        </span>
                      </p>
                      {offer.message ? (
                        <p className="text-muted-foreground">{offer.message}</p>
                      ) : null}
                    </div>
                    {offer.status === "pending" && offer.side === "organization" ? (
                      <div className="flex gap-2">
                        <form
                          action={respondCounterofferAction.bind(
                            null,
                            offer.id,
                            true,
                            `/opdrachten/${job.id}`,
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
                            `/opdrachten/${job.id}`,
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
              </div>
            ) : null}

            {job.status === "open" &&
            application.status === "pending" &&
            (job.pay_is_negotiable || true) ? (
              <div className="border-t border-border pt-4">
                <p className="mb-2 text-sm font-medium">Tegenvoorstel doen</p>
                <CounterofferForm applicationId={application.id} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
