import type { Metadata } from "next";
import { RoleIcon } from "@/components/brand/role-icon";
import { DemoStartButton } from "@/components/demo/demo-start-button";
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
    <div className="mx-auto w-full max-w-4xl px-4 py-14 sm:py-20">
      <h1 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
        Bekijk de demo
      </h1>

      {error && errorMessages[error] ? (
        <p
          className="mx-auto mt-6 max-w-2xl rounded-lg border border-destructive/20 bg-destructive-soft p-3 text-center text-sm text-destructive"
          role="alert"
        >
          {errorMessages[error]}
        </p>
      ) : null}

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {demos.map((demo) => (
          <section
            className="group flex flex-col items-center rounded-2xl border border-border bg-card p-8 text-center shadow-card transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-raised"
            key={demo.role}
          >
            <RoleIcon
              className="h-20 w-20 rounded-2xl"
              iconClassName="h-11 w-11"
              role={demo.role}
            />
            <h2 className="mt-5 text-lg font-semibold tracking-tight">
              {demo.title}
            </h2>
            <form action={startDemoAction} className="mt-6 w-full">
              <input name="role" type="hidden" value={demo.role} />
              <DemoStartButton label={`Start ${demo.title.toLowerCase()}`} />
            </form>
          </section>
        ))}
      </div>
    </div>
  );
}
