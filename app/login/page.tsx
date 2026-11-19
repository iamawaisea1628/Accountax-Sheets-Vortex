"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const demo = [
  ["Opening", "Main account", "+ 1,240.00"],
  ["Deposit", "Morning shift", "+ 320.00"],
  ["Redeem", "Evening shift", "– 95.50"],
  ["Deposit", "Service desk", "+ 60.00"],
];

const Mark = ({ size = "h-9 w-9" }: { size?: string }) => (
  <span className={`grid ${size} shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#3df0b4] to-[#0e9f7e] font-display text-lg font-extrabold text-[#06242a] shadow-lg shadow-black/20`}>A</span>
);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
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
    <div className="grid min-h-screen w-full lg:grid-cols-[1.15fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex" style={{ backgroundImage: "linear-gradient(150deg,#051f25 0%,#0a4443 42%,#0e8a6e 100%)" }}>
        <div className="blob absolute -left-24 -top-24 h-96 w-96 rounded-full bg-[#2fe0a8]/25 blur-3xl" />
        <div className="blob blob-2 absolute -bottom-32 right-0 h-[28rem] w-[28rem] rounded-full bg-[#22d3ee]/20 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "44px 44px" }} />

        <div className="relative flex items-center gap-3"><Mark /><span className="font-display text-2xl font-bold tracking-tight">Accountax</span></div>

        <div className="relative max-w-xl">
          <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight">
            Every entry in <span className="bg-gradient-to-r from-white to-[#7ff0c8] bg-clip-text text-transparent">one ledger.</span>
          </h1>
          <p className="mt-4 max-w-md text-lg text-white/70">
            Enter once. Closings and summaries are built from the same rows, so the numbers always agree.
          </p>

          <div className="mt-10 rounded-2xl border border-white/15 bg-white/10 p-2 shadow-2xl shadow-black/20 backdrop-blur-md">
            {demo.map((r, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.28, duration: 0.5, ease: "easeOut" }}
                className="grid grid-cols-[90px_1fr_auto] items-center gap-4 border-b border-white/10 px-4 py-3 last:border-0"
              >
                <span className="text-sm font-semibold text-[#7ff0c8]">{r[0]}</span>
                <span className="text-sm text-white/75">{r[1]}</span>
                <span className="tnum text-sm font-semibold">{r[2]}</span>
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 + demo.length * 0.28 + 0.2 }}
              className="flex items-center justify-between rounded-xl bg-black/15 px-4 py-3"
            >
              <span className="text-sm text-white/65">Balance</span>
              <span className="tnum bg-gradient-to-r from-white to-[#7ff0c8] bg-clip-text font-display text-xl font-bold text-transparent">$1,524.50</span>
            </motion.div>
          </div>
        </div>

        <p className="relative text-sm text-white/45">Sample figures for illustration.</p>
      </section>

      <section className="relative flex flex-col" style={{ backgroundImage: "linear-gradient(160deg,#ffffff 0%,#f1f8f4 55%,#dff1e8 100%)" }}>
        <div className="flex items-center gap-3 px-6 py-4 text-white lg:hidden" style={{ backgroundImage: "linear-gradient(135deg,#051f25,#0a4443 55%,#0e8a6e)" }}>
          <Mark size="h-8 w-8" /><span className="font-display text-xl font-bold">Accountax</span>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <motion.form
            onSubmit={submit}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="w-full max-w-sm rounded-2xl border border-white bg-white/85 p-8 shadow-[0_24px_60px_-24px_rgba(11,90,76,0.35)] backdrop-blur"
          >
            <h2 className="font-display text-3xl font-bold tracking-tight">Sign in</h2>
            <p className="mt-1 text-sm text-ink/60">Use the email and password your admin gave you.</p>

            <label className="lbl mt-7" htmlFor="email">Email</label>
            <input id="email" type="email" required autoComplete="email" className="field py-2.5" value={email} onChange={(e) => setEmail(e.target.value)} />

            <label className="lbl mt-4" htmlFor="password">Password</label>
            <div className="relative">
              <input id="password" type={show ? "text" : "password"} required autoComplete="current-password" className="field py-2.5 pr-11" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-2 text-ink/45 transition hover:bg-brand-soft hover:text-brand-dark">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {err && <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}

            <button className="btn-primary mt-6 w-full py-2.5 text-base" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
            </button>
          </motion.form>
        </div>
      </section>
    </div>
  );
}
