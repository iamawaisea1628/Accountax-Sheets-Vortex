"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fmtDate, fmtMoney, monthStartISO, parseAmount, todayISO } from "@/lib/format";
import { STATUSES, type Entry, type EntryType, type Profile } from "@/lib/types";

type Props = { profile: Profile; offices: string[]; shifts: string[]; allOffices: string[]; allShifts: string[]; accounts: string[]; groups: string[]; managers: { id: string; name: string }[] };
const opt = (list: string[], v: string) => (v && !list.includes(v) ? [...list, v] : list);
const PAGE = 100;

const pill: Record<string, string> = {
  Deposit: "bg-brand-soft text-brand-dark",
  Redeem: "bg-danger/10 text-danger",
  Opening: "bg-ink/10 text-ink",
};
const GREEN = ["Deposit", "Transfer In", "Outdoor In"];
const RED = ["Redeem", "Withdraw", "Written Off", "Transfer Out", "Ads", "Outdoor Out"];
const amountColor = (s: string) => (GREEN.includes(s) ? "text-brand-dark" : RED.includes(s) ? "text-danger" : "text-ink");

export default function EntrySheet({ profile, offices, shifts, allOffices, allShifts, accounts, groups, managers }: Props) {
  const sb = useMemo(() => createClient(), []);
  const isAdmin = profile.role === "admin";
  const [type, setType] = useState<EntryType>("main");
  const [f, setF] = useState({ from: monthStartISO(), to: todayISO(), status: "", office: "", shift: "", q: "" });
  const [qInput, setQInput] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Entry[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [newId, setNewId] = useState<number | null>(null);

  const blank = () => ({
    entry_date: todayISO(), account_name: "", customer_name: "", amount: "", status: "Deposit",
    office: offices[0] ?? "", shift: shifts[0] ?? "", manager_id: profile.id, manager_name: profile.full_name, grp: "", remarks: "",
  });
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const customerRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [accts, setAccts] = useState(accounts);
  const [addAcct, setAddAcct] = useState("");
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const setFilter = (patch: Partial<typeof f>) => { setF((p) => ({ ...p, ...patch })); setPage(0); };

  useEffect(() => {
    const t = setTimeout(() => setFilter({ q: qInput }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput]);

  const load = useCallback(async () => {
    setLoading(true);
    let q = sb.from("entries").select("*", { count: "exact" }).eq("entry_type", type)
      .order("entry_date", { ascending: false }).order("id", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (f.from) q = q.gte("entry_date", f.from);
    if (f.to) q = q.lte("entry_date", f.to);
    if (f.status) q = q.eq("status", f.status);
    if (f.office) q = q.eq("office", f.office);
    if (f.shift) q = q.eq("shift", f.shift);
    const s = f.q.trim().replace(/[%,()]/g, "");
    if (s) q = q.or(`account_name.ilike.%${s}%,customer_name.ilike.%${s}%,remarks.ilike.%${s}%`);
    const { data, count: c, error } = await q;
    if (error) setErr(error.message); else { setRows((data ?? []) as Entry[]); setCount(c ?? 0); }
    setLoading(false);
  }, [sb, type, f, page]);
  useEffect(() => { load(); }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const amount = parseAmount(form.amount);
    if (!form.entry_date) return setErr("Pick a date.");
    const typed = form.account_name.trim();
    if (!typed) return setErr("Enter the account name.");
    const known = accts.find((a) => a.toLowerCase() === typed.toLowerCase());
    if (!known) { setAddAcct(typed); return setErr(`"${typed}" is not in the Chime accounts list.`); }
    setAddAcct("");
    if (amount === null) return setErr("Enter a valid amount, like 25 or 25.50.");
    const payload = {
      entry_date: form.entry_date, entry_type: type, account_name: known,
      customer_name: form.customer_name.trim() || null, amount, status: form.status,
      office: form.office || null, shift: form.shift || null,
      manager_id: form.manager_id || null, manager_name: form.manager_name || null,
      grp: form.grp.trim() || null, remarks: form.remarks.trim() || null,
    };
    setSaving(true);
    if (editing) {
      const { error } = await sb.from("entries").update(payload).eq("id", editing);
      setSaving(false);
      if (error) return setErr(error.message);
      setEditing(null);
      setForm((p) => ({ ...blank(), entry_date: p.entry_date }));
    } else {
      const { data, error } = await sb.from("entries").insert(payload).select("id").single();
      setSaving(false);
      if (error) return setErr(error.message);
      setNewId(data?.id ?? null);
      setForm((p) => ({ ...p, customer_name: "", amount: "", remarks: "" }));
      customerRef.current?.focus();
    }
    setPage(0);
    load();
  }

  async function addAndSave() {
    const name = addAcct;
    const { error } = await sb.from("accounts").insert({ name });
    if (error && !/duplicate/i.test(error.message)) return setErr(error.message);
    setAccts((p) => (p.includes(name) ? p : [...p, name].sort((a, b) => a.localeCompare(b))));
    setAddAcct(""); setErr("");
    setTimeout(() => formRef.current?.requestSubmit(), 0);
  }

  function startEdit(r: Entry) {
    setEditing(r.id);
    setForm({
      entry_date: r.entry_date, account_name: r.account_name, customer_name: r.customer_name ?? "", amount: String(r.amount),
      status: r.status, office: r.office ?? "", shift: r.shift ?? "", manager_id: r.manager_id ?? "", manager_name: r.manager_name ?? "",
      grp: r.grp ?? "", remarks: r.remarks ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function cancelEdit() { setEditing(null); setForm(blank()); setErr(""); }

  async function remove(r: Entry) {
    if (!confirm(`Delete this ${fmtMoney(r.amount)} ${r.status} entry for ${r.account_name}?`)) return;
    const { error } = await sb.from("entries").delete().eq("id", r.id);
    if (error) setErr(error.message); else load();
  }

  const canEdit = (r: Entry) => isAdmin || r.manager_id === profile.id;
  const pages = Math.max(1, Math.ceil(count / PAGE));

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Entry sheet</h1>
          <p className="mt-1 text-sm text-ink/60">Every summary and closing is built from these rows.</p>
        </div>
        <div className="relative flex rounded-lg bg-[#dfe8e2] p-1">
          {(["main", "service"] as EntryType[]).map((t) => (
            <button key={t} onClick={() => { setType(t); setPage(0); }} className="relative rounded-md px-5 py-1.5 text-sm font-semibold capitalize">
              {type === t && <motion.span layoutId="type-pill" className="absolute inset-0 rounded-md bg-white shadow-sm" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <span className={`relative ${type === t ? "text-ink" : "text-ink/55"}`}>{t}</span>
            </button>
          ))}
        </div>
      </div>

      <form ref={formRef} onSubmit={save} className={`card mt-6 p-4 transition ${editing ? "ring-2 ring-gold/60" : ""}`}>
        {editing && <p className="mb-3 text-sm font-semibold text-gold">Editing entry #{editing}</p>}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-12">
          <div className="2xl:col-span-1"><label className="lbl">Date</label><input type="date" className="field" value={form.entry_date} onChange={(e) => set("entry_date", e.target.value)} /></div>
          <div className="2xl:col-span-2"><label className="lbl">Account name</label><input className="field" list="acct-list" autoComplete="off" value={form.account_name} onChange={(e) => { set("account_name", e.target.value); setAddAcct(""); }} placeholder="Start typing…" /><datalist id="acct-list">{accts.map((a) => <option key={a} value={a} />)}</datalist></div>
          <div className="2xl:col-span-2"><label className="lbl">Customer name</label><input ref={customerRef} className="field" value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} placeholder="Customer" /></div>
          <div className="2xl:col-span-1"><label className="lbl">Amount</label><input inputMode="decimal" className="field tnum" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0.00" /></div>
          <div className="2xl:col-span-1"><label className="lbl">Status</label>
            <select className="field" value={form.status} onChange={(e) => set("status", e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div className="2xl:col-span-1"><label className="lbl">Office</label>
            <select className="field" value={form.office} onChange={(e) => set("office", e.target.value)}><option value="">—</option>{opt(offices, form.office).map((o) => <option key={o}>{o}</option>)}</select></div>
          <div className="2xl:col-span-1"><label className="lbl">Shift</label>
            <select className="field" value={form.shift} onChange={(e) => set("shift", e.target.value)}><option value="">—</option>{opt(shifts, form.shift).map((o) => <option key={o}>{o}</option>)}</select></div>
          <div className="2xl:col-span-1"><label className="lbl">Manager</label>
            {isAdmin ? (
              <select className="field" value={form.manager_id} onChange={(e) => { const m = managers.find((x) => x.id === e.target.value); setForm((p) => ({ ...p, manager_id: e.target.value, manager_name: m?.name ?? p.manager_name })); }}>
                {!form.manager_id && <option value="">{form.manager_name || "—"}</option>}
                {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            ) : <input className="field bg-paper" value={profile.full_name} readOnly />}
          </div>
          <div className="2xl:col-span-1"><label className="lbl">Group</label><input className="field" list="grp-list" value={form.grp} onChange={(e) => set("grp", e.target.value)} /><datalist id="grp-list">{groups.map((g) => <option key={g} value={g} />)}</datalist></div>
          <div className="col-span-2 md:col-span-4 xl:col-span-6 2xl:col-span-12"><label className="lbl">Remarks</label><input className="field" value={form.remarks} onChange={(e) => set("remarks", e.target.value)} placeholder="Optional note" /></div>
        </div>
        {err && (
          <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            <span>{err}</span>
            {addAcct && <button type="button" onClick={addAndSave} className="btn-ghost !px-3 !py-1 text-ink">Add &quot;{addAcct}&quot; and save</button>}
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <button className="btn-primary" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editing ? "Save changes" : "Add entry"}
          </button>
          {editing && <button type="button" className="btn-ghost" onClick={cancelEdit}><X className="h-4 w-4" /> Cancel</button>}
        </div>
      </form>

      <div className="card mt-6 overflow-hidden">
        <div className="flex flex-wrap items-end gap-3 border-b border-rule p-4">
          <div><label className="lbl">From</label><input type="date" className="field" value={f.from} onChange={(e) => setFilter({ from: e.target.value })} /></div>
          <div><label className="lbl">To</label><input type="date" className="field" value={f.to} onChange={(e) => setFilter({ to: e.target.value })} /></div>
          <div><label className="lbl">Status</label><select className="field" value={f.status} onChange={(e) => setFilter({ status: e.target.value })}><option value="">All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className="lbl">Office</label><select className="field" value={f.office} onChange={(e) => setFilter({ office: e.target.value })}><option value="">All</option>{allOffices.map((o) => <option key={o}>{o}</option>)}</select></div>
          <div><label className="lbl">Shift</label><select className="field" value={f.shift} onChange={(e) => setFilter({ shift: e.target.value })}><option value="">All</option>{allShifts.map((o) => <option key={o}>{o}</option>)}</select></div>
          <div className="min-w-[220px] flex-1"><label className="lbl">Search</label>
            <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-ink/40" /><input className="field pl-9" placeholder="Account, customer or remarks" value={qInput} onChange={(e) => setQInput(e.target.value)} /></div></div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr>
              {["Date", "Account name", "Customer name", "Amount", "Status", "Office", "Shift", "Manager", "Group", "Remarks", ""].map((h) => <th key={h} className={`th ${h === "Amount" ? "text-right" : ""}`}>{h}</th>)}
            </tr></thead>
            <tbody className={loading ? "opacity-50 transition" : "transition"}>
              {rows.map((r) => (
                <tr key={r.id} className={`hover:bg-brand-soft/40 ${r.id === newId ? "row-new" : ""} ${editing === r.id ? "bg-gold/10" : ""}`}>
                  <td className="td tnum">{fmtDate(r.entry_date)}</td>
                  <td className="td font-semibold">{r.account_name}</td>
                  <td className="td">{r.customer_name}</td>
                  <td className={`td tnum text-right font-semibold ${amountColor(r.status)}`}>{fmtMoney(r.amount)}</td>
                  <td className="td"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${pill[r.status] ?? "bg-gold/15 text-[#8a5f0a]"}`}>{r.status}</span></td>
                  <td className="td">{r.office}</td>
                  <td className="td">{r.shift}</td>
                  <td className="td">{r.manager_name}</td>
                  <td className="td">{r.grp}</td>
                  <td className="td max-w-[280px] truncate" title={r.remarks ?? ""}>{r.remarks}</td>
                  <td className="td text-right">
                    {canEdit(r) && (
                      <span className="inline-flex gap-1">
                        <button aria-label="Edit entry" onClick={() => startEdit(r)} className="rounded-md p-1.5 text-ink/50 transition hover:bg-white hover:text-brand-dark"><Pencil className="h-4 w-4" /></button>
                        <button aria-label="Delete entry" onClick={() => remove(r)} className="rounded-md p-1.5 text-ink/50 transition hover:bg-white hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-14 text-center text-sm text-ink/55">No entries match these filters. Add one above, or widen the date range.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-rule px-4 py-3 text-sm text-ink/65">
          <span className="tnum">{count.toLocaleString()} {count === 1 ? "entry" : "entries"}{loading && " · loading…"}</span>
          <div className="flex items-center gap-2">
            <button className="btn-ghost !px-2.5 !py-1.5" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
            <span className="tnum">Page {page + 1} of {pages}</span>
            <button className="btn-ghost !px-2.5 !py-1.5" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
