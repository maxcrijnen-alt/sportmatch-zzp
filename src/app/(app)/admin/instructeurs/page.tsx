import { redirect } from "next/navigation";

export default function AdminInstructeursPage() {
  redirect("/admin/gebruikers?rol=instructor");
}
