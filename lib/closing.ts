import type { Entry } from "./types";

export type Sums = {
  opening: number; deposit: number; redeem: number; depositService: number; redeemService: number;
  withdraw: number; transfer: number; ads: number; other: number; unconfirmed: number;
  writtenOff: number; outdoorIn: number; outdoorOut: number;
};

export const emptySums = (): Sums => ({
  opening: 0, deposit: 0, redeem: 0, depositService: 0, redeemService: 0, withdraw: 0, transfer: 0,
  ads: 0, other: 0, unconfirmed: 0, writtenOff: 0, outdoorIn: 0, outdoorOut: 0,
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
    case "Transfer In": s.transfer += a; break;
    case "Transfer Out": s.transfer -= a; break;
    case "Ads": s.ads += a; break;
    case "Other Transaction": case "Other": s.other += a; break;
    case "Written Off": s.writtenOff += a; break;
    case "Outdoor In": s.outdoorIn += a; break;
    case "Outdoor Out": s.outdoorOut += a; break;
  }
  if (!main && e.office === "Unconfirmed") s.unconfirmed += a;
}

/** Closing Balance: Opening + Deposit + Transfer + Outdoor In - Outdoor Out - Redeem - Withdraw - Ads
 *  + Deposit-Service - Redeem-Service - Other Transaction - Unconfirmed - Written Off */
export const balanceOf = (s: Sums) =>
  r2(
    s.opening + s.deposit + s.transfer + s.outdoorIn - s.outdoorOut - s.redeem - s.withdraw -
      s.ads + s.depositService - s.redeemService - s.other - s.unconfirmed - s.writtenOff
  );

/** Summary-Month Balance: same, but without Unconfirmed (that sheet has no such column). `opening` is the full Opening figure. */
export const summaryBalanceOf = (s: Sums, opening: number) =>
  r2(
    opening + s.deposit + s.transfer + s.outdoorIn - s.outdoorOut - s.redeem - s.withdraw -
      s.ads + s.depositService - s.redeemService - s.other - s.writtenOff
  );

/** Closing sheet Difference = Closing - (Opening + Balance). Zero means the books agree. */
export const differenceOf = (closing: number, prev: number, balance: number) => r2(closing - (prev + balance));
