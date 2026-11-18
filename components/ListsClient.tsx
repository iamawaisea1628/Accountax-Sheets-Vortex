"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Tabs from "@/components/Tabs";

type Item = { id: number; name: string; active: boolean };
const LISTS: Record<string, { label: string; one: string; hint: string }> = {
  accounts: { label: "Chime accounts", one: "account", hint: "Shown as suggestions when entering Account name. Entries must use a name from this list, so typos can't split an account in two." },
  offices: { label: "Offices", one: "office", hint: "Shown in the Office dropdown and in filters." },
  shifts: { label: "Shifts", one: "shift", hint: "Shown in the Shift dropdown. Shifts are ordered as created, and Shift closing uses that order to find the previous shift." },
  groups: { label: "Groups", one: "group", hint: "Shown as suggestions in the Group field." },
};

export default function ListsClient({ isAdmin }: { isAdmin: boolean }) {
  const sb = useMemo(() => createClient(), []);
  const [tab, setTab] = useState("accounts");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const L = LISTS[tab];

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb.from(tab).select("id,name,active").order(tab === "shifts" ? "id" : "name").limit(5000);
    if (error) setMsg({ ok: false, text: error.message }); else setItems((data ?? []) as Item[]);
    setLoading(false);
  }, [sb, tab]);
  useEffect(() => { setItems([]); setMsg(null); setQ(""); setText(""); load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const have = new Set(items.map((i) => i.name.toLowerCase()));
    const fresh = Array.from(new Set(text.split("\n").map((s) => s.trim()).filter(Boolean))).filter((n) => !have.has(n.toLowerCase()));
    if (fresh.length === 0) return setMsg({ ok: false, text: text.trim() ? "Those names are already in the list." : `Type or paste at least one ${L.one} name.` });
    setAdding(true);
    const { error } = await sb.from(tab).insert(fresh.map((name) => ({ name })));
    setAdding(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setText("");
    setMsg({ ok: true, text: `Added ${fresh.length} ${fresh.length === 1 ? L.one : L.one + "s"}.` });
    load();
  }

  async function toggle(i: Item) {
    const { error } = await sb.from(tab).update({ active: !i.active }).eq("id", i.id);
    if (error) return setMsg({ ok: false, text: error.message });
    setItems((p) => p.map((x) => (x.id === i.id ? { ...x, active: !x.active } : x)));
  }

  async function remove(i: Item) {
    if (!confirm(`Delete "${i.name}" from the list? Old entries keep this name. If it was used before, hiding it is safer.`)) return;
    const { error } = await sb.from(tab).delete().eq("id", i.id);
    if (error) return setMsg({ ok: false, text: error.message });
    setItems((p) => p.filter((x) => x.id !== i.id));
  }

  const shown = items.filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase()));
  const activeCount = items.filter((i) => i.active).length;

  return (
    <div className="w-full">
      <h1 className="font-display text-3xl font-bold tracking-tight">Lists</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink/60">The dropdowns used on the entry sheet. Add new names, or hide old ones so they stop appearing. Past entries are never changed.</p>
      <div className="mt-5"><Tabs id="lists" value={tab} onChange={setTab} tabs={Object.entries(LISTS).map(([id, v]) => ({ id, label: v.label }))} /></div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(300px,400px)_1fr]">
        <form onSubmit={add} className="card h-fit p-5">
          <h2 className="font-display text-lg font-bold">Add to {L.label.toLowerCase()}</h2>
          <p className="mt-1 text-xs text-ink/55">{L.hint}</p>
          <label className="lbl mt-4">One {L.one} per line</label>
          <textarea className="field min-h-[110px]" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a whole list from Google Sheets, or type one name" />
          <button className="btn-primary mt-4 w-full" disabled={adding}>{adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add</button>
          {msg && <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${msg.ok ? "bg-brand-soft text-brand-dark" : "bg-danger/10 text-danger"}`}>{msg.text}</p>}
        </form>

        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule p-4">
            <p className="tnum text-sm text-ink/65">{items.length} total · {activeCount} showing in dropdowns · {items.length - activeCount} hidden{loading && " · loading…"}</p>
            <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-2.5 h-4 w-4 text-ink/40" /><input className="field pl-9" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          </div>
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full border-collapse">
              <thead><tr><th className="th sticky top-0">Name</th><th className="th sticky top-0">Status</th><th className="th sticky top-0" /></tr></thead>
              <tbody>
                {shown.map((i) => (
                  <tr key={i.id} className="hover:bg-brand-soft/40">
                    <td className={`td font-semibold ${i.active ? "" : "text-ink/40 line-through"}`}>{i.name}</td>
                    <td className="td"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${i.active ? "bg-brand-soft text-brand-dark" : "bg-ink/10 text-ink/60"}`}>{i.active ? "Showing" : "Hidden"}</span></td>
                    <td className="td text-right">
                      <button onClick={() => toggle(i)} className="btn-ghost !px-3 !py-1.5">{i.active ? <><EyeOff className="h-4 w-4" /> Hide</> : <><Eye className="h-4 w-4" /> Show</>}</button>
                      {isAdmin && <button aria-label={`Delete ${i.name}`} onClick={() => remove(i)} className="ml-1 rounded-md p-2 text-ink/45 hover:bg-white hover:text-danger"><Trash2 className="h-4 w-4" /></button>}
                    </td>
                  </tr>
                ))}
                {!loading && shown.length === 0 && <tr><td colSpan={3} className="px-4 py-12 text-center text-sm text-ink/55">{items.length === 0 ? "Nothing here yet. Add the first one." : "No matches."}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
