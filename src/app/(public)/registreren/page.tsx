import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Registreren",
};

export default async function RegistrerenPage({
  searchParams,
}: {
  searchParams: Promise<{ rol?: string }>;
}) {
  const profile = await getSessionProfile();

  if (profile) {
    redirect("/dashboard");
  }

  const { rol } = await searchParams;
  const defaultRole = rol === "organisatie" ? "organization" : "instructor";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Gratis account aanmaken</CardTitle>
          <CardDescription>
            Kies wat bij je past — je kunt je profiel daarna verder invullen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterForm defaultRole={defaultRole} />
          <p className="mt-4 text-sm text-muted-foreground">
            Al een account?{" "}
            <Link className="font-medium text-primary hover:underline" href="/login">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
