import { Page } from '@playwright/test';
import { env } from '../support/env';

export class StorefrontLoginModal {
  constructor(private page: Page) {}

  async open(url: string = env.storefrontUrl()) {
    await this.page.goto(url);
    await this.page.getByRole('button', { name: 'Sign in', exact: true }).click();
  }

  async login(email: string, password: string) {
    await this.page.getByPlaceholder('Enter your email address').fill(email);
    await this.page.getByPlaceholder('Enter your password').fill(password);
    // getByRole name matching is case-insensitive substring matching by default, so an
    // unscoped 'Sign In' would collide with the header's 'Sign in' trigger button (same
    // locator to Playwright). The site has no role="dialog" wrapper around the login
    // modal, so scope to the modal's own <form> — verified against the live site that it's
    // the only <form> containing a "Sign In" submit button — plus exact match as a second
    // layer of defense against the case-insensitive collision.
    await this.page
      .locator('form')
      .getByRole('button', { name: 'Sign In', exact: true })
      .click();
  }
}
