"use client";
import { useActionState, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { createManager, deleteManager } from "@/app/(app)/team/actions";
import type { Profile } from "@/lib/types";

export default function TeamClient({ people, meId }: { people: Profile[]; meId: string }) {
  const [state, action, pending] = useActionState(createManager, null);
  const [msg, setMsg] = useState("");
  const [, start] = useTransition();

  function remove(p: Profile) {
    if (!confirm(`Remove ${p.full_name || p.email}? They will no longer be able to sign in. Their past entries stay.`)) return;
    start(async () => { const r = await deleteManager(p.id); setMsg(r?.message ?? ""); });
  }

  return (
    <div className="w-full">
      <h1 className="font-display text-3xl font-bold tracking-tight">Team</h1>
      <p className="mt-1 text-sm text-ink/60">Managers enter and edit their own entries. Admins can see and change everything.</p>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <form action={action} className="card h-fit p-5">
          <h2 className="font-display text-lg font-bold">Add a manager</h2>
          <label className="lbl mt-4">Full name</label><input name="name" className="field" required />
          <label className="lbl mt-3">Email</label><input name="email" type="email" className="field" required />
          <label className="lbl mt-3">Password</label><input name="password" type="text" minLength={8} className="field" placeholder="At least 8 characters" required />
          <button className="btn-primary mt-5 w-full" disabled={pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Create manager</button>
          {state && <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm ${state.ok ? "bg-brand-soft text-brand-dark" : "bg-danger/10 text-danger"}`}>{state.message}</p>}
        </form>

        <div className="card overflow-hidden">
          <table className="w-full border-collapse">
            <thead><tr>{["Name", "Email", "Role", ""].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>
              {people.map((p, i) => (
                <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                  <td className="td font-semibold">{p.full_name || "—"}</td>
                  <td className="td">{p.email}</td>
                  <td className="td"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${p.role === "admin" ? "bg-ink text-white" : "bg-brand-soft text-brand-dark"}`}>{p.role}</span></td>
                  <td className="td text-right">{p.role === "manager" && p.id !== meId && (
                    <button aria-label={`Remove ${p.full_name}`} onClick={() => remove(p)} className="rounded-md p-1.5 text-ink/50 hover:bg-paper hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                  )}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {msg && <p className="border-t border-rule px-4 py-3 text-sm text-ink/70">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
