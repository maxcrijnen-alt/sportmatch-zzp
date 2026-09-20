import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/branding";

/**
 * Tijdelijk logo: monogram-blok met hartslag/energielijn plus wordmark.
 * Vervangbaar zonder de rest van de UI te raken.
 */
function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("h-8 w-8", className)}
      fill="none"
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="var(--primary)" height="32" rx="8" width="32" />
      <path
        d="M5 17h5l2.5-6 4 11 3-8 1.8 3H27"
        stroke="#fff"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}

function Logo({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={markClassName} />
      <span className="flex items-baseline gap-1.5 font-semibold tracking-tight">
        <span>{BRAND.shortName}</span>
      </span>
    </span>
  );
}

export { Logo, LogoMark };
