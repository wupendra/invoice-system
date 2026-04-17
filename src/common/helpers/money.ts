export function money(n: number): string {
  // half-up rounding to 2dp
  const cents = Math.round((n + Number.EPSILON) * 100);
  return (cents / 100).toFixed(2);
}

export function computeLineTotal(unitCost: string, quantity: string): string {
  return money(Number(unitCost) * Number(quantity));
}

export interface ItemLike { unitCost: string; quantity: string }

export function computeTotals(items: ItemLike[], vatRate: string) {
  const subtotalNum = items.reduce(
    (acc, it) => acc + Number(it.unitCost) * Number(it.quantity),
    0,
  );
  const subtotal = money(subtotalNum);
  const vatAmount = money(subtotalNum * (Number(vatRate) / 100));
  const grandTotal = money(Number(subtotal) + Number(vatAmount));
  return { subtotal, vatAmount, grandTotal };
}
