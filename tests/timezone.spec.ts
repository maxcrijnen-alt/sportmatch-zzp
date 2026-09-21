import { expect, test } from "@playwright/test";
import {
  amsterdamDateTimeToInstant,
  dateInAmsterdam,
} from "@/lib/datetime/amsterdam";

test("Nederlandse lestijd gebruikt CET in de winter", () => {
  expect(amsterdamDateTimeToInstant("2026-01-15", "19:00")?.toISOString()).toBe(
    "2026-01-15T18:00:00.000Z",
  );
});

test("Nederlandse lestijd gebruikt CEST in de zomer", () => {
  expect(amsterdamDateTimeToInstant("2026-07-15", "19:00")?.toISOString()).toBe(
    "2026-07-15T17:00:00.000Z",
  );
});

test("niet-bestaande lokale tijd tijdens zomertijdsprong wordt geweigerd", () => {
  expect(amsterdamDateTimeToInstant("2026-03-29", "02:30")).toBeNull();
});

test("Nederlandse kalenderdatum volgt niet impliciet UTC", () => {
  expect(dateInAmsterdam(new Date("2026-07-14T22:30:00.000Z"))).toBe(
    "2026-07-15",
  );
});

