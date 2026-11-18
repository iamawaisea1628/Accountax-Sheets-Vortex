"use client";
import { useState } from "react";
import Papa from "papaparse";
import { motion } from "framer-motion";
import { CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fmtDate, fmtMoney, parseAmount, parseDate } from "@/lib/format";
import { STATUSES, type EntryType } from "@/lib/types";

type Row = Record<string, string>;
type Parsed = { entry_date: string; account_name: string; customer_name: string | null; amount: number; status: string; office: string | null; shift: string | null; manager_name: string | null; grp: string | null; remarks: string | null };

const pick = (r: Row, keys: string[]) => {
  for (const k of keys) if (r[k] !== undefined && String(r[k]).trim() !== "") return String(r[k]).trim();
  return "";
};

export default function ImportClient() {
  const [type, setType] = useState<EntryType>("main");
  const [file, setFile] = useState("");
  const [rows, setRows] = useState<Parsed[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState<number | null>(null);
  const [err, setErr] = useState("");

  function onFile(f: File | undefined) {
    if (!f) return;
    setFile(f.name); setDone(null); setErr(""); setProgress(0);
    Papa.parse<Row>(f, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""),
      complete: (res) => {
        const ok: Parsed[] = [];
        const bad: string[] = [];
        res.data.forEach((r, i) => {
          const line = i + 2;
          const date = parseDate(pick(r, ["date", "entrydate", ""]));
          const account = pick(r, ["accountname", "account"]);
          const amount = parseAmount(pick(r, ["amount"]));
          const rawStatus = pick(r, ["status"]);
          if (!date || !account || amount === null || !rawStatus) {
            if (Object.values(r).some((v) => String(v).trim())) bad.push(`Line ${line}: missing or invalid date, account, amount or status`);
            return;
          }
          const status = STATUSES.find((s) => s.toLowerCase() === rawStatus.toLowerCase()) ?? rawStatus;
          ok.push({
            entry_date: date, account_name: account, customer_name: pick(r, ["customername", "customer"]) || null, amount, status,
            office: pick(r, ["office"]) || null, shift: pick(r, ["shift"]) || null, manager_name: pick(r, ["manager"]) || null,
            grp: pick(r, ["group", "grp"]) || null, remarks: pick(r, ["remarks", "remark"]) || null,
          });
        });
        setRows(ok); setSkipped(bad);
      },
      error: (e) => setErr(e.message),
    });
  }

  async function run() {
    setBusy(true); setErr(""); setProgress(0);
    const sb = createClient();
    const offices = Array.from(new Set(rows.map((r) => r.office).filter(Boolean))) as string[];
    const shifts = Array.from(new Set(rows.map((r) => r.shift).filter(Boolean))) as string[];
    if (offices.length) await sb.from("offices").upsert(offices.map((name) => ({ name })), { onConflict: "name", ignoreDuplicates: true });
    if (shifts.length) await sb.from("shifts").upsert(shifts.map((name) => ({ name })), { onConflict: "name", ignoreDuplicates: true });
    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH).map((r) => ({ ...r, entry_type: type }));
      const { error } = await sb.from("entries").insert(chunk);
      if (error) { setErr(`Stopped after ${i} rows: ${error.message}`); setBusy(false); return; }
      setProgress(Math.min(rows.length, i + BATCH));
    }
    setDone(rows.length); setRows([]); setBusy(false);
  }

  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="w-full">
      <h1 className="font-display text-3xl font-bold tracking-tight">Import CSV</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink/60">
        Upload this month's entries once. Columns: Date, Account Name, Customer Name, Amount, Status, Office, Shift, Manager, Group, Remarks. Rows without a date or amount, like section titles, are skipped.
      </p>

      <div className="card mt-6 p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="lbl">Import into</label>
            <select className="field w-44" value={type} onChange={(e) => setType(e.target.value as EntryType)}>
              <option value="main">Main entries</option>
              <option value="service">Service entries</option>
            </select>
          </div>
          <label className="btn-ghost cursor-pointer">
            <FileUp className="h-4 w-4" /> {file || "Choose CSV file"}
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        </div>

        {rows.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
            <p className="text-sm"><span className="font-semibold tnum">{rows.length.toLocaleString()}</span> rows ready · net amount <span className="font-semibold tnum">{fmtMoney(total)}</span>{skipped.length > 0 && <> · <span className="text-gold font-semibold">{skipped.length} skipped</span></>}</p>
            <div className="mt-3 overflow-x-auto rounded-lg border border-rule">
              <table className="w-full border-collapse">
                <thead><tr>{["Date", "Account", "Customer", "Amount", "Status", "Office", "Shift", "Manager"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
                <tbody>{rows.slice(0, 8).map((r, i) => (
                  <tr key={i}><td className="td tnum">{fmtDate(r.entry_date)}</td><td className="td">{r.account_name}</td><td className="td">{r.customer_name}</td><td className="td tnum">{fmtMoney(r.amount)}</td><td className="td">{r.status}</td><td className="td">{r.office}</td><td className="td">{r.shift}</td><td className="td">{r.manager_name}</td></tr>
                ))}</tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-ink/55">Showing the first 8 rows. Check them before importing, because importing twice creates duplicates.</p>
            <button className="btn-primary mt-4" onClick={run} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Import {rows.length.toLocaleString()} rows
            </button>
            {busy && (
              <div className="mt-3 h-2 w-full max-w-md overflow-hidden rounded-full bg-rule">
                <motion.div className="h-full bg-brand" animate={{ width: `${(progress / rows.length) * 100}%` }} />
              </div>
            )}
          </motion.div>
        )}

        {skipped.length > 0 && (
          <ul className="mt-4 space-y-1 text-xs text-ink/60">
            {skipped.slice(0, 5).map((s) => <li key={s}>{s}</li>)}
            {skipped.length > 5 && <li>…and {skipped.length - 5} more</li>}
          </ul>
        )}
        {err && <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        {done !== null && (
          <motion.p initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mt-5 flex items-center gap-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark">
            <CheckCircle2 className="h-4 w-4" /> Imported {done.toLocaleString()} rows. Open the entry sheet to check them.
          </motion.p>
        )}
      </div>
    </div>
  );
}
