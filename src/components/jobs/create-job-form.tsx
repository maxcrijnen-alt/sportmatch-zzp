"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { jobTypeLabels } from "@/lib/labels";
import { createJobAction, type JobActionState } from "@/lib/jobs/actions";
import type {
  JobType,
  LessonType,
  OrganizationLocation,
  Qualification,
  Sport,
} from "@/types/database";

const initialState: JobActionState = { error: null, success: null };
const PREVIOUS_JOB_KEY = "sportmatch_previous_job_choices";

export interface JobFormDefaults {
  jobType?: JobType;
  sportId?: string;
  lessonTypeId?: string;
  customLessonType?: string;
  locationId?: string;
  title?: string;
  description?: string;
  startsOn?: string;
  startTime?: string;
  endTime?: string;
  recurrenceNote?: string;
  payType?: "fixed" | "hourly";
  payAmountEuro?: number;
  payHourlyRateEuro?: number;
  payIsNegotiable?: boolean;
  requiredLevel?: string;
  expectedParticipants?: number;
  qualificationIds?: string[];
  intervalWeeks?: number;
  occurrenceCount?: number;
  endsOn?: string;
  partialBlockAllowed?: boolean;
  segments?: Array<{
    startTime: string;
    endTime: string;
    lessonTypeId: string;
    customLessonType?: string;
    level?: string;
  }>;
}

interface SegmentDraft {
  key: string;
  startTime: string;
  endTime: string;
  lessonTypeId: string;
  customLessonType: string;
  level: string;
}

function createSegment(index: number): SegmentDraft {
  const startHour = 18 + index;
  return {
    key: `${Date.now()}-${index}`,
    startTime: `${String(startHour).padStart(2, "0")}:00`,
    endTime: `${String(startHour + 1).padStart(2, "0")}:00`,
    lessonTypeId: "",
    customLessonType: "",
    level: "",
  };
}

export function CreateJobForm({
  locations,
  sports,
  lessonTypes,
  qualifications,
  defaultContactName,
  defaults = {},
}: {
  locations: OrganizationLocation[];
  sports: Sport[];
  lessonTypes: LessonType[];
  qualifications: Qualification[];
  defaultContactName: string;
  defaults?: JobFormDefaults;
}) {
  const [state, formAction, isPending] = useActionState(
    createJobAction,
    initialState,
  );
  const [jobType, setJobType] = useState<JobType>(defaults.jobType ?? "one_time");
  const [sportId, setSportId] = useState(defaults.sportId ?? "");
  const [lessonTypeId, setLessonTypeId] = useState(defaults.lessonTypeId ?? "");
  const [customLessonType, setCustomLessonType] = useState(
    defaults.customLessonType ?? "",
  );
  const [locationId, setLocationId] = useState(defaults.locationId ?? "");
  const [payType, setPayType] = useState<"fixed" | "hourly">(
    defaults.payType ?? "hourly",
  );
  const [payAmount, setPayAmount] = useState(
    defaults.payAmountEuro?.toString() ?? "",
  );
  const [hourlyRate, setHourlyRate] = useState(
    defaults.payHourlyRateEuro?.toString() ?? "",
  );
  const [requiredLevel, setRequiredLevel] = useState(
    defaults.requiredLevel ?? "",
  );
  const [qualificationIds, setQualificationIds] = useState<string[]>(
    defaults.qualificationIds ?? [],
  );
  const [qualificationSearch, setQualificationSearch] = useState("");
  const [isBlock, setIsBlock] = useState(Boolean(defaults.segments?.length));
  const [segments, setSegments] = useState<SegmentDraft[]>(() =>
    defaults.segments?.length
      ? defaults.segments.map((segment, index) => ({
          key: `default-${index}`,
          startTime: segment.startTime,
          endTime: segment.endTime,
          lessonTypeId: segment.lessonTypeId,
          customLessonType: segment.customLessonType ?? "",
          level: segment.level ?? "",
        }))
      : [createSegment(0), createSegment(1)],
  );

  const hasExplicitDefaults = Object.keys(defaults).length > 0;

  useEffect(() => {
    if (hasExplicitDefaults) return;
    let timer: number | undefined;
    try {
      const stored = JSON.parse(
        window.localStorage.getItem(PREVIOUS_JOB_KEY) ?? "null",
      ) as JobFormDefaults | null;
      if (!stored) return;
      timer = window.setTimeout(() => {
        setSportId(stored.sportId ?? "");
        setLessonTypeId(stored.lessonTypeId ?? "");
        setCustomLessonType(stored.customLessonType ?? "");
        setLocationId(stored.locationId ?? "");
        setPayType(stored.payType ?? "hourly");
        setPayAmount(stored.payAmountEuro?.toString() ?? "");
        setHourlyRate(stored.payHourlyRateEuro?.toString() ?? "");
        setRequiredLevel(stored.requiredLevel ?? "");
        setQualificationIds(stored.qualificationIds ?? []);
      }, 0);
    } catch {
      window.localStorage.removeItem(PREVIOUS_JOB_KEY);
    }
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [hasExplicitDefaults]);

  const sportLessonTypes = useMemo(
    () => lessonTypes.filter((lessonType) => lessonType.sport_id === sportId),
    [lessonTypes, sportId],
  );
  const filteredQualifications = qualifications.filter((qualification) =>
    `${qualification.name} ${qualification.description ?? ""}`
      .toLocaleLowerCase("nl")
      .includes(qualificationSearch.toLocaleLowerCase("nl")),
  );
  const selectedQualifications = qualifications.filter((qualification) =>
    qualificationIds.includes(qualification.id),
  );

  const rememberChoices = () => {
    window.localStorage.setItem(
      PREVIOUS_JOB_KEY,
      JSON.stringify({
        sportId,
        lessonTypeId,
        customLessonType,
        locationId,
        payType,
        payAmountEuro: payAmount ? Number(payAmount) : undefined,
        payHourlyRateEuro: hourlyRate ? Number(hourlyRate) : undefined,
        requiredLevel,
        qualificationIds,
      } satisfies JobFormDefaults),
    );
  };

  const updateSegment = (key: string, patch: Partial<SegmentDraft>) => {
    setSegments((current) =>
      current.map((segment) =>
        segment.key === key ? { ...segment, ...patch } : segment,
      ),
    );
  };

  return (
    <form action={formAction} className="space-y-6" onSubmit={rememberChoices}>
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="jobType">Soort plaatsing</Label>
          <Select
            id="jobType"
            name="jobType"
            onChange={(event) => setJobType(event.target.value as JobType)}
            value={jobType}
          >
            {(Object.entries(jobTypeLabels) as [JobType, string][]).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="locationId">Vestiging</Label>
          <Select
            id="locationId"
            name="locationId"
            onChange={(event) => setLocationId(event.target.value)}
            required
            value={locationId}
          >
            <option disabled value="">Kies een vestiging</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>{location.name}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sportId">Sport</Label>
          <Select
            id="sportId"
            name="sportId"
            onChange={(event) => {
              setSportId(event.target.value);
              setLessonTypeId("");
              setCustomLessonType("");
              setSegments((current) =>
                current.map((segment) => ({
                  ...segment,
                  lessonTypeId: "",
                  customLessonType: "",
                })),
              );
            }}
            required
            value={sportId}
          >
            <option disabled value="">Kies een sport</option>
            {sports.map((sport) => (
              <option key={sport.id} value={sport.id}>{sport.name}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lessonTypeId">Soort les</Label>
          <Select
            disabled={!sportId}
            id="lessonTypeId"
            name="lessonTypeId"
            onChange={(event) => setLessonTypeId(event.target.value)}
            required
            value={lessonTypeId}
          >
            <option disabled value="">Kies een lesvorm</option>
            {sportLessonTypes.map((lessonType) => (
              <option key={lessonType.id} value={lessonType.id}>{lessonType.name}</option>
            ))}
            <option value="custom">Anders, namelijk…</option>
          </Select>
        </div>
        {lessonTypeId === "custom" ? (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="customLessonType">Eigen lesvorm</Label>
            <Input
              id="customLessonType"
              name="customLessonType"
              onChange={(event) => setCustomLessonType(event.target.value)}
              required
              value={customLessonType}
            />
          </div>
        ) : null}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="contactName">Contactpersoon</Label>
          <Input defaultValue={defaultContactName} id="contactName" name="contactName" required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Titel</Label>
        <Input defaultValue={defaults.title} id="title" name="title" placeholder="Bijv. Inval spinning dinsdagavond" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Beschrijving</Label>
        <Textarea defaultValue={defaults.description} id="description" name="description" required rows={4} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="startsOn">{jobType === "recurring" ? "Eerste datum" : "Datum"}</Label>
          <Input defaultValue={defaults.startsOn} id="startsOn" name="startsOn" required type="date" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="startTime">Begintijd</Label>
          <Input defaultValue={defaults.startTime} id="startTime" name="startTime" required type="time" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endTime">Eindtijd</Label>
          <Input defaultValue={defaults.endTime} id="endTime" name="endTime" required type="time" />
        </div>
      </div>

      {jobType === "recurring" ? (
        <div className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-3">
          <div className="space-y-2 sm:col-span-3">
            <Label htmlFor="recurrenceNote">Omschrijving herhaling</Label>
            <Input defaultValue={defaults.recurrenceNote} id="recurrenceNote" name="recurrenceNote" placeholder="Bijv. iedere dinsdagavond" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="intervalWeeks">Iedere … week/weken</Label>
            <Input defaultValue={defaults.intervalWeeks ?? 1} id="intervalWeeks" max={52} min={1} name="intervalWeeks" type="number" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="occurrenceCount">Aantal lessen</Label>
            <Input defaultValue={defaults.occurrenceCount ?? 8} id="occurrenceCount" max={104} min={2} name="occurrenceCount" type="number" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endsOn">Of einddatum</Label>
            <Input defaultValue={defaults.endsOn} id="endsOn" name="endsOn" type="date" />
          </div>
        </div>
      ) : null}

      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="payType">Vergoeding</Label>
            <Select id="payType" name="payType" onChange={(event) => setPayType(event.target.value as "fixed" | "hourly")} value={payType}>
              <option value="hourly">Uurtarief</option>
              <option value="fixed">Vast totaalbedrag</option>
            </Select>
          </div>
          {payType === "fixed" ? (
            <div className="space-y-2">
              <Label htmlFor="payAmountEuro">Totaalbedrag (€)</Label>
              <Input id="payAmountEuro" min={1} name="payAmountEuro" onChange={(event) => setPayAmount(event.target.value)} required step="0.50" type="number" value={payAmount} />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="payHourlyRateEuro">Uurtarief (€)</Label>
              <Input id="payHourlyRateEuro" min={1} name="payHourlyRateEuro" onChange={(event) => setHourlyRate(event.target.value)} required step="0.50" type="number" value={hourlyRate} />
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input defaultChecked={defaults.payIsNegotiable} name="payIsNegotiable" type="checkbox" />
          Vergoeding is onderhandelbaar
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="requiredLevel">Gevraagd niveau (optioneel)</Label>
          <Input id="requiredLevel" name="requiredLevel" onChange={(event) => setRequiredLevel(event.target.value)} value={requiredLevel} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expectedParticipants">Verwacht aantal deelnemers</Label>
          <Input defaultValue={defaults.expectedParticipants} id="expectedParticipants" min={0} name="expectedParticipants" type="number" />
        </div>
      </div>

      <div className="space-y-3">
        <Label htmlFor="qualificationSearch">Benodigde diploma&apos;s (optioneel)</Label>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input id="qualificationSearch" onChange={(event) => setQualificationSearch(event.target.value)} placeholder="Zoek een diploma of certificaat…" value={qualificationSearch} />
        </div>
        {selectedQualifications.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedQualifications.map((qualification) => (
              <Badge key={qualification.id} variant="accent">
                {qualification.name}
                <button aria-label={`${qualification.name} verwijderen`} onClick={() => setQualificationIds((current) => current.filter((id) => id !== qualification.id))} type="button">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : null}
        <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-border p-2">
          {filteredQualifications.map((qualification) => (
            <label className="flex cursor-pointer items-center gap-2 rounded p-2 text-sm hover:bg-muted" key={qualification.id}>
              <input
                checked={qualificationIds.includes(qualification.id)}
                name="qualificationIds"
                onChange={(event) => setQualificationIds((current) => event.target.checked ? [...current, qualification.id] : current.filter((id) => id !== qualification.id))}
                type="checkbox"
                value={qualification.id}
              />
              {qualification.name}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-border p-4">
        <label className="flex items-center gap-2 font-medium">
          <input checked={isBlock} onChange={(event) => setIsBlock(event.target.checked)} type="checkbox" />
          Meerdere aansluitende lessen plaatsen
        </label>
        {isBlock ? (
          <>
            <p className="text-xs text-muted-foreground">
              Bij een lessenblok bepalen de eerste en laatste les automatisch de
              begin- en eindtijd van de volledige dienst.
            </p>
            <input
              name="segmentsJson"
              type="hidden"
              value={JSON.stringify(
                segments.map((segment, index) => ({
                  startTime: segment.startTime,
                  endTime: segment.endTime,
                  lessonTypeId:
                    segment.lessonTypeId === "custom"
                      ? null
                      : segment.lessonTypeId,
                  customLessonType: segment.customLessonType,
                  level: segment.level,
                  position: index + 1,
                })),
              )}
            />
            <label className="flex items-center gap-2 text-sm">
              <input defaultChecked={defaults.partialBlockAllowed} name="partialBlockAllowed" type="checkbox" />
              Gedeeltelijk overnemen toegestaan (alleen aansluitende lessen)
            </label>
            <div className="space-y-3">
              {segments.map((segment, index) => (
                <div className="grid gap-3 rounded-md bg-muted/40 p-3 sm:grid-cols-[auto_1fr_1fr_2fr_auto]" key={segment.key}>
                  <span className="pt-2 text-sm font-semibold">{index + 1}</span>
                  <Input aria-label={`Begintijd les ${index + 1}`} onChange={(event) => updateSegment(segment.key, { startTime: event.target.value })} required type="time" value={segment.startTime} />
                  <Input aria-label={`Eindtijd les ${index + 1}`} onChange={(event) => updateSegment(segment.key, { endTime: event.target.value })} required type="time" value={segment.endTime} />
                  <div className="space-y-2">
                    <Select
                      aria-label={`Lesvorm les ${index + 1}`}
                      onChange={(event) =>
                        updateSegment(segment.key, {
                          lessonTypeId: event.target.value,
                          customLessonType:
                            event.target.value === "custom"
                              ? segment.customLessonType
                              : "",
                        })
                      }
                      required
                      value={segment.lessonTypeId}
                    >
                      <option disabled value="">Kies lesvorm</option>
                      {sportLessonTypes.map((lessonType) => <option key={lessonType.id} value={lessonType.id}>{lessonType.name}</option>)}
                      <option value="custom">Anders, namelijk…</option>
                    </Select>
                    {segment.lessonTypeId === "custom" ? (
                      <Input
                        aria-label={`Eigen lesvorm les ${index + 1}`}
                        maxLength={100}
                        onChange={(event) =>
                          updateSegment(segment.key, {
                            customLessonType: event.target.value,
                          })
                        }
                        placeholder="Vul de lesvorm in"
                        required
                        value={segment.customLessonType}
                      />
                    ) : null}
                  </div>
                  <Button aria-label={`Les ${index + 1} verwijderen`} disabled={segments.length <= 2} onClick={() => setSegments((current) => current.filter((item) => item.key !== segment.key))} size="icon" type="button" variant="ghost">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button onClick={() => setSegments((current) => [...current, createSegment(current.length)])} type="button" variant="outline">
              <Plus className="h-4 w-4" /> Les toevoegen
            </Button>
          </>
        ) : null}
      </div>

      <div className="rounded-lg border border-border p-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input name="saveAsTemplate" type="checkbox" />
          Deze keuzes ook als sjabloon opslaan
        </label>
        <Input className="mt-3" name="templateName" placeholder="Naam van het sjabloon (optioneel)" />
      </div>

      {jobType === "permanent" ? (
        <Alert>
          <AlertDescription>
            Voor vaste vacatures faciliteert SportMatch de sollicitatie en chat.
            De arbeidsovereenkomst sluit je rechtstreeks met de kandidaat.
          </AlertDescription>
        </Alert>
      ) : null}

      <Button disabled={isPending} size="lg" type="submit">
        {isPending ? "Plaatsen…" : "Opdracht plaatsen"}
      </Button>
    </form>
  );
}
