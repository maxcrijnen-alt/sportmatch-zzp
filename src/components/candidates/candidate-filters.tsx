import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  AVAILABILITY_FILTERS,
  CANDIDATE_SORTS,
  MAX_DISTANCE_OPTIONS,
  MAX_QUERY_LENGTH,
  MIN_EXPERIENCE_OPTIONS,
  MIN_RATING_OPTIONS,
  MIN_RELIABILITY_OPTIONS,
  PARAM,
  type CandidateFilters as Filters,
} from "@/lib/candidates/filters";
import { cn } from "@/lib/utils";

const labelClass = "space-y-1 text-[11px] font-medium text-muted-foreground";
const fieldClass = "h-10 text-sm sm:h-9";

function formatRating(value: number) {
  return value.toLocaleString("nl-NL", { maximumFractionDigits: 1 });
}

/**
 * Zoek- en filterformulier. Een gewoon GET-formulier: de status komt in de
 * URL, werkt zonder JavaScript en blijft behouden bij terugnavigeren.
 */
export function CandidateFilters({
  filters,
  jobId,
  locationId,
  openJobs,
  sports,
  lessonTypes,
  resetHref,
}: {
  filters: Filters;
  jobId: string | null;
  locationId: string | null;
  openJobs: { id: string; title: string }[];
  sports: { id: string; name: string }[];
  lessonTypes: { id: string; name: string; sportId: string }[];
  resetHref: string;
}) {
  const advancedActive = Boolean(
    filters.lessonType ||
      filters.availability ||
      filters.minRating != null ||
      filters.minExperience != null ||
      filters.maxDistance != null ||
      filters.minReliability != null ||
      filters.includeUnrated ||
      filters.onlyMatching,
  );
  const lessonGroups = sports
    .map((sport) => ({
      sport,
      items: lessonTypes.filter((lessonType) => lessonType.sportId === sport.id),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <form
      aria-label="Kandidaten zoeken en filteren"
      className="space-y-3"
      method="get"
      role="search"
    >
      {locationId ? <input name="location" type="hidden" value={locationId} /> : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <label className={labelClass}>
          Naam
          <span className="relative block">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              autoComplete="off"
              className={cn(fieldClass, "pl-9")}
              defaultValue={filters.q ?? ""}
              maxLength={MAX_QUERY_LENGTH}
              name={PARAM.q}
              placeholder="Zoek op naam"
              type="search"
            />
          </span>
        </label>

        <label className={labelClass}>
          Opdracht
          <Select className={fieldClass} defaultValue={jobId ?? ""} name="job">
            <option value="">Alle open opdrachten</option>
            {openJobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </Select>
        </label>

        <label className={labelClass}>
          Sport
          <Select className={fieldClass} defaultValue={filters.sport ?? ""} name={PARAM.sport}>
            <option value="">Alle sporten</option>
            {sports.map((sport) => (
              <option key={sport.id} value={sport.id}>
                {sport.name}
              </option>
            ))}
          </Select>
        </label>

        <label className={labelClass}>
          Sorteren
          <Select className={fieldClass} defaultValue={filters.sort} name={PARAM.sort}>
            {Object.entries(CANDIDATE_SORTS).map(([value, option]) => (
              <option key={value} value={value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <details className="group rounded-lg border border-border bg-card" open={advancedActive}>
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 [&::-webkit-details-marker]:hidden">
          <SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
          Meer filters
          <span className="text-xs font-normal text-muted-foreground group-open:hidden">
            lesvorm, beschikbaarheid, beoordeling, ervaring, afstand
          </span>
        </summary>
        <div className="grid gap-2 border-t border-border p-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className={labelClass}>
            Lesvorm
            <Select
              className={fieldClass}
              defaultValue={filters.lessonType ?? ""}
              name={PARAM.lessonType}
            >
              <option value="">Alle lesvormen</option>
              {lessonGroups.map((group) => (
                <optgroup key={group.sport.id} label={group.sport.name}>
                  {group.items.map((lessonType) => (
                    <option key={lessonType.id} value={lessonType.id}>
                      {lessonType.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </label>

          <label className={labelClass}>
            Beschikbaarheid voor de opdracht
            <Select
              aria-describedby={jobId ? undefined : "availability-hint"}
              className={fieldClass}
              defaultValue={filters.availability ?? ""}
              disabled={!jobId}
              name={PARAM.availability}
            >
              <option value="">Alle</option>
              {Object.entries(AVAILABILITY_FILTERS).map(([value, option]) => (
                <option key={value} value={value}>
                  {option.label}
                </option>
              ))}
            </Select>
            {jobId ? null : (
              <span className="block font-normal" id="availability-hint">
                Kies eerst een opdracht.
              </span>
            )}
          </label>

          <label className={labelClass}>
            Minimale beoordeling
            <Select
              className={fieldClass}
              defaultValue={filters.minRating?.toString() ?? ""}
              name={PARAM.minRating}
            >
              <option value="">Alle beoordelingen</option>
              {MIN_RATING_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {formatRating(value)}+ sterren
                </option>
              ))}
            </Select>
          </label>

          <label className={labelClass}>
            Ervaring
            <Select
              className={fieldClass}
              defaultValue={filters.minExperience?.toString() ?? ""}
              name={PARAM.minExperience}
            >
              <option value="">Alle ervaring</option>
              {MIN_EXPERIENCE_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}+ jaar
                </option>
              ))}
            </Select>
          </label>

          <label className={labelClass}>
            Maximale afstand
            <Select
              aria-describedby="distance-hint"
              className={fieldClass}
              defaultValue={filters.maxDistance?.toString() ?? ""}
              name={PARAM.maxDistance}
            >
              <option value="">Elke afstand</option>
              {MAX_DISTANCE_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  Binnen {value} km
                </option>
              ))}
            </Select>
            <span className="block font-normal" id="distance-hint">
              Alleen kandidaten met een bekende afstand.
            </span>
          </label>

          <label className={labelClass}>
            Minimale betrouwbaarheid
            <Select
              className={fieldClass}
              defaultValue={filters.minReliability?.toString() ?? ""}
              name={PARAM.minReliability}
            >
              <option value="">Alle</option>
              {MIN_RELIABILITY_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}% of hoger
                </option>
              ))}
            </Select>
          </label>

          <div className="flex flex-col justify-end gap-2 text-[13px] sm:col-span-2 lg:col-span-3 lg:flex-row lg:gap-6">
            <label className="flex items-start gap-2">
              <input
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                defaultChecked={filters.includeUnrated}
                name={PARAM.includeUnrated}
                type="checkbox"
                value="1"
              />
              <span>
                Nieuwe instructeurs zonder reviews of historie meenemen bij
                beoordeling- en betrouwbaarheidsfilters
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                defaultChecked={filters.onlyMatching}
                name={PARAM.onlyMatching}
                type="checkbox"
                value="1"
              />
              <span>Alleen passend bij een open opdracht</span>
            </label>
          </div>
        </div>
      </details>

      {filters.relation ? (
        <input name={PARAM.relation} type="hidden" value={filters.relation} />
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button className="w-full sm:w-auto" size="sm" type="submit">
          Filters toepassen
        </Button>
        <Link
          className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "w-full sm:w-auto")}
          href={resetHref}
        >
          Filters wissen
        </Link>
      </div>
    </form>
  );
}
