import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ClosingClient from "@/components/ClosingClient";
import type { Profile } from "@/lib/types";

export default async function ClosingPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: shifts }] = await Promise.all([
    sb.from("profiles").select("*").eq("id", user.id).single(),
    sb.from("shifts").select("name").order("id"),
  ]);
  if (!profile) redirect("/login");
  return <ClosingClient profile={profile as Profile} shifts={(shifts ?? []).map((s) => s.name as string)} />;
}
