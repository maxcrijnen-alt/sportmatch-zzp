"use client";

import { startTransition, useActionState, useId, useState } from "react";
import { Check, Star } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitReviewAction, type JobActionState } from "@/lib/jobs/actions";
import {
  MAX_REVIEW_ATTRIBUTES,
  reviewAttributeOptions,
  type ReviewAttributeCode,
} from "@/lib/reviews/attributes";
import { cn } from "@/lib/utils";
import type { PartySide } from "@/types/database";

const initialState: JobActionState = { error: null, success: null };

const ratingWords = ["", "Slecht", "Matig", "Voldoende", "Goed", "Uitstekend"];

/**
 * Beoordelingsformulier na een afgeronde opdracht.
 *
 * `side` is de beoordelende partij en bepaalt welke kenmerken selecteerbaar
 * zijn. De database leidt de partij zelf af en weigert kenmerken die daar
 * niet bij horen; deze prop stuurt alleen de weergave.
 */
export function ReviewForm({
  jobId,
  revieweeId,
  side,
}: {
  jobId: string;
  revieweeId?: string;
  side: PartySide;
}) {
  const [state, formAction, isPending] = useActionState(
    submitReviewAction,
    initialState,
  );
  const [rating, setRating] = useState(0);
  const [attributes, setAttributes] = useState<ReviewAttributeCode[]>([]);
  const [comment, setComment] = useState("");
  const id = useId();
  const options = reviewAttributeOptions(side);
  const limitReached = attributes.length >= MAX_REVIEW_ATTRIBUTES;

  if (state.success) {
    return (
      <Alert variant="info">
        <AlertDescription>{state.success}</AlertDescription>
      </Alert>
    );
  }

  function toggleAttribute(code: ReviewAttributeCode) {
    setAttributes((current) => {
      if (current.includes(code)) {
        return current.filter((value) => value !== code);
      }
      if (current.length >= MAX_REVIEW_ATTRIBUTES) return current;
      return [...current, code];
    });
  }

  // Verstuur zonder `action`-prop: React reset een formulier na een
  // form action automatisch, waardoor gekozen kenmerken en de toelichting na
  // een foutmelding visueel verdwijnen terwijl de state ze nog bevat.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <input name="jobId" type="hidden" value={jobId} />
      {revieweeId ? (
        <input name="revieweeId" type="hidden" value={revieweeId} />
      ) : null}
      <input name="rating" type="hidden" value={rating} />

      {/* 1. Sterren (verplicht) */}
      <fieldset className="space-y-1.5">
        <legend className="text-[13px] font-medium text-foreground">
          Je beoordeling
        </legend>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                aria-label={`${value} sterren`}
                aria-pressed={value === rating}
                className="rounded-md p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                key={value}
                onClick={() => setRating(value)}
                type="button"
              >
                <Star
                  aria-hidden="true"
                  className={cn(
                    "h-8 w-8 transition-colors",
                    value <= rating
                      ? "fill-amber-400 text-amber-400"
                      : "fill-muted text-border-strong hover:text-amber-400",
                  )}
                />
              </button>
            ))}
          </div>
          <span
            aria-live="polite"
            className={cn(
              "text-sm",
              rating > 0 ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {rating > 0
              ? `${rating} van 5 · ${ratingWords[rating]}`
              : "Kies 1 tot 5 sterren"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Je beoordeling wordt pas zichtbaar nadat beide partijen hebben
          beoordeeld.
        </p>
      </fieldset>

      {/* 2. Kenmerken (optioneel, maximaal drie) */}
      <fieldset aria-describedby={`${id}-attributes-hint`} className="space-y-2">
        <legend className="text-[13px] font-medium text-foreground">
          Kenmerken (optioneel)
        </legend>
        <div
          className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs text-muted-foreground"
          id={`${id}-attributes-hint`}
        >
          <span>Kies maximaal drie kenmerken die goed bij deze samenwerking passen.</span>
          <span aria-live="polite" className="font-medium tabular-nums">
            {attributes.length} van {MAX_REVIEW_ATTRIBUTES} gekozen
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const selected = attributes.includes(option.code);
            const disabled = !selected && limitReached;
            return (
              <label
                className={cn(
                  "inline-flex min-h-10 select-none items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors sm:min-h-9",
                  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40",
                  selected
                    ? "border-primary bg-primary-soft text-primary-soft-foreground"
                    : "border-border bg-card text-foreground",
                  disabled
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer hover:border-border-strong",
                )}
                key={option.code}
              >
                <input
                  checked={selected}
                  className="sr-only"
                  disabled={disabled}
                  name="attributes"
                  onChange={() => toggleAttribute(option.code)}
                  type="checkbox"
                  value={option.code}
                />
                <Check
                  aria-hidden="true"
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-opacity",
                    selected ? "opacity-100" : "hidden",
                  )}
                />
                {option.label}
              </label>
            );
          })}
        </div>
        {limitReached ? (
          <p className="text-xs text-muted-foreground">
            Je hebt drie kenmerken gekozen. Klik op een gekozen kenmerk om te
            wisselen.
          </p>
        ) : null}
      </fieldset>

      {/* 3. Toelichting (optioneel) */}
      <div className="space-y-2">
        <Label htmlFor={`${id}-comment`}>Toelichting (optioneel)</Label>
        <Textarea
          id={`${id}-comment`}
          maxLength={2000}
          name="comment"
          onChange={(event) => setComment(event.target.value)}
          rows={3}
          value={comment}
        />
      </div>

      {/* 4. Probleem melden (bestaand, bij een lage score) */}
      {rating > 0 && rating <= 2 ? (
        <div className="space-y-3 rounded-xl border border-warning/30 bg-warning-soft p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input name="alsoReport" type="checkbox" />
            Ik wil dit ook melden bij SportMatch
          </label>
          <div className="space-y-2">
            <Label htmlFor={`${id}-report`}>Toelichting voor SportMatch</Label>
            <Textarea
              id={`${id}-report`}
              name="reportDetails"
              placeholder="Beschrijf wat er is gebeurd. De melding blijft los van je review."
              rows={3}
            />
          </div>
        </div>
      ) : null}

      {/* 5. Versturen */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          className="w-full sm:w-auto"
          disabled={isPending || rating === 0}
          type="submit"
        >
          {isPending ? "Versturen…" : "Beoordeling versturen"}
        </Button>
        {rating === 0 ? (
          <p className="text-xs text-muted-foreground">
            Kies eerst een sterrenbeoordeling.
          </p>
        ) : null}
      </div>
    </form>
  );
}
