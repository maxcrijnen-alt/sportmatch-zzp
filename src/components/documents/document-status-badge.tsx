import { Badge } from "@/components/ui/badge";
import { documentStatusLabels } from "@/lib/labels";
import type { DocumentStatus } from "@/types/database";

const variantByStatus: Record<
  DocumentStatus,
  "muted" | "secondary" | "success" | "destructive" | "warning"
> = {
  not_submitted: "muted",
  pending: "secondary",
  approved: "success",
  rejected: "destructive",
  expired: "warning",
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <Badge variant={variantByStatus[status]}>
      {documentStatusLabels[status]}
    </Badge>
  );
}
