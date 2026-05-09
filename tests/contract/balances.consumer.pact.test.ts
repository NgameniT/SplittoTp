import { describe, it, expect, beforeAll } from 'vitest';
import { PactV3 } from '@pact-foundation/pact';

let pact: PactV3;

describe('Balances API - Consumer', () => {
  beforeAll(() => {
    pact = new PactV3({
      consumer: 'splitto-frontend',
      provider: 'splitto-api',
      dir: './pacts',
    });
  });

  it('retrieves balances for an existing group with expenses', async () => {
    await pact
      .addInteraction({
        states: [{ description: 'group-1 a 3 membres et 2 dépenses' }],
        uponReceiving: 'a request for balances of group-1',
        withRequest: {
          method: 'GET',
          path: '/api/groups/group-1/balances',
        },
        willRespondWith: {
          status: 200,
          body: {
            groupId: 'group-1',
            balances: {
              alice: 20,
              bob: -10,
              carol: -10,
            },
            settlements: [
              {
                from: 'bob',
                to: 'alice',
                amount: 10,
              },
              {
                from: 'carol',
                to: 'alice',
                amount: 10,
              },
            ],
          },
        },
      })
      .executeTest(async (mockServer) => {
        const res = await fetch(`${mockServer.url}/api/groups/group-1/balances`);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.groupId).toBe('group-1');
        expect(data.balances).toBeDefined();
        expect(data.settlements).toBeDefined();
      });
  });

  it('returns 404 for a non-existent group', async () => {
    await pact
      .addInteraction({
        states: [{ description: 'aucun groupe inexistant' }],
        uponReceiving: 'a request for balances of a non-existent group',
        withRequest: {
          method: 'GET',
          path: '/api/groups/inexistant/balances',
        },
        willRespondWith: {
          status: 404,
          body: {
            error: 'Group not found',
          },
        },
      })
      .executeTest(async (mockServer) => {
        const res = await fetch(`${mockServer.url}/api/groups/inexistant/balances`);
        expect(res.status).toBe(404);
        const data = await res.json();
        expect(data.error).toBeDefined();
      });
  });
});

