/** INR formatting helper - all amounts in the demo are whole rupees. */

const formatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatINR(amount: number): string {
  return formatter.format(Math.round(amount));
}

/** e.g. 0 -> "Out of stock", 4 -> "Only 4 left", 20 -> "In stock" */
export function stockLabel(stock: number): { label: string; kind: 'out' | 'low' | 'in' } {
  // Stock can only go negative if an order slipped through in buggy mode.
  // The storefront shows a neutral label; the presenter panel reveals the real
  // number in the self-check results.
  if (stock <= 0) return { label: 'Out of stock', kind: 'out' };
  if (stock < 6) return { label: `Only ${stock} left`, kind: 'low' };
  return { label: 'In stock', kind: 'in' };
}