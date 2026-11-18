"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ProfileMenu } from "@/components/Shell";
import type { Profile } from "@/lib/types";

export default function PortalShell({ profile, serviceName, children }: { profile: Profile; serviceName: string; children: React.ReactNode }) {
  const router = useRouter();
  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  return (
    <div className="min-h-screen w-full">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-ink px-4 py-3 text-white sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 font-display text-lg font-bold text-[#5fd3a6]">A</span>
          <span className="font-display text-lg font-bold">Accountax</span>
          <span className="hidden truncate rounded-full bg-white/10 px-3 py-1 text-sm text-white/80 sm:inline">{serviceName}</span>
        </div>
        <ProfileMenu profile={profile} onSignOut={signOut} />
      </header>
      <main className="w-full px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
