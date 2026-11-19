import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SummariesClient from "@/components/SummariesClient";

export default async function SummariesPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: offices }, { data: sOffices }, { data: shifts }] = await Promise.all([
    sb.from("offices").select("name").order("name"),
    sb.from("service_offices").select("name").order("name"),
    sb.from("shifts").select("name").order("id"),
  ]);
  return <SummariesClient offices={Array.from(new Set([...(offices ?? []), ...(sOffices ?? [])].map((o) => o.name as string))).sort((a, b) => a.localeCompare(b))} shifts={(shifts ?? []).map((s) => s.name as string)} />;
}
