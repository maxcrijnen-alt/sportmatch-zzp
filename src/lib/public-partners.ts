export interface PublicSportschoolPartner {
  name: string;
  logo: string;
  site: string;
  active: boolean;
  sort_order: number;
}

function isPartner(value: unknown): value is PublicSportschoolPartner {
  if (!value || typeof value !== "object") return false;

  const partner = value as Record<string, unknown>;

  return (
    typeof partner.name === "string" &&
    partner.name.trim().length > 0 &&
    typeof partner.logo === "string" &&
    partner.logo.startsWith("/") &&
    typeof partner.site === "string" &&
    /^https:\/\//.test(partner.site) &&
    typeof partner.active === "boolean" &&
    typeof partner.sort_order === "number" &&
    Number.isFinite(partner.sort_order)
  );
}

/**
 * Publieke partnerlijst uit configuratie, zodat alleen expliciet goedgekeurde
 * partners zichtbaar worden. Logo's staan als lokaal pad in `public/`; demo-
 * organisaties uit de database worden hierdoor nooit per ongeluk getoond.
 */
export function getPublicSportschoolPartners(): PublicSportschoolPartner[] {
  const configuredPartners = process.env.PUBLIC_SPORTSCHOOL_PARTNERS_JSON;

  if (!configuredPartners) return [];

  try {
    const parsed: unknown = JSON.parse(configuredPartners);

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(isPartner)
      .filter((partner) => partner.active)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  } catch {
    console.warn(
      "PUBLIC_SPORTSCHOOL_PARTNERS_JSON bevat geen geldige partnerconfiguratie.",
    );
    return [];
  }
}
