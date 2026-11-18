"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Pencil, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fmtMoney } from "@/lib/format";
import { signUrls } from "@/lib/image";
import { ruleText, type Profile, type ServiceStat, type Submission, type Withdrawal } from "@/lib/types";
import Tabs from "@/components/Tabs";

const pill: Record<string, string> = {
  pending: "bg-gold/15 text-[#8a5f0a]", entered: "bg-brand-soft text-brand-dark", approved: "bg-brand-soft text-brand-dark",
  paid: "bg-ink text-white", rejected: "bg-danger/10 text-danger",
};
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const blank = { id: 0, name: "", office: "", commission_type: "percent", commission_value: "" };

export default function ServicesClient({ profile, offices }: { profile: Profile; offices: string[] }) {
  const sb = useMemo(() => createClient(), []);
  const isAdmin = profile.role === "admin";
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState<ServiceStat[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [wds, setWds] = useState<Withdrawal[]>([]);
  const [subFilter, setSubFilter] = useState("pending");
  const [wdFilter, setWdFilter] = useState("pending");
  const [counts, setCounts] = useState({ subs: 0, wds: 0 });
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [view, setView] = useState("");

  const loadStats = useCallback(async () => {
    const { data, error } = await sb.rpc("service_summary");
    if (error) setErr(error.message); else setStats((data ?? []) as ServiceStat[]);
  }, [sb]);
  const loadCounts = useCallback(async () => {
    const [a, b] = await Promise.all([
      sb.from("submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      sb.from("withdrawals").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    setCounts({ subs: a.count ?? 0, wds: b.count ?? 0 });
  }, [sb]);
  const loadSubs = useCallback(async () => {
    let q = sb.from("submissions").select("*, services(name)").order("created_at", { ascending: false }).limit(200);
    if (subFilter) q = q.eq("status", subFilter);
    const { data } = await q;
    const list = (data ?? []) as Submission[];
    setSubs(list);
    setUrls(await signUrls(sb, list.map((s) => s.image_path)));
  }, [sb, subFilter]);
  const loadWds = useCallback(async () => {
    let q = sb.from("withdrawals").select("*, services(name)").order("created_at", { ascending: false }).limit(200);
    if (wdFilter) q = q.eq("status", wdFilter);
    const { data } = await q;
    setWds((data ?? []) as Withdrawal[]);
  }, [sb, wdFilter]);

  useEffect(() => { loadStats(); loadCounts(); }, [loadStats, loadCounts]);
  useEffect(() => { loadSubs(); }, [loadSubs]);
  useEffect(() => { loadWds(); }, [loadWds]);
  useEffect(() => {
    if (!view) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setView("");
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [view]);

  async function saveService(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const value = Number(form.commission_value || 0);
    if (!form.name.trim() || !form.office.trim()) return setErr("Enter the service name and its office.");
    if (Number.isNaN(value) || value < 0) return setErr("Commission must be a number, zero or more.");
    const payload = { name: form.name.trim(), office: form.office.trim(), commission_type: form.commission_type, commission_value: form.commission_type === "none" ? 0 : value };
    setSaving(true);
    const { error } = form.id ? await sb.from("services").update(payload).eq("id", form.id) : await sb.from("services").insert(payload);
    setSaving(false);
    if (error) return setErr(error.message);
    setForm(blank);
    loadStats();
  }

  async function handleSub(s: Submission, status: "entered" | "rejected") {
    let staff_note: string | null = null;
    if (status === "rejected") {
      const r = window.prompt("Reason for rejecting (the service will see this):", "");
      if (r === null) return;
      staff_note = r.trim() || null;
    }
    const { error } = await sb.from("submissions").update({ status, staff_note, handled_by: profile.id, handled_name: profile.full_name, handled_at: new Date().toISOString() }).eq("id", s.id);
    if (error) return setErr(error.message);
    loadSubs(); loadCounts();
  }

  async function handleWd(w: Withdrawal, status: "approved" | "paid" | "rejected") {
    let staff_note = w.staff_note;
    if (status === "rejected") {
      const r = window.prompt("Reason for rejecting (the service will see this):", "");
      if (r === null) return;
      staff_note = r.trim() || null;
    }
    const { error } = await sb.from("withdrawals").update({ status, staff_note, handled_by: profile.id, handled_name: profile.full_name, handled_at: new Date().toISOString() }).eq("id", w.id);
    if (error) return setErr(error.message);
    loadWds(); loadCounts(); loadStats();
  }

  const total = stats.reduce((t, s) => ({ dep: t.dep + Number(s.deposits), red: t.red + Number(s.redeems), com: t.com + Number(s.commission), wd: t.wd + Number(s.withdrawn), av: t.av + Number(s.available) }), { dep: 0, red: 0, com: 0, wd: 0, av: 0 });
  const FilterSel = ({ value, set, opts }: { value: string; set: (v: string) => void; opts: string[] }) => (
    <select className="field w-44 capitalize" value={value} onChange={(e) => set(e.target.value)}><option value="">All</option>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</select>
  );

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Services</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink/60">Each service sees only its own figures. Commission is worked out from the Deposit entries you enter on the Service tab of the entry sheet.</p>
        </div>
        <Tabs id="svc" value={tab} onChange={setTab} tabs={[{ id: "overview", label: "Overview" }, { id: "shots", label: "Screenshots", badge: counts.subs }, { id: "wd", label: "Withdrawals", badge: counts.wds }]} />
      </div>
      {err && <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}

      {tab === "overview" && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_minmax(300px,360px)]">
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead><tr>{["Service", "Office", "Commission", "Deposits", "Redeems", "Earned", "Withdrawn", "Available", ""].map((h, i) => <th key={i} className={`th ${i > 2 && i < 8 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
                <tbody>
                  {stats.length > 0 && (
                    <tr className="bg-brand-soft/60 font-semibold">
                      <td className="td" colSpan={3}>All services</td>
                      <td className="td tnum text-right">{fmtMoney(total.dep)}</td><td className="td tnum text-right">{fmtMoney(total.red)}</td>
                      <td className="td tnum text-right">{fmtMoney(total.com)}</td><td className="td tnum text-right">{fmtMoney(total.wd)}</td><td className="td tnum text-right">{fmtMoney(total.av)}</td><td className="td" />
                    </tr>
                  )}
                  {stats.map((s) => (
                    <tr key={s.service_id} className="hover:bg-brand-soft/40">
                      <td className="td font-semibold">{s.name}</td><td className="td">{s.office}</td><td className="td">{ruleText(s.commission_type, Number(s.commission_value))}</td>
                      <td className="td tnum text-right">{fmtMoney(Number(s.deposits))}</td><td className="td tnum text-right">{fmtMoney(Number(s.redeems))}</td>
                      <td className="td tnum text-right">{fmtMoney(Number(s.commission))}</td><td className="td tnum text-right">{fmtMoney(Number(s.withdrawn))}</td>
                      <td className="td tnum text-right font-semibold text-brand-dark">{fmtMoney(Number(s.available))}</td>
                      <td className="td text-right">{isAdmin && <button aria-label={`Edit ${s.name}`} className="rounded-md p-1.5 text-ink/50 hover:bg-white hover:text-brand-dark" onClick={() => setForm({ id: s.service_id, name: s.name, office: s.office, commission_type: s.commission_type, commission_value: String(s.commission_value) })}><Pencil className="h-4 w-4" /></button>}</td>
                    </tr>
                  ))}
                  {stats.length === 0 && <tr><td colSpan={9} className="px-4 py-14 text-center text-sm text-ink/55">{isAdmin ? "No services yet. Add the first one on the right." : "No services have been added yet."}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {isAdmin && (
            <form onSubmit={saveService} className="card h-fit p-5">
              <h2 className="font-display text-lg font-bold">{form.id ? "Edit service" : "Add a service"}</h2>
              <label className="lbl mt-4">Service name</label><input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <label className="lbl mt-3">Office on its entries</label>
              <input className="field" list="office-list" value={form.office} onChange={(e) => setForm({ ...form, office: e.target.value })} placeholder="Must match the Office on service entries" />
              <datalist id="office-list">{offices.map((o) => <option key={o} value={o} />)}</datalist>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div><label className="lbl">Commission</label>
                  <select className="field" value={form.commission_type} onChange={(e) => setForm({ ...form, commission_type: e.target.value })}>
                    <option value="percent">Percent of deposits</option><option value="fixed">Fixed per deposit</option><option value="none">None</option></select></div>
                <div><label className="lbl">{form.commission_type === "fixed" ? "Amount ($)" : "Rate (%)"}</label>
                  <input inputMode="decimal" className="field tnum" disabled={form.commission_type === "none"} value={form.commission_value} onChange={(e) => setForm({ ...form, commission_value: e.target.value })} /></div>
              </div>
              <div className="mt-5 flex gap-2">
                <button className="btn-primary" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{form.id ? "Save" : "Add service"}</button>
                {form.id !== 0 && <button type="button" className="btn-ghost" onClick={() => setForm(blank)}>Cancel</button>}
              </div>
              <p className="mt-4 text-xs text-ink/55">Create the service's login on the Team page.</p>
            </form>
          )}
        </div>
      )}

      {tab === "shots" && (
        <div className="card mt-6 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule p-4">
            <p className="text-sm text-ink/65">Enter the payment on the Entry sheet (Service tab), then mark it entered here.</p>
            <FilterSel value={subFilter} set={setSubFilter} opts={["pending", "entered", "rejected"]} />
          </div>
          {subs.length === 0 && <p className="px-4 py-12 text-center text-sm text-ink/55">No screenshots here.</p>}
          <ul className="divide-y divide-rule">
            {subs.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                <button onClick={() => urls[s.image_path] && setView(urls[s.image_path])} aria-label="View screenshot" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {urls[s.image_path] ? <img src={urls[s.image_path]} alt="" className="h-16 w-16 rounded-md object-cover ring-1 ring-rule transition hover:ring-brand" /> : <div className="h-16 w-16 rounded-md bg-rule" />}
                </button>
                <div className="min-w-[200px] flex-1">
                  <div className="text-sm font-semibold">{s.services?.name} <span className="tnum font-normal text-ink/70">· {s.amount !== null ? fmtMoney(Number(s.amount)) : "no amount"}{s.customer_name && ` · ${s.customer_name}`}</span></div>
                  <div className="text-xs text-ink/55">{when(s.created_at)}{s.note && ` · ${s.note}`}{s.handled_name && ` · ${s.status} by ${s.handled_name}`}{s.staff_note && ` · ${s.staff_note}`}</div>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${pill[s.status]}`}>{s.status}</span>
                {s.status === "pending" && (
                  <div className="flex gap-2">
                    <button className="btn-primary !px-3 !py-1.5" onClick={() => handleSub(s, "entered")}><Check className="h-4 w-4" /> Mark entered</button>
                    <button className="btn-ghost !px-3 !py-1.5 hover:!text-danger" onClick={() => handleSub(s, "rejected")}><X className="h-4 w-4" /> Reject</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "wd" && (
        <div className="card mt-6 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule p-4">
            <p className="text-sm text-ink/65">{isAdmin ? "Approve a request, pay it, then mark it paid." : "Only the admin can approve or pay withdrawals."}</p>
            <FilterSel value={wdFilter} set={setWdFilter} opts={["pending", "approved", "paid", "rejected"]} />
          </div>
          {wds.length === 0 && <p className="px-4 py-12 text-center text-sm text-ink/55">No withdrawal requests here.</p>}
          <ul className="divide-y divide-rule">
            {wds.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                <div className="min-w-[220px] flex-1">
                  <div className="text-sm font-semibold">{w.services?.name} <span className="tnum font-normal">· {fmtMoney(Number(w.amount))}</span></div>
                  <div className="whitespace-pre-line text-xs text-ink/60">{w.details || "No payout details given"}</div>
                  <div className="text-xs text-ink/45">{when(w.created_at)}{w.handled_name && ` · ${w.status} by ${w.handled_name}`}{w.staff_note && ` · ${w.staff_note}`}</div>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${pill[w.status]}`}>{w.status}</span>
                {isAdmin && (w.status === "pending" || w.status === "approved") && (
                  <div className="flex gap-2">
                    {w.status === "pending" && <button className="btn-primary !px-3 !py-1.5" onClick={() => handleWd(w, "approved")}><Check className="h-4 w-4" /> Approve</button>}
                    {w.status === "approved" && <button className="btn-primary !px-3 !py-1.5" onClick={() => handleWd(w, "paid")}><Check className="h-4 w-4" /> Mark paid</button>}
                    <button className="btn-ghost !px-3 !py-1.5 hover:!text-danger" onClick={() => handleWd(w, "rejected")}><X className="h-4 w-4" /> Reject</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <AnimatePresence>
        {view && (
          <motion.div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setView("")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <motion.img src={view} alt="Payment screenshot" initial={{ scale: 0.96 }} animate={{ scale: 1 }} className="max-h-[92vh] max-w-full rounded-lg shadow-2xl" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
