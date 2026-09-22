import Image from "next/image";
import { BRAND } from "@/lib/branding";
import { cn } from "@/lib/utils";

function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className={cn("h-9 w-auto", className)}
      height={263}
      src="/sportmatch-logo.svg"
      width={480}
    />
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

export { Logo, LogoMark };
