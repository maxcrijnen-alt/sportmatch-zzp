"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export interface AdminActionState {
  error: string | null;
  success: string | null;
}

async function requireAdmin() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!profile || !supabase || profile.role !== "admin") {
    return null;
  }

  return { profile, supabase };
}

export async function reviewDocumentAction(
  documentId: string,
  approve: boolean,
  formData: FormData,
): Promise<void> {
  const context = await requireAdmin();

  if (!context) {
    return;
  }

  const note = String(formData.get("note") ?? "");
  const expiresAt = String(formData.get("expiresAt") ?? "");

  await context.supabase
    .from("document_uploads")
    .update({
      status: approve ? "approved" : "rejected",
      review_note: note,
      expires_at: expiresAt || null,
      reviewed_by: context.profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  revalidatePath("/admin/documenten");
}

const subscriptionStatusSchema = z.enum([
  "trial",
  "active",
  "past_due",
  "cancelled",
  "expired",
]);

export async function adminSetSubscriptionStatusAction(
  subscriptionId: string,
  formData: FormData,
): Promise<void> {
  const context = await requireAdmin();

  if (!context) {
    return;
  }

  const parsed = subscriptionStatusSchema.safeParse(formData.get("status"));

  if (!parsed.success) {
    return;
  }

  await context.supabase.rpc("admin_set_subscription_status", {
    p_subscription: subscriptionId,
    p_status: parsed.data,
    p_grace_days: 14,
  });

  revalidatePath("/admin/billing");
}

const feeStatusSchema = z.enum([
  "reported",
  "verified",
  "invoiced",
  "paid",
  "disputed",
]);

export async function updateConversionFeeStatusAction(
  feeId: string,
  formData: FormData,
): Promise<void> {
  const context = await requireAdmin();

  if (!context) {
    return;
  }

  const parsed = feeStatusSchema.safeParse(formData.get("status"));

  if (!parsed.success) {
    return;
  }

  await context.supabase
    .from("conversion_fees")
    .update({ status: parsed.data })
    .eq("id", feeId);

  revalidatePath("/admin/billing");
}

export async function addLookupAction(
  kind: "sport" | "qualification",
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const context = await requireAdmin();

  if (!context) {
    return { error: "Geen toegang.", success: null };
  }

  const name = String(formData.get("name") ?? "").trim();

  if (name.length < 2) {
    return { error: "Vul een naam in.", success: null };
  }

  if (kind === "sport") {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const { error } = await context.supabase
      .from("sports")
      .insert({ name, slug });
    if (error) {
      return { error: "Toevoegen is niet gelukt (bestaat al?).", success: null };
    }
  } else {
    const { error } = await context.supabase
      .from("qualifications")
      .insert({ name });
    if (error) {
      return { error: "Toevoegen is niet gelukt (bestaat al?).", success: null };
    }
  }

  revalidatePath("/admin/categorieen");
  return { error: null, success: "Toegevoegd." };
}

export async function toggleLookupAction(
  kind: "sport" | "qualification",
  id: string,
  isActive: boolean,
): Promise<void> {
  const context = await requireAdmin();

  if (!context) {
    return;
  }

  await context.supabase
    .from(kind === "sport" ? "sports" : "qualifications")
    .update({ is_active: isActive })
    .eq("id", id);

  revalidatePath("/admin/categorieen");
}

export async function refreshDocumentStatusesAction(): Promise<void> {
  const context = await requireAdmin();

  if (!context) {
    return;
  }

  await context.supabase.rpc("refresh_document_statuses");
  revalidatePath("/admin/documenten");
}

export async function adminCloseJobAction(jobId: string): Promise<void> {
  const context = await requireAdmin();

  if (!context) {
    return;
  }

  await context.supabase
    .from("jobs")
    .update({ status: "closed" })
    .eq("id", jobId);

  revalidatePath("/admin/opdrachten");
}
