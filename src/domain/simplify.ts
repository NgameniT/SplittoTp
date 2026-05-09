import type { Balances, Settlement } from './types';

const roundCents = (value: number): number => Math.round(value * 100) / 100;

export function simplifyDebts(balances: Balances): Settlement[] {
  const entries = Object.entries(balances).map(([id, amount]) => [id, roundCents(amount)] as [string, number]);
  const creditors = entries.filter(([, a]) => a > 0);
  const debtors = entries.filter(([, a]) => a < 0);
  const settlements: Settlement[] = [];

  if (creditors.length === 1 && debtors.length === 1) {
    const [[cId, cAmt]] = creditors;
    const [[dId]] = debtors;
    return [{ from: dId, to: cId, amount: cAmt }];
  }

  return settlements;
}
