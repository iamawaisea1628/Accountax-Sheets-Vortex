import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EntrySheet from "@/components/EntrySheet";
import type { Profile } from "@/lib/types";

export default async function EntriesPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: offices }, { data: shifts }, { data: people }] = await Promise.all([
    sb.from("profiles").select("*").eq("id", user.id).single(),
    sb.from("offices").select("name").order("name"),
    sb.from("shifts").select("name").order("id"),
    sb.from("profiles").select("id, full_name").order("full_name"),
  ]);
  if (!profile) redirect("/login");
  const me = profile as Profile;
  const managers = me.role === "admin"
    ? (people ?? []).map((p) => ({ id: p.id as string, name: (p.full_name as string) || "Unnamed" }))
    : [{ id: me.id, name: me.full_name }];
  return (
    <EntrySheet
      profile={me}
      offices={(offices ?? []).map((o) => o.name as string)}
      shifts={(shifts ?? []).map((s) => s.name as string)}
      managers={managers}
    />
  );
}
