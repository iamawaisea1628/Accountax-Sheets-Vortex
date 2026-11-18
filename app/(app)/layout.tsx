import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Shell from "@/components/Shell";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="card max-w-md p-6">
          <h1 className="font-display text-xl font-bold">Profile not found</h1>
          <p className="mt-2 text-sm text-ink/70">
            Your login works but has no profile row yet. Run the setup SQL in the Supabase SQL Editor, then add the user again.
          </p>
        </div>
      </div>
    );
  }
  return <Shell profile={profile as Profile}>{children}</Shell>;
}
