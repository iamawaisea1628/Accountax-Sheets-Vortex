import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TeamClient from "@/components/TeamClient";
import type { Profile } from "@/lib/types";

export default async function TeamPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/entries");
  const { data } = await sb.from("profiles").select("*").order("created_at");
  return <TeamClient people={(data ?? []) as Profile[]} meId={user.id} />;
}
