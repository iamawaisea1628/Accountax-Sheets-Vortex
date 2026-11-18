import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ServicesClient from "@/components/ServicesClient";
import type { Profile } from "@/lib/types";

export default async function ServicesPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: offices }] = await Promise.all([
    sb.from("profiles").select("*").eq("id", user.id).single(),
    sb.from("offices").select("name").order("name"),
  ]);
  if (!profile) redirect("/login");
  return <ServicesClient profile={profile as Profile} offices={(offices ?? []).map((o) => o.name as string)} />;
}
