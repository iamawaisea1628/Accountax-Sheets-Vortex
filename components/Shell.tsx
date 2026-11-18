"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, ClipboardCheck, Headset, LogOut, Menu, Table2, Upload, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

const nav = [
  { href: "/entries", label: "Entry sheet", icon: Table2, admin: false },
  { href: "/import", label: "Import CSV", icon: Upload, admin: true },
  { href: "/team", label: "Team", icon: Users, admin: true },
];
const soon = [
  { label: "Shift closing", icon: ClipboardCheck },
  { label: "Summaries", icon: BarChart3 },
  { label: "Services portal", icon: Headset },
];

export default function Shell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const side = (
    <div className="flex h-full flex-col p-5 text-white">
      <div className="font-display text-2xl font-bold tracking-tight">Accountax</div>

      <nav className="mt-8 space-y-1">
        {nav.filter((n) => !n.admin || profile.role === "admin").map((n) => {
          const active = path.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} className="relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-white/75 transition hover:text-white">
              {active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-lg bg-white/10" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
              <n.icon className="relative h-4 w-4" />
              <span className="relative">{n.label}</span>
            </Link>
          );
        })}
      </nav>

      <p className="mb-2 mt-8 px-3 text-xs font-semibold text-white/40">Coming next</p>
      <div className="space-y-1">
        {soon.map((n) => (
          <div key={n.label} className="flex items-center gap-3 px-3 py-2 text-sm text-white/35">
            <n.icon className="h-4 w-4" /> {n.label}
          </div>
        ))}
      </div>

      <div className="mt-auto rounded-xl bg-white/[0.06] p-3">
        <div className="truncate text-sm font-semibold">{profile.full_name || profile.email}</div>
        <div className="text-xs capitalize text-[#5fd3a6]">{profile.role}</div>
        <button onClick={signOut} className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white/70 transition hover:bg-white/10 hover:text-white">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-ink lg:block">{side}</aside>

      <header className="sticky top-0 z-20 flex items-center justify-between bg-ink px-4 py-3 text-white lg:hidden">
        <span className="font-display text-lg font-bold">Accountax</span>
        <button aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-white/10"><Menu className="h-5 w-5" /></button>
      </header>

      <AnimatePresence>
        {open && (
          <>
            <motion.div key="o" className="fixed inset-0 z-40 bg-black/40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside key="d" className="fixed inset-y-0 left-0 z-50 w-64 bg-ink lg:hidden" initial={{ x: -270 }} animate={{ x: 0 }} exit={{ x: -270 }} transition={{ type: "tween", duration: 0.22 }}>
              <button aria-label="Close menu" onClick={() => setOpen(false)} className="absolute right-3 top-4 rounded-lg p-1.5 text-white/70 hover:bg-white/10"><X className="h-5 w-5" /></button>
              {side}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="w-full px-4 py-6 sm:px-6 lg:pl-[17rem] lg:pr-8 lg:py-8">{children}</main>
    </div>
  );
}
