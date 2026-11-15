import Link from "next/link";
import {
  BookmarkCheck,
  Briefcase,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  Gauge,
  History,
  Inbox,
  MailCheck,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { InviteForm } from "@/components/jobs/invite-form";
import { ConnectionButton } from "@/components/org/connection-button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Stars } from "@/components/ui/stars";
import type { Candidate } from "@/lib/candidates/search";
import { cn } from "@/lib/utils";

const MAX_CHIPS = 3;

const availabilityDisplay = {
  available: {
    label: "Beschikbaar volgens rooster",
    icon: CalendarCheck,
    className: "text-primary-soft-foreground",
  },
  unknown: {
    label: "Beschikbaarheid onbekend",
    icon: CalendarClock,
    className: "text-muted-foreground",
  },
  unavailable: {
    label: "Niet beschikbaar",
    icon: CalendarX,
    className: "text-destructive",
  },
} as const;

function formatRating(value: number) {
  return value.toLocaleString("nl-NL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/** Relevante items eerst, daarna alfabetisch; maximaal drie zichtbaar. */
function chipList(
  ids: string[],
  names: Map<string, string>,
  relevant: Set<string>,
): { visible: { id: string; name: string; relevant: boolean }[]; hidden: number } {
  const items = ids
    .map((id) => ({ id, name: names.get(id), relevant: relevant.has(id) }))
    .filter((item): item is { id: string; name: string; relevant: boolean } => Boolean(item.name))
    .sort(
      (left, right) =>
        Number(right.relevant) - Number(left.relevant) ||
        left.name.localeCompare(right.name, "nl"),
    );
  return { visible: items.slice(0, MAX_CHIPS), hidden: Math.max(0, items.length - MAX_CHIPS) };
}

export function CandidateCard({
  candidate,
  profileHref,
  sportNames,
  lessonTypeNames,
  relevantSports,
  relevantLessonTypes,
  jobTitles,
  selectedJobId,
}: {
  candidate: Candidate;
  profileHref: string;
  sportNames: Map<string, string>;
  lessonTypeNames: Map<string, string>;
  relevantSports: Set<string>;
  relevantLessonTypes: Set<string>;
  jobTitles: Map<string, string>;
  selectedJobId: string | null;
}) {
  const sports = chipList(candidate.sportIds, sportNames, relevantSports);
  const lessons = chipList(candidate.lessonTypeIds, lessonTypeNames, relevantLessonTypes);
  const availability = candidate.availability
    ? availabilityDisplay[candidate.availability]
    : null;
  const matchJobTitle = candidate.matchJobId ? jobTitles.get(candidate.matchJobId) : null;
  const actionJobTitle = candidate.actionJobId ? jobTitles.get(candidate.actionJobId) : null;
  const headingId = `candidate-${candidate.id}`;

  let inviteAction: React.ReactNode = null;
  if (candidate.actionJobId) {
    if (candidate.appliedToActionJob) {
      inviteAction = (
        <Link
          className={buttonVariants({ size: "sm", variant: "outline" })}
          href={`/organisatie/opdrachten/${candidate.actionJobId}`}
        >
          <Inbox aria-hidden="true" className="h-3.5 w-3.5" />
          Reactie bekijken
        </Link>
      );
    } else if (candidate.invitedToActionJob) {
      inviteAction = (
        <Badge className="h-9 px-3 sm:h-8" variant="muted">
          <MailCheck aria-hidden="true" className="h-3.5 w-3.5" />
          Al uitgenodigd
        </Badge>
      );
    } else if (!candidate.hasValidVog) {
      inviteAction = (
        <span className="text-xs text-muted-foreground">
          Uitnodigen kan na een goedgekeurde VOG
        </span>
      );
    } else if (selectedJobId || candidate.matchJobId) {
      inviteAction = (
        <InviteForm instructorId={candidate.id} jobId={candidate.actionJobId} />
      );
    }
  }

  return (
    <article
      aria-labelledby={headingId}
      className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_auto] lg:items-start lg:gap-6"
      data-testid="candidate-card"
    >
      {/* Identiteit en reputatie */}
      <div className="flex min-w-0 items-start gap-3">
        <Link
          aria-hidden="true"
          className="relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          href={profileHref}
          tabIndex={-1}
        >
          <Avatar
            className={candidate.inPool ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : undefined}
            name={candidate.name}
            size="md"
            src={candidate.avatarUrl}
          />
          {candidate.inPool ? (
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-card">
              <BookmarkCheck aria-hidden="true" className="h-2.5 w-2.5" />
            </span>
          ) : null}
        </Link>
        <div className="min-w-0 space-y-1">
          <h3 className="truncate text-sm font-semibold" id={headingId}>
            <Link className="hover:text-primary" href={profileHref}>
              {candidate.name}
            </Link>
          </h3>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin aria-hidden="true" className="h-3 w-3 shrink-0" />
            <span className="truncate">{candidate.city ?? "Woonplaats onbekend"}</span>
            {candidate.distanceKm != null ? (
              <span className="shrink-0">· {formatRating(candidate.distanceKm)} km</span>
            ) : (
              <span className="shrink-0">· afstand onbekend</span>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {candidate.avgRating != null ? (
              <Link
                aria-label={`Gemiddeld ${formatRating(candidate.avgRating)} van 5 sterren uit ${candidate.reviewCount} ${candidate.reviewCount === 1 ? "review" : "reviews"}`}
                className="inline-flex items-center gap-1 rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                href={`${profileHref}#reviews`}
              >
                <Stars rating={candidate.avgRating} size="xs" />
                <span className="font-semibold text-foreground">
                  {formatRating(candidate.avgRating)}
                </span>
                <span>({candidate.reviewCount})</span>
              </Link>
            ) : (
              <Badge className="py-0 text-[11px]" variant="accent">
                Eerste klus
              </Badge>
            )}
            <span className="inline-flex items-center gap-1">
              <Gauge aria-hidden="true" className="h-3 w-3" />
              {candidate.reliability != null
                ? `Betrouwbaarheid ${candidate.reliability}%`
                : "Betrouwbaarheid nog onbekend"}
            </span>
            {candidate.completedCount > 0 ? (
              <span>{candidate.completedCount} afgerond</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Geschiktheid */}
      <div className="min-w-0 space-y-2 text-[13px] text-muted-foreground lg:border-l lg:border-border lg:pl-6">
        <div className="flex flex-wrap items-center gap-1.5">
          {candidate.matchScore != null ? (
            <Badge
              title="Indicatie op basis van sport, lesvorm, diploma's, afstand, beschikbaarheid, ervaring, profiel en reviews. Geen voorspelde slagingskans."
              variant="accent"
            >
              <Sparkles aria-hidden="true" className="h-3 w-3" />
              Matchscore {candidate.matchScore}
            </Badge>
          ) : null}
          {candidate.hasValidVog ? (
            <Badge variant="success">
              <ShieldCheck aria-hidden="true" className="h-3 w-3" />
              VOG
            </Badge>
          ) : (
            <Badge variant="muted">Geen geldige VOG</Badge>
          )}
          {candidate.inPool ? (
            <Badge variant="default">
              <BookmarkCheck aria-hidden="true" className="h-3 w-3" />
              In poule
            </Badge>
          ) : null}
          {candidate.workedBefore ? (
            <Badge variant="outline">
              <History aria-hidden="true" className="h-3 w-3" />
              Eerder samengewerkt
            </Badge>
          ) : null}
          {candidate.pendingApplicationJobId ? (
            <Badge variant="warning">
              <Inbox aria-hidden="true" className="h-3 w-3" />
              Heeft gereageerd
            </Badge>
          ) : null}
          {candidate.invitedPending ? (
            <Badge variant="secondary">
              <MailCheck aria-hidden="true" className="h-3 w-3" />
              Uitgenodigd
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1">
            <Briefcase aria-hidden="true" className="h-3.5 w-3.5" />
            {candidate.yearsExperience === 0
              ? "Minder dan 1 jaar ervaring"
              : `${candidate.yearsExperience} jaar ervaring`}
          </span>
          {availability ? (
            <span className={cn("inline-flex items-center gap-1 font-medium", availability.className)}>
              <availability.icon aria-hidden="true" className="h-3.5 w-3.5" />
              {availability.label}
              {!selectedJobId && matchJobTitle ? (
                <span className="font-normal text-muted-foreground"> · {matchJobTitle}</span>
              ) : null}
            </span>
          ) : null}
          {!selectedJobId ? (
            matchJobTitle ? (
              <span className="text-foreground">Past bij {matchJobTitle}</span>
            ) : (
              <span>Geen passende open opdracht</span>
            )
          ) : null}
        </div>

        {sports.visible.length > 0 || lessons.visible.length > 0 ? (
          <ul aria-label="Sporten en lesvormen" className="flex flex-wrap gap-1">
            {[...sports.visible, ...lessons.visible].map((item) => (
              <li key={item.id}>
                <Badge
                  className={cn("py-0 text-[11px]", !item.relevant && "font-normal")}
                  variant={item.relevant ? "default" : "outline"}
                >
                  {item.name}
                </Badge>
              </li>
            ))}
            {sports.hidden + lessons.hidden > 0 ? (
              <li>
                <Badge className="py-0 text-[11px] font-normal" variant="muted">
                  +{sports.hidden + lessons.hidden}
                </Badge>
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="text-xs">Nog geen sporten of lesvormen opgegeven.</p>
        )}
      </div>

      {/* Acties */}
      <div className="flex flex-wrap items-center gap-2 lg:max-w-56 lg:flex-col lg:items-stretch">
        <Link className={buttonVariants({ size: "sm", variant: "outline" })} href={profileHref}>
          Profiel bekijken
        </Link>
        {inviteAction ? (
          <div className="lg:[&_button]:w-full" title={actionJobTitle ? `Voor ${actionJobTitle}` : undefined}>
            {inviteAction}
          </div>
        ) : null}
        <ConnectionButton
          initialConnected={candidate.inPool}
          instructorId={candidate.id}
          key={`${candidate.id}-${candidate.inPool}`}
        />
      </div>
    </article>
  );
}
