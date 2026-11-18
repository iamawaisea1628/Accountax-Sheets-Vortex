import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EntrySheet from "@/components/EntrySheet";
import type { Profile } from "@/lib/types";

export default async function EntriesPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: offices }, { data: shifts }, { data: people }, { data: accts }, { data: groups }] = await Promise.all([
    sb.from("profiles").select("*").eq("id", user.id).single(),
    sb.from("offices").select("name, active").order("name"),
    sb.from("shifts").select("name, active").order("id"),
    sb.from("profiles").select("id, full_name").order("full_name"),
    sb.from("accounts").select("name").eq("active", true).order("name"),
    sb.from("groups").select("name").eq("active", true).order("name"),
  ]);
  if (!profile) redirect("/login");
  const me = profile as Profile;
  const managers = me.role === "admin"
    ? (people ?? []).map((p) => ({ id: p.id as string, name: (p.full_name as string) || "Unnamed" }))
    : [{ id: me.id, name: me.full_name }];
  return (
    <EntrySheet
      profile={me}
      offices={(offices ?? []).filter((o) => o.active).map((o) => o.name as string)}
      shifts={(shifts ?? []).filter((x) => x.active).map((x) => x.name as string)}
      allOffices={(offices ?? []).map((o) => o.name as string)}
      allShifts={(shifts ?? []).map((x) => x.name as string)}
      accounts={(accts ?? []).map((a) => a.name as string)}
      groups={(groups ?? []).map((g) => g.name as string)}
      managers={managers}
    />
  );
}
