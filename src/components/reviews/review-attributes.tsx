import { Badge } from "@/components/ui/badge";
import { reviewAttributeLabels } from "@/lib/reviews/attributes";
import { cn } from "@/lib/utils";

/** Compacte labels voor de gekozen beoordelingskenmerken van een review. */
function ReviewAttributeList({
  attributes,
  className,
}: {
  attributes?: readonly string[] | null;
  className?: string;
}) {
  const labels = reviewAttributeLabels(attributes);
  if (labels.length === 0) return null;

  return (
    <ul aria-label="Kenmerken" className={cn("flex flex-wrap gap-1", className)}>
      {labels.map((item) => (
        <li key={item.code}>
          <Badge variant="default">{item.label}</Badge>
        </li>
      ))}
    </ul>
  );
}

export { ReviewAttributeList };
