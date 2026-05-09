// src/domain/simplify.ts — simplification des dettes
//
// EXERCICE 2 — À COMPLÉTER EN TDD STRICT
//
// Spec : voir SUJET.md, exercice 2
//
// Le but : transformer un dictionnaire de soldes en LISTE MINIMALE
// de règlements pour solder le groupe.

import type { Balances, Settlement } from './types';

const roundCents = (value: number): number => Math.round(value * 100) / 100;

function sortCreditors(balances: Array<[string, number]>): Array<[string, number]> {
  return balances
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]);
}

function sortDebtors(balances: Array<[string, number]>): Array<[string, number]> {
  return balances
    .filter(([, amount]) => amount < 0)
    .sort((a, b) => a[1] - b[1]);
}

export function simplifyDebts(balances: Balances): Settlement[] {
  const entries = Object.entries(balances).map(([memberId, amount]) => [memberId, roundCents(amount)] as [string, number]);
  const creditors = sortCreditors(entries);
  const debtors = sortDebtors(entries);
  const settlements: Settlement[] = [];

  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const [creditorId, creditorAmount] = creditors[creditorIndex];
    const [debtorId, debtorAmount] = debtors[debtorIndex];

    const amount = roundCents(Math.min(creditorAmount, -debtorAmount));
    if (amount <= 0) {
      break;
    }

    settlements.push({ from: debtorId, to: creditorId, amount });

    const nextCreditorAmount = roundCents(creditorAmount - amount);
    const nextDebtorAmount = roundCents(debtorAmount + amount);

    if (nextCreditorAmount === 0) {
      creditorIndex += 1;
    } else {
      creditors[creditorIndex][1] = nextCreditorAmount;
    }

    if (nextDebtorAmount === 0) {
      debtorIndex += 1;
    } else {
      debtors[debtorIndex][1] = nextDebtorAmount;
    }
  }

  return settlements;
}
