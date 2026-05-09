import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { PgExpenseRepository } from '../../src/infrastructure/pg-expense.repository';
import type { Expense } from '../../src/domain/types';

const __dirname = dirname(fileURLToPath(import.meta.url));

const groupIdA = 'group-1';
const groupIdB = 'group-2';
const aliceId = 'alice';
const bobId = 'bob';

let container: PostgreSqlContainer;
let pool: Pool;
let repository: PgExpenseRepository;

async function insertGroupAndMembers(groupId: string, memberIds: string[]) {
  await pool.query('INSERT INTO groups (id, name, currency) VALUES ($1, $2, $3)', [groupId, `Groupe ${groupId}`, 'EUR']);
  for (const memberId of memberIds) {
    await pool.query(
      'INSERT INTO members (id, group_id, name, email) VALUES ($1, $2, $3, $4)',
      [memberId, groupId, `Membre ${memberId}`, `${memberId}@example.com`],
    );
  }
}

async function countExpenses(): Promise<number> {
  const result = await pool.query('SELECT COUNT(*) FROM expenses');
  return Number(result.rows[0].count);
}

describe('PgExpenseRepository integration', () => {
  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('splitto')
      .withUsername('test')
      .withPassword('test')
      .start();

    pool = new Pool({
      host: container.getHost(),
      port: container.getPort(),
      user: 'test',
      password: 'test',
      database: 'splitto',
    });

    const migration = await readFile(join(__dirname, '../../migrations/001-initial.sql'), 'utf8');
    await pool.query(migration);
    repository = new PgExpenseRepository(pool);
  }, 120_000);

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
    if (container) {
      await container.stop();
    }
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE expenses CASCADE');
    await pool.query('TRUNCATE members CASCADE');
    await pool.query('TRUNCATE groups CASCADE');
  });

  it('saves an expense and finds it by id', async () => {
    await insertGroupAndMembers(groupIdA, [aliceId, bobId]);

    const expense: Expense = {
      id: 'exp-1',
      groupId: groupIdA,
      description: 'Gâteau',
      amount: 25.5,
      currency: 'EUR',
      paidBy: aliceId,
      paidAt: new Date('2026-05-09T10:00:00Z'),
      split: { mode: 'equal', beneficiaries: [aliceId, bobId] },
      createdAt: new Date('2026-05-09T10:01:00Z'),
    };

    await repository.save(expense);

    const found = await repository.findById(expense.id);
    expect(found).toEqual(expense);
  });

  it('finds expenses only for the requested group', async () => {
    await insertGroupAndMembers(groupIdA, [aliceId, bobId]);
    await insertGroupAndMembers(groupIdB, ['bob-group-2']);

    const expenseA: Expense = {
      id: 'exp-a',
      groupId: groupIdA,
      description: 'Pizza',
      amount: 30,
      currency: 'EUR',
      paidBy: aliceId,
      paidAt: new Date('2026-05-09T11:00:00Z'),
      split: { mode: 'equal', beneficiaries: [aliceId, bobId] },
      createdAt: new Date('2026-05-09T11:00:00Z'),
    };
    const expenseB: Expense = {
      id: 'exp-b',
      groupId: groupIdB,
      description: 'Café',
      amount: 5,
      currency: 'EUR',
      paidBy: 'bob-group-2',
      paidAt: new Date('2026-05-09T12:00:00Z'),
      split: { mode: 'equal', beneficiaries: ['bob-group-2'] },
      createdAt: new Date('2026-05-09T12:00:00Z'),
    };

    await repository.save(expenseA);
    await repository.save(expenseB);

    const groupAExpenses = await repository.findByGroupId(groupIdA);
    expect(groupAExpenses).toEqual([expenseA]);
  });

  it('finds expenses in an inclusive date range', async () => {
    await insertGroupAndMembers(groupIdA, [aliceId, bobId]);

    const expenseStart: Expense = {
      id: 'exp-start',
      groupId: groupIdA,
      description: 'Déjeuner',
      amount: 15,
      currency: 'EUR',
      paidBy: aliceId,
      paidAt: new Date('2026-05-09T08:00:00Z'),
      split: { mode: 'equal', beneficiaries: [aliceId, bobId] },
      createdAt: new Date('2026-05-09T08:00:00Z'),
    };
    const expenseMiddle: Expense = {
      id: 'exp-middle',
      groupId: groupIdA,
      description: 'Collation',
      amount: 10,
      currency: 'EUR',
      paidBy: bobId,
      paidAt: new Date('2026-05-09T12:00:00Z'),
      split: { mode: 'equal', beneficiaries: [aliceId, bobId] },
      createdAt: new Date('2026-05-09T12:00:00Z'),
    };
    const expenseEnd: Expense = {
      id: 'exp-end',
      groupId: groupIdA,
      description: 'Dîner',
      amount: 20,
      currency: 'EUR',
      paidBy: aliceId,
      paidAt: new Date('2026-05-09T18:00:00Z'),
      split: { mode: 'equal', beneficiaries: [aliceId, bobId] },
      createdAt: new Date('2026-05-09T18:00:00Z'),
    };

    await repository.save(expenseStart);
    await repository.save(expenseMiddle);
    await repository.save(expenseEnd);

    const results = await repository.findInDateRange(
      groupIdA,
      new Date('2026-05-09T08:00:00Z'),
      new Date('2026-05-09T18:00:00Z'),
    );

    expect(results).toEqual([expenseEnd, expenseMiddle, expenseStart]);
  });

  it('rejects duplicate expenses with the unique constraint', async () => {
    await insertGroupAndMembers(groupIdA, [aliceId, bobId]);

    const expense: Expense = {
      id: 'exp-unique-1',
      groupId: groupIdA,
      description: 'Billet',
      amount: 50,
      currency: 'EUR',
      paidBy: aliceId,
      paidAt: new Date('2026-05-09T14:00:00Z'),
      split: { mode: 'equal', beneficiaries: [aliceId, bobId] },
      createdAt: new Date('2026-05-09T14:00:00Z'),
    };

    await repository.save(expense);

    const duplicate: Expense = {
      ...expense,
      id: 'exp-unique-2',
    };

    await expect(repository.save(duplicate)).rejects.toThrow();
    expect(await countExpenses()).toBe(1);
  });

  it('rolls back when a transaction fails and leaves no expense saved', async () => {
    await insertGroupAndMembers(groupIdA, [aliceId, bobId]);

    const invalidExpense: Expense = {
      id: 'exp-bad',
      groupId: groupIdA,
      description: 'Mauvaise dépense',
      amount: 10,
      currency: 'EUR',
      paidBy: 'unknown-member',
      paidAt: new Date('2026-05-09T14:00:00Z'),
      split: { mode: 'equal', beneficiaries: ['unknown-member'] },
      createdAt: new Date('2026-05-09T14:00:00Z'),
    };

    await expect(repository.save(invalidExpense)).rejects.toThrow();
    expect(await countExpenses()).toBe(0);
  });
});
