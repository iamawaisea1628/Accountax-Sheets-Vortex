import type { Entry } from "./types";

export type Sums = {
  opening: number; deposit: number; redeem: number; depositService: number; redeemService: number;
  withdraw: number; transfer: number; ads: number; other: number; unconfirmed: number;
  forfeited: number; outdoorIn: number; outdoorOut: number;
};

export const emptySums = (): Sums => ({
  opening: 0, deposit: 0, redeem: 0, depositService: 0, redeemService: 0, withdraw: 0, transfer: 0,
  ads: 0, other: 0, unconfirmed: 0, forfeited: 0, outdoorIn: 0, outdoorOut: 0,
});

export const r2 = (n: number) => Math.round(n * 100) / 100;

/** Adds one entry row into an account's totals (same rules as the Closing sheet). */
export function addEntry(s: Sums, e: Pick<Entry, "entry_type" | "status" | "amount" | "office">) {
  const a = Number(e.amount);
  const main = e.entry_type === "main";
  switch (e.status) {
    case "Opening": if (main) s.opening += a; break;
    case "Deposit": if (main) s.deposit += a; else s.depositService += a; break;
    case "Redeem": if (main) s.redeem += a; else s.redeemService += a; break;
    case "Withdraw": s.withdraw += a; break;
    case "Written Off": s.forfeited += a; break;
    case "Transfer In": s.transfer += a; break;
    case "Transfer Out": s.transfer -= a; break;
    case "Ads": s.ads += a; break;
    case "Other": s.other += a; break;
    case "Outdoor In": s.outdoorIn += a; break;
    case "Outdoor Out": s.outdoorOut += a; break;
  }
  if (!main && e.office === "Unconfirmed") s.unconfirmed += a;
}

/** Balance = movement for the shift. Same formula as the Closing sheet. */
export const balanceOf = (s: Sums) =>
  r2(
    s.opening + s.deposit + s.transfer + s.outdoorIn - s.outdoorOut - s.redeem - s.withdraw - s.forfeited -
      s.ads + s.depositService - s.redeemService - s.other - s.unconfirmed
  );

/** Difference = Closing - (last closing + Balance). Zero means the books agree. */
export const differenceOf = (closing: number, prev: number, balance: number) => r2(closing - (prev + balance));
