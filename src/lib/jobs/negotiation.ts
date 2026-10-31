import type { ApplicationStatus, JobStatus } from "@/types/database";

/** Authorization is enforced independently by the counteroffer RPCs. */
export function canNegotiateJob(
  job: { status: JobStatus; pay_is_negotiable: boolean },
  application: { status: ApplicationStatus },
  hasSelection: boolean,
) {
  return (
    job.status === "open" &&
    job.pay_is_negotiable &&
    application.status === "pending" &&
    !hasSelection
  );
}
