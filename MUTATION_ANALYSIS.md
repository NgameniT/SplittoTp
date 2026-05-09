# Mutation Analysis — Splitto TP

## Scores

| Run | balances.ts | simplify.ts | Global |
|-----|------------|-------------|--------|
| Initial (after ex. 1 & 2 tests) | 73% | 54% | 63.38% |
| Final (after targeted tests) | 85.88% | 75.44% | **81.69%** |

## Changes made to reach the target

### balances.test.ts
- Added 5 new tests to cover edge cases left unaddressed:
  - Non-divisible equal split (kills remainder arithmetic mutant)
  - Empty beneficiaries list (kills `return []` array mutant via `toEqual`)
  - All-zero weighted shares (kills `map([id] => [])` array mutant via `toEqual`)
  - Outsider member in weighted split (kills block statement removal mutants)
  - Outsider member in percentage split (idem)

- Changed two tests from `.toBe(x)` per-property to `.toEqual({...})` exact-match. This is critical: the survived `ArrayDeclaration` mutants produce extra keys (e.g. `S: NaN` or `undefined: NaN`) that `.toBe()` ignores but `.toEqual()` catches.

### simplify.test.ts
- Added 5 new tests, two of which specifically target the `BlockStatement` surviving mutants:
  - `{ a: 30, b: 10, c: -25, d: -15 }` — kills the mutant that drops `creditors[i][1] = nextCreditorAmount`. Without the update, debtor D pays 15 to creditor A instead of 5, and creditor B is never reached.
  - `{ a: 7, b: 5, c: -10, d: -2 }` — kills the mutant that drops `debtors[i][1] = nextDebtorAmount`. Without the update, debtor C pays 5 to creditor B instead of 3, leaving debtor D unable to settle.

## Surviving mutants — analysis

### Equivalent mutants (cannot be killed without changing the implementation)

**`simplify.ts` — filter predicates**
```
.filter(([, amount]) => amount > 0)  →  amount >= 0  /  true
.filter(([, amount]) => amount < 0)  →  amount <= 0  /  true
```
These survive because the `if (amount <= 0) { break; }` guard inside the loop already handles zero-balance entries: if a zero-balance "creditor" is included, `Math.min(0, -debtorAmount) = 0` triggers the break immediately, producing the same result. Writing a test that distinguishes these is impossible without exposing internal state.

**`simplify.ts` — while loop boundary conditions**
```
while (creditorIndex < creditors.length && debtorIndex < debtors.length)
  →  creditorIndex <= ...  /  debtorIndex <= ...  /  ||  /  true &&  /  && true
```
Since the sum of all credits equals the sum of all debts (a valid balance), both `creditorIndex` and `debtorIndex` always reach their respective lengths at the same step. All these mutants produce the same loop termination. Equivalent.

**`simplify.ts` — `if (amount <= 0)` guard**
```
if (amount <= 0) { break; }  →  if (false)  /  if (amount < 0)
```
`amount = Math.min(creditorAmount, -debtorAmount)`. After correct filtering, `creditorAmount > 0` and `-debtorAmount > 0`, so `amount > 0` always. The guard is defensive code that is unreachable when balances are consistent. Equivalent.

**`balances.ts` — `if (entries.length === 0)` in `allocateShares` (lines 15–16, NoCoverage)**
This guard inside `allocateShares` is never reached because every caller already guards for empty entries before calling it. Dead code: unreachable in any valid call path.

**`balances.ts` — `totalPercentage` variable (line 53)**
```
const totalPercentage = entries.reduce((sum, [, p]) => sum + p, 0);
```
`totalPercentage` is computed but never used (the code divides by 100 directly). Any mutation to this expression is equivalent because the variable's value has no effect. This is a dead-code smell in the source.

**`balances.ts` — `if (beneficiaries.length === 0)` ConditionalExpression + BlockStatement**
With `if (false)`, the code falls through to `1 / 0 = Infinity`, then `[].map(...) = []`, then `allocateShares(amount, []) = []` (guarded at line 15). The result is identical. Equivalent.

**`balances.ts` — `if (entries.length === 0)` in percentage branch (line 54)**
Same reasoning: if `percentages = {}`, `allocateShares(amount, []) = []` with or without the guard. Equivalent.
