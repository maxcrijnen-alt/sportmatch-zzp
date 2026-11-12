import "server-only";
import { syntheticLessons, type LessonSourceProvider } from "./lesson-contract";

export const syntheticLessonProvider: LessonSourceProvider = {
  id: "synthetic",
  async loadLessons(anchorDate, sportId) {
    return syntheticLessons(anchorDate, sportId);
  },
};

/** Capability registry, not fabricated API adapters. Live connectors stay absent
 * until credentials, contracts and tenant/occurrence mapping are verified. */
export const externalRosterProviders = [
  {
    id: "logifit",
    name: "LogiFit",
    status: "API-toegang genoemd; technisch roostercontract nodig",
  },
  {
    id: "gymly",
    name: "Gymly",
    status: "Developer API beschikbaar na activatie; roostercontract nodig",
  },
  {
    id: "sportbit",
    name: "SportBit Manager",
    status: "Roosterfunctie bevestigd; API-contract nodig",
  },
] as const;
