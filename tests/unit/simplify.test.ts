import { describe, it, expect } from 'vitest';
import { simplifyDebts } from '../../src/domain/simplify';

describe('simplifyDebts', () => {
  it('simplifies a two-person balance', () => {
    const balances = { a: 10, b: -10 };

    const settlements = simplifyDebts(balances);

    expect(settlements).toEqual([
      { from: 'b', to: 'a', amount: 10 },
    ]);
  });

  it('simplifies a three-person triangle debt into one settlement', () => {
    const balances = { a: 10, b: 0, c: -10 };

    const settlements = simplifyDebts(balances);

    expect(settlements).toEqual([
      { from: 'c', to: 'a', amount: 10 },
    ]);
  });

  it('simplifies a four-person debt with a minimum number of settlements', () => {
    const balances = { a: 30, b: -20, c: -10, d: 0 };

    const settlements = simplifyDebts(balances);

    expect(settlements).toEqual([
      { from: 'b', to: 'a', amount: 20 },
      { from: 'c', to: 'a', amount: 10 },
    ]);
  });

  it('returns empty array when all balances are zero', () => {
    const settlements = simplifyDebts({ a: 0, b: 0, c: 0 });
    expect(settlements).toEqual([]);
  });

  it('splits one debtor across multiple creditors (largest creditor first)', () => {
    // creditors sorted descending: a:20, b:10; c owes 30
    const balances = { a: 20, b: 10, c: -30 };

    const settlements = simplifyDebts(balances);

    expect(settlements).toEqual([
      { from: 'c', to: 'a', amount: 20 },
      { from: 'c', to: 'b', amount: 10 },
    ]);
  });

  it('splits multiple debtors to one creditor (largest debtor first)', () => {
    // debtors sorted ascending: c:-25, b:-15
    const balances = { a: 40, b: -15, c: -25 };

    const settlements = simplifyDebts(balances);

    expect(settlements).toEqual([
      { from: 'c', to: 'a', amount: 25 },
      { from: 'b', to: 'a', amount: 15 },
    ]);
  });

  it('handles cross-settlement where one debtor partially satisfies two creditors', () => {
    // creditors: [b:10, a:5]; debtor c:-15
    const balances = { a: 5, b: 10, c: -15 };

    const settlements = simplifyDebts(balances);

    expect(settlements).toEqual([
      { from: 'c', to: 'b', amount: 10 },
      { from: 'c', to: 'a', amount: 5 },
    ]);
  });

  it('correctly tracks partial creditor remainder across multiple debtors', () => {
    // creditors [a:30, b:10]; debtors [c:-25, d:-15]
    // c pays 25 to a (a has 5 left); d pays 5 to a then 10 to b
    const balances = { a: 30, b: 10, c: -25, d: -15 };

    const settlements = simplifyDebts(balances);

    expect(settlements).toEqual([
      { from: 'c', to: 'a', amount: 25 },
      { from: 'd', to: 'a', amount: 5 },
      { from: 'd', to: 'b', amount: 10 },
    ]);
  });

  it('correctly tracks partial debtor remainder across multiple creditors', () => {
    // creditors [a:7, b:5]; debtor c:-10 then d:-2
    // c pays 7 to a then 3 to b; d pays remaining 2 to b
    const balances = { a: 7, b: 5, c: -10, d: -2 };

    const settlements = simplifyDebts(balances);

    expect(settlements).toEqual([
      { from: 'c', to: 'a', amount: 7 },
      { from: 'c', to: 'b', amount: 3 },
      { from: 'd', to: 'b', amount: 2 },
    ]);
  });
});
