import { Page } from '@playwright/test';

export class GroupsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('http://localhost:3000');
  }

  async clickCreateGroupButton() {
    await this.page.getByRole('button', { name: 'Nouveau groupe' }).click();
  }

  async clickAddGroupButton() {
    await this.page.getByRole('button', { name: 'Créer' }).click();
  }

  async fillGroupForm(name: string, members: Array<{ name: string; email: string }>) {
    await this.page.getByLabel(/nom du groupe/i).fill(name);
    const membersText = members.map(m => `${m.name} <${m.email}>`).join('\n');
    await this.page.getByLabel(/membres/i).fill(membersText);
  }

  async clickGroupByName(groupName: string) {
    await this.page.getByText(groupName).first().click();
  }

  async isGroupVisible(groupName: string) {
    return this.page.getByText(groupName).first().isVisible();
  }
}
