export interface UserRow {
  readonly id: string
  readonly email: string
  readonly name: string
}

/**
 * Builds test user rows. Auth users are not tenant-scoped —
 * tenant association is handled via MembershipBuilder instead.
 */
export class UserBuilder {
  private data: UserRow = {
    id: crypto.randomUUID(),
    email: `user-${crypto.randomUUID().slice(0, 8)}@test.com`,
    name: 'Test User',
  }

  withId(id: string): this {
    this.data = { ...this.data, id }
    return this
  }

  withEmail(email: string): this {
    this.data = { ...this.data, email }
    return this
  }

  withName(name: string): this {
    this.data = { ...this.data, name }
    return this
  }

  build(): UserRow {
    return { ...this.data }
  }
}
