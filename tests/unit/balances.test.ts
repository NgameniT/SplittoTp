import { describe, it, expect } from 'vitest';
import { computeBalances } from '../../src/domain/balances';
import type { Group, Expense, Currency } from '../../src/domain/types';

const currency: Currency = 'EUR';

const alice = { id: 'alice', name: 'Alice', email: 'alice@example.com' };
const bob = { id: 'bob', name: 'Bob', email: 'bob@example.com' };
const carol = { id: 'carol', name: 'Carol', email: 'carol@example.com' };

const group: Group = {
  id: 'group-1',
  name: 'Les amis',
  currency,
  members: [alice, bob, carol],
};

function createExpense(overrides: Partial<Expense>): Expense {
  return {
    id: overrides.id ?? 'exp-1',
    groupId: overrides.groupId ?? group.id,
    description: overrides.description ?? 'Dépense',
    amount: overrides.amount ?? 0,
    currency: overrides.currency ?? currency,
    paidBy: overrides.paidBy ?? alice.id,
    paidAt: overrides.paidAt ?? new Date('2026-05-09T12:00:00Z'),
    split: overrides.split ?? { mode: 'equal', beneficiaries: [alice.id, bob.id, carol.id] },
    createdAt: overrides.createdAt ?? new Date('2026-05-09T12:00:00Z'),
    category: overrides.category,
  };
}

describe('computeBalances', () => {
  it('returns zero balances for an empty group', () => {
    const emptyGroup: Group = { id: 'g-empty', name: 'Vide', currency, members: [] };
    const balances = computeBalances(emptyGroup, []);
    expect(balances).toEqual({});
  });

  it('calculates equal split when the payer is also a beneficiary', () => {
    const expense = createExpense({
      amount: 90,
      paidBy: alice.id,
      split: { mode: 'equal', beneficiaries: [alice.id, bob.id, carol.id] },
    });

    const balances = computeBalances(group, [expense]);

    expect(balances).toEqual({
      alice: 60,
      bob: -30,
      carol: -30,
    });
  });

  it('calculates equal split when the payer is not a beneficiary', () => {
    const expense = createExpense({
      amount: 90,
      paidBy: alice.id,
      split: { mode: 'equal', beneficiaries: [bob.id, carol.id] },
    });

    const balances = computeBalances(group, [expense]);

    expect(balances).toEqual({
      alice: 90,
      bob: -45,
      carol: -45,
    });
  });

  it('accumulates multiple expenses that partially compensate', () => {
    const expenses: Expense[] = [
      createExpense({
        id: 'exp-1',
        amount: 60,
        paidBy: alice.id,
        split: { mode: 'equal', beneficiaries: [alice.id, bob.id, carol.id] },
      }),
      createExpense({
        id: 'exp-2',
        amount: 40,
        paidBy: bob.id,
        split: { mode: 'equal', beneficiaries: [alice.id, bob.id] },
      }),
    ];

    const balances = computeBalances(group, expenses);

    expect(balances).toEqual({
      alice: 20,
      bob: 0,
      carol: -20,
    });
  });

  it('calculates weighted split with non-uniform weights', () => {
    const expense = createExpense({
      amount: 120,
      paidBy: bob.id,
      split: { mode: 'weighted', weights: { alice: 1, bob: 1, carol: 2 } },
    });

    const balances = computeBalances(group, [expense]);

    expect(balances).toEqual({
      alice: -30,
      bob: 90,
      carol: -60,
    });
  });

  it('handles percentage split with rounding', () => {
    const expense = createExpense({
      amount: 100,
      paidBy: carol.id,
      split: { mode: 'percentage', percentages: { alice: 33, bob: 33, carol: 34 } },
    });

    const balances = computeBalances(group, [expense]);

    expect(balances).toEqual({
      alice: -33.00,
      bob: -33.00,
      carol: 66.00,
    });
  });

  it('keeps a deleted member from a historic expense in the balances output', () => {
    const oldMemberId = 'old-member';
    const expense = createExpense({
      amount: 50,
      paidBy: alice.id,
      split: { mode: 'equal', beneficiaries: [alice.id, oldMemberId] },
    });

    const balances = computeBalances(group, [expense]);

    expect(balances).toEqual({
      alice: 25,
      bob: 0,
      carol: 0,
      [oldMemberId]: -25,
    });
  });

  it('allows a zero-amount expense', () => {
    const expense = createExpense({
      amount: 0,
      paidBy: alice.id,
      split: { mode: 'equal', beneficiaries: [alice.id, bob.id, carol.id] },
    });

    const balances = computeBalances(group, [expense]);

    expect(balances).toEqual({ alice: 0, bob: 0, carol: 0 });
  });

  it('distributes remainder to the last beneficiary on non-divisible amounts', () => {
    // 10€ / 3 = 3.33 + 3.33 + 3.34 (remainder +0.01 goes to last)
    const expense = createExpense({
      amount: 10,
      paidBy: alice.id,
      split: { mode: 'equal', beneficiaries: [alice.id, bob.id, carol.id] },
    });

    const balances = computeBalances(group, [expense]);

    expect(balances.alice).toBe(6.67);   // 10 - 3.33
    expect(balances.bob).toBe(-3.33);
    expect(balances.carol).toBe(-3.34);  // gets the +0.01 remainder
    expect(balances.alice + balances.bob + balances.carol).toBeCloseTo(0);
  });

  it('returns full amount to payer when equal split has no beneficiaries', () => {
    const expense = createExpense({
      amount: 50,
      paidBy: alice.id,
      split: { mode: 'equal', beneficiaries: [] },
    });

    const balances = computeBalances(group, [expense]);

    expect(balances).toEqual({ alice: 50, bob: 0, carol: 0 });
  });

  it('returns full amount to payer when all weighted shares are zero', () => {
    const expense = createExpense({
      amount: 100,
      paidBy: alice.id,
      split: { mode: 'weighted', weights: { alice: 0, bob: 0, carol: 0 } },
    });

    const balances = computeBalances(group, [expense]);

    expect(balances).toEqual({ alice: 100, bob: 0, carol: 0 });
  });

  it('tracks a beneficiary from weighted split who is not in group members', () => {
    const outsider = 'outsider';
    const expense = createExpense({
      amount: 100,
      paidBy: alice.id,
      split: { mode: 'weighted', weights: { [alice.id]: 1, [outsider]: 1 } },
    });

    const balances = computeBalances(group, [expense]);

    expect(balances[outsider]).toBe(-50);
    expect(balances.alice).toBe(50);
  });

  it('tracks a beneficiary from percentage split who is not in group members', () => {
    const outsider = 'outsider';
    const expense = createExpense({
      amount: 100,
      paidBy: alice.id,
      split: { mode: 'percentage', percentages: { [alice.id]: 60, [outsider]: 40 } },
    });

    const balances = computeBalances(group, [expense]);

    expect(balances[outsider]).toBe(-40);
    expect(balances.alice).toBe(40); // +100 - 60
  });
});
