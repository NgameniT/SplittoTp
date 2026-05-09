import type { Balances, Settlement } from './types';

const roundCents = (value: number): number => Math.round(value * 100) / 100;

export function simplifyDebts(balances: Balances): Settlement[] {
  const entries = Object.entries(balances).map(([id, amount]) => [id, roundCents(amount)] as [string, number]);
  const creditors = entries.filter(([, a]) => a > 0).sort((a, b) => b[1] - a[1]);
  const debtors = entries.filter(([, a]) => a < 0).sort((a, b) => a[1] - b[1]);
  const settlements: Settlement[] = [];

  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const [cId, cAmt] = creditors[ci];
    const [dId, dAmt] = debtors[di];
    const amount = roundCents(Math.min(cAmt, -dAmt));
    if (amount <= 0) break;
    settlements.push({ from: dId, to: cId, amount });
    const nc = roundCents(cAmt - amount);
    const nd = roundCents(dAmt + amount);
    if (nc === 0) { ci++; } else { creditors[ci][1] = nc; }
    if (nd === 0) { di++; } else { debtors[di][1] = nd; }
  }

  return settlements;
}
