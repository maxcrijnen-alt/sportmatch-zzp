"use client";

import { MapPin } from "lucide-react";
import { Select } from "@/components/ui/select";

export interface LocationOption {
  id: string;
  name: string;
}
export function LocationSelector({
  locations,
  value,
  onChange,
}: {
  locations: LocationOption[];
  value: string;
  onChange: (locationId: string) => void;
}) {
  return (
    <label className="relative flex min-w-0 items-center text-sm">
      <MapPin className="pointer-events-none absolute left-2.5 h-4 w-4 text-primary" />
      <span className="sr-only">Vestiging</span>
      <Select
        aria-label="Vestiging filteren"
        className="h-9 w-auto min-w-0 max-w-44 rounded-lg bg-subtle pl-8 font-medium sm:min-w-40 sm:max-w-56"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">Alle vestigingen</option>
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
      </Select>
    </label>
  );
}
