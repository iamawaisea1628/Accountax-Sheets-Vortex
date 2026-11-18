import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PortalClient from "@/components/PortalClient";
import type { Profile } from "@/lib/types";

export default async function PortalPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || profile.role !== "service") redirect("/entries");
  if (!profile.service_id) {
    return <div className="card max-w-lg p-6"><h1 className="font-display text-xl font-bold">Almost there</h1><p className="mt-2 text-sm text-ink/70">This login is not linked to a service yet. Ask the admin to link it.</p></div>;
  }
  return <PortalClient profile={profile as Profile} />;
}
