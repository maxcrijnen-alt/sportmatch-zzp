import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Nieuw wachtwoord instellen",
};

export default async function WachtwoordHerstellenPage() {
  const profile = await getSessionProfile();

  if (!profile) {
    redirect("/wachtwoord-vergeten");
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Nieuw wachtwoord instellen</CardTitle>
          <CardDescription>
            Kies een nieuw wachtwoord voor {profile.email}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
