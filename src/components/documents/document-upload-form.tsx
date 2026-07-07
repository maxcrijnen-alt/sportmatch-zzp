"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { documentTypeLabels } from "@/lib/labels";
import { createClient } from "@/lib/supabase/client";
import type { DocumentType } from "@/types/database";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const docTypeOptions = Object.entries(documentTypeLabels) as [
  DocumentType,
  string,
][];

export function DocumentUploadForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const docType = String(formData.get("docType") ?? "");
    const expiresAt = String(formData.get("expiresAt") ?? "");
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0) {
      setError("Kies een bestand.");
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setError("Het bestand is te groot (maximaal 10 MB).");
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is niet geconfigureerd.");
      return;
    }

    setIsUploading(true);

    try {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
      const path = `${userId}/${docType}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(path, file, { upsert: false });

      if (uploadError) {
        setError("Uploaden is niet gelukt. Probeer het opnieuw.");
        return;
      }

      const { error: insertError } = await supabase
        .from("document_uploads")
        .insert({
          user_id: userId,
          doc_type: docType,
          storage_path: path,
          original_filename: file.name,
          status: "pending",
          expires_at: expiresAt || null,
        });

      if (insertError) {
        setError("Registreren van het document is niet gelukt.");
        return;
      }

      form.reset();
      router.refresh();
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="docType">Soort document</Label>
          <Select defaultValue="sport_diploma" id="docType" name="docType">
            {docTypeOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="file">Bestand (pdf of afbeelding)</Label>
          <Input
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            id="file"
            name="file"
            required
            type="file"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="expiresAt">Geldig tot (optioneel)</Label>
          <Input id="expiresAt" name="expiresAt" type="date" />
        </div>
      </div>

      <Button disabled={isUploading} type="submit">
        {isUploading ? "Uploaden…" : "Document uploaden"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Documenten worden handmatig gecontroleerd. Upload geen identiteitsbewijs.
      </p>
    </form>
  );
}
