// src/domain/balances.ts — calcul des soldes d'un groupe
//
// EXERCICE 1 — À COMPLÉTER
//
// Spec : voir SUJET.md, exercice 1
//
// Cette fonction est PURE : pas d'effets de bord, pas d'I/O.
// Elle prend un groupe et ses dépenses, retourne les soldes.

import type { Group, Expense, Balances, ExpenseSplit } from './types';

const roundCents = (value: number): number => Math.round(value * 100) / 100;

function allocateShares(amount: number, entries: Array<[string, number]>): Array<[string, number]> {
  if (entries.length === 0) {
    return [];
  }

  const rawShares = entries.map(([id, ratio]) => [id, amount * ratio] as const);
  const roundedShares = rawShares.map(([id, raw]) => [id, roundCents(raw)] as const);
  const sumRounded = roundedShares.reduce((sum, [, share]) => sum + share, 0);
  const remainder = roundCents(amount - sumRounded);

  const result = roundedShares.map(([id, share]) => [id, share] as [string, number]);
  const lastIndex = result.length - 1;
  result[lastIndex] = [result[lastIndex][0], roundCents(result[lastIndex][1] + remainder)];

  return result;
}

function buildShares(amount: number, split: ExpenseSplit): Array<[string, number]> {
  switch (split.mode) {
    case 'equal': {
      const beneficiaries = split.beneficiaries;
      if (beneficiaries.length === 0) {
        return [];
      }
      const equalRatio = 1 / beneficiaries.length;
      return allocateShares(amount, beneficiaries.map(id => [id, equalRatio]));
    }

    case 'weighted': {
      const entries = Object.entries(split.weights);
      const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
      if (totalWeight === 0) {
        return entries.map(([id]) => [id, 0]);
      }
      return allocateShares(amount, entries.map(([id, weight]) => [id, weight / totalWeight]));
    }

    case 'percentage': {
      const entries = Object.entries(split.percentages);
      const totalPercentage = entries.reduce((sum, [, percentage]) => sum + percentage, 0);
      if (entries.length === 0) {
        return [];
      }
      return allocateShares(
        amount,
        entries.map(([id, percentage]) => [id, percentage / 100]),
      );
    }

    default:
      return [];
  }
}

export function computeBalances(group: Group, expenses: Expense[]): Balances {
  const balances: Balances = {};
  const allMemberIds = new Set<string>(group.members.map(member => member.id));

  for (const expense of expenses) {
    allMemberIds.add(expense.paidBy);
    if (expense.split.mode === 'equal') {
      for (const beneficiary of expense.split.beneficiaries) {
        allMemberIds.add(beneficiary);
      }
    }
    if (expense.split.mode === 'weighted') {
      for (const beneficiary of Object.keys(expense.split.weights)) {
        allMemberIds.add(beneficiary);
      }
    }
    if (expense.split.mode === 'percentage') {
      for (const beneficiary of Object.keys(expense.split.percentages)) {
        allMemberIds.add(beneficiary);
      }
    }
  }

  for (const memberId of allMemberIds) {
    balances[memberId] = 0;
  }

  for (const expense of expenses) {
    balances[expense.paidBy] = roundCents(balances[expense.paidBy] + expense.amount);

    const shares = buildShares(expense.amount, expense.split);
    for (const [beneficiaryId, share] of shares) {
      balances[beneficiaryId] = roundCents(balances[beneficiaryId] - share);
    }
  }

  return balances;
}
