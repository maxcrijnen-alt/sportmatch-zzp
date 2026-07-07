import type { Metadata } from "next";
import { AddLookupForm } from "@/components/admin/add-lookup-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toggleLookupAction } from "@/lib/admin/actions";
import { createClient } from "@/lib/supabase/server";
import type { Qualification, Sport } from "@/types/database";

export const metadata: Metadata = {
  title: "Categorieën",
};

function LookupList({
  items,
  kind,
}: {
  items: { id: string; name: string; is_active: boolean }[];
  kind: "sport" | "qualification";
}) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
          key={item.id}
        >
          <span className="flex items-center gap-2">
            {item.name}
            {!item.is_active ? <Badge variant="muted">Inactief</Badge> : null}
          </span>
          <form
            action={toggleLookupAction.bind(null, kind, item.id, !item.is_active)}
          >
            <Button size="sm" type="submit" variant="ghost">
              {item.is_active ? "Deactiveren" : "Activeren"}
            </Button>
          </form>
        </div>
      ))}
    </div>
  );
}

export default async function AdminCategorieenPage() {
  const supabase = await createClient();

  if (!supabase) {
    return null;
  }

  const [sportsResult, qualificationsResult] = await Promise.all([
    supabase.from("sports").select("*").order("name"),
    supabase.from("qualifications").select("*").order("name"),
  ]);

  const sports = (sportsResult.data as Sport[] | null) ?? [];
  const qualifications =
    (qualificationsResult.data as Qualification[] | null) ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Categorieën</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sporten en lestypen</CardTitle>
            <CardDescription>
              Gebruikt voor specialisaties en opdrachten.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AddLookupForm kind="sport" />
            <LookupList items={sports} kind="sport" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Diploma&apos;s en certificaten</CardTitle>
            <CardDescription>
              Gebruikt voor diploma-eisen en documentcontrole.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AddLookupForm kind="qualification" />
            <LookupList items={qualifications} kind="qualification" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
