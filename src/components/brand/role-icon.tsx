import Image from "next/image";
import { cn } from "@/lib/utils";

type RoleIconRole = "organization" | "instructor";

const roleStyles: Record<
  RoleIconRole,
  {
    src: string;
    className: string;
    imageClassName: string;
  }
> = {
  organization: {
    src: "/sportmatch-role-organization.svg",
    className:
      "bg-emerald-500/10 ring-1 ring-inset ring-emerald-600/15",
    imageClassName: "h-5 w-7",
  },
  instructor: {
    src: "/sportmatch-role-instructor.svg",
    className: "bg-red-500/10 ring-1 ring-inset ring-red-600/15",
    imageClassName: "h-6 w-6",
  },
};

function RoleIcon({
  role,
  className,
  iconClassName,
}: {
  role: RoleIconRole;
  className?: string;
  iconClassName?: string;
}) {
  const roleStyle = roleStyles[role];

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
        roleStyle.className,
        className,
      )}
    >
      <span
        className={cn(
          "relative inline-flex items-center justify-center",
          roleStyle.imageClassName,
          iconClassName,
        )}
      >
        <Image
          alt=""
          aria-hidden="true"
          className="h-full w-full object-contain"
          fill
          sizes="32px"
          src={roleStyle.src}
        />
      </span>
    </span>
  );
}

export { RoleIcon };
export type { RoleIconRole };
