"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const demo = [
  ["Opening", "Main account", "+ 1,240.00"],
  ["Deposit", "Morning shift", "+ 320.00"],
  ["Redeem", "Evening shift", "– 95.50"],
  ["Deposit", "Service desk", "+ 60.00"],
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      setErr("That email and password don't match. Check them and try again.");
      return;
    }
    router.replace("/entries");
    router.refresh();
  }

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-ink p-12 text-white lg:flex">
        <div className="font-display text-2xl font-bold tracking-tight">Accountax</div>

        <div className="max-w-xl">
          <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight">
            Every entry in one ledger.
          </h1>
          <p className="mt-4 max-w-md text-lg text-white/65">
            Enter once. Closings and summaries are built from the same rows, so the numbers always agree.
          </p>

          <div className="mt-10 rounded-xl border border-white/10 bg-white/[0.04] p-2">
            {demo.map((r, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.28, duration: 0.5, ease: "easeOut" }}
                className="grid grid-cols-[90px_1fr_auto] items-center gap-4 border-b border-white/10 px-4 py-3 last:border-0"
              >
                <span className="text-sm font-semibold text-[#5fd3a6]">{r[0]}</span>
                <span className="text-sm text-white/70">{r[1]}</span>
                <span className="tnum text-sm font-semibold">{r[2]}</span>
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 + demo.length * 0.28 + 0.2 }}
              className="flex items-center justify-between px-4 py-3"
            >
              <span className="text-sm text-white/60">Balance</span>
              <span className="tnum font-display text-xl font-bold text-[#5fd3a6]">$1,524.50</span>
            </motion.div>
          </div>
        </div>

        <p className="text-sm text-white/40">Sample figures for illustration.</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="font-display text-xl font-bold lg:hidden">Accountax</div>
          <h2 className="mt-6 font-display text-3xl font-bold tracking-tight lg:mt-0">Sign in</h2>
          <p className="mt-1 text-sm text-ink/60">Use the email and password your admin gave you.</p>

          <label className="lbl mt-8" htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />

          <label className="lbl mt-4" htmlFor="password">Password</label>
          <input id="password" type="password" required autoComplete="current-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} />

          {err && <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}

          <button className="btn-primary mt-6 w-full" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
          </button>
        </form>
      </section>
    </div>
  );
}
