import type { Subscription } from "@/types/database";

/** Bepaalt of een abonnement op dit moment toegang geeft (trial/actief/hersteltermijn). */
export function subscriptionGrantsAccess(
  subscription: Subscription | null | undefined,
): boolean {
  if (!subscription) {
    return false;
  }

  const now = Date.now();

  switch (subscription.status) {
    case "trial":
      return new Date(subscription.trial_ends_at).getTime() > now;
    case "active":
      return true;
    case "past_due":
      return subscription.grace_until
        ? new Date(subscription.grace_until).getTime() > now
        : false;
    default:
      return false;
  }
}

export function subscriptionStatusDescription(
  subscription: Subscription | null | undefined,
): string {
  if (!subscription) {
    return "Geen abonnement gevonden.";
  }

  switch (subscription.status) {
    case "trial": {
      const daysLeft = Math.max(
        0,
        Math.ceil(
          (new Date(subscription.trial_ends_at).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        ),
      );
      return daysLeft > 0
        ? `Proefperiode — nog ${daysLeft} ${daysLeft === 1 ? "dag" : "dagen"} gratis.`
        : "Proefperiode verlopen. Activeer je abonnement om verder te gaan.";
    }
    case "active":
      return "Abonnement actief.";
    case "past_due":
      return subscription.grace_until &&
        new Date(subscription.grace_until).getTime() > Date.now()
        ? "Betaling mislukt — je hebt nog een hersteltermijn van maximaal 14 dagen."
        : "Betaling mislukt en hersteltermijn verlopen.";
    case "cancelled":
      return "Abonnement opgezegd. Bestaande afspraken blijven zichtbaar.";
    default:
      return "Abonnement verlopen.";
  }
}
