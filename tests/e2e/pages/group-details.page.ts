import { Page } from '@playwright/test';

export class GroupDetailsPage {
  constructor(private page: Page) {}

  async goto(groupId: string) {
    await this.page.goto(`http://localhost:3000/groups/${groupId}`);
  }

  async clickAddExpenseButton() {
    await this.page.getByRole('button', { name: /ajouter une dépense|add expense/i }).click();
  }

  async fillExpenseForm(expense: {
    description: string;
    amount: number;
    paidBy: string;
    beneficiaries: string[];
  }) {
    await this.page.getByLabel(/description/i).fill(expense.description);
    await this.page.getByLabel(/montant|amount/i).fill(String(expense.amount));

    const payerLabel = expense.paidBy[0].toUpperCase() + expense.paidBy.slice(1);
    await this.page.getByLabel(/payé par|paid by/i).selectOption({ label: payerLabel });

    for (const beneficiary of expense.beneficiaries) {
      const checkbox = this.page.getByRole('checkbox', { name: new RegExp(beneficiary, 'i') });
      await checkbox.check();
    }
  }

  async clickAddExpenseFormButton() {
    await this.page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  }

  async getExpenseItem(description: string) {
    return this.page.getByTestId(`expense-${description}`) || this.page.getByText(description).first();
  }

  async isExpenseVisible(description: string) {
    return (await this.getExpenseItem(description)) !== null;
  }

  async getBalanceForMember(memberId: string) {
    const balanceText = await this.page.getByTestId(`balance-${memberId}`).textContent();
    return balanceText ? parseFloat(balanceText) : null;
  }

  async clickSettleButton(from: string, to: string) {
    this.page.once('dialog', dialog => dialog.accept());
    const settlement = this.page.getByTestId(`settlement-${from}-to-${to}`);
    await settlement.getByRole('button', { name: /régler|settle/i }).click();
  }

  async confirmSettlement() {
    // Le dialog natif est accepté automatiquement dans clickSettleButton
  }

  async isSettlementVisible(from: string, to: string) {
    return this.page.getByTestId(`settlement-${from}-to-${to}`).isVisible();
  }
}
