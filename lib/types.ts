export type Role = "admin" | "manager";
export type Profile = { id: string; full_name: string; email: string | null; role: Role };
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
export const STATUSES = ["Deposit", "Redeem", "Opening", "Unconfirmed", "Forfeited Funds", "Overpayment"];
