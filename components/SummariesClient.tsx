"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { addEntry, emptySums, r2, summaryBalanceOf, type Sums } from "@/lib/closing";
import { fmtDate, fmtMoney, monthStartISO, todayISO } from "@/lib/format";

type Group = "account" | "office" | "day" | "month" | "shift";
type SumKey = "deposit" | "redeem" | "depositService" | "redeemService" | "withdraw" | "transfer" | "ads" | "other" | "outdoorIn" | "outdoorOut";
type SortKey = "key" | "difference" | "closing" | "balance" | "opening" | SumKey;
type Raw = { entry_date: string; account_name: string; entry_type: "main" | "service"; status: string; amount: number; office: string | null; shift: string | null };
type Closed = { closing_date: string; shift: string; account_name: string; difference: number };
type Line = { key: string; sums: Sums; openBal: number; closing: number; opening: number; balance: number; difference: number };

const GROUPS: [Group, string][] = [["account", "Chime"], ["office", "Office"], ["day", "Day"], ["month", "Month"], ["shift", "Shift"]];
// Column names exactly as in the Summary-Shift sheet (Forfeited Funds removed)
const COLS: [SumKey, string][] = [
  ["deposit", "Deposit"], ["redeem", "Redeem"], ["depositService", "Deposit-Service"], ["redeemService", "Redeem-Service"],
  ["withdraw", "Withdraw"], ["transfer", "Transfer"], ["ads", "Ads"], ["other", "Other Transaction"],
  ["outdoorIn", "Outdoor In"], ["outdoorOut", "Outdoor Out"],
];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll(make: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: { message: string } | null }>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await make(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const cell = (n: number) => (n === 0 ? <span className="text-ink/25">–</span> : fmtMoney(n));
const keyOf = (g: Group, e: { entry_date: string; account_name: string; office: string | null; shift: string | null }) =>
  g === "account" ? e.account_name : g === "office" ? e.office || "(none)" : g === "day" ? e.entry_date : g === "month" ? e.entry_date.slice(0, 7) : e.shift || "(none)";
const label = (g: Group, k: string) => (g === "day" ? fmtDate(k) : g === "month" ? `${MON[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}` : k);

export default function SummariesClient({ offices, shifts }: { offices: string[]; shifts: string[] }) {
  const sb = useMemo(() => createClient(), []);
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());
  const [office, setOffice] = useState("");
  const [shift, setShift] = useState("");
  const [group, setGroup] = useState<Group>("account");
  const [raw, setRaw] = useState<Raw[]>([]);
  const [closed, setClosed] = useState<Closed[]>([]);
  const [openMap, setOpenMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "key", dir: 1 });

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true); setErr("");
      try {
        const e = await fetchAll((a, b) => {
          let q = sb.from("entries").select("entry_date,account_name,entry_type,status,amount,office,shift").order("id").range(a, b);
          if (from) q = q.gte("entry_date", from);
          if (to) q = q.lte("entry_date", to);
          if (office) q = q.eq("office", office);
          if (shift) q = q.eq("shift", shift);
          return q;
        });
        const c = await fetchAll((a, b) => {
          let q = sb.from("closings").select("closing_date,shift,account_name,difference").order("id").range(a, b);
          if (from) q = q.gte("closing_date", from);
          if (to) q = q.lte("closing_date", to);
          if (shift) q = q.eq("shift", shift);
          return q;
        });
        if (live) { setRaw(e as Raw[]); setClosed(c as Closed[]); }
      } catch (x) {
        if (live) setErr(x instanceof Error ? x.message : "Could not load the summary.");
      }
      if (live) setLoading(false);
    })();
    return () => { live = false; };
  }, [sb, from, to, office, shift]);

  // Closing and Difference come from saved closings, which belong to accounts, not offices
  const showClosing = group !== "office" && !office;
  // Opening from closings: latest saved closing before the period (per account) or before each month
  const showOpening = (group === "account" || group === "month") && !office;

  useEffect(() => {
    if (!showOpening) { setOpenMap({}); return; }
    let live = true;
    (async () => {
      const m: Record<string, number> = {};
      try {
        if (group === "account") {
          if (from) {
            const { data, error } = await sb.rpc("opening_balances", { p_before: from });
            if (error) throw new Error(error.message);
            ((data ?? []) as { account_name: string; closing: number }[]).forEach((r) => { m[r.account_name] = Number(r.closing); });
          }
        } else {
          for (const mo of Array.from(new Set(raw.map((e) => e.entry_date.slice(0, 7))))) {
            const { data, error } = await sb.rpc("opening_balances", { p_before: `${mo}-01` });
            if (error) throw new Error(error.message);
            m[mo] = r2(((data ?? []) as { closing: number }[]).reduce((t, r) => t + Number(r.closing), 0));
          }
        }
        if (live) setOpenMap(m);
      } catch (x) {
        if (live) setErr(`Opening balances unavailable: ${x instanceof Error ? x.message : "unknown error"}`);
      }
    })();
    return () => { live = false; };
  }, [sb, showOpening, group, from, raw]);

  const lines = useMemo(() => {
    const m = new Map<string, { sums: Sums; closing: number }>();
    const get = (k: string) => { if (!m.has(k)) m.set(k, { sums: emptySums(), closing: 0 }); return m.get(k)!; };
    for (const e of raw) addEntry(get(keyOf(group, e)).sums, e);
    if (showClosing) {
      for (const c of closed) {
        const k = keyOf(group, { entry_date: c.closing_date, account_name: c.account_name, office: null, shift: c.shift });
        if (m.has(k)) m.get(k)!.closing = r2(m.get(k)!.closing + Number(c.difference));
      }
    }
    if (group === "account" && showOpening) {
      for (const [a, v] of Object.entries(openMap)) if (Math.abs(v) > 0.005) get(a);
    }
    const out: Line[] = Array.from(m.entries()).map(([key, v]) => {
      const openBal = showOpening ? openMap[key] ?? 0 : 0;
      const opening = r2(openBal + v.sums.opening);
      const balance = summaryBalanceOf(v.sums, opening);
      return { key, sums: v.sums, openBal, closing: v.closing, opening, balance, difference: r2(v.closing + balance) };
    });
    const val = (l: Line): number | string =>
      sort.k === "key" ? l.key : sort.k === "difference" ? l.difference : sort.k === "closing" ? l.closing : sort.k === "balance" ? l.balance : sort.k === "opening" ? l.opening : l.sums[sort.k];
    const dflt = group === "day" || group === "month" ? -1 : 1;
    out.sort((a, b) => {
      const x = val(a), y = val(b);
      const c = typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number);
      return c * sort.dir * (sort.k === "key" ? dflt : 1);
    });
    return out;
  }, [raw, closed, group, showClosing, showOpening, openMap, sort]);

  const total = useMemo(() => {
    const s = emptySums();
    let closing = 0, opening = 0, balance = 0, difference = 0;
    for (const l of lines) {
      closing += l.closing; opening += l.opening; balance += l.balance; difference += l.difference;
      (Object.keys(s) as (keyof Sums)[]).forEach((k) => (s[k] = r2(s[k] + l.sums[k])));
    }
    return { sums: s, closing: r2(closing), opening: r2(opening), balance: r2(balance), difference: r2(difference) };
  }, [lines]);

  function toggle(k: SortKey) { setSort((p) => (p.k === k ? { k, dir: (p.dir * -1) as 1 | -1 } : { k, dir: k === "key" ? 1 : -1 })); }
  const Th = ({ k, children, right = true }: { k: SortKey; children: React.ReactNode; right?: boolean }) => (
    <th className={`th ${right ? "text-right" : ""}`} aria-sort={sort.k === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button onClick={() => toggle(k)} className="inline-flex items-center gap-1 font-semibold hover:text-ink">
        {children}{sort.k === k && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );

  function preset(a: string, b: string) { setFrom(a); setTo(b); }
  function lastMonth() { const d = new Date(); preset(todayISO(new Date(d.getFullYear(), d.getMonth() - 1, 1)), todayISO(new Date(d.getFullYear(), d.getMonth(), 0))); }

  function exportCsv() {
    const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const head = [GROUPS.find((g) => g[0] === group)![1], "Difference", "Closing", "Balance", "Opening", ...COLS.map((c) => c[1])];
    const body = lines.map((l) => [label(group, l.key), l.difference, l.closing, l.balance, l.opening, ...COLS.map(([k]) => l.sums[k])]);
    const foot = ["Total", total.difference, total.closing, total.balance, total.opening, ...COLS.map(([k]) => total.sums[k])];
    const csv = [head, ...body, foot].map((r) => r.map(q).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `accountax-summary-${group}-${from || "start"}-to-${to || "today"}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Summaries</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink/60">Built live from the entry sheet, with the same columns as your Summary sheet. Group by Chime, office, day, month or shift.</p>
        </div>
        <button className="btn-ghost" onClick={exportCsv} disabled={lines.length === 0}><Download className="h-4 w-4" /> Export CSV</button>
      </div>

      <div className="card mt-6 flex flex-wrap items-end gap-3 p-4">
        <div><label className="lbl">From</label><input type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="lbl">To</label><input type="date" className="field" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="flex gap-1.5 pb-0.5">
          <button className="btn-ghost !px-3 !py-2" onClick={() => preset(todayISO(), todayISO())}>Today</button>
          <button className="btn-ghost !px-3 !py-2" onClick={() => preset(monthStartISO(), todayISO())}>This month</button>
          <button className="btn-ghost !px-3 !py-2" onClick={lastMonth}>Last month</button>
        </div>
        <div><label className="lbl">Office</label><select className="field" value={office} onChange={(e) => setOffice(e.target.value)}><option value="">All</option>{offices.map((o) => <option key={o}>{o}</option>)}</select></div>
        <div><label className="lbl">Shift</label><select className="field" value={shift} onChange={(e) => setShift(e.target.value)}><option value="">All</option>{shifts.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div>
          <label className="lbl">Group by</label>
          <div className="flex rounded-lg bg-[#dfe8e2] p-1">
            {GROUPS.map(([g, l]) => (
              <button key={g} onClick={() => { setGroup(g); setSort({ k: "key", dir: 1 }); }} className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${group === g ? "bg-gradient-to-r from-[#1ccb98] to-[#0b7f68] text-white shadow-md shadow-brand/30" : "text-ink/55 hover:text-ink"}`}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm text-ink/70 tnum">
        {lines.length} {lines.length === 1 ? "row" : "rows"} · Balance {fmtMoney(total.balance)}
        {loading && <Loader2 className="ml-2 inline h-4 w-4 animate-spin" />}
      </p>
      {err && <p role="alert" className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}

      <div className="card mt-3 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr>
              <th className="th sticky left-0 z-10" aria-sort={sort.k === "key" ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                <button onClick={() => toggle("key")} className="inline-flex items-center gap-1 font-semibold hover:text-ink">
                  {GROUPS.find((g) => g[0] === group)![1]}{sort.k === "key" && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                </button>
              </th>
              <Th k="difference">Difference</Th>
              <Th k="closing">Closing</Th>
              <Th k="balance">Balance</Th>
              <Th k="opening">Opening</Th>
              {COLS.map(([k, l]) => <Th key={k} k={k}>{l}</Th>)}
            </tr></thead>
            <tbody className={loading ? "opacity-50 transition" : "transition"}>
              {lines.length > 0 && (
                <tr className="bg-brand-soft/60 font-semibold">
                  <td className="td sticky left-0 bg-[#e3f2ea]">Total</td>
                  <td className="td tnum text-right">{fmtMoney(total.difference)}</td>
                  <td className="td tnum text-right">{cell(total.closing)}</td>
                  <td className="td tnum text-right">{fmtMoney(total.balance)}</td>
                  <td className="td tnum text-right">{cell(total.opening)}</td>
                  {COLS.map(([k]) => <td key={k} className="td tnum text-right">{cell(total.sums[k])}</td>)}
                </tr>
              )}
              {lines.map((l) => (
                <tr key={l.key} className="hover:bg-brand-soft/40">
                  <td className="td sticky left-0 bg-white font-semibold">{label(group, l.key)}</td>
                  <td className={`td tnum text-right font-semibold ${Math.abs(l.difference) > 0.005 ? "text-danger" : "text-brand-dark"}`}>{fmtMoney(l.difference)}</td>
                  <td className="td tnum text-right">{cell(l.closing)}</td>
                  <td className="td tnum text-right font-semibold">{fmtMoney(l.balance)}</td>
                  <td className="td tnum text-right">{cell(l.opening)}</td>
                  {COLS.map(([k]) => <td key={k} className="td tnum text-right">{cell(l.sums[k])}</td>)}
                </tr>
              ))}
              {!loading && lines.length === 0 && (
                <tr><td colSpan={COLS.length + 5} className="px-4 py-14 text-center text-sm text-ink/55">No entries in this range. Widen the dates or clear a filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
