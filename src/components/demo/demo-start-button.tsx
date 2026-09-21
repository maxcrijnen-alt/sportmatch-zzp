"use client";

import { Loader2, ArrowRight } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function DemoStartButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      className="w-full bg-emerald-600 hover:bg-emerald-700"
      disabled={pending}
      size="lg"
      type="submit"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Demo wordt klaargezet…
        </>
      ) : (
        <>
          {label}
          <ArrowRight className="h-4 w-4" />
        </>
      )}
    </Button>
  );
}
