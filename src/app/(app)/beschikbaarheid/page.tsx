import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  AddExceptionForm,
  AddRuleForm,
  WEEKDAYS,
} from "@/components/availability/availability-forms";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth/session";
import {
  deleteAvailabilityExceptionAction,
  deleteAvailabilityRuleAction,
} from "@/lib/availability/actions";
import { formatDate, formatTime } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Beschikbaarheid",
};

interface Rule {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
}

interface Exception {
  id: string;
  on_date: string;
  note: string;
}

export default async function BeschikbaarheidPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase) {
    redirect("/login");
  }

  const [rulesResult, exceptionsResult] = await Promise.all([
    supabase
      .from("availability_rules")
      .select("id, weekday, start_time, end_time")
      .eq("user_id", profile.id)
      .order("weekday")
      .order("start_time"),
    supabase
      .from("availability_exceptions")
      .select("id, on_date, note")
      .eq("user_id", profile.id)
      .gte("on_date", new Date().toISOString().slice(0, 10))
      .order("on_date"),
  ]);

  const rules = (rulesResult.data as Rule[] | null) ?? [];
  const exceptions = (exceptionsResult.data as Exception[] | null) ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Beschikbaarheid</h1>
        <p className="text-sm text-muted-foreground">
          Geef aan wanneer je standaard beschikbaar bent en blokkeer losse
          datums.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Wekelijkse beschikbaarheid</CardTitle>
          <CardDescription>
            Organisaties zien deze tijden bij je profiel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nog geen beschikbaarheid ingesteld.
            </p>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <div
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                  key={rule.id}
                >
                  <span>
                    <span className="font-medium">{WEEKDAYS[rule.weekday]}</span>{" "}
                    {formatTime(rule.start_time)}–{formatTime(rule.end_time)}
                  </span>
                  <form action={deleteAvailabilityRuleAction.bind(null, rule.id)}>
                    <Button
                      aria-label="Verwijderen"
                      size="icon"
                      type="submit"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          )}
          <AddRuleForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uitzonderingen</CardTitle>
          <CardDescription>
            Datums waarop je niet beschikbaar bent (vakantie, afspraken).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {exceptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Geen geblokkeerde datums.
            </p>
          ) : (
            <div className="space-y-2">
              {exceptions.map((exception) => (
                <div
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                  key={exception.id}
                >
                  <span>
                    <span className="font-medium">
                      {formatDate(exception.on_date)}
                    </span>
                    {exception.note ? (
                      <span className="text-muted-foreground">
                        {" "}
                        — {exception.note}
                      </span>
                    ) : null}
                  </span>
                  <form
                    action={deleteAvailabilityExceptionAction.bind(
                      null,
                      exception.id,
                    )}
                  >
                    <Button
                      aria-label="Verwijderen"
                      size="icon"
                      type="submit"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          )}
          <AddExceptionForm />
        </CardContent>
      </Card>
    </div>
  );
}
