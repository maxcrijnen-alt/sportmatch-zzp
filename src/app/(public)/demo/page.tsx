import type { Metadata } from "next";
import { RoleIcon } from "@/components/brand/role-icon";
import { DemoStartButton } from "@/components/demo/demo-start-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { startDemoAction } from "@/lib/demo/actions";

export const metadata: Metadata = {
  title: "Demo bekijken",
  description: "Bekijk SportMatch als sportschool of instructeur.",
};

const demos = [
  {
    role: "organization",
    title: "Demo als sportschool",
  },
  {
    role: "instructor",
    title: "Demo als instructeur",
  },
] as const;

const errorMessages: Record<string, string> = {
  config: "De demo is tijdelijk niet geconfigureerd. Probeer het later opnieuw.",
  login: "De tijdelijke demosessie kon niet worden geopend. Probeer opnieuw.",
  role: "Kies een geldige demo.",
  start: "De demo kon nu niet worden gestart. Probeer het over een moment opnieuw.",
};

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:py-16">
      <h1 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
        Bekijk de demo
      </h1>

      {error && errorMessages[error] ? (
        <p
          className="mx-auto mt-6 max-w-2xl rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-center text-sm text-destructive"
          role="alert"
        >
          {errorMessages[error]}
        </p>
      ) : null}

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {demos.map((demo) => {
          return (
            <Card className="h-full" key={demo.role}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <RoleIcon role={demo.role} />
                  <CardTitle>{demo.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <form action={startDemoAction}>
                  <input name="role" type="hidden" value={demo.role} />
                  <DemoStartButton label={`Start ${demo.title.toLowerCase()}`} />
                </form>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
