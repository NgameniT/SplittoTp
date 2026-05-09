import { test, expect } from '@playwright/test';
import { GroupsPage } from './pages/groups.page';
import { GroupDetailsPage } from './pages/group-details.page';

test.describe('Splitto E2E', () => {
  let groupsPage: GroupsPage;
  let groupDetailsPage: GroupDetailsPage;

  test.beforeEach(async ({ page, context }) => {
    // Reset state before each test
    await fetch('http://localhost:3000/_test/reset', { method: 'POST' });

    groupsPage = new GroupsPage(page);
    groupDetailsPage = new GroupDetailsPage(page);

    await groupsPage.goto();
  });

  test('scenario 1: create a group with 3 members', async ({ page }) => {
    await groupsPage.clickCreateGroupButton();

    await groupsPage.fillGroupForm('Vacances été', [
      { name: 'Alice', email: 'alice@example.com' },
      { name: 'Bob', email: 'bob@example.com' },
      { name: 'Carol', email: 'carol@example.com' },
    ]);

    await groupsPage.clickAddGroupButton();

    // Verify the group appears in the list
    const groupLink = page.getByText('Vacances été');
    await expect(groupLink).toBeVisible();
  });

  test('scenario 2: add an expense to a group', async ({ page }) => {
    // First create a group
    await groupsPage.clickCreateGroupButton();
    await groupsPage.fillGroupForm('Weekend', [
      { name: 'Alice', email: 'alice@example.com' },
      { name: 'Bob', email: 'bob@example.com' },
    ]);
    await groupsPage.clickAddGroupButton();

    // Navigate to group details
    await expect(page.getByText('Weekend')).toBeVisible();
    await groupsPage.clickGroupByName('Weekend');

    // Add an expense
    await groupDetailsPage.clickAddExpenseButton();
    await groupDetailsPage.fillExpenseForm({
      description: 'Restaurant',
      amount: 50,
      paidBy: 'alice',
      beneficiaries: ['alice', 'bob'],
    });
    await groupDetailsPage.clickAddExpenseFormButton();

    // Verify expense is visible
    const expenseText = page.getByText('Restaurant');
    await expect(expenseText).toBeVisible();
  });

  test('scenario 3: verify balances after adding an expense', async ({ page }) => {
    // Setup: create group and add expense
    await groupsPage.clickCreateGroupButton();
    await groupsPage.fillGroupForm('Dîner', [
      { name: 'Alice', email: 'alice@example.com' },
      { name: 'Bob', email: 'bob@example.com' },
      { name: 'Carol', email: 'carol@example.com' },
    ]);
    await groupsPage.clickAddGroupButton();

    await expect(page.getByText('Dîner')).toBeVisible();
    await groupsPage.clickGroupByName('Dîner');

    // Add expense: Alice pays 30€ for 3 people
    await groupDetailsPage.clickAddExpenseButton();
    await groupDetailsPage.fillExpenseForm({
      description: 'Dîner restaurant',
      amount: 30,
      paidBy: 'alice',
      beneficiaries: ['alice', 'bob', 'carol'],
    });
    await groupDetailsPage.clickAddExpenseFormButton();

    // Attendre que la dépense apparaisse dans la liste (page rechargée)
    await expect(page.getByText('Dîner restaurant')).toBeVisible();

    // Verify balances appear
    await expect(page.getByTestId('balance-alice')).toBeVisible();
    const aliceBalance = await groupDetailsPage.getBalanceForMember('alice');
    const bobBalance = await groupDetailsPage.getBalanceForMember('bob');
    const carolBalance = await groupDetailsPage.getBalanceForMember('carol');

    expect(aliceBalance).toBe(20);
    expect(bobBalance).toBe(-10);
    expect(carolBalance).toBe(-10);
  });

  test('scenario 4: mark a settlement as resolved', async ({ page }) => {
    // Setup: create group with expense that creates a settlement
    await groupsPage.clickCreateGroupButton();
    await groupsPage.fillGroupForm('Projet', [
      { name: 'Alice', email: 'alice@example.com' },
      { name: 'Bob', email: 'bob@example.com' },
    ]);
    await groupsPage.clickAddGroupButton();

    await expect(page.getByText('Projet')).toBeVisible();
    await groupsPage.clickGroupByName('Projet');

    // Add expense: Alice pays 40€ for both
    await groupDetailsPage.clickAddExpenseButton();
    await groupDetailsPage.fillExpenseForm({
      description: 'Matériel',
      amount: 40,
      paidBy: 'alice',
      beneficiaries: ['alice', 'bob'],
    });
    await groupDetailsPage.clickAddExpenseFormButton();

    // Settlement should exist: Bob owes 20€ to Alice
    await expect(page.getByTestId('settlement-bob-to-alice')).toBeVisible();

    // Mark settlement as resolved
    await groupDetailsPage.clickSettleButton('bob', 'alice');
    await groupDetailsPage.confirmSettlement();

    // Settlement should no longer be visible
    await expect(page.getByTestId('settlement-bob-to-alice')).not.toBeVisible();
  });
});
