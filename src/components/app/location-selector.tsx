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
    <label className="flex min-w-0 items-center gap-2 text-sm">
      <MapPin className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
      <span className="sr-only">Vestiging</span>
      <Select
        aria-label="Vestiging filteren"
        className="h-9 max-w-48 min-w-32"
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
