import "server-only";

import { cookies } from "next/headers";
import { LOCATION_FILTER_COOKIE } from "@/lib/org/location-filter-constants";
import type { OrganizationLocation } from "@/types/database";

export async function resolveLocationFilter(
  locations: OrganizationLocation[],
  requestedLocation?: string,
): Promise<string | null> {
  const validIds = new Set(locations.map((location) => location.id));

  if (requestedLocation && validIds.has(requestedLocation)) {
    return requestedLocation;
  }

  const cookieStore = await cookies();
  const storedLocation = cookieStore.get(LOCATION_FILTER_COOKIE)?.value;

  return storedLocation && validIds.has(storedLocation) ? storedLocation : null;
}
