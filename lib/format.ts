const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

export function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function monthStartISO(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

/** "$1,234.50", "-$159.22", "(20)", "20" -> number | null */
export function parseAmount(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const neg = s.includes("-") || /^\(.*\)$/.test(s);
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  if (Number.isNaN(n)) return null;
  return Math.round((neg ? -n : n) * 100) / 100;
}

/** "31-Oct-2026", "2026-10-31", "10/31/2026" -> "2026-10-31" | null */
export function parseDate(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})[-\/ ]([A-Za-z]{3,})[-\/ ,]*(\d{4})$/);
  if (m) {
    const i = MON.findIndex((x) => x.toLowerCase() === m![2].slice(0, 3).toLowerCase());
    return i < 0 ? null : `${m[3]}-${pad(i + 1)}-${pad(+m[1])}`;
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${pad(+m[1])}-${pad(+m[2])}`;
  return null;
}

export function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}-${MON[m - 1]}-${y}`;
}

export function fmtMoney(n: number) {
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? "-" : ""}$${s}`;
}
