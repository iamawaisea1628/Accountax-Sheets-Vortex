"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { addEntry, balanceOf, differenceOf, emptySums, r2, type Sums } from "@/lib/closing";
import { fmtMoney, parseAmount, todayISO } from "@/lib/format";
import type { Profile } from "@/lib/types";

type Row = { account: string; sums: Sums; prev: number; saved: boolean; carried: boolean };

const COLS: [keyof Sums, string][] = [
  ["opening", "Opening"], ["deposit", "Deposit"], ["redeem", "Redeem"], ["depositService", "Deposit-Service"],
  ["redeemService", "Redeem-Service"], ["withdraw", "Withdraw"], ["transfer", "Transfer"], ["ads", "Ads"],
  ["other", "Other Transaction"], ["unconfirmed", "Unconfirmed"], ["writtenOff", "Written Off"], ["outdoorIn", "Outdoor In"], ["outdoorOut", "Outdoor Out"],
];

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

export default function ClosingClient({ profile, shifts }: { profile: Profile; shifts: string[] }) {
  const sb = useMemo(() => createClient(), []);
  const [date, setDate] = useState(todayISO());
  const [shift, setShift] = useState(shifts[0] ?? "");
  const [rows, setRows] = useState<Row[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async (keepMessages = false) => {
    if (!shift) return;
    setLoading(true);
    if (!keepMessages) { setErr(""); setNote(""); }
    try {
      const entries = await fetchAll((a, b) =>
        sb.from("entries").select("account_name,entry_type,status,amount,office").eq("entry_date", date).eq("shift", shift).order("id").range(a, b));
      const saved = await fetchAll((a, b) =>
        sb.from("closings").select("account_name,closing").eq("closing_date", date).eq("shift", shift).order("id").range(a, b));
      const hist = await fetchAll((a, b) =>
        sb.from("closings").select("closing_date,shift,account_name,closing").lte("closing_date", date)
          .order("closing_date", { ascending: false }).order("id", { ascending: false }).range(a, b));

      // Last closing before this shift = the latest saved closing by (date, shift order)
      const cur = shifts.indexOf(shift);
      const best = new Map<string, { d: string; i: number; v: number }>();
      for (const h of hist) {
        const i = shifts.indexOf(h.shift);
        const before = h.closing_date < date || (h.closing_date === date && i < cur);
        if (!before) continue;
        const b = best.get(h.account_name);
        if (!b || h.closing_date > b.d || (h.closing_date === b.d && i > b.i)) best.set(h.account_name, { d: h.closing_date, i, v: Number(h.closing) });
      }
      const prevMap = new Map<string, number>(Array.from(best.entries()).map(([k, b]) => [k, b.v]));

      const sums = new Map<string, Sums>();
      const withEntries = new Set<string>();
      for (const e of entries) {
        if (!sums.has(e.account_name)) sums.set(e.account_name, emptySums());
        addEntry(sums.get(e.account_name)!, e);
        withEntries.add(e.account_name);
      }
      const savedMap = new Map<string, number>(saved.map((s) => [s.account_name as string, Number(s.closing)]));
      for (const a of savedMap.keys()) if (!sums.has(a)) sums.set(a, emptySums());
      // Carry over: accounts with a balance from the previous shift appear even with no entries today
      for (const [a, v] of prevMap) if (Math.abs(v) > 0.005 && !sums.has(a)) sums.set(a, emptySums());

      const list: Row[] = Array.from(sums.keys()).sort((x, y) => x.localeCompare(y))
        .map((account) => ({ account, sums: sums.get(account)!, prev: prevMap.get(account) ?? 0, saved: savedMap.has(account), carried: !withEntries.has(account) && !savedMap.has(account) }));
      setRows(list);
      setInputs(Object.fromEntries(Array.from(savedMap.entries()).map(([k, v]) => [k, String(v)])));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load this shift.");
    }
    setLoading(false);
  }, [sb, date, shift, shifts]);
  useEffect(() => { load(); }, [load]);

  const calc = rows.map((r) => {
    const balance = balanceOf(r.sums);
    const closing = parseAmount(inputs[r.account]);
    const net = closing === null && r.sums.unconfirmed === 0 ? null : r2((closing ?? 0) + r.sums.unconfirmed);
    return { ...r, balance, closing, net, diff: closing === null ? null : differenceOf(closing, r.prev, balance) };
  });
  const entered = calc.filter((r) => r.closing !== null);
  const totalBalance = r2(calc.reduce((s, r) => s + r.balance, 0));
  const totalDiff = r2(entered.reduce((s, r) => s + (r.diff ?? 0), 0));
  const off = entered.filter((r) => Math.abs(r.diff ?? 0) > 0.005).length;

  async function save() {
    setSaving(true); setErr(""); setNote("");
    const payload = entered.map((r) => ({
      closing_date: date, shift, account_name: r.account, opening: r.prev, closing: r.closing!, balance: r.balance,
      difference: r.diff!, sums: r.sums, manager_id: profile.id, manager_name: profile.full_name,
    }));
    const { error } = await sb.from("closings").upsert(payload, { onConflict: "closing_date,shift,account_name" });
    setSaving(false);
    if (error) {
      const blocked = error.code === "42501" || /row-level security|permission/i.test(error.message);
      const missing = error.code === "42P01" || /does not exist|schema cache/i.test(error.message);
      return setErr(
        blocked ? "The database refused this save (missing permission for closings). Run the closings repair SQL from the chat, then try again."
        : missing ? "The closings table is missing. Run the closings repair SQL from the chat, then try again."
        : `Save failed: ${error.message}`
      );
    }
    setNote(`Saved ${payload.length} closing${payload.length === 1 ? "" : "s"} for ${shift}. They become the opening for the next shift.`);
    await load(true);
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Shift closing</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink/60">Totals come from the entry sheet. Type the real closing balance for each account; Difference should be zero.</p>
        </div>
        <div className="flex items-end gap-3">
          <div><label className="lbl">Date</label><input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><label className="lbl">Shift</label>
            <select className="field" value={shift} onChange={(e) => setShift(e.target.value)}>{shifts.map((s) => <option key={s}>{s}</option>)}</select></div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink/70 tnum">
          {rows.length} accounts · balance {fmtMoney(totalBalance)} · {entered.length} closings typed
          {entered.length > 0 && (off === 0 ? <span className="font-semibold text-brand-dark"> · all differences are zero</span> : <span className="font-semibold text-danger"> · {off} with a difference ({fmtMoney(totalDiff)})</span>)}
        </p>
        <button className="btn-primary" onClick={save} disabled={saving || entered.length === 0}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save closings
        </button>
      </div>
      {err && <p role="alert" className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
      {note && <p role="status" className="mt-3 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark">{note}</p>}

      <div className="card mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr>
              <th className="th sticky left-0 z-10">Chime</th>
              <th className="th text-right">Net</th>
              <th className="th text-right">Opening</th>
              <th className="th text-right">Closing</th>
              <th className="th text-right">Difference</th>
              <th className="th text-right">Balance</th>
              {COLS.map(([, l]) => <th key={l} className="th text-right">{l}</th>)}
            </tr></thead>
            <tbody className={loading ? "opacity-50 transition" : "transition"}>
              {calc.map((r) => {
                const bad = r.diff !== null && Math.abs(r.diff) > 0.005;
                return (
                  <tr key={r.account} className="hover:bg-brand-soft/40">
                    <td className="td sticky left-0 bg-white font-semibold">{r.account}{r.saved && <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-dark">saved</span>}{r.carried && <span className="ml-2 rounded-full bg-ink/10 px-2 py-0.5 text-[11px] font-semibold text-ink/60">carried over</span>}</td>
                    <td className="td tnum text-right">{r.net === null ? <span className="text-ink/25">–</span> : fmtMoney(r.net)}</td>
                    <td className="td tnum text-right">{fmtMoney(r.prev)}</td>
                    <td className="td w-36"><input inputMode="decimal" className="field tnum py-1.5 text-right" placeholder="0.00" value={inputs[r.account] ?? ""} onChange={(e) => setInputs((p) => ({ ...p, [r.account]: e.target.value }))} /></td>
                    <td className={`td tnum text-right font-semibold ${r.diff === null ? "text-ink/25" : bad ? "text-danger" : "text-brand-dark"}`}>{r.diff === null ? "–" : fmtMoney(r.diff)}</td>
                    <td className="td tnum text-right font-semibold">{fmtMoney(r.balance)}</td>
                    {COLS.map(([k]) => <td key={k} className="td tnum text-right">{cell(r.sums[k])}</td>)}
                  </tr>
                );
              })}
              {!loading && calc.length === 0 && (
                <tr><td colSpan={6 + COLS.length} className="px-4 py-14 text-center text-sm text-ink/55">No entries or carried-over balances for this date and shift. Add entries on the entry sheet, or pick another date or shift.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
