import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types/database";

export const metadata: Metadata = {
  title: "Gebruikers",
};

const roleLabels: Record<UserRole, string> = {
  instructor: "Instructeur",
  organization: "Organisatie",
  admin: "Admin",
};

export default async function AdminGebruikersPage({
  searchParams,
}: {
  searchParams: Promise<{ rol?: string }>;
}) {
  const supabase = await createClient();
  const { rol } = await searchParams;

  if (!supabase) {
    return null;
  }

  let query = supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (rol === "instructor" || rol === "organization" || rol === "admin") {
    query = query.eq("role", rol);
  }

  const { data } = await query;
  const profiles = (data as Profile[] | null) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Gebruikers</h1>
        <div className="flex gap-2 text-sm">
          <Link className="text-primary hover:underline" href="/admin/gebruikers">
            Alle
          </Link>
          <Link
            className="text-primary hover:underline"
            href="/admin/gebruikers?rol=instructor"
          >
            Instructeurs
          </Link>
          <Link
            className="text-primary hover:underline"
            href="/admin/gebruikers?rol=organization"
          >
            Organisaties
          </Link>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Naam</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Profiel compleet</TableHead>
              <TableHead>Geregistreerd</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((profile) => (
              <TableRow key={profile.id}>
                <TableCell className="font-medium">{profile.full_name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {profile.email}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={profile.role === "admin" ? "destructive" : "muted"}
                  >
                    {roleLabels[profile.role]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {profile.onboarding_completed ? "Ja" : "Nee"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(profile.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
