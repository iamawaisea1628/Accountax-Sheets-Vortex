import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PortalShell from "@/components/PortalShell";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/login");
  if (profile.role !== "service") redirect("/entries");
  const { data: svc } = profile.service_id ? await sb.from("services").select("name").eq("id", profile.service_id).single() : { data: null };
  return <PortalShell profile={profile as Profile} serviceName={svc?.name ?? "Service"}>{children}</PortalShell>;
}
