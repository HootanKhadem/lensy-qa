import { Page } from '@playwright/test';
import { env } from '../support/env';

export class AdminLoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto(env.adminUrl());
  }

  async login(email: string, password: string) {
    await this.page.getByPlaceholder('Enter your email').fill(email);
    await this.page.getByPlaceholder('Enter your password').fill(password);
    await this.page.getByRole('button', { name: 'Sign In' }).click();
  }
}
