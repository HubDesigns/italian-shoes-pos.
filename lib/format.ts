/** Rupee amount for display, e.g. "Rs 5,500". Display only; never used for arithmetic. */
export function formatPKR(value: string | number) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return "Rs " + amount.toLocaleString("en-PK", { maximumFractionDigits: 2 });
}
