"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ImagePlus, Loader2, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fmtDate, fmtMoney, monthStartISO, parseAmount, todayISO } from "@/lib/format";
import { shrink, signUrls } from "@/lib/image";
import { ruleText, type Profile, type ServiceStat, type Submission, type Withdrawal } from "@/lib/types";
import Tabs from "@/components/Tabs";

type Row = { id: number; entry_date: string; customer_name: string | null; amount: number; status: string; shift: string | null; remarks: string | null };

const pill: Record<string, string> = {
  pending: "bg-gold/15 text-[#8a5f0a]", entered: "bg-brand-soft text-brand-dark", approved: "bg-brand-soft text-brand-dark",
  paid: "bg-ink text-white", rejected: "bg-danger/10 text-danger",
};
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function PortalClient({ profile }: { profile: Profile }) {
  const sb = useMemo(() => createClient(), []);
  const serviceId = profile.service_id!;
  const [tab, setTab] = useState("shots");
  const [stat, setStat] = useState<ServiceStat | null>(null);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [wds, setWds] = useState<Withdrawal[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());
  const [err, setErr] = useState("");

  // screenshot form
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [amount, setAmount] = useState("");
  const [customer, setCustomer] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState("");
  // withdrawal form
  const [wAmount, setWAmount] = useState("");
  const [details, setDetails] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [wMsg, setWMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadStat = useCallback(async () => {
    const { data } = await sb.rpc("service_summary");
    setStat(((data ?? [])[0] as ServiceStat) ?? null);
  }, [sb]);
  const loadSubs = useCallback(async () => {
    const { data } = await sb.from("submissions").select("*").order("created_at", { ascending: false }).limit(100);
    const list = (data ?? []) as Submission[];
    setSubs(list);
    setUrls(await signUrls(sb, list.map((s) => s.image_path)));
  }, [sb]);
  const loadWds = useCallback(async () => {
    const { data } = await sb.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(100);
    setWds((data ?? []) as Withdrawal[]);
  }, [sb]);
  const loadRows = useCallback(async () => {
    const { data, error } = await sb.rpc("service_entries", { p_from: from || null, p_to: to || null });
    if (error) setErr(error.message); else setRows((data ?? []) as Row[]);
  }, [sb, from, to]);

  useEffect(() => { loadStat(); loadSubs(); loadWds(); }, [loadStat, loadSubs, loadWds]);
  useEffect(() => { loadRows(); }, [loadRows]);
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setSent("");
    if (!file) return setErr("Choose a screenshot first.");
    setSending(true);
    try {
      const img = await shrink(file);
      const path = `${serviceId}/${crypto.randomUUID()}.jpg`;
      const up = await sb.storage.from("screenshots").upload(path, img, { contentType: "image/jpeg" });
      if (up.error) throw new Error(up.error.message);
      const { error } = await sb.from("submissions").insert({
        service_id: serviceId, image_path: path, amount: parseAmount(amount), customer_name: customer.trim() || null,
        note: note.trim() || null, created_by: profile.id,
      });
      if (error) { await sb.storage.from("screenshots").remove([path]); throw new Error(error.message); }
      setFile(null); setAmount(""); setCustomer(""); setNote("");
      setSent("Sent. A manager will enter it shortly.");
      loadSubs();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Could not send the screenshot.");
    }
    setSending(false);
  }

  async function request(e: React.FormEvent) {
    e.preventDefault();
    setWMsg(null);
    const amt = parseAmount(wAmount);
    if (amt === null || amt <= 0) return setWMsg({ ok: false, text: "Enter an amount above zero." });
    setRequesting(true);
    const { error } = await sb.rpc("request_withdrawal", { p_amount: amt, p_details: details });
    setRequesting(false);
    if (error) return setWMsg({ ok: false, text: error.message });
    setWAmount(""); setDetails("");
    setWMsg({ ok: true, text: "Request sent. You will see its status below." });
    loadWds(); loadStat();
  }

  const figures: [string, number | undefined, string?][] = [
    ["Deposits", stat?.deposits], ["Redeems", stat?.redeems], ["Commission earned", stat?.commission],
    ["Withdrawn or requested", stat?.withdrawn], ["Available to withdraw", stat?.available, "text-brand-dark"],
  ];

  return (
    <div className="w-full">
      <h1 className="font-display text-3xl font-bold tracking-tight">{stat?.name ?? "Your service"}</h1>
      <p className="mt-1 text-sm text-ink/60">{stat ? `Your commission: ${ruleText(stat.commission_type, stat.commission_value)}. ` : ""}Figures update as the team enters your payments.</p>

      <div className="card mt-6 grid grid-cols-2 divide-rule sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
        {figures.map(([l, v, c]) => (
          <div key={l} className="p-4">
            <div className="text-xs font-semibold text-ink/55">{l}</div>
            <div className={`tnum mt-1 font-display text-2xl font-bold ${c ?? ""}`}>{v === undefined ? "–" : fmtMoney(Number(v))}</div>
          </div>
        ))}
      </div>

      <div className="mt-6"><Tabs id="portal" value={tab} onChange={setTab} tabs={[{ id: "shots", label: "Send screenshot" }, { id: "wd", label: "Withdrawals" }, { id: "entries", label: "My entries" }]} /></div>
      {err && <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}

      {tab === "shots" && (
        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(320px,440px)_1fr]">
          <form onSubmit={send} className="card h-fit p-5">
            <h2 className="font-display text-lg font-bold">Send a payment screenshot</h2>
            <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#bccbc2] bg-paper px-4 py-6 text-center text-sm text-ink/65 transition hover:border-brand hover:bg-brand-soft/50">
              {preview ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={preview} alt="Screenshot preview" className="max-h-56 rounded-md" /> : <><ImagePlus className="h-7 w-7 text-brand" />Tap to choose a screenshot</>}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setSent(""); }} />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div><label className="lbl">Amount</label><input inputMode="decimal" className="field tnum" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></div>
              <div><label className="lbl">Customer name</label><input className="field" value={customer} onChange={(e) => setCustomer(e.target.value)} /></div>
            </div>
            <label className="lbl mt-3">Note</label><input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
            <button className="btn-primary mt-5 w-full" disabled={sending}>{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send</button>
            {sent && <p role="status" className="mt-3 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark">{sent}</p>}
          </form>

          <div className="card overflow-hidden">
            <div className="border-b border-rule px-4 py-3 font-display text-lg font-bold">Your screenshots</div>
            {subs.length === 0 && <p className="px-4 py-10 text-center text-sm text-ink/55">Nothing sent yet.</p>}
            <ul className="divide-y divide-rule">
              {subs.map((s) => (
                <li key={s.id} className="flex items-center gap-4 px-4 py-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {urls[s.image_path] ? <img src={urls[s.image_path]} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" /> : <div className="h-14 w-14 shrink-0 rounded-md bg-rule" />}
                  <div className="min-w-0 flex-1">
                    <div className="tnum text-sm font-semibold">{s.amount !== null ? fmtMoney(Number(s.amount)) : "No amount"} {s.customer_name && <span className="font-normal text-ink/60">· {s.customer_name}</span>}</div>
                    <div className="text-xs text-ink/55">{when(s.created_at)}{s.staff_note && ` · ${s.staff_note}`}</div>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${pill[s.status]}`}>{s.status}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === "wd" && (
        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(320px,440px)_1fr]">
          <form onSubmit={request} className="card h-fit p-5">
            <h2 className="font-display text-lg font-bold">Request a withdrawal</h2>
            <p className="mt-1 text-sm text-ink/60">Available now: <span className="tnum font-semibold text-brand-dark">{fmtMoney(Number(stat?.available ?? 0))}</span></p>
            <label className="lbl mt-4">Amount</label>
            <div className="flex gap-2">
              <input inputMode="decimal" className="field tnum" value={wAmount} onChange={(e) => setWAmount(e.target.value)} placeholder="0.00" />
              <button type="button" className="btn-ghost shrink-0" onClick={() => setWAmount(String(Math.max(0, Number(stat?.available ?? 0))))}>Max</button>
            </div>
            <label className="lbl mt-3">Where should it be sent?</label>
            <textarea className="field min-h-[84px]" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Account name and number, or wallet details" />
            <button className="btn-primary mt-5 w-full" disabled={requesting}>{requesting && <Loader2 className="h-4 w-4 animate-spin" />} Request withdrawal</button>
            {wMsg && <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${wMsg.ok ? "bg-brand-soft text-brand-dark" : "bg-danger/10 text-danger"}`}>{wMsg.text}</p>}
          </form>
          <div className="card overflow-hidden">
            <div className="border-b border-rule px-4 py-3 font-display text-lg font-bold">Your requests</div>
            {wds.length === 0 && <p className="px-4 py-10 text-center text-sm text-ink/55">No requests yet.</p>}
            <ul className="divide-y divide-rule">
              {wds.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0"><div className="tnum text-sm font-semibold">{fmtMoney(Number(w.amount))}</div><div className="truncate text-xs text-ink/55">{when(w.created_at)}{w.staff_note && ` · ${w.staff_note}`}</div></div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${pill[w.status]}`}>{w.status}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === "entries" && (
        <div className="card mt-5 overflow-hidden">
          <div className="flex flex-wrap items-end gap-3 border-b border-rule p-4">
            <div><label className="lbl">From</label><input type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><label className="lbl">To</label><input type="date" className="field" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr>{["Date", "Customer", "Amount", "Status", "Shift", "Remarks"].map((h) => <th key={h} className={`th ${h === "Amount" ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-brand-soft/40">
                    <td className="td tnum">{fmtDate(r.entry_date)}</td><td className="td">{r.customer_name}</td>
                    <td className={`td tnum text-right font-semibold ${r.status === "Deposit" ? "text-brand-dark" : r.status === "Redeem" ? "text-danger" : ""}`}>{fmtMoney(Number(r.amount))}</td>
                    <td className="td">{r.status}</td><td className="td">{r.shift}</td><td className="td max-w-[260px] truncate">{r.remarks}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-ink/55">No entries in this range.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
