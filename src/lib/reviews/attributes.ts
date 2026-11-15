import type { PartySide } from "@/types/database";

/**
 * Vaste beoordelingskenmerken per beoordelende partij.
 *
 * De `code` is een stabiele interne identifier die in de database wordt
 * opgeslagen; het label is uitsluitend presentatie en mag dus wijzigen.
 * Houd de codes gelijk aan de `reviews_attributes_valid`-constraint en de
 * `submit_review`-RPC in
 * `supabase/migrations/20261115013000_review_attributes.sql`.
 *
 * `side` is de partij die beoordeelt:
 *   - "organization": een sportschool beoordeelt een instructeur
 *   - "instructor":   een instructeur beoordeelt een sportschool
 */
export const REVIEW_ATTRIBUTES = {
  organization: [
    { code: "keeps_agreements", label: "Komt afspraken na" },
    { code: "communicates_clearly", label: "Communiceert duidelijk" },
    { code: "quality_lessons", label: "Geeft kwalitatief goede lessen" },
    { code: "professional", label: "Is professioneel" },
    { code: "flexible", label: "Is flexibel inzetbaar" },
  ],
  instructor: [
    { code: "clear_communication", label: "Duidelijke communicatie" },
    { code: "well_organized", label: "Goede organisatie" },
    { code: "agreements_kept", label: "Afspraken nagekomen" },
    { code: "pleasant_collaboration", label: "Prettige samenwerking" },
    { code: "good_facilities", label: "Goede faciliteiten" },
  ],
} as const satisfies Record<
  PartySide,
  readonly { code: string; label: string }[]
>;

export const MAX_REVIEW_ATTRIBUTES = 3;

export type ReviewAttributeCode =
  (typeof REVIEW_ATTRIBUTES)[PartySide][number]["code"];

export interface ReviewAttributeOption {
  code: ReviewAttributeCode;
  label: string;
}

const labelByCode = new Map<string, string>(
  Object.values(REVIEW_ATTRIBUTES).flatMap((options) =>
    options.map((option) => [option.code, option.label] as const),
  ),
);

export const ALL_REVIEW_ATTRIBUTE_CODES = Array.from(
  labelByCode.keys(),
) as ReviewAttributeCode[];

export function reviewAttributeOptions(
  side: PartySide,
): readonly ReviewAttributeOption[] {
  return REVIEW_ATTRIBUTES[side];
}

/**
 * Zet opgeslagen codes om naar labels voor weergave. Onbekende codes (bijv.
 * van een nieuwere versie) en ontbrekende waarden (bestaande reviews, of een
 * database zonder de nieuwe kolom) worden genegeerd.
 */
export function reviewAttributeLabels(
  codes: readonly string[] | null | undefined,
): { code: string; label: string }[] {
  if (!Array.isArray(codes)) return [];
  return codes.flatMap((code) => {
    const label = labelByCode.get(code);
    return label ? [{ code, label }] : [];
  });
}
