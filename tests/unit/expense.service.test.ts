import { describe, it, expect } from 'vitest';
import { ExpenseService } from '../../src/domain/expense.service';
import type { Expense, CreateExpenseInput } from '../../src/domain/types';
import type { ExpenseRepository } from '../../src/ports/expense.repository';
import type { EmailNotifier } from '../../src/ports/notifier';
import type { Clock } from '../../src/ports/clock';
import type { IdGenerator } from '../../src/ports/id-generator';
import type { Logger } from '../../src/ports/logger';

// ─── DUMMY ──────────────────────────────────────
// Logger passé au service mais non utilisé dans ces tests.
const dummyLogger: Logger = {
  info: () => {},
  error: () => {},
};

// ─── STUB ───────────────────────────────────────
// Retourne une date fixe pour rendre la création déterministe.
const stubClock: Clock = {
  now: () => new Date('2026-05-09T12:00:00Z'),
};

// ─── MOCK ───────────────────────────────────────
// Implémentation simple qui vérifie que next() est appelée exactement une fois.
class MockIdGenerator implements IdGenerator {
  calls = 0;

  next(): string {
    this.calls += 1;
    return 'expense-123';
  }

  verify() {
    expect(this.calls).toBe(1);
  }
}

// ─── SPY ──────────────────────────────────────
// Enregistre les appels pour vérification ultérieure.
class SpyEmailNotifier implements EmailNotifier {
  calls: Array<{ groupId: string; message: string }> = [];

  async notifyGroupMembers(groupId: string, message: string): Promise<void> {
    this.calls.push({ groupId, message });
  }
}

// ─── FAKE ───────────────────────────────────────
// Repository en mémoire qui stocke les expenses et permet de les retrouver.
class FakeExpenseRepository implements ExpenseRepository {
  public savedExpenses: Expense[] = [];

  async save(expense: Expense): Promise<void> {
    this.savedExpenses.push(expense);
  }

  async findById(id: string): Promise<Expense | null> {
    return this.savedExpenses.find(expense => expense.id === id) ?? null;
  }

  async findByGroupId(groupId: string): Promise<Expense[]> {
    return this.savedExpenses.filter(expense => expense.groupId === groupId);
  }

  async findInDateRange(groupId: string, from: Date, to: Date): Promise<Expense[]> {
    return this.savedExpenses.filter(
      expense =>
        expense.groupId === groupId &&
        expense.paidAt >= from &&
        expense.paidAt <= to,
    );
  }
}

describe('ExpenseService.create', () => {
  it('returns the created expense, saves it, and notifies members for large expenses', async () => {
    const fakeRepo = new FakeExpenseRepository();
    const spyNotifier = new SpyEmailNotifier();
    const mockIdGen = new MockIdGenerator();

    const service = new ExpenseService(
      fakeRepo,
      spyNotifier,
      stubClock,
      mockIdGen,
      dummyLogger,
    );

    const input: CreateExpenseInput = {
      groupId: 'group-1',
      description: 'Dîner de groupe',
      amount: 150,
      currency: 'EUR',
      paidBy: 'alice',
      paidAt: new Date('2026-05-09T18:00:00Z'),
      split: {
        mode: 'equal',
        beneficiaries: ['alice', 'bob'],
      },
    };

    const expense = await service.create(input);

    expect(expense).toEqual({
      id: 'expense-123',
      createdAt: new Date('2026-05-09T12:00:00Z'),
      ...input,
    });

    expect(fakeRepo.savedExpenses).toHaveLength(1);
    expect(fakeRepo.savedExpenses[0]).toEqual(expense);

    expect(spyNotifier.calls).toEqual([
      {
        groupId: 'group-1',
        message: 'Nouvelle dépense importante : Dîner de groupe (150€)',
      },
    ]);

    mockIdGen.verify();
  });

  it('does not notify members for a small expense but still saves it', async () => {
    const fakeRepo = new FakeExpenseRepository();
    const spyNotifier = new SpyEmailNotifier();
    const mockIdGen = new MockIdGenerator();

    const service = new ExpenseService(
      fakeRepo,
      spyNotifier,
      stubClock,
      mockIdGen,
      dummyLogger,
    );

    const input: CreateExpenseInput = {
      groupId: 'group-2',
      description: 'Café',
      amount: 10,
      currency: 'EUR',
      paidBy: 'bob',
      paidAt: new Date('2026-05-09T09:00:00Z'),
      split: {
        mode: 'equal',
        beneficiaries: ['bob'],
      },
    };

    const expense = await service.create(input);

    expect(expense).toEqual({
      id: 'expense-123',
      createdAt: new Date('2026-05-09T12:00:00Z'),
      ...input,
    });

    expect(fakeRepo.savedExpenses).toHaveLength(1);
    expect(fakeRepo.savedExpenses[0]).toEqual(expense);
    expect(spyNotifier.calls).toEqual([]);

    mockIdGen.verify();
  });
});
