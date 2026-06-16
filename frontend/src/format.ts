// Amounts are stored as whole IDR (no minor units), so format as plain integers
// with a currency suffix rather than Intl currency (which would add decimals).
export function formatIdr(amount: number): string {
  return `${amount.toLocaleString('id-ID')} IDR`;
}
