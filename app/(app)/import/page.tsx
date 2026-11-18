import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ImportClient from "@/components/ImportClient";

export default async function ImportPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if (p?.role !== "admin") redirect("/entries");
  return <ImportClient />;
}
