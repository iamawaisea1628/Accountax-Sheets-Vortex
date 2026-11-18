"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, ClipboardCheck, Headset, LogOut, Menu, Table2, Upload, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

const nav = [
  { href: "/entries", label: "Entry sheet", icon: Table2, admin: false },
  { href: "/closing", label: "Shift closing", icon: ClipboardCheck, admin: false },
  { href: "/summaries", label: "Summaries", icon: BarChart3, admin: false },
  { href: "/services", label: "Services", icon: Headset, admin: false },
  { href: "/import", label: "Import CSV", icon: Upload, admin: true },
  { href: "/team", label: "Team", icon: Users, admin: true },
];
export const initials = (p: Profile) =>
  (p.full_name || p.email || "?").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

function Nav({ profile, path, always }: { profile: Profile; path: string; always?: boolean }) {
  // Labels are hidden until the sidebar is hovered (always = mobile drawer, where they stay visible).
  const t = always ? "" : "opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100";
  return (
    <div className="p-3 text-white">
      <div className="flex items-center gap-3 px-2 py-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 font-display text-lg font-bold text-[#5fd3a6]">A</span>
        <span className={`whitespace-nowrap font-display text-xl font-bold tracking-tight ${t}`}>Accountax</span>
      </div>

      <nav className="mt-6 space-y-1">
        {nav.filter((n) => !n.admin || profile.role === "admin").map((n) => {
          const active = path.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} title={n.label} className="relative flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-white/75 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
              {active && <motion.span layoutId={always ? "nav-pill-m" : "nav-pill"} className="absolute inset-0 rounded-lg bg-white/10" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
              <n.icon className="relative h-5 w-5 shrink-0" />
              <span className={`relative whitespace-nowrap ${t}`}>{n.label}</span>
            </Link>
          );
        })}
      </nav>

    </div>
  );
}

export function ProfileMenu({ profile, onSignOut }: { profile: Profile; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", click); document.removeEventListener("keydown", key); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open profile menu"
        aria-expanded={open}
        className="grid h-10 w-10 place-items-center rounded-full bg-ink text-sm font-bold text-white ring-2 ring-white transition hover:ring-brand/40 focus-visible:outline-none focus-visible:ring-brand"
      >
        {initials(profile)}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            style={{ transformOrigin: "top right" }}
            className="card absolute right-0 z-50 mt-2 w-72 p-4"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink text-base font-bold text-white">{initials(profile)}</span>
              <div className="min-w-0">
                <div className="truncate font-display text-base font-bold">{profile.full_name || "Unnamed"}</div>
                <div className="truncate text-sm text-ink/60">{profile.email}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-paper px-3 py-2 text-sm">
              <span className="text-ink/60">Role</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${profile.role === "admin" ? "bg-ink text-white" : "bg-brand-soft text-brand-dark"}`}>{profile.role}</span>
            </div>
            <button onClick={onSignOut} className="btn-ghost mt-3 w-full hover:!bg-danger/10 hover:!text-danger">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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

  return (
    <div className="min-h-screen w-full">
      {/* Desktop sidebar: icons only, expands while hovered or focused */}
      <aside className="group fixed inset-y-0 left-0 z-40 hidden w-[4.5rem] overflow-hidden bg-ink shadow-xl transition-[width] duration-200 ease-out focus-within:w-64 hover:w-64 lg:block">
        <Nav profile={profile} path={path} />
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-paper/85 px-4 py-3 backdrop-blur sm:px-6 lg:pl-[5.5rem] lg:pr-8">
        <div className="flex items-center gap-3 lg:hidden">
          <button aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-white"><Menu className="h-5 w-5" /></button>
          <span className="font-display text-lg font-bold">Accountax</span>
        </div>
        <div className="hidden lg:block" />
        <ProfileMenu profile={profile} onSignOut={signOut} />
      </header>

      <AnimatePresence>
        {open && (
          <>
            <motion.div key="o" className="fixed inset-0 z-40 bg-black/40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside key="d" className="fixed inset-y-0 left-0 z-50 w-64 bg-ink lg:hidden" initial={{ x: -270 }} animate={{ x: 0 }} exit={{ x: -270 }} transition={{ type: "tween", duration: 0.22 }}>
              <button aria-label="Close menu" onClick={() => setOpen(false)} className="absolute right-3 top-4 rounded-lg p-1.5 text-white/70 hover:bg-white/10"><X className="h-5 w-5" /></button>
              <Nav profile={profile} path={path} always />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="w-full px-4 pb-8 pt-2 sm:px-6 lg:pl-[5.5rem] lg:pr-8">{children}</main>
    </div>
  );
}
