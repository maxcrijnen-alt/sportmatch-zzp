/** Centrale branding-configuratie. */
export const BRAND = {
  name: "SportMatch",
  shortName: "SportMatch",
  tagline: "Vind snel een sportinstructeur. Of je volgende opdracht.",
  description:
    "SportMatch koppelt sportscholen en sportorganisaties aan sportinstructeurs voor spoed-inval, losse opdrachten, terugkerende lessen en vacatures.",
  supportEmail:
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ??
    "de contactmogelijkheid in je account",
} as const;
