// src/infrastructure/pg-expense.repository.ts
//
// EXERCICE 4 — À COMPLÉTER
//
// Implémentation Postgres du ExpenseRepository.
// À tester avec Testcontainers (voir SUJET.md exercice 4).

import type { Pool } from 'pg';
import type { Expense } from '../domain/types';
import type { ExpenseRepository } from '../ports/expense.repository';

function mapRowToExpense(row: any): Expense {
  return {
    id: row.id,
    groupId: row.group_id,
    description: row.description,
    amount: Number(row.amount),
    currency: row.currency,
    paidBy: row.paid_by,
    paidAt: row.paid_at,
    split: row.split_data as Expense['split'],
    category: row.category ?? undefined,
    createdAt: row.created_at,
  };
}

export class PgExpenseRepository implements ExpenseRepository {
  constructor(private readonly pool: Pool) {}

  async save(expense: Expense): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO expenses (
           id, group_id, description, amount, currency,
           paid_by, paid_at, split_mode, split_data, category, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          expense.id,
          expense.groupId,
          expense.description,
          expense.amount,
          expense.currency,
          expense.paidBy,
          expense.paidAt,
          expense.split.mode,
          expense.split,
          expense.category ?? null,
          expense.createdAt,
        ],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<Expense | null> {
    const result = await this.pool.query(
      `SELECT id, group_id, description, amount, currency,
              paid_by, paid_at, split_mode, split_data, category, created_at
         FROM expenses
        WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapRowToExpense(result.rows[0]);
  }

  async findByGroupId(groupId: string): Promise<Expense[]> {
    const result = await this.pool.query(
      `SELECT id, group_id, description, amount, currency,
              paid_by, paid_at, split_mode, split_data, category, created_at
         FROM expenses
        WHERE group_id = $1
        ORDER BY paid_at DESC`,
      [groupId],
    );

    return result.rows.map(mapRowToExpense);
  }

  async findInDateRange(
    groupId: string,
    from: Date,
    to: Date,
  ): Promise<Expense[]> {
    const result = await this.pool.query(
      `SELECT id, group_id, description, amount, currency,
              paid_by, paid_at, split_mode, split_data, category, created_at
         FROM expenses
        WHERE group_id = $1
          AND paid_at >= $2
          AND paid_at <= $3
        ORDER BY paid_at DESC`,
      [groupId, from, to],
    );

    return result.rows.map(mapRowToExpense);
  }
}
