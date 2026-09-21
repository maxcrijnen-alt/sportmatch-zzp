"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DEMO_SESSION_COOKIE } from "@/lib/demo/constants";
import {
  cleanupDemoSession,
  createDemoSession,
} from "@/lib/demo/factory";
import { createClient } from "@/lib/supabase/server";

const demoRoleSchema = z.enum(["organization", "instructor"]);

export async function startDemoAction(formData: FormData): Promise<void> {
  const role = demoRoleSchema.safeParse(formData.get("role"));
  if (!role.success) {
    redirect("/demo?error=role");
  }

  const cookieStore = await cookies();
  const previousSession = cookieStore.get(DEMO_SESSION_COOKIE)?.value;
  const supabase = await createClient();

  if (!supabase) {
    redirect("/demo?error=config");
  }

  if (previousSession) {
    const { data: currentProfile } = await supabase
      .rpc("get_my_profile")
      .maybeSingle();
    const demoSessionId = (
      currentProfile as { demo_session_id?: string | null } | null
    )?.demo_session_id;
    if (demoSessionId === previousSession) {
      await cleanupDemoSession(previousSession).catch(() => undefined);
    }
  }
  await supabase.auth.signOut();

  let demo: Awaited<ReturnType<typeof createDemoSession>>;
  try {
    demo = await createDemoSession(role.data);
  } catch (error) {
    console.error("Demo session creation failed", error);
    redirect("/demo?error=start");
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: demo.email,
    password: demo.password,
  });

  if (error) {
    await cleanupDemoSession(demo.sessionId).catch(() => undefined);
    redirect("/demo?error=login");
  }

  cookieStore.set(DEMO_SESSION_COOKIE, demo.sessionId, {
    httpOnly: true,
    maxAge: 8 * 60 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  redirect("/dashboard");
}
