import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Verifier } from '@pact-foundation/pact';
import { createApp } from '../../src/server';

const __dirname = dirname(fileURLToPath(import.meta.url));

let container: PostgreSqlContainer;
let pool: Pool;
let server: any;
let serverUrl: string;

async function setupState(state: string) {
  if (state === 'group-1 a 3 membres et 2 dépenses') {
    await pool.query('TRUNCATE expenses CASCADE');
    await pool.query('TRUNCATE members CASCADE');
    await pool.query('TRUNCATE groups CASCADE');

    await pool.query(
      'INSERT INTO groups (id, name, currency) VALUES ($1, $2, $3)',
      ['group-1', 'Test Group', 'EUR'],
    );

    const memberIds = ['alice', 'bob', 'carol'];
    for (const memberId of memberIds) {
      await pool.query(
        'INSERT INTO members (id, group_id, name, email) VALUES ($1, $2, $3, $4)',
        [memberId, 'group-1', `Member ${memberId}`, `${memberId}@example.com`],
      );
    }

    const now = new Date();
    await pool.query(
      `INSERT INTO expenses (
         id, group_id, description, amount, currency,
         paid_by, paid_at, split_mode, split_data, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        'exp-1',
        'group-1',
        'Dinner',
        60,
        'EUR',
        'alice',
        now,
        'equal',
        JSON.stringify({ mode: 'equal', beneficiaries: ['alice', 'bob', 'carol'] }),
        now,
      ],
    );

    await pool.query(
      `INSERT INTO expenses (
         id, group_id, description, amount, currency,
         paid_by, paid_at, split_mode, split_data, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        'exp-2',
        'group-1',
        'Lunch',
        30,
        'EUR',
        'bob',
        new Date(now.getTime() + 3600000),
        'equal',
        JSON.stringify({ mode: 'equal', beneficiaries: ['alice', 'bob'] }),
        new Date(now.getTime() + 3600000),
      ],
    );
  } else if (state === 'aucun groupe inexistant') {
    await pool.query('TRUNCATE expenses CASCADE');
    await pool.query('TRUNCATE members CASCADE');
    await pool.query('TRUNCATE groups CASCADE');
  }
}

describe('Balances API - Provider', () => {
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

    const app = createApp(pool);
    server = app.listen(3001, 'localhost', () => {
      serverUrl = 'http://localhost:3001';
    });

    return new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });
  }, 120_000);

  afterAll(async () => {
    if (server) {
      server.close();
    }
    if (pool) {
      await pool.end();
    }
    if (container) {
      await container.stop();
    }
  });

  it('verifies provider fulfills the contract', async () => {
    const verifier = new Verifier({
      provider: 'splitto-api',
      providerBaseUrl: serverUrl,
      pactFiles: ['./pacts/splitto-frontend-splitto-api.json'],
      stateHandlers: {
        'group-1 a 3 membres et 2 dépenses': async () => {
          await setupState('group-1 a 3 membres et 2 dépenses');
        },
        'aucun groupe inexistant': async () => {
          await setupState('aucun groupe inexistant');
        },
      },
    });

    await verifier.verifyProvider();
  });
});
