import { Page } from '@playwright/test';
import { env } from '../support/env';

export class StorefrontLoginModal {
  constructor(private page: Page) {}

  async open(url: string = env.storefrontUrl()) {
    await this.page.goto(url);
    await this.page.getByRole('button', { name: 'Sign in' }).click();
  }

  async login(email: string, password: string) {
    await this.page.getByPlaceholder('Enter your email address').fill(email);
    await this.page.getByPlaceholder('Enter your password').fill(password);
    await this.page.getByRole('button', { name: 'Sign In' }).click();
  }
}
