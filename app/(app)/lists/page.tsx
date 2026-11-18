import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ListsClient from "@/components/ListsClient";

export default async function ListsPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if (!p || p.role === "service") redirect("/entries");
  return <ListsClient isAdmin={p.role === "admin"} />;
}
