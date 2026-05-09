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
});
