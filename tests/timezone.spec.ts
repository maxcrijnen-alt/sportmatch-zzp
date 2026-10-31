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

for (const [instant, expected] of [
  ["2026-01-14T22:59:59Z", "2026-01-14"],
  ["2026-01-14T23:00:00Z", "2026-01-15"],
  ["2026-07-14T21:59:59Z", "2026-07-14"],
  ["2026-07-14T22:00:00Z", "2026-07-15"],
  ["2026-01-31T23:30:00Z", "2026-02-01"],
  ["2026-12-31T23:30:00Z", "2027-01-01"],
  ["2026-03-29T01:00:00Z", "2026-03-29"],
  ["2026-10-25T01:00:00Z", "2026-10-25"],
] as const) {
  test(`Amsterdamse kalenderdatum bij ${instant}`, () => {
    expect(dateInAmsterdam(new Date(instant))).toBe(expected);
  });
}

test("dubbele wintertijd kiest de eerste geldige instantie", () => {
  expect(amsterdamDateTimeToInstant("2026-10-25", "02:30")?.toISOString()).toBe(
    "2026-10-25T00:30:00.000Z",
  );
});
