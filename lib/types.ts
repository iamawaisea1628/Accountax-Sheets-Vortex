export type Role = "admin" | "manager" | "service";
export type Profile = { id: string; full_name: string; email: string | null; role: Role; service_id: number | null };
export type EntryType = "main" | "service";

export type Entry = {
  id: number;
  entry_date: string;
  entry_type: EntryType;
  account_name: string;
  customer_name: string | null;
  amount: number;
  status: string;
  office: string | null;
  shift: string | null;
  manager_id: string | null;
  manager_name: string | null;
  grp: string | null;
  remarks: string | null;
};

// Edit this list any time to change the Status dropdown.
export const STATUSES = [
  "Deposit", "Redeem", "Opening", "Withdraw", "Transfer In", "Transfer Out",
  "Ads", "Other Transaction", "Written Off", "Outdoor In", "Outdoor Out",
];

export type ServiceStat = {
  service_id: number; name: string; office: string; commission_type: "percent" | "fixed" | "none"; commission_value: number;
  deposit_count: number; deposits: number; redeems: number; commission: number; withdrawn: number; available: number;
};
export type Submission = {
  id: number; service_id: number; image_path: string; amount: number | null; customer_name: string | null; note: string | null;
  status: "pending" | "entered" | "rejected"; staff_note: string | null; handled_name: string | null; handled_at: string | null;
  created_at: string; services?: { name: string } | null;
};
export type Withdrawal = {
  id: number; service_id: number; amount: number; details: string | null; status: "pending" | "approved" | "paid" | "rejected";
  staff_note: string | null; handled_name: string | null; handled_at: string | null; created_at: string; services?: { name: string } | null;
};
export const ruleText = (t: string, v: number) =>
  t === "percent" ? `${v}% of deposits` : t === "fixed" ? `$${v} per deposit` : "No commission";
