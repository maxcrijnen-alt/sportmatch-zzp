import Image from "next/image";
import { BRAND } from "@/lib/branding";
import { cn } from "@/lib/utils";

function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className={cn("h-9 w-9", className)}
      height={256}
      src="/sportmatch-mark.svg"
      width={256}
    />
  );
}

/**
 * Horizontale lockup voor navigatie: het bestaande beeldmerk met het
 * woordmerk in de logokleuren (Sport groen, Match rood). `variant="full"`
 * toont het officiële, volledige logo.
 */
function Logo({
  className,
  markClassName,
  variant = "lockup",
}: {
  className?: string;
  markClassName?: string;
  variant?: "lockup" | "full";
}) {
  if (variant === "full") {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <Image
          alt={BRAND.name}
          className={cn("h-14 w-auto", markClassName)}
          height={263}
          src="/sportmatch-logo.svg"
          width={480}
        />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={cn("h-8 w-8", markClassName)} />
      <span className="text-[17px] font-black uppercase italic leading-none tracking-[-0.02em]">
        <span className="text-brand-green">Sport</span>
        <span className="text-brand-red">Match</span>
      </span>
    </span>
  );
}

export { Logo, LogoMark };
